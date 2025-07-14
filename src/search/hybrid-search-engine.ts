/**
 * Hybrid Search Engine
 * 
 * Main orchestrator that coordinates FTS5, vector search, RRF fusion, and Cohere reranking
 * to provide semantic search capabilities for n8n nodes and templates.
 */

import { DatabaseAdapter } from '../database/database-adapter';
import { EmbeddingService } from './embedding-service';
import { VectorRepository } from './vector-repository';
import { RRFFusion } from './rrf-fusion';
import { CohereReranker } from './cohere-reranker';
import { 
  SearchResult, 
  HybridSearchOptions, 
  SearchMetrics, 
  CombinedSearchResult,
  TemplateSearchResult,
  VectorSearchOptions 
} from '../types/search-types';
import { logger } from '../utils/logger';
import { SimpleCache } from '../utils/simple-cache';

export class HybridSearchEngine {
  private embeddingService: EmbeddingService;
  private vectorRepository: VectorRepository;
  private rrfFusion: RRFFusion;
  private cohereReranker: CohereReranker;
  private cache: SimpleCache | null = null;
  private enableCache: boolean = true;
  private defaultOptions: Partial<HybridSearchOptions>;

  constructor(
    private db: DatabaseAdapter,
    options: {
      embeddingService?: EmbeddingService;
      vectorRepository?: VectorRepository;
      rrfFusion?: RRFFusion;
      cohereReranker?: CohereReranker;
      enableCache?: boolean;
      defaultOptions?: Partial<HybridSearchOptions>;
    } = {}
  ) {
    this.embeddingService = options.embeddingService || new EmbeddingService();
    this.vectorRepository = options.vectorRepository || new VectorRepository(db);
    this.rrfFusion = options.rrfFusion || new RRFFusion();
    this.cohereReranker = options.cohereReranker || new CohereReranker();
    this.enableCache = options.enableCache !== false;
    this.defaultOptions = options.defaultOptions || {};

    if (this.enableCache) {
      this.cache = new SimpleCache();
    }
  }

  /**
   * Main search method - orchestrates hybrid search pipeline
   */
  async search(
    query: string,
    options: Partial<HybridSearchOptions> = {}
  ): Promise<SearchResult[]> {
    const startTime = Date.now();
    const searchOptions = this.mergeOptions(options);

    // Validate inputs
    if (!query || query.trim().length === 0) {
      return [];
    }

    const cleanQuery = query.trim();
    const cacheKey = this.getCacheKey(cleanQuery, searchOptions);

    // Check cache first
    if (this.enableCache && this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for query: ${cleanQuery}`);
        return cached;
      }
    }

    try {
      const metrics: SearchMetrics = {
        totalTime: 0,
        resultsCount: 0
      };

      // Execute search pipeline
      const results = await this.executeSearchPipeline(cleanQuery, searchOptions, metrics);

      // Cache results
      if (this.enableCache && this.cache) {
        this.cache.set(cacheKey, results, 300); // Cache for 5 minutes
      }

      // Update metrics
      metrics.totalTime = Date.now() - startTime;
      metrics.resultsCount = results.length;

      logger.info(`Hybrid search completed: "${cleanQuery}" → ${results.length} results in ${metrics.totalTime}ms`);
      
      return results;

    } catch (error) {
      logger.error('Hybrid search failed:', error);
      // No fallbacks when semantic search is enabled - re-throw the error
      throw error;
    }
  }

  /**
   * Execute the complete search pipeline
   */
  private async executeSearchPipeline(
    query: string,
    options: HybridSearchOptions,
    metrics: SearchMetrics
  ): Promise<SearchResult[]> {
    const pipeline = {
      fts5: options.searchMethods.includes('fts5'),
      vector: options.searchMethods.includes('vector'),
      rrf: options.searchMethods.length > 1,
      rerank: options.enableReranking
    };

    // Stage 1: Parallel Search
    const [fts5Results, vectorResults] = await Promise.all([
      pipeline.fts5 ? this.executeFTS5Search(query, options.limit * 2) : Promise.resolve([]),
      pipeline.vector ? this.executeVectorSearch(query, options.limit * 2) : Promise.resolve([])
    ]);

    // Update metrics
    metrics.ftsTime = fts5Results.length > 0 ? Date.now() - Date.now() : 0;
    metrics.vectorTime = vectorResults.length > 0 ? Date.now() - Date.now() : 0;

    // Stage 2: Result Fusion (if both search methods used)
    let fusedResults: SearchResult[];
    if (pipeline.rrf && fts5Results.length > 0 && vectorResults.length > 0) {
      const rrfStart = Date.now();
      fusedResults = this.rrfFusion.fuseResults(fts5Results, vectorResults);
      metrics.rrfTime = Date.now() - rrfStart;
      logger.debug(`RRF fusion: ${fts5Results.length} + ${vectorResults.length} → ${fusedResults.length} results`);
    } else if (fts5Results.length > 0 && vectorResults.length === 0) {
      fusedResults = fts5Results;
    } else if (vectorResults.length > 0 && fts5Results.length === 0) {
      fusedResults = vectorResults;
    } else {
      fusedResults = [...fts5Results, ...vectorResults];
    }

    // Stage 3: Final Re-ranking (if enabled and available)
    let finalResults = fusedResults;
    if (pipeline.rerank && fusedResults.length > 0) {
      const isAvailable = await this.cohereReranker.isAvailable();
      if (isAvailable) {
        const rerankStart = Date.now();
        finalResults = await this.cohereReranker.rerank(query, fusedResults, {
          model: 'rerank-multilingual-v3.0',
          topN: options.limit,
          returnDocuments: false
        });
        metrics.cohereTime = Date.now() - rerankStart;
        logger.debug(`Cohere reranking: ${fusedResults.length} → ${finalResults.length} results`);
      } else {
        logger.debug('Cohere reranking not available, skipping');
      }
    }

    // Limit final results
    return finalResults.slice(0, options.limit);
  }

  /**
   * Execute FTS5 search
   */
  private async executeFTS5Search(query: string, limit: number): Promise<SearchResult[]> {
    try {
      // Check if FTS5 table exists
      const ftsExists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='nodes_fts'
      `).get();

      if (!ftsExists) {
        logger.debug('FTS5 table not available, skipping FTS5 search');
        return [];
      }

      // Prepare FTS5 query
      const words = query.split(/\s+/).filter(w => w.length > 0);
      const ftsQuery = words.join(' OR ');

      // Execute FTS5 search
      const nodes = this.db.prepare(`
        SELECT 
          n.node_type,
          n.display_name,
          n.description,
          n.category,
          n.package_name,
          rank
        FROM nodes n
        JOIN nodes_fts ON n.rowid = nodes_fts.rowid
        WHERE nodes_fts MATCH ?
        ORDER BY rank, n.display_name
        LIMIT ?
      `).all(ftsQuery, limit) as Array<{
        node_type: string;
        display_name: string;
        description: string;
        category: string;
        package_name: string;
        rank: number;
      }>;

      // Convert to SearchResult format
      const results: SearchResult[] = nodes.map((node, index) => ({
        nodeType: node.node_type,
        displayName: node.display_name,
        description: node.description || '',
        category: node.category || '',
        package: node.package_name,
        relevanceScore: 1.0 - (index / Math.max(nodes.length, 1)), // Normalize rank to 0-1
        searchMethod: 'fts5',
        metadata: {
          ftsRank: index + 1
        }
      }));

      logger.debug(`FTS5 search returned ${results.length} results`);
      return results;

    } catch (error) {
      logger.error('FTS5 search failed:', error);
      return [];
    }
  }

  /**
   * Execute vector search
   */
  private async executeVectorSearch(query: string, limit: number): Promise<SearchResult[]> {
    try {
      // Check if vector storage is ready
      const isReady = await this.vectorRepository.isVectorStorageReady();
      if (!isReady) {
        logger.debug('Vector storage not ready, skipping vector search');
        return [];
      }

      // Generate query embedding
      const embeddingResult = await this.embeddingService.getEmbedding(query);
      const queryVector = embeddingResult.embedding;

      // Search for similar nodes
      const vectorOptions: VectorSearchOptions = {
        queryVector,
        limit,
        threshold: 0.2, // Reduced from 0.5 to allow more nodes for reranking
        includeDistances: true
      };

      const results = await this.vectorRepository.findSimilarNodes(queryVector, vectorOptions);
      logger.debug(`Vector search returned ${results.length} results`);
      return results;

    } catch (error) {
      logger.error('Vector search failed:', error);
      return [];
    }
  }

  /**
   * Combined search for both nodes and templates
   */
  async searchCombined(
    query: string,
    options: Partial<HybridSearchOptions> = {}
  ): Promise<CombinedSearchResult> {
    const startTime = Date.now();
    const searchOptions = this.mergeOptions(options);

    try {
      // Search nodes and templates in parallel
      const [nodeResults, templateResults] = await Promise.all([
        this.search(query, { ...searchOptions, limit: Math.ceil(searchOptions.limit * 0.7) }),
        this.searchTemplates(query, { ...searchOptions, limit: Math.ceil(searchOptions.limit * 0.3) })
      ]);

      const totalCount = nodeResults.length + templateResults.length;
      const searchTime = Date.now() - startTime;

      return {
        query,
        nodes: nodeResults,
        templates: templateResults,
        totalCount,
        searchTime,
        searchMethod: 'hybrid'
      };

    } catch (error) {
      logger.error('Combined search failed:', error);
      return {
        query,
        nodes: [],
        templates: [],
        totalCount: 0,
        searchTime: Date.now() - startTime,
        searchMethod: 'hybrid'
      };
    }
  }

  /**
   * Search templates using the same hybrid approach as nodes
   */
  async searchTemplates(
    query: string,
    options: Partial<HybridSearchOptions> = {}
  ): Promise<TemplateSearchResult[]> {
    const startTime = Date.now();
    const searchOptions = this.mergeOptions(options);

    // Validate inputs
    if (!query || query.trim().length === 0) {
      return [];
    }

    const cleanQuery = query.trim();
    const cacheKey = this.getCacheKey(cleanQuery + '_templates', searchOptions);

    // Check cache first
    if (this.enableCache && this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        logger.debug(`Cache hit for template query: ${cleanQuery}`);
        return cached;
      }
    }

    try {
      const metrics: SearchMetrics = {
        totalTime: 0,
        resultsCount: 0
      };

      // Execute template search pipeline
      const results = await this.executeTemplateSearchPipeline(cleanQuery, searchOptions, metrics);

      // Cache results
      if (this.enableCache && this.cache) {
        this.cache.set(cacheKey, results, 300); // Cache for 5 minutes
      }

      // Update metrics
      metrics.totalTime = Date.now() - startTime;
      metrics.resultsCount = results.length;

      logger.info(`Template hybrid search completed: "${cleanQuery}" → ${results.length} results in ${metrics.totalTime}ms`);
      
      return results;

    } catch (error) {
      logger.error('Template hybrid search failed:', error);
      // No fallbacks when semantic search is enabled - re-throw the error
      throw error;
    }
  }

  /**
   * Execute the complete template search pipeline (same as nodes)
   */
  private async executeTemplateSearchPipeline(
    query: string,
    options: HybridSearchOptions,
    metrics: SearchMetrics
  ): Promise<TemplateSearchResult[]> {
    const pipeline = {
      fts5: options.searchMethods.includes('fts5'),
      vector: options.searchMethods.includes('vector'),
      rrf: options.searchMethods.length > 1,
      rerank: options.enableReranking
    };

    // Stage 1: Parallel Search
    const [fts5Results, vectorResults] = await Promise.all([
      pipeline.fts5 ? this.executeTemplateFTS5Search(query, options.limit * 2) : Promise.resolve([]),
      pipeline.vector ? this.executeTemplateVectorSearch(query, options.limit * 2) : Promise.resolve([])
    ]);

    // Update metrics
    metrics.ftsTime = fts5Results.length > 0 ? Date.now() - Date.now() : 0;
    metrics.vectorTime = vectorResults.length > 0 ? Date.now() - Date.now() : 0;

    // Stage 2: Result Fusion (if both search methods used)
    let fusedResults: TemplateSearchResult[];
    if (pipeline.rrf && fts5Results.length > 0 && vectorResults.length > 0) {
      const rrfStart = Date.now();
      // Convert to SearchResult format for RRF, then convert back
      const fts5SearchResults = this.convertTemplateToSearchResults(fts5Results);
      const vectorSearchResults = this.convertTemplateToSearchResults(vectorResults);
      const fusedSearchResults = this.rrfFusion.fuseResults(fts5SearchResults, vectorSearchResults);
      fusedResults = this.convertSearchResultsToTemplate(fusedSearchResults);
      metrics.rrfTime = Date.now() - rrfStart;
      logger.debug(`Template RRF fusion: ${fts5Results.length} + ${vectorResults.length} → ${fusedResults.length} results`);
    } else if (fts5Results.length > 0 && vectorResults.length === 0) {
      fusedResults = fts5Results;
    } else if (vectorResults.length > 0 && fts5Results.length === 0) {
      fusedResults = vectorResults;
    } else {
      fusedResults = [...fts5Results, ...vectorResults];
    }

    // Stage 3: Final Re-ranking (if enabled and available)
    let finalResults = fusedResults;
    if (pipeline.rerank && fusedResults.length > 0) {
      const isAvailable = await this.cohereReranker.isAvailable();
      if (isAvailable) {
        const rerankStart = Date.now();
        // Convert to SearchResult for reranking, then convert back
        const searchResults = this.convertTemplateToSearchResults(fusedResults);
        const rerankedSearchResults = await this.cohereReranker.rerank(query, searchResults, {
          model: 'rerank-multilingual-v3.0',
          topN: options.limit,
          returnDocuments: false
        });
        finalResults = this.convertSearchResultsToTemplate(rerankedSearchResults);
        metrics.cohereTime = Date.now() - rerankStart;
        logger.debug(`Template Cohere reranking: ${fusedResults.length} → ${finalResults.length} results`);
      } else {
        logger.debug('Cohere reranking not available for templates, skipping');
      }
    }

    // Limit final results
    return finalResults.slice(0, options.limit);
  }

  /**
   * Execute FTS5 search for templates
   */
  private async executeTemplateFTS5Search(query: string, limit: number): Promise<TemplateSearchResult[]> {
    try {
      // Check if FTS5 table exists for templates
      const ftsExists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='templates_fts'
      `).get();

      if (!ftsExists) {
        logger.debug('Template FTS5 table not available, using LIKE search');
        return this.executeTemplateLikeSearch(query, limit);
      }

      // Prepare FTS5 query
      const words = query.split(/\s+/).filter(w => w.length > 0);
      const ftsQuery = words.map(word => `"${word.replace(/"/g, '""')}"`).join(' OR ');

      // Execute FTS5 search
      const templates = this.db.prepare(`
        SELECT 
          t.id,
          t.workflow_id,
          t.name,
          t.description,
          t.author_name,
          t.author_username,
          t.author_verified,
          t.categories,
          t.nodes_used,
          t.views,
          t.created_at,
          rank
        FROM templates t
        JOIN templates_fts ON t.id = templates_fts.rowid
        WHERE templates_fts MATCH ?
        ORDER BY rank, t.views DESC
        LIMIT ?
      `).all(ftsQuery, limit) as Array<{
        id: number;
        workflow_id: number;
        name: string;
        description: string;
        author_name: string;
        author_username: string;
        author_verified: number;
        categories: string;
        nodes_used: string;
        views: number;
        created_at: string;
        rank: number;
      }>;

      // Convert to TemplateSearchResult format
      const results: TemplateSearchResult[] = templates.map((template, index) => ({
        id: template.id,
        workflowId: template.workflow_id,
        name: template.name,
        description: template.description || '',
        author: {
          name: template.author_name,
          username: template.author_username,
          verified: template.author_verified === 1
        },
        categories: template.categories ? JSON.parse(template.categories) : [],
        nodesUsed: template.nodes_used ? JSON.parse(template.nodes_used) : [],
        relevanceScore: 1.0 - (index / Math.max(templates.length, 1)),
        searchMethod: 'fts5',
        metadata: {
          ftsRank: index + 1,
          views: template.views,
          createdAt: template.created_at ? new Date(template.created_at) : undefined
        }
      }));

      logger.debug(`Template FTS5 search returned ${results.length} results`);
      return results;

    } catch (error) {
      logger.error('Template FTS5 search failed:', error);
      return this.executeTemplateLikeSearch(query, limit);
    }
  }

  /**
   * Execute vector search for templates
   */
  private async executeTemplateVectorSearch(query: string, limit: number): Promise<TemplateSearchResult[]> {
    try {
      // Check if vector storage is ready
      const isReady = await this.vectorRepository.isVectorStorageReady();
      if (!isReady) {
        logger.debug('Vector storage not ready, skipping template vector search');
        return [];
      }

      // Generate query embedding
      const embeddingResult = await this.embeddingService.getEmbedding(query);
      const queryVector = embeddingResult.embedding;

      // Search for similar templates
      const vectorOptions: VectorSearchOptions = {
        queryVector,
        limit,
        threshold: 0.2, // Reduced from 0.5 to allow more templates for reranking
        includeDistances: true
      };

      const searchResults = await this.vectorRepository.findSimilarTemplates(queryVector, vectorOptions);
      
      // Convert SearchResult[] to TemplateSearchResult[]
      const results = this.convertSearchResultsToTemplate(searchResults);
      
      logger.debug(`Template vector search returned ${results.length} results`);
      return results;

    } catch (error) {
      logger.error('Template vector search failed:', error);
      return [];
    }
  }

  /**
   * Fallback LIKE search for templates
   */
  private async executeTemplateLikeSearch(query: string, limit: number): Promise<TemplateSearchResult[]> {
    const likeQuery = `%${query}%`;
    
    const templates = this.db.prepare(`
      SELECT 
        id,
        workflow_id,
        name,
        description,
        author_name,
        author_username,
        author_verified,
        categories,
        nodes_used,
        views,
        created_at
      FROM templates
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY views DESC, name
      LIMIT ?
    `).all(likeQuery, likeQuery, limit) as Array<{
      id: number;
      workflow_id: number;
      name: string;
      description: string;
      author_name: string;
      author_username: string;
      author_verified: number;
      categories: string;
      nodes_used: string;
      views: number;
      created_at: string;
    }>;

    const results: TemplateSearchResult[] = templates.map((template, index) => ({
      id: template.id,
      workflowId: template.workflow_id,
      name: template.name,
      description: template.description || '',
      author: {
        name: template.author_name,
        username: template.author_username,
        verified: template.author_verified === 1
      },
      categories: template.categories ? JSON.parse(template.categories) : [],
      nodesUsed: template.nodes_used ? JSON.parse(template.nodes_used) : [],
      relevanceScore: 1.0 - (index / Math.max(templates.length, 1)),
      searchMethod: 'like',
      metadata: {
        views: template.views,
        createdAt: template.created_at ? new Date(template.created_at) : undefined
      }
    }));

    logger.debug(`Template LIKE search returned ${results.length} results`);
    return results;
  }

  /**
   * Convert TemplateSearchResult[] to SearchResult[] for RRF/reranking
   */
  private convertTemplateToSearchResults(templates: TemplateSearchResult[]): SearchResult[] {
    return templates.map(template => ({
      nodeType: `template:${template.id}`,
      displayName: template.name,
      description: template.description,
      category: 'template',
      package: 'n8n-templates',
      relevanceScore: template.relevanceScore,
      searchMethod: template.searchMethod,
      metadata: template.metadata
    }));
  }

  /**
   * Convert SearchResult[] back to TemplateSearchResult[]
   */
  private convertSearchResultsToTemplate(searchResults: SearchResult[]): TemplateSearchResult[] {
    return searchResults
      .filter(result => result.nodeType.startsWith('template:'))
      .map(result => {
        const templateId = parseInt(result.nodeType.replace('template:', ''));
        
        // Get template details from database
        const template = this.db.prepare(`
          SELECT 
            id, workflow_id, name, description, author_name, author_username,
            author_verified, categories, nodes_used, views, created_at
          FROM templates WHERE id = ?
        `).get(templateId) as {
          id: number;
          workflow_id: number;
          name: string;
          description: string;
          author_name: string;
          author_username: string;
          author_verified: number;
          categories: string;
          nodes_used: string;
          views: number;
          created_at: string;
        } | undefined;

        if (!template) {
          // Fallback with basic data from SearchResult
          return {
            id: templateId,
            workflowId: templateId,
            name: result.displayName,
            description: result.description,
            author: { name: '', username: '', verified: false },
            categories: [],
            nodesUsed: [],
            relevanceScore: result.relevanceScore,
            searchMethod: result.searchMethod,
            metadata: result.metadata
          };
        }

        return {
          id: template.id,
          workflowId: template.workflow_id,
          name: template.name,
          description: template.description || '',
          author: {
            name: template.author_name,
            username: template.author_username,
            verified: template.author_verified === 1
          },
          categories: template.categories ? JSON.parse(template.categories) : [],
          nodesUsed: template.nodes_used ? JSON.parse(template.nodes_used) : [],
          relevanceScore: result.relevanceScore,
          searchMethod: result.searchMethod,
          metadata: {
            ...result.metadata,
            views: template.views,
            createdAt: template.created_at ? new Date(template.created_at) : undefined
          }
        };
      });
  }

  /**
   * Merge search options with defaults
   */
  private mergeOptions(options: Partial<HybridSearchOptions>): HybridSearchOptions {
    return {
      query: options.query || '',
      limit: options.limit || 20,
      rrfK: options.rrfK || 60,
      enableReranking: options.enableReranking !== false,
      searchMethods: options.searchMethods || ['fts5', 'vector'],
      includeMetadata: options.includeMetadata || false,
      ...this.defaultOptions,
      ...options
    };
  }

  /**
   * Generate cache key for search results
   */
  private getCacheKey(query: string, options: HybridSearchOptions): string {
    const keyData = {
      query,
      limit: options.limit,
      rrfK: options.rrfK,
      enableReranking: options.enableReranking,
      searchMethods: options.searchMethods.sort()
    };
    return JSON.stringify(keyData);
  }

  /**
   * Get search engine statistics
   */
  async getStatistics(): Promise<{
    vectorCoverage: any;
    cacheStats: any;
    searchMethods: string[];
  }> {
    const [vectorCoverage, cacheStats] = await Promise.all([
      this.vectorRepository.getEmbeddingStats(),
      this.cache ? { size: 0, hits: 0, misses: 0 } : { size: 0, hits: 0, misses: 0 }
    ]);

    return {
      vectorCoverage,
      cacheStats,
      searchMethods: ['fts5', 'vector', 'hybrid']
    };
  }

  /**
   * Check if all search components are ready
   */
  async isReady(): Promise<{
    overall: boolean;
    fts5: boolean;
    vector: boolean;
    embedding: boolean;
    reranking: boolean;
  }> {
    const [vectorReady, embeddingReady, rerankingReady] = await Promise.all([
      this.vectorRepository.isVectorStorageReady(),
      this.embeddingService.isAvailable(),
      this.cohereReranker.isAvailable()
    ]);

    // Check FTS5 for both nodes and templates
    const nodesFts5Ready = !!this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='nodes_fts'
    `).get();
    
    const templatesFts5Ready = !!this.db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='templates_fts'
    `).get();
    
    const fts5Ready = nodesFts5Ready && templatesFts5Ready;

    return {
      overall: fts5Ready && vectorReady,
      fts5: fts5Ready,
      vector: vectorReady,
      embedding: embeddingReady,
      reranking: rerankingReady
    };
  }

  /**
   * Clear search cache
   */
  clearCache(): void {
    if (this.cache) {
      this.cache.clear();
      logger.debug('Search cache cleared');
    }
  }

  /**
   * Update search engine configuration
   */
  updateConfig(config: {
    enableCache?: boolean;
    defaultOptions?: Partial<HybridSearchOptions>;
  }): void {
    if (config.enableCache !== undefined) {
      this.enableCache = config.enableCache;
      if (!this.enableCache && this.cache) {
        this.cache.clear();
        this.cache = null;
      } else if (this.enableCache && !this.cache) {
        this.cache = new SimpleCache();
      }
    }

    if (config.defaultOptions) {
      this.defaultOptions = { ...this.defaultOptions, ...config.defaultOptions };
    }

    logger.debug('Search engine configuration updated');
  }
}