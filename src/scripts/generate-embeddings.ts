/**
 * Batch Embedding Generation Script
 * 
 * Generates embeddings for all nodes and templates in the database.
 * Follows existing script patterns from rebuild.ts
 */

import dotenv from 'dotenv';
import { createDatabaseAdapter } from '../database/database-adapter';
import { VectorRepository } from '../search/vector-repository';
import { EmbeddingService } from '../search/embedding-service';
import { DatabaseMigrationUtils } from '../database/migration-utils';
import { logger } from '../utils/logger';
import { existsSync } from 'fs';
import path from 'path';

interface EmbeddingStats {
  totalNodes: number;
  totalTemplates: number;
  processedNodes: number;
  processedTemplates: number;
  skippedNodes: number;
  skippedTemplates: number;
  failedNodes: number;
  failedTemplates: number;
  totalCost: number;
  totalTokens: number;
  processingTime: number;
}

export async function generateEmbeddingsForAllNodes(
  options: {
    forceRegenerate?: boolean;
    dryRun?: boolean;
    batchSize?: number;
    nodeTypes?: string[];
    templatesOnly?: boolean;
    nodesOnly?: boolean;
  } = {}
): Promise<EmbeddingStats> {
  
  const startTime = Date.now();
  const stats: EmbeddingStats = {
    totalNodes: 0,
    totalTemplates: 0,
    processedNodes: 0,
    processedTemplates: 0,
    skippedNodes: 0,
    skippedTemplates: 0,
    failedNodes: 0,
    failedTemplates: 0,
    totalCost: 0,
    totalTokens: 0,
    processingTime: 0
  };

  try {
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
      throw new Error('Database not found. Please run npm run rebuild first.');
    }

    // Initialize database and services
    const db = await createDatabaseAdapter(dbPath);
    const migrationUtils = new DatabaseMigrationUtils(db);
    const vectorRepository = new VectorRepository(db);
    const embeddingService = new EmbeddingService();

    // Check if semantic search is ready
    const isReady = await migrationUtils.isSemanticSearchReady();
    if (!isReady) {
      logger.info('Database not ready for semantic search, attempting migration...');
      const migrationResult = await migrationUtils.migrateToSemanticSearch({
        createBackup: true,
        forceReapply: false,
        dryRun: options.dryRun || false
      });
      
      if (!migrationResult.success) {
        throw new Error(`Migration failed: ${migrationResult.message}`);
      }
    }

    // Validate OpenAI configuration
    const configValidation = EmbeddingService.validateConfig();
    if (!configValidation.valid) {
      throw new Error(`Invalid configuration: ${configValidation.errors.join(', ')}`);
    }

    // Generate embeddings for nodes
    if (!options.templatesOnly) {
      logger.info('Processing nodes for embedding generation...');
      const nodeStats = await generateNodeEmbeddings(
        vectorRepository,
        embeddingService,
        options
      );
      
      stats.totalNodes = nodeStats.total;
      stats.processedNodes = nodeStats.processed;
      stats.skippedNodes = nodeStats.skipped;
      stats.failedNodes = nodeStats.failed;
      stats.totalCost += nodeStats.cost;
      stats.totalTokens += nodeStats.tokens;
    }

    // Generate embeddings for templates
    if (!options.nodesOnly) {
      logger.info('Processing templates for embedding generation...');
      const templateStats = await generateTemplateEmbeddings(
        vectorRepository,
        embeddingService,
        options
      );
      
      stats.totalTemplates = templateStats.total;
      stats.processedTemplates = templateStats.processed;
      stats.skippedTemplates = templateStats.skipped;
      stats.failedTemplates = templateStats.failed;
      stats.totalCost += templateStats.cost;
      stats.totalTokens += templateStats.tokens;
    }

    // Close database
    db.close();

    // Update final stats
    stats.processingTime = Date.now() - startTime;

    // Log final results
    logger.info('Embedding generation completed!');
    logger.info('Final Statistics:', {
      nodes: {
        total: stats.totalNodes,
        processed: stats.processedNodes,
        skipped: stats.skippedNodes,
        failed: stats.failedNodes
      },
      templates: {
        total: stats.totalTemplates,
        processed: stats.processedTemplates,
        skipped: stats.skippedTemplates,
        failed: stats.failedTemplates
      },
      cost: `$${stats.totalCost.toFixed(4)}`,
      tokens: stats.totalTokens,
      time: `${(stats.processingTime / 1000).toFixed(2)}s`
    });

    return stats;

  } catch (error) {
    logger.error('Embedding generation failed:', error);
    throw error;
  }
}

async function generateNodeEmbeddings(
  vectorRepository: VectorRepository,
  embeddingService: EmbeddingService,
  options: any
): Promise<{ total: number; processed: number; skipped: number; failed: number; cost: number; tokens: number }> {
  
  const stats = { total: 0, processed: 0, skipped: 0, failed: 0, cost: 0, tokens: 0 };
  
  // Get nodes that need embeddings
  const nodes = await vectorRepository.getNodesNeedingEmbeddings();
  stats.total = nodes.length;

  if (nodes.length === 0) {
    logger.info('No nodes need embedding generation');
    return stats;
  }

  // Filter by node types if specified
  let nodesToProcess = nodes;
  if (options.nodeTypes && options.nodeTypes.length > 0) {
    nodesToProcess = nodes.filter(node => 
      options.nodeTypes.includes(node.node_type)
    );
  }

  logger.info(`Processing ${nodesToProcess.length} nodes for embedding generation`);

  // Process nodes in batches
  const batchSize = options.batchSize || 50;
  const batches = [];
  
  for (let i = 0; i < nodesToProcess.length; i += batchSize) {
    batches.push(nodesToProcess.slice(i, i + batchSize));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    logger.info(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} nodes)`);

    if (options.dryRun) {
      logger.info('DRY RUN: Would process batch:', batch.map(n => n.node_type));
      stats.processed += batch.length;
      continue;
    }

    try {
      // Prepare content for embedding
      const contents = batch.map(node => 
        EmbeddingService.prepareEmbeddingContent(node, 'node')
      );

      // Skip if content already has embeddings and not forcing regeneration
      const contentsToProcess = [];
      const nodesToSave = [];
      
      for (let i = 0; i < contents.length; i++) {
        const content = contents[i];
        const node = batch[i];
        
        if (!options.forceRegenerate && node.current_hash === content.contentHash) {
          logger.debug(`Skipping ${node.node_type} - content unchanged`);
          stats.skipped++;
          continue;
        }
        
        contentsToProcess.push(content.content);
        nodesToSave.push({ node, content });
      }

      if (contentsToProcess.length === 0) {
        logger.debug('No nodes need processing in this batch');
        continue;
      }

      // Generate embeddings
      const batchResult = await embeddingService.generateEmbeddings(contentsToProcess);
      
      // Save embeddings
      const embeddingsToSave = [];
      for (let i = 0; i < batchResult.embeddings.length; i++) {
        const embedding = batchResult.embeddings[i];
        const { node, content } = nodesToSave[i];
        
        embeddingsToSave.push({
          nodeType: node.node_type,
          embedding,
          contentHash: content.contentHash,
          model: 'text-embedding-3-small'
        });
      }

      // Batch save to database
      await vectorRepository.batchSaveEmbeddings(embeddingsToSave);

      // Update stats
      stats.processed += embeddingsToSave.length;
      stats.cost += batchResult.totalCost;
      stats.tokens += batchResult.totalTokens;

      logger.info(`Batch ${batchIndex + 1} completed: ${embeddingsToSave.length} embeddings saved`);

    } catch (error) {
      logger.error(`Batch ${batchIndex + 1} failed:`, error);
      stats.failed += batch.length;
    }

    // Add delay between batches to respect rate limits
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return stats;
}

async function generateTemplateEmbeddings(
  vectorRepository: VectorRepository,
  embeddingService: EmbeddingService,
  options: any
): Promise<{ total: number; processed: number; skipped: number; failed: number; cost: number; tokens: number }> {
  
  const stats = { total: 0, processed: 0, skipped: 0, failed: 0, cost: 0, tokens: 0 };
  
  // Get templates that need embeddings
  const templates = await vectorRepository.getTemplatesNeedingEmbeddings();
  stats.total = templates.length;

  if (templates.length === 0) {
    logger.info('No templates need embedding generation');
    return stats;
  }

  logger.info(`Processing ${templates.length} templates for embedding generation`);

  // Process templates in batches
  const batchSize = options.batchSize || 50;
  const batches = [];
  
  for (let i = 0; i < templates.length; i += batchSize) {
    batches.push(templates.slice(i, i + batchSize));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    logger.info(`Processing template batch ${batchIndex + 1}/${batches.length} (${batch.length} templates)`);

    if (options.dryRun) {
      logger.info('DRY RUN: Would process template batch:', batch.map(t => t.id));
      stats.processed += batch.length;
      continue;
    }

    try {
      // Prepare content for embedding
      const contents = batch.map(template => 
        EmbeddingService.prepareEmbeddingContent(template, 'template')
      );

      // Skip if content already has embeddings and not forcing regeneration
      const contentsToProcess = [];
      const templatesToSave = [];
      
      for (let i = 0; i < contents.length; i++) {
        const content = contents[i];
        const template = batch[i];
        
        if (!options.forceRegenerate && template.current_hash === content.contentHash) {
          logger.debug(`Skipping template ${template.id} - content unchanged`);
          stats.skipped++;
          continue;
        }
        
        contentsToProcess.push(content.content);
        templatesToSave.push({ template, content });
      }

      if (contentsToProcess.length === 0) {
        logger.debug('No templates need processing in this batch');
        continue;
      }

      // Generate embeddings
      const batchResult = await embeddingService.generateEmbeddings(contentsToProcess);
      
      // Save embeddings
      for (let i = 0; i < batchResult.embeddings.length; i++) {
        const embedding = batchResult.embeddings[i];
        const { template, content } = templatesToSave[i];
        
        await vectorRepository.saveTemplateEmbedding(
          template.id,
          embedding,
          content.contentHash,
          'text-embedding-3-small'
        );
      }

      // Update stats
      stats.processed += batchResult.embeddings.length;
      stats.cost += batchResult.totalCost;
      stats.tokens += batchResult.totalTokens;

      logger.info(`Template batch ${batchIndex + 1} completed: ${batchResult.embeddings.length} embeddings saved`);

    } catch (error) {
      logger.error(`Template batch ${batchIndex + 1} failed:`, error);
      stats.failed += batch.length;
    }

    // Add delay between batches to respect rate limits
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return stats;
}

// CLI interface
if (require.main === module) {
  // Load environment variables
  dotenv.config();
  
  const options = {
    forceRegenerate: process.argv.includes('--force'),
    dryRun: process.argv.includes('--dry-run'),
    batchSize: process.argv.includes('--batch-size') ? 
      parseInt(process.argv[process.argv.indexOf('--batch-size') + 1]) || 50 : 50,
    templatesOnly: process.argv.includes('--templates-only'),
    nodesOnly: process.argv.includes('--nodes-only')
  };

  generateEmbeddingsForAllNodes(options)
    .then(stats => {
      process.exit(0);
    })
    .catch(error => {
      logger.error('Script failed:', error);
      process.exit(1);
    });
}