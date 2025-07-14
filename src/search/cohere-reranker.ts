/**
 * Cohere Reranker Service
 * 
 * Handles final re-ranking of search results using Cohere's multilingual rerank API.
 * Follows existing API client patterns with graceful degradation.
 */

import { SearchResult, CohereRerankOptions } from '../types/search-types';
import { logger } from '../utils/logger';

export class CohereReranker {
  private client: any = null;
  private model: string;
  private maxDocuments: number;
  private maxRetries: number;
  private baseDelayMs: number;
  
  // Cost tracking (approximate)
  private readonly costPerSearchUnit = 0.001; // Estimated cost per search unit

  constructor(
    model: string = 'rerank-multilingual-v3.0',
    maxDocuments: number = 1000,
    maxRetries: number = 3
  ) {
    this.model = model;
    this.maxDocuments = maxDocuments;
    this.maxRetries = maxRetries;
    this.baseDelayMs = 1000;
  }

  /**
   * Initialize Cohere client
   */
  private async initializeCohere(): Promise<void> {
    if (this.client) return;

    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) {
      throw new Error('COHERE_API_KEY environment variable is required');
    }

    try {
      // Use named import for cohere-ai v7+
      const { CohereClient } = await import('cohere-ai');
      this.client = new CohereClient({
        token: apiKey
      });
      logger.info('Cohere client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Cohere client:', error);
      throw new Error('Failed to initialize Cohere client. Make sure cohere-ai package is installed.');
    }
  }

  /**
   * Rerank search results using Cohere's multilingual rerank API
   */
  async rerank(
    query: string,
    documents: SearchResult[],
    options: CohereRerankOptions = {
      model: this.model,
      topN: 20,
      returnDocuments: false,
      maxChunksPerDoc: 10
    }
  ): Promise<SearchResult[]> {
    // Return original results if no documents or query
    if (!documents || documents.length === 0 || !query.trim()) {
      return documents;
    }

    // Limit documents to API constraints
    const limitedDocuments = documents.slice(0, Math.min(documents.length, this.maxDocuments));

    try {
      await this.initializeCohere();

      if (!this.client) {
        logger.warn('Cohere client not available, returning original results');
        return documents;
      }

      // Prepare documents for Cohere API
      const cohereDocuments = this.prepareDocuments(limitedDocuments);

      // Call Cohere rerank API with retry logic
      const rerankedResults = await this.rerankWithRetries(
        query,
        cohereDocuments,
        limitedDocuments,
        options
      );

      // Include any documents that weren't sent to Cohere (beyond limit)
      const remainingDocuments = documents.slice(this.maxDocuments);
      
      return [...rerankedResults, ...remainingDocuments];

    } catch (error) {
      logger.error('Cohere reranking failed, returning original results:', error);
      return documents;
    }
  }

  /**
   * Prepare documents for Cohere API
   */
  private prepareDocuments(documents: SearchResult[]): string[] {
    return documents.map(doc => {
      // Combine relevant fields for reranking
      const parts = [
        doc.displayName,
        doc.description,
        doc.category,
        doc.nodeType.replace(/^nodes-base\./, '').replace(/^nodes-langchain\./, '')
      ].filter(part => part && part.trim().length > 0);

      return parts.join(' | ');
    });
  }

  /**
   * Rerank with retry logic
   */
  private async rerankWithRetries(
    query: string,
    cohereDocuments: string[],
    originalDocuments: SearchResult[],
    options: CohereRerankOptions
  ): Promise<SearchResult[]> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.maxRetries) {
      try {
        const response = await this.client!.rerank({
          model: options.model,
          query: query,
          documents: cohereDocuments,
          top_n: options.topN,
          max_chunks_per_doc: options.maxChunksPerDoc,
          return_documents: options.returnDocuments
        });

        // Process and return reranked results
        return this.processRerankResponse(response, originalDocuments, query);

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (attempt < this.maxRetries) {
          const delay = this.baseDelayMs * Math.pow(2, attempt - 1);
          logger.warn(`Cohere rerank failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms:`, error);
          await this.delay(delay);
        }
      }
    }

    throw new Error(`Cohere reranking failed after ${this.maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Process Cohere rerank response
   */
  private processRerankResponse(
    response: any,
    originalDocuments: SearchResult[],
    query: string
  ): SearchResult[] {
    if (!response.results || response.results.length === 0) {
      logger.debug('No rerank results returned from Cohere');
      return originalDocuments;
    }

    // Create reranked results
    const rerankedResults: SearchResult[] = [];
    
    for (const result of response.results) {
      const originalIndex = result.index;
      const originalDocument = originalDocuments[originalIndex];
      
      if (originalDocument) {
        // Handle both new and old property names
        const relevanceScore = result.relevanceScore ?? result.relevance_score ?? 0;
        
        rerankedResults.push({
          ...originalDocument,
          relevanceScore,
          searchMethod: 'hybrid',
          metadata: {
            ...originalDocument.metadata,
            cohereScore: relevanceScore,
            cohereRank: rerankedResults.length + 1,
            rerankQuery: query
          }
        });
      }
    }

    // Log reranking performance  
    const billedUnits = response.meta?.billedUnits?.searchUnits ?? response.meta?.billed_units?.search_units ?? 0;
    const estimatedCost = billedUnits * this.costPerSearchUnit;
    logger.debug(`Cohere reranking: ${rerankedResults.length} results, ${billedUnits} search units, ~$${estimatedCost.toFixed(4)} cost`);

    return rerankedResults;
  }

  /**
   * Check if Cohere service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.initializeCohere();
      return true;
    } catch (error) {
      logger.debug('Cohere service not available:', error);
      return false;
    }
  }

  /**
   * Validate Cohere configuration
   */
  static validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!process.env.COHERE_API_KEY) {
      errors.push('COHERE_API_KEY environment variable is required');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get supported models
   */
  static getSupportedModels(): string[] {
    return [
      'rerank-multilingual-v3.0',
      'rerank-english-v3.0',
      'rerank-multilingual-v2.0',
      'rerank-english-v2.0'
    ];
  }

  /**
   * Get optimal model for query language
   */
  static getOptimalModel(query: string): string {
    // Simple language detection - in practice, you might want a more sophisticated approach
    const englishPattern = /^[a-zA-Z0-9\s\-_.,!?()]+$/;
    const isEnglish = englishPattern.test(query);
    
    if (isEnglish && query.length > 0) {
      // For English-only queries, the English model might be faster
      return 'rerank-english-v3.0';
    } else {
      // For multilingual or non-English queries, use multilingual model
      return 'rerank-multilingual-v3.0';
    }
  }

  /**
   * Analyze reranking effectiveness
   */
  static analyzeReranking(
    originalResults: SearchResult[],
    rerankedResults: SearchResult[]
  ): {
    originalTopResult: string;
    rerankedTopResult: string;
    topResultChanged: boolean;
    averageScoreChange: number;
    positionChanges: Array<{ nodeType: string; originalRank: number; newRank: number; change: number }>;
  } {
    if (originalResults.length === 0 || rerankedResults.length === 0) {
      return {
        originalTopResult: '',
        rerankedTopResult: '',
        topResultChanged: false,
        averageScoreChange: 0,
        positionChanges: []
      };
    }

    const originalTopResult = originalResults[0].nodeType;
    const rerankedTopResult = rerankedResults[0].nodeType;
    const topResultChanged = originalTopResult !== rerankedTopResult;

    // Calculate average score change
    const originalScores = originalResults.map(r => r.relevanceScore);
    const rerankedScores = rerankedResults.map(r => r.relevanceScore);
    const originalAvg = originalScores.reduce((sum, score) => sum + score, 0) / originalScores.length;
    const rerankedAvg = rerankedScores.reduce((sum, score) => sum + score, 0) / rerankedScores.length;
    const averageScoreChange = rerankedAvg - originalAvg;

    // Calculate position changes
    const originalPositions = new Map<string, number>();
    originalResults.forEach((result, index) => {
      originalPositions.set(result.nodeType, index + 1);
    });

    const positionChanges = rerankedResults.map((result, index) => {
      const originalRank = originalPositions.get(result.nodeType) || originalResults.length + 1;
      const newRank = index + 1;
      return {
        nodeType: result.nodeType,
        originalRank,
        newRank,
        change: originalRank - newRank
      };
    });

    return {
      originalTopResult,
      rerankedTopResult,
      topResultChanged,
      averageScoreChange,
      positionChanges
    };
  }

  /**
   * Utility method to delay execution
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update reranker configuration
   */
  updateConfig(config: {
    model?: string;
    maxDocuments?: number;
    maxRetries?: number;
  }): void {
    if (config.model) {
      this.model = config.model;
    }
    if (config.maxDocuments) {
      this.maxDocuments = config.maxDocuments;
    }
    if (config.maxRetries) {
      this.maxRetries = config.maxRetries;
    }

    logger.debug('Cohere reranker config updated:', {
      model: this.model,
      maxDocuments: this.maxDocuments,
      maxRetries: this.maxRetries
    });
  }

  /**
   * Get current configuration
   */
  getConfig(): {
    model: string;
    maxDocuments: number;
    maxRetries: number;
  } {
    return {
      model: this.model,
      maxDocuments: this.maxDocuments,
      maxRetries: this.maxRetries
    };
  }

  /**
   * Estimate cost for reranking
   */
  estimateCost(documentCount: number): number {
    // Cohere charges per search unit, roughly 1 search unit per document
    const searchUnits = Math.min(documentCount, this.maxDocuments);
    return searchUnits * this.costPerSearchUnit;
  }
}