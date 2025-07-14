/**
 * Embedding Service for Semantic Search
 * 
 * Handles OpenAI embeddings generation with batching, caching, and cost optimization.
 * Follows the existing service pattern from property-filter.ts
 */

import { logger } from '../utils/logger';
import { EmbeddingContent, EmbeddingBatch, SearchServiceConfig } from '../types/search-types';
import crypto from 'crypto';

// OpenAI client interface (to avoid importing the full library at type level)
interface OpenAIClient {
  embeddings: {
    create(params: {
      model: string;
      input: string | string[];
      encoding_format?: 'float' | 'base64';
      dimensions?: number;
      user?: string;
    }): Promise<{
      data: Array<{ embedding: number[]; index: number }>;
      model: string;
      usage: { prompt_tokens: number; total_tokens: number };
    }>;
  };
}

interface EmbeddingResult {
  embedding: Float32Array;
  tokenCount: number;
  cost: number;
}

interface BatchEmbeddingResult {
  embeddings: Float32Array[];
  totalTokens: number;
  totalCost: number;
  processingTime: number;
}

export class EmbeddingService {
  private openai: OpenAIClient | null = null;
  private batchSize = 100; // OpenAI batch limit
  private model = 'text-embedding-3-small';
  private dimensions = 1536;
  private maxRetries = 3;
  private baseDelayMs = 1000;
  private cache = new Map<string, { embedding: Float32Array; timestamp: number }>();
  private cacheTTL = 24 * 60 * 60 * 1000; // 24 hours

  // Cost calculation constants (as of 2024)
  private readonly costPerToken = 0.00002 / 1000; // $0.00002 per 1K tokens

  constructor(private config?: SearchServiceConfig) {
    if (config?.openai) {
      this.batchSize = config.openai.batchSize || 100;
      this.model = config.openai.model || 'text-embedding-3-small';
      this.maxRetries = config.openai.maxRetries || 3;
    }
  }

  /**
   * Initialize OpenAI client
   */
  private async initializeOpenAI(): Promise<void> {
    if (this.openai) return;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }

    try {
      // Dynamically import OpenAI to avoid issues if not installed
      const { OpenAI } = await import('openai');
      this.openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: false
      });
      logger.info('OpenAI client initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize OpenAI client:', error);
      throw new Error('Failed to initialize OpenAI client. Make sure openai package is installed.');
    }
  }

  /**
   * Generate embeddings for multiple texts with batching
   */
  async generateEmbeddings(texts: string[]): Promise<BatchEmbeddingResult> {
    if (texts.length === 0) {
      return {
        embeddings: [],
        totalTokens: 0,
        totalCost: 0,
        processingTime: 0
      };
    }

    const startTime = Date.now();
    const embeddings: Float32Array[] = [];
    let totalTokens = 0;
    let totalCost = 0;

    try {
      await this.initializeOpenAI();

      // Process texts in batches
      const batches = this.createBatches(texts, this.batchSize);
      logger.info(`Processing ${texts.length} texts in ${batches.length} batches`);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        logger.debug(`Processing batch ${i + 1}/${batches.length} with ${batch.length} texts`);

        const batchResult = await this.processBatch(batch);
        embeddings.push(...batchResult.embeddings);
        totalTokens += batchResult.totalTokens;
        totalCost += batchResult.totalCost;

        // Add delay between batches to respect rate limits
        if (i < batches.length - 1) {
          await this.delay(100);
        }
      }

      const processingTime = Date.now() - startTime;
      logger.info(`Generated ${embeddings.length} embeddings in ${processingTime}ms. Cost: $${totalCost.toFixed(4)}`);

      return {
        embeddings,
        totalTokens,
        totalCost,
        processingTime
      };

    } catch (error) {
      logger.error('Failed to generate embeddings:', error);
      throw error;
    }
  }

  /**
   * Generate embedding for a single text with caching
   */
  async getEmbedding(text: string): Promise<EmbeddingResult> {
    const contentHash = this.generateContentHash(text);
    
    // Check cache first
    const cached = this.cache.get(contentHash);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      logger.debug('Returning cached embedding');
      return {
        embedding: cached.embedding,
        tokenCount: 0, // Cached, no tokens used
        cost: 0
      };
    }

    const batchResult = await this.generateEmbeddings([text]);
    
    if (batchResult.embeddings.length === 0) {
      throw new Error('Failed to generate embedding');
    }

    const embedding = batchResult.embeddings[0];
    
    // Cache the result
    this.cache.set(contentHash, { embedding, timestamp: Date.now() });
    
    return {
      embedding,
      tokenCount: batchResult.totalTokens,
      cost: batchResult.totalCost
    };
  }

  /**
   * Process a batch of texts
   */
  private async processBatch(texts: string[]): Promise<BatchEmbeddingResult> {
    const startTime = Date.now();
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.maxRetries) {
      try {
        if (!this.openai) {
          throw new Error('OpenAI client not initialized');
        }

        const response = await this.openai.embeddings.create({
          model: this.model,
          input: texts,
          encoding_format: 'float',
          dimensions: this.dimensions
        });

        // Convert embeddings to Float32Array
        const embeddings = response.data
          .sort((a, b) => a.index - b.index) // Ensure correct order
          .map(item => new Float32Array(item.embedding));

        const totalTokens = response.usage.total_tokens;
        const totalCost = totalTokens * this.costPerToken;
        const processingTime = Date.now() - startTime;

        logger.debug(`Batch processed: ${embeddings.length} embeddings, ${totalTokens} tokens, $${totalCost.toFixed(4)}`);

        return {
          embeddings,
          totalTokens,
          totalCost,
          processingTime
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        if (attempt < this.maxRetries) {
          const delay = this.baseDelayMs * Math.pow(2, attempt - 1);
          logger.warn(`Batch processing failed (attempt ${attempt}/${this.maxRetries}), retrying in ${delay}ms:`, error);
          await this.delay(delay);
        }
      }
    }

    throw new Error(`Failed to process batch after ${this.maxRetries} attempts. Last error: ${lastError?.message}`);
  }

  /**
   * Create batches from texts array
   */
  private createBatches(texts: string[], batchSize: number): string[][] {
    const batches: string[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      batches.push(texts.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
   * Generate content hash for caching
   */
  generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  /**
   * Prepare embedding content from node/template data
   */
  static prepareEmbeddingContent(nodeData: any, type: 'node' | 'template'): EmbeddingContent {
    let content: string;
    let contentParts: string[] = [];

    if (type === 'node') {
      // For nodes, combine key searchable fields
      contentParts = [
        nodeData.display_name || nodeData.displayName || '',
        nodeData.description || '',
        nodeData.category || '',
        nodeData.documentation || '',
        // Include operation names if available
        ...(nodeData.operations ? JSON.parse(nodeData.operations || '[]').map((op: any) => op.name || '') : [])
      ].filter(part => part.trim().length > 0);
    } else {
      // For templates, combine name and description
      contentParts = [
        nodeData.name || '',
        nodeData.description || '',
        // Include category information
        ...(nodeData.categories ? JSON.parse(nodeData.categories || '[]') : [])
      ].filter(part => part.trim().length > 0);
    }

    content = contentParts.join(' | ');
    
    return {
      nodeType: type === 'node' ? nodeData.node_type : `template:${nodeData.id}`,
      content,
      contentHash: crypto.createHash('sha256').update(content).digest('hex'),
      metadata: {
        displayName: nodeData.display_name || nodeData.displayName || nodeData.name,
        description: nodeData.description,
        category: nodeData.category,
        operations: nodeData.operations ? JSON.parse(nodeData.operations || '[]').map((op: any) => op.name || '') : undefined
      }
    };
  }

  /**
   * Utility method to delay execution
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.debug('Embedding cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; hitRate: number } {
    // Simple cache stats (could be enhanced with hit/miss tracking)
    return {
      size: this.cache.size,
      hitRate: 0 // Would need hit/miss tracking to calculate
    };
  }

  /**
   * Estimate cost for embedding generation
   */
  estimateCost(texts: string[]): { estimatedTokens: number; estimatedCost: number } {
    // Rough estimation: average 75 tokens per 100 characters
    const totalChars = texts.reduce((sum, text) => sum + text.length, 0);
    const estimatedTokens = Math.ceil(totalChars * 0.75);
    const estimatedCost = estimatedTokens * this.costPerToken;

    return {
      estimatedTokens,
      estimatedCost
    };
  }

  /**
   * Validate embedding configuration
   */
  static validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!process.env.OPENAI_API_KEY) {
      errors.push('OPENAI_API_KEY environment variable is required');
    }

    const batchSize = parseInt(process.env.EMBEDDING_BATCH_SIZE || '100');
    if (batchSize < 1 || batchSize > 2048) {
      errors.push('EMBEDDING_BATCH_SIZE must be between 1 and 2048');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if OpenAI service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.initializeOpenAI();
      return true;
    } catch (error) {
      logger.debug('OpenAI service not available:', error);
      return false;
    }
  }
}