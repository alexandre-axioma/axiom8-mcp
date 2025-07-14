#!/usr/bin/env node
/**
 * Comprehensive Pre-Embedding Validation Script
 * 
 * This script performs 100% validation before any embedding generation.
 * It ensures complete data quality and prevents costly embedding failures.
 * 
 * CRITICAL: This script MUST pass 100% before embedding generation is allowed.
 */

import dotenv from 'dotenv';
import { createDatabaseAdapter } from '../database/database-adapter';
import { DatabaseMigrationUtils } from '../database/migration-utils';
import { EmbeddingService } from '../search/embedding-service';
import { VectorRepository } from '../search/vector-repository';
import { logger } from '../utils/logger';
import { existsSync } from 'fs';
import path from 'path';
import crypto from 'crypto';

interface ValidationReport {
  passed: boolean;
  summary: {
    totalNodes: number;
    nodesWithDocumentation: number;
    documentationCoveragePercent: number;
    criticalNodesFound: number;
    totalTemplates: number;
    estimatedEmbeddingCost: number;
    estimatedTokens: number;
  };
  criticalIssues: string[];
  warnings: string[];
  recommendations: string[];
  backupCreated: boolean;
  backupPath?: string;
}

interface NodeValidationResult {
  nodeType: string;
  hasDocumentation: boolean;
  documentationLength: number;
  contentQuality: 'excellent' | 'good' | 'minimal' | 'empty';
  embeddingContent: string;
  estimatedTokens: number;
}

class PreEmbeddingValidator {
  private db: any;
  private vectorRepository!: VectorRepository;
  private embeddingService!: EmbeddingService;
  private migrationUtils!: DatabaseMigrationUtils;

  // Critical nodes that MUST have documentation
  private readonly CRITICAL_NODES = [
    'nodes-base.httpRequest',
    'nodes-base.webhook', 
    'nodes-base.code',
    'nodes-base.slack',
    'nodes-base.gmail',
    'nodes-base.googleSheets',
    'nodes-base.openAi',
    'nodes-base.set',
    'nodes-base.if',
    'nodes-base.switch'
  ];

  // Minimum documentation length for quality content
  private readonly MIN_DOC_LENGTH = 100;
  private readonly GOOD_DOC_LENGTH = 500;
  private readonly EXCELLENT_DOC_LENGTH = 1000;

  constructor(dbPath: string) {
    // Will be initialized in init()
  }

  async init(dbPath: string): Promise<void> {
    this.db = await createDatabaseAdapter(dbPath);
    this.vectorRepository = new VectorRepository(this.db);
    this.embeddingService = new EmbeddingService();
    this.migrationUtils = new DatabaseMigrationUtils(this.db);
  }

  /**
   * Main validation function - MUST pass 100%
   */
  async validateAll(): Promise<ValidationReport> {
    logger.info('🔍 Starting comprehensive pre-embedding validation...');
    
    const report: ValidationReport = {
      passed: false,
      summary: {
        totalNodes: 0,
        nodesWithDocumentation: 0,
        documentationCoveragePercent: 0,
        criticalNodesFound: 0,
        totalTemplates: 0,
        estimatedEmbeddingCost: 0,
        estimatedTokens: 0
      },
      criticalIssues: [],
      warnings: [],
      recommendations: [],
      backupCreated: false
    };

    try {
      // 1. Database structure validation
      await this.validateDatabaseStructure(report);
      
      // 2. API configuration validation
      await this.validateApiConfiguration(report);
      
      // 3. Create mandatory backup
      await this.createBackup(report);
      
      // 4. Node content validation
      await this.validateNodeContent(report);
      
      // 5. Template content validation
      await this.validateTemplateContent(report);
      
      // 6. Cost estimation and approval
      await this.calculateCostEstimation(report);
      
      // 7. Final validation decision
      this.makeFinalValidationDecision(report);
      
    } catch (error) {
      report.criticalIssues.push(`Validation failed with error: ${error instanceof Error ? error.message : String(error)}`);
    }

    return report;
  }

  private async validateDatabaseStructure(report: ValidationReport): Promise<void> {
    logger.info('📊 Validating database structure...');
    
    // Check if semantic search schema is ready
    const isSemanticReady = await this.migrationUtils.isSemanticSearchReady();
    if (!isSemanticReady) {
      report.criticalIssues.push('Semantic search schema not found. Run semantic migration first.');
      return;
    }

    // Check basic node count
    const nodeCount = this.db.prepare('SELECT COUNT(*) as count FROM nodes').get();
    report.summary.totalNodes = nodeCount.count;
    
    if (nodeCount.count < 500) {
      report.criticalIssues.push(`Insufficient nodes in database: ${nodeCount.count}. Expected 500+.`);
    }

    // Check template count
    const templateCount = this.db.prepare('SELECT COUNT(*) as count FROM templates').get();
    report.summary.totalTemplates = templateCount.count;

    logger.info(`  ✓ Found ${nodeCount.count} nodes and ${templateCount.count} templates`);
  }

  private async validateApiConfiguration(report: ValidationReport): Promise<void> {
    logger.info('🔑 Validating API configuration...');
    
    // Validate OpenAI configuration
    const configValidation = EmbeddingService.validateConfig();
    if (!configValidation.valid) {
      report.criticalIssues.push(...configValidation.errors);
      return;
    }

    // Test OpenAI API connectivity with small sample
    try {
      const testResult = await this.embeddingService.getEmbedding('Test embedding connectivity');
      logger.info(`  ✓ OpenAI API test successful. Cost: $${testResult.cost.toFixed(6)}`);
    } catch (error) {
      report.criticalIssues.push(`OpenAI API test failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async createBackup(report: ValidationReport): Promise<void> {
    logger.info('💾 Creating mandatory backup...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `./data/nodes-backup-pre-embedding-${timestamp}.db`;
    
    try {
      // Create backup using database-specific method
      if (this.db.backup) {
        // better-sqlite3 method
        this.db.backup(backupPath);
      } else if (this.db.export) {
        // sql.js method - export and save
        const data = this.db.export();
        const fs = await import('fs');
        fs.writeFileSync(backupPath, data);
      } else {
        // Fallback: copy the database file
        const fs = await import('fs');
        const sourceDbPath = process.cwd() + '/data/nodes.db';
        fs.copyFileSync(sourceDbPath, backupPath);
      }
      
      report.backupCreated = true;
      report.backupPath = backupPath;
      logger.info(`  ✓ Backup created: ${backupPath}`);
    } catch (error) {
      report.criticalIssues.push(`Failed to create backup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async validateNodeContent(report: ValidationReport): Promise<void> {
    logger.info('📝 Validating node content quality...');
    
    // Get all nodes
    const nodes = this.db.prepare(`
      SELECT node_type, display_name, description, documentation, category, operations 
      FROM nodes
    `).all();

    let nodesWithDocs = 0;
    let criticalNodesFound = 0;
    const nodeValidations: NodeValidationResult[] = [];

    for (const node of nodes) {
      const validation = this.validateSingleNode(node);
      nodeValidations.push(validation);
      
      if (validation.hasDocumentation) {
        nodesWithDocs++;
      }
      
      if (this.CRITICAL_NODES.includes(validation.nodeType)) {
        criticalNodesFound++;
        
        if (!validation.hasDocumentation || validation.contentQuality === 'empty') {
          report.criticalIssues.push(`Critical node ${validation.nodeType} lacks sufficient documentation`);
        }
      }
    }

    // Check critical nodes coverage
    if (criticalNodesFound < this.CRITICAL_NODES.length) {
      report.criticalIssues.push(`Missing critical nodes: expected ${this.CRITICAL_NODES.length}, found ${criticalNodesFound}`);
    }

    // Calculate documentation coverage
    const coveragePercent = (nodesWithDocs / nodes.length) * 100;
    report.summary.nodesWithDocumentation = nodesWithDocs;
    report.summary.documentationCoveragePercent = coveragePercent;
    report.summary.criticalNodesFound = criticalNodesFound;

    if (coveragePercent < 75) {
      report.criticalIssues.push(`Documentation coverage too low: ${coveragePercent.toFixed(1)}%. Minimum required: 75%`);
    }

    // Validate content quality distribution
    const qualityCounts = nodeValidations.reduce((acc, val) => {
      acc[val.contentQuality] = (acc[val.contentQuality] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    if ((qualityCounts.empty || 0) > nodes.length * 0.2) {
      report.warnings.push(`High number of nodes with empty content: ${qualityCounts.empty || 0}`);
    }

    logger.info(`  ✓ Documentation coverage: ${coveragePercent.toFixed(1)}%`);
    logger.info(`  ✓ Content quality: ${qualityCounts.excellent || 0} excellent, ${qualityCounts.good || 0} good, ${qualityCounts.minimal || 0} minimal, ${qualityCounts.empty || 0} empty`);
  }

  private validateSingleNode(node: any): NodeValidationResult {
    const embeddingContent = EmbeddingService.prepareEmbeddingContent(node, 'node');
    const hasDocumentation = !!(node.documentation && node.documentation.trim().length > 0);
    const docLength = node.documentation ? node.documentation.length : 0;
    
    let contentQuality: NodeValidationResult['contentQuality'];
    if (docLength === 0) {
      contentQuality = 'empty';
    } else if (docLength < this.MIN_DOC_LENGTH) {
      contentQuality = 'minimal';
    } else if (docLength < this.GOOD_DOC_LENGTH) {
      contentQuality = 'good';
    } else {
      contentQuality = 'excellent';
    }

    // Rough token estimation (75 tokens per 100 characters)
    const estimatedTokens = Math.ceil(embeddingContent.content.length * 0.75);

    return {
      nodeType: node.node_type,
      hasDocumentation,
      documentationLength: docLength,
      contentQuality,
      embeddingContent: embeddingContent.content,
      estimatedTokens
    };
  }

  private async validateTemplateContent(report: ValidationReport): Promise<void> {
    logger.info('📋 Validating template content...');
    
    if (report.summary.totalTemplates === 0) {
      report.warnings.push('No templates found in database. Template embeddings will be skipped.');
      return;
    }

    // Sample a few templates to validate content quality
    const sampleTemplates = this.db.prepare(`
      SELECT id, name, description, workflow_json 
      FROM templates 
      LIMIT 10
    `).all();

    for (const template of sampleTemplates) {
      if (!template.name || template.name.trim().length === 0) {
        report.warnings.push(`Template ${template.id} has empty name`);
      }
      
      if (!template.description || template.description.trim().length < 20) {
        report.warnings.push(`Template ${template.id} has insufficient description`);
      }
    }

    logger.info(`  ✓ Template validation completed`);
  }

  private async calculateCostEstimation(report: ValidationReport): Promise<void> {
    logger.info('💰 Calculating embedding cost estimation...');
    
    // Get all content that will be embedded
    const nodes = this.db.prepare(`
      SELECT node_type, display_name, description, documentation, category, operations 
      FROM nodes 
      WHERE documentation IS NOT NULL AND length(trim(documentation)) > 0
    `).all();

    const templates = this.db.prepare(`
      SELECT id, name, description, categories
      FROM templates
    `).all();

    // Prepare embedding content
    const nodeContents = nodes.map((node: any) => 
      EmbeddingService.prepareEmbeddingContent(node, 'node').content
    );

    const templateContents = templates.map((template: any) => 
      EmbeddingService.prepareEmbeddingContent(template, 'template').content
    );

    // Calculate cost estimation
    const allContents = [...nodeContents, ...templateContents];
    const estimation = this.embeddingService.estimateCost(allContents);
    
    report.summary.estimatedTokens = estimation.estimatedTokens;
    report.summary.estimatedEmbeddingCost = estimation.estimatedCost;

    // Validate cost is reasonable
    if (estimation.estimatedCost > 20) {
      report.warnings.push(`High embedding cost estimated: $${estimation.estimatedCost.toFixed(2)}. Consider content optimization.`);
    }

    logger.info(`  ✓ Estimated cost: $${estimation.estimatedCost.toFixed(4)} for ${estimation.estimatedTokens} tokens`);
    logger.info(`  ✓ Content to embed: ${nodeContents.length} nodes, ${templateContents.length} templates`);
  }

  private makeFinalValidationDecision(report: ValidationReport): void {
    logger.info('🎯 Making final validation decision...');
    
    // Check if there are any critical issues
    if (report.criticalIssues.length > 0) {
      report.passed = false;
      logger.error('❌ Validation FAILED - Critical issues found:');
      report.criticalIssues.forEach(issue => logger.error(`  • ${issue}`));
      return;
    }

    // Check minimum requirements
    const requirements = [
      report.backupCreated,
      report.summary.totalNodes >= 500,
      report.summary.documentationCoveragePercent >= 75,
      report.summary.criticalNodesFound >= this.CRITICAL_NODES.length,
      report.summary.estimatedEmbeddingCost < 50 // Sanity check
    ];

    if (!requirements.every(req => req)) {
      report.passed = false;
      logger.error('❌ Validation FAILED - Minimum requirements not met');
      return;
    }

    // All checks passed
    report.passed = true;
    logger.info('✅ Validation PASSED - Ready for embedding generation!');
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
    }
  }
}

/**
 * Generate detailed validation report
 */
function generateReport(report: ValidationReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('📋 PRE-EMBEDDING VALIDATION REPORT');
  console.log('='.repeat(80));
  
  console.log('\n📊 SUMMARY:');
  console.log(`  Total Nodes: ${report.summary.totalNodes}`);
  console.log(`  Nodes with Documentation: ${report.summary.nodesWithDocumentation}`);
  console.log(`  Documentation Coverage: ${report.summary.documentationCoveragePercent.toFixed(1)}%`);
  console.log(`  Critical Nodes Found: ${report.summary.criticalNodesFound}`);
  console.log(`  Total Templates: ${report.summary.totalTemplates}`);
  console.log(`  Estimated Tokens: ${report.summary.estimatedTokens.toLocaleString()}`);
  console.log(`  Estimated Cost: $${report.summary.estimatedEmbeddingCost.toFixed(4)}`);
  console.log(`  Backup Created: ${report.backupCreated ? '✅' : '❌'}`);
  if (report.backupPath) {
    console.log(`  Backup Path: ${report.backupPath}`);
  }

  if (report.criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES:');
    report.criticalIssues.forEach(issue => console.log(`  ❌ ${issue}`));
  }

  if (report.warnings.length > 0) {
    console.log('\n⚠️  WARNINGS:');
    report.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
  }

  if (report.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    report.recommendations.forEach(rec => console.log(`  💡 ${rec}`));
  }

  console.log('\n' + '='.repeat(80));
  if (report.passed) {
    console.log('✅ VALIDATION PASSED - EMBEDDING GENERATION APPROVED');
    console.log('Run: npm run generate:embeddings');
  } else {
    console.log('❌ VALIDATION FAILED - EMBEDDING GENERATION BLOCKED');
    console.log('Fix the critical issues above before proceeding.');
  }
  console.log('='.repeat(80));
}

// CLI interface
if (require.main === module) {
  async function main() {
    // Load environment variables
    dotenv.config();
    
    // Find database
    const possiblePaths = [
      path.join(process.cwd(), 'data', 'nodes.db'),
      path.join(__dirname, '../../data', 'nodes.db'),
      './data/nodes.db'
    ];
    
    let dbPath: string | null = null;
    for (const p of possiblePaths) {
      if (existsSync(p)) {
        dbPath = p;
        break;
      }
    }
    
    if (!dbPath) {
      console.error('❌ Database not found. Please run npm run rebuild first.');
      process.exit(1);
    }

    const validator = new PreEmbeddingValidator(dbPath);
    
    try {
      await validator.init(dbPath);
      const report = await validator.validateAll();
      
      generateReport(report);
      
      // Exit with appropriate code
      process.exit(report.passed ? 0 : 1);
      
    } catch (error) {
      logger.error('Validation script failed:', error);
      process.exit(1);
    } finally {
      await validator.close();
    }
  }

  main();
}

export { PreEmbeddingValidator, ValidationReport, NodeValidationResult };