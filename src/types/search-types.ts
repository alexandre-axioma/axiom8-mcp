/**
 * Search Types for Semantic Search Enhancement
 * 
 * TypeScript interfaces and types for the hybrid search system
 * combining FTS5 (lexical) + embeddings (semantic) + RRF + Cohere reranking
 */

// Core embedding types
export interface EmbeddingVector {
  id: string;
  nodeType: string;
  content: string;
  contentHash: string;
  embedding: Float32Array;
  createdAt: Date;
  updatedAt: Date;
}

// Search result interface
export interface SearchResult {
  nodeType: string;
  displayName: string;
  description: string;
  category: string;
  package: string;
  relevanceScore: number;
  searchMethod: 'fts5' | 'vector' | 'hybrid' | 'like';
  metadata?: {
    ftsRank?: number;
    vectorSimilarity?: number;
    vectorRank?: number;
    rrfScore?: number;
    cohereScore?: number;
    cohereRank?: number;
    rerankQuery?: string;
    appliedBoost?: number;
  };
}

// Search configuration options
export interface HybridSearchOptions {
  query: string;
  limit: number;
  rrfK: number;
  enableReranking: boolean;
  searchMethods: ('fts5' | 'vector')[];
  includeMetadata?: boolean;
}

// Vector search configuration
export interface VectorSearchOptions {
  queryVector: Float32Array;
  limit: number;
  threshold?: number; // Minimum similarity threshold
  includeDistances?: boolean;
}

// RRF fusion configuration
export interface RRFOptions {
  k: number; // RRF parameter, typically 60
  weights?: {
    fts5: number;
    vector: number;
  };
}

// Cohere reranking configuration
export interface CohereRerankOptions {
  model: string;
  topN: number;
  returnDocuments?: boolean;
  maxChunksPerDoc?: number;
}

// Database embedding storage
export interface EmbeddingRow {
  node_type: string;
  embedding_vector: Buffer;
  embedding_content_hash: string;
  embedding_generated_at: string;
  embedding_model?: string;
  embedding_dimensions?: number;
}

// Content preparation for embedding
export interface EmbeddingContent {
  nodeType: string;
  content: string;
  contentHash: string;
  metadata?: {
    displayName?: string;
    description?: string;
    category?: string;
    operations?: string[];
  };
}

// Batch embedding generation
export interface EmbeddingBatch {
  contents: EmbeddingContent[];
  batchId: string;
  createdAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// Search performance metrics
export interface SearchMetrics {
  totalTime: number;
  ftsTime?: number;
  vectorTime?: number;
  rrfTime?: number;
  cohereTime?: number;
  resultsCount: number;
  cacheHits?: number;
  cacheMisses?: number;
}

// Error types for search operations
export interface SearchError {
  type: 'embedding_generation' | 'vector_search' | 'rrf_fusion' | 'cohere_rerank' | 'database_error';
  message: string;
  details?: any;
  fallbackUsed?: boolean;
}

// Search statistics and monitoring
export interface SearchStats {
  totalSearches: number;
  averageResponseTime: number;
  searchMethodUsage: {
    fts5Only: number;
    vectorOnly: number;
    hybrid: number;
  };
  errors: SearchError[];
  costs: {
    embeddingGeneration: number;
    cohereReranking: number;
    totalCost: number;
  };
}

// Configuration for search services
export interface SearchServiceConfig {
  openai: {
    apiKey: string;
    model: string;
    batchSize: number;
    maxRetries: number;
  };
  cohere: {
    apiKey: string;
    model: string;
    maxDocuments: number;
  };
  rrf: {
    k: number;
    weights: {
      fts5: number;
      vector: number;
    };
  };
  cache: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };
}

// Template search results (extending nodes search)
export interface TemplateSearchResult {
  id: number;
  workflowId: number;
  name: string;
  description: string;
  author: {
    name: string;
    username: string;
    verified: boolean;
  };
  categories: string[];
  nodesUsed: string[];
  relevanceScore: number;
  searchMethod: 'fts5' | 'vector' | 'hybrid' | 'like';
  metadata?: {
    views?: number;
    createdAt?: Date;
    ftsRank?: number;
    vectorSimilarity?: number;
  };
}

// Combined search results (nodes + templates)
export interface CombinedSearchResult {
  query: string;
  nodes: SearchResult[];
  templates: TemplateSearchResult[];
  totalCount: number;
  searchTime: number;
  searchMethod: 'fts5' | 'vector' | 'hybrid' | 'like';
  metadata?: SearchMetrics;
}

// Search query analysis
export interface QueryAnalysis {
  query: string;
  language: string;
  intent: 'node_search' | 'template_search' | 'mixed';
  entities: string[];
  keywords: string[];
  confidence: number;
}

// Cache key and value types
export interface SearchCacheKey {
  query: string;
  options: HybridSearchOptions;
  hash: string;
}

export interface SearchCacheValue {
  results: SearchResult[];
  timestamp: Date;
  ttl: number;
  metadata?: SearchMetrics;
}

// Types are already exported above with their definitions