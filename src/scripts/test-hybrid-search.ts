/**
 * Hybrid Search Integration Test
 * 
 * Tests the hybrid search functionality including Portuguese query support
 */

import { createDatabaseAdapter } from '../database/database-adapter';
import { HybridSearchEngine } from '../search/hybrid-search-engine';
import { EmbeddingService } from '../search/embedding-service';
import { VectorRepository } from '../search/vector-repository';
import { RRFFusion } from '../search/rrf-fusion';
import { CohereReranker } from '../search/cohere-reranker';
import { DatabaseMigrationUtils } from '../database/migration-utils';
import { logger } from '../utils/logger';
import { existsSync } from 'fs';
import path from 'path';

interface TestResult {
  query: string;
  expectedNodes: string[];
  actualNodes: string[];
  success: boolean;
  score: number;
  searchEngine: string;
  responseTime: number;
  error?: string;
}

const TEST_QUERIES = [
  {
    query: 'enviar mensagem para equipe',
    expectedNodes: ['slack', 'teams', 'discord', 'email'],
    description: 'Portuguese query for sending messages to team'
  },
  {
    query: 'build a chatbot',
    expectedNodes: ['webhook', 'openai', 'ai', 'response'],
    description: 'English intent-based query for building chatbot'
  },
  {
    query: 'automatizar vendas',
    expectedNodes: ['http', 'webhook', 'crm', 'email'],
    description: 'Portuguese query for sales automation'
  },
  {
    query: 'process csv data',
    expectedNodes: ['csv', 'transform', 'filter', 'set'],
    description: 'English query for CSV processing'
  },
  {
    query: 'conectar com banco de dados',
    expectedNodes: ['postgres', 'mysql', 'mongodb', 'redis'],
    description: 'Portuguese query for database connection'
  },
  {
    query: 'schedule workflow',
    expectedNodes: ['cron', 'schedule', 'interval', 'trigger'],
    description: 'English query for workflow scheduling'
  }
];

async function runHybridSearchTests(): Promise<void> {
  logger.info('🚀 Starting Hybrid Search Integration Tests');
  
  try {
    // Initialize database and search engine
    const { hybridSearchEngine, isReady } = await initializeSearchEngine();
    
    if (!isReady) {
      logger.error('Hybrid search engine not ready for testing');
      return;
    }

    // Run test queries
    const results: TestResult[] = [];
    
    for (const testCase of TEST_QUERIES) {
      logger.info(`\n📋 Testing: ${testCase.description}`);
      logger.info(`Query: "${testCase.query}"`);
      
      const testResult = await runSingleTest(hybridSearchEngine, testCase);
      results.push(testResult);
      
      // Log results
      if (testResult.success) {
        logger.info(`✅ Test passed (score: ${testResult.score.toFixed(2)}, ${testResult.responseTime}ms)`);
      } else {
        logger.error(`❌ Test failed (score: ${testResult.score.toFixed(2)}, ${testResult.responseTime}ms)`);
        if (testResult.error) {
          logger.error(`Error: ${testResult.error}`);
        }
      }
      
      logger.info(`Expected nodes: ${testResult.expectedNodes.join(', ')}`);
      logger.info(`Found nodes: ${testResult.actualNodes.join(', ')}`);
    }

    // Generate summary report
    generateSummaryReport(results);

  } catch (error) {
    logger.error('Test setup failed:', error);
    process.exit(1);
  }
}

async function initializeSearchEngine(): Promise<{
  hybridSearchEngine: HybridSearchEngine;
  isReady: boolean;
}> {
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
  
  // Check if semantic search is ready
  const isSemanticReady = await migrationUtils.isSemanticSearchReady();
  
  if (!isSemanticReady) {
    logger.info('Database not ready for semantic search, running with FTS5 only');
  }

  // Initialize hybrid search components
  const embeddingService = new EmbeddingService();
  const vectorRepository = new VectorRepository(db);
  const rrfFusion = new RRFFusion({ k: 60 });
  const cohereReranker = new CohereReranker();

  // Initialize hybrid search engine
  const hybridSearchEngine = new HybridSearchEngine(db, {
    embeddingService,
    vectorRepository,
    rrfFusion,
    cohereReranker,
    enableCache: false, // Disable cache for testing
    defaultOptions: {
      limit: 10,
      rrfK: 60,
      enableReranking: true,
      searchMethods: ['fts5', 'vector']
    }
  });

  // Check if hybrid search is ready
  const searchStatus = await hybridSearchEngine.isReady();
  
  logger.info('Search engine status:', searchStatus);
  
  return {
    hybridSearchEngine,
    isReady: searchStatus.overall || searchStatus.fts5 // Accept FTS5-only for testing
  };
}

async function runSingleTest(
  hybridSearchEngine: HybridSearchEngine,
  testCase: any
): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    // Execute search
    const searchResults = await hybridSearchEngine.search(testCase.query, {
      limit: 10,
      rrfK: 60,
      enableReranking: true,
      searchMethods: ['fts5', 'vector']
    });

    const responseTime = Date.now() - startTime;
    
    // Extract node types from results
    const actualNodes = searchResults.map(result => {
      const nodeType = result.nodeType.toLowerCase();
      // Extract base node name (remove prefixes and suffixes)
      return nodeType
        .replace(/^nodes-base\./, '')
        .replace(/^nodes-langchain\./, '')
        .replace(/^template:/, '');
    });

    // Calculate relevance score
    const score = calculateRelevanceScore(testCase.expectedNodes, actualNodes);
    
    // Determine if test passed (score >= 0.3 means at least some expected nodes found)
    const success = score >= 0.3;

    return {
      query: testCase.query,
      expectedNodes: testCase.expectedNodes,
      actualNodes: actualNodes.slice(0, 5), // Show top 5 results
      success,
      score,
      searchEngine: searchResults.length > 0 ? searchResults[0].searchMethod || 'unknown' : 'none',
      responseTime
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    return {
      query: testCase.query,
      expectedNodes: testCase.expectedNodes,
      actualNodes: [],
      success: false,
      score: 0,
      searchEngine: 'error',
      responseTime,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function calculateRelevanceScore(expectedNodes: string[], actualNodes: string[]): number {
  if (expectedNodes.length === 0) return 0;
  
  let matches = 0;
  
  for (const expected of expectedNodes) {
    const found = actualNodes.some(actual => 
      actual.includes(expected.toLowerCase()) || 
      expected.toLowerCase().includes(actual)
    );
    
    if (found) {
      matches++;
    }
  }
  
  return matches / expectedNodes.length;
}

function generateSummaryReport(results: TestResult[]): void {
  const totalTests = results.length;
  const passedTests = results.filter(r => r.success).length;
  const failedTests = totalTests - passedTests;
  
  const averageScore = results.reduce((sum, r) => sum + r.score, 0) / totalTests;
  const averageResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / totalTests;
  
  const searchEngineUsage = results.reduce((acc, r) => {
    acc[r.searchEngine] = (acc[r.searchEngine] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  logger.info('\n📊 Test Summary Report');
  logger.info('='.repeat(50));
  logger.info(`Total Tests: ${totalTests}`);
  logger.info(`Passed: ${passedTests} (${((passedTests / totalTests) * 100).toFixed(1)}%)`);
  logger.info(`Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);
  logger.info(`Average Score: ${averageScore.toFixed(3)}`);
  logger.info(`Average Response Time: ${averageResponseTime.toFixed(0)}ms`);
  logger.info('\nSearch Engine Usage:');
  
  Object.entries(searchEngineUsage).forEach(([engine, count]) => {
    logger.info(`  ${engine}: ${count} tests`);
  });

  logger.info('\nDetailed Results:');
  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    logger.info(`${status} Test ${index + 1}: "${result.query}" (${result.score.toFixed(2)}, ${result.responseTime}ms)`);
  });

  // Check Portuguese query support specifically
  const portugueseQueries = results.filter(r => 
    r.query.includes('enviar') || 
    r.query.includes('automatizar') || 
    r.query.includes('conectar')
  );
  
  const portugueseSuccess = portugueseQueries.filter(r => r.success).length;
  const portugueseTotal = portugueseQueries.length;
  
  logger.info(`\n🇵🇹 Portuguese Query Support: ${portugueseSuccess}/${portugueseTotal} (${((portugueseSuccess / portugueseTotal) * 100).toFixed(1)}%)`);
  
  if (passedTests >= Math.ceil(totalTests * 0.7)) {
    logger.info('\n🎉 Overall Test Result: PASSED');
  } else {
    logger.info('\n❌ Overall Test Result: FAILED');
  }
}

// CLI interface
if (require.main === module) {
  runHybridSearchTests()
    .then(() => {
      logger.info('\n✅ Test suite completed');
      process.exit(0);
    })
    .catch(error => {
      logger.error('Test suite failed:', error);
      process.exit(1);
    });
}