/**
 * Reciprocal Rank Fusion (RRF) Algorithm Implementation
 * 
 * Combines rankings from multiple search engines into a single, unified ranking.
 * Pure utility class with no external dependencies.
 * 
 * RRF Formula: score = Σ(1/(k + rank)) where k=60 is experimentally proven optimal
 */

import { SearchResult, RRFOptions } from '../types/search-types';
import { logger } from '../utils/logger';

export class RRFFusion {
  private k: number;
  private weights: { fts5: number; vector: number };

  constructor(options: RRFOptions = { k: 60 }) {
    this.k = options.k;
    this.weights = options.weights || { fts5: 1.0, vector: 1.0 };
  }

  /**
   * Main RRF fusion method - combines results from multiple search engines
   */
  fuseResults(
    fts5Results: SearchResult[],
    vectorResults: SearchResult[]
  ): SearchResult[] {
    const startTime = Date.now();

    try {
      // Create unified document set (deduplicated by nodeType)
      const allDocuments = this.createUnifiedDocumentSet(fts5Results, vectorResults);

      // Calculate RRF scores for each document
      const rrfScores = this.calculateRRFScores(allDocuments, fts5Results, vectorResults);

      // Create final results with RRF scores
      const fusedResults = this.createFusedResults(allDocuments, rrfScores);

      // Sort by RRF score (descending)
      fusedResults.sort((a, b) => b.relevanceScore - a.relevanceScore);

      const processingTime = Date.now() - startTime;
      logger.debug(`RRF fusion completed in ${processingTime}ms for ${fusedResults.length} results`);

      return fusedResults;

    } catch (error) {
      logger.error('RRF fusion error:', error);
      // Fallback: return FTS5 results if available, otherwise vector results
      return fts5Results.length > 0 ? fts5Results : vectorResults;
    }
  }

  /**
   * Create unified document set from multiple result sets
   */
  private createUnifiedDocumentSet(
    fts5Results: SearchResult[],
    vectorResults: SearchResult[]
  ): Map<string, SearchResult> {
    const documents = new Map<string, SearchResult>();

    // Add FTS5 results
    for (const result of fts5Results) {
      documents.set(result.nodeType, {
        ...result,
        searchMethod: 'fts5',
        metadata: {
          ...result.metadata,
          ftsRank: fts5Results.indexOf(result) + 1
        }
      });
    }

    // Add vector results, merging with existing documents
    for (const result of vectorResults) {
      const existing = documents.get(result.nodeType);
      if (existing) {
        // Merge information from both search methods
        documents.set(result.nodeType, {
          ...existing,
          searchMethod: 'hybrid',
          metadata: {
            ...existing.metadata,
            vectorSimilarity: result.relevanceScore,
            vectorRank: vectorResults.indexOf(result) + 1
          }
        });
      } else {
        // New document from vector search only
        documents.set(result.nodeType, {
          ...result,
          searchMethod: 'vector',
          metadata: {
            ...result.metadata,
            vectorSimilarity: result.relevanceScore,
            vectorRank: vectorResults.indexOf(result) + 1
          }
        });
      }
    }

    return documents;
  }

  /**
   * Calculate RRF scores for all documents
   */
  private calculateRRFScores(
    documents: Map<string, SearchResult>,
    fts5Results: SearchResult[],
    vectorResults: SearchResult[]
  ): Map<string, number> {
    const rrfScores = new Map<string, number>();

    // Create ranking maps for efficient lookup
    const fts5Rankings = new Map<string, number>();
    const vectorRankings = new Map<string, number>();

    fts5Results.forEach((result, index) => {
      fts5Rankings.set(result.nodeType, index + 1);
    });

    vectorResults.forEach((result, index) => {
      vectorRankings.set(result.nodeType, index + 1);
    });

    // Calculate RRF score for each document
    for (const [nodeType, document] of documents) {
      let rrfScore = 0;

      // FTS5 contribution
      const ftsRank = fts5Rankings.get(nodeType);
      if (ftsRank !== undefined) {
        rrfScore += this.weights.fts5 * (1 / (this.k + ftsRank));
      }

      // Vector contribution
      const vectorRank = vectorRankings.get(nodeType);
      if (vectorRank !== undefined) {
        rrfScore += this.weights.vector * (1 / (this.k + vectorRank));
      }

      rrfScores.set(nodeType, rrfScore);
    }

    return rrfScores;
  }

  /**
   * Create final results with RRF scores
   */
  private createFusedResults(
    documents: Map<string, SearchResult>,
    rrfScores: Map<string, number>
  ): SearchResult[] {
    const results: SearchResult[] = [];

    for (const [nodeType, document] of documents) {
      const rrfScore = rrfScores.get(nodeType) || 0;
      
      results.push({
        ...document,
        relevanceScore: rrfScore,
        metadata: {
          ...document.metadata,
          rrfScore: rrfScore
        }
      });
    }

    return results;
  }

  /**
   * Analyze fusion effectiveness
   */
  analyzeFusion(
    fts5Results: SearchResult[],
    vectorResults: SearchResult[],
    fusedResults: SearchResult[]
  ): {
    totalInputResults: number;
    totalOutputResults: number;
    overlap: number;
    overlapPercentage: number;
    fts5Only: number;
    vectorOnly: number;
    hybrid: number;
    topResultSource: string;
    scoreDistribution: { min: number; max: number; avg: number };
  } {
    const fts5Set = new Set(fts5Results.map(r => r.nodeType));
    const vectorSet = new Set(vectorResults.map(r => r.nodeType));
    const fusedSet = new Set(fusedResults.map(r => r.nodeType));

    // Calculate overlap
    const overlap = [...fts5Set].filter(nodeType => vectorSet.has(nodeType)).length;
    const overlapPercentage = fusedSet.size > 0 ? (overlap / fusedSet.size) * 100 : 0;

    // Calculate distribution
    const fts5Only = fusedResults.filter(r => r.metadata?.ftsRank && !r.metadata?.vectorRank).length;
    const vectorOnly = fusedResults.filter(r => r.metadata?.vectorRank && !r.metadata?.ftsRank).length;
    const hybrid = fusedResults.filter(r => r.metadata?.ftsRank && r.metadata?.vectorRank).length;

    // Score distribution
    const scores = fusedResults.map(r => r.relevanceScore);
    const scoreDistribution = {
      min: Math.min(...scores),
      max: Math.max(...scores),
      avg: scores.reduce((sum, score) => sum + score, 0) / scores.length
    };

    // Top result source
    const topResult = fusedResults[0];
    let topResultSource = 'none';
    if (topResult) {
      if (topResult.metadata?.ftsRank && topResult.metadata?.vectorRank) {
        topResultSource = 'hybrid';
      } else if (topResult.metadata?.ftsRank) {
        topResultSource = 'fts5';
      } else if (topResult.metadata?.vectorRank) {
        topResultSource = 'vector';
      }
    }

    return {
      totalInputResults: fts5Results.length + vectorResults.length,
      totalOutputResults: fusedResults.length,
      overlap,
      overlapPercentage,
      fts5Only,
      vectorOnly,
      hybrid,
      topResultSource,
      scoreDistribution
    };
  }

  /**
   * Validate RRF parameters
   */
  static validateParameters(k: number, weights: { fts5: number; vector: number }): {
    valid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (k < 1) {
      errors.push('RRF parameter k must be >= 1');
    }

    if (k > 1000) {
      errors.push('RRF parameter k should be <= 1000 for practical use');
    }

    if (weights.fts5 < 0 || weights.vector < 0) {
      errors.push('RRF weights must be non-negative');
    }

    if (weights.fts5 + weights.vector === 0) {
      errors.push('At least one RRF weight must be > 0');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get optimal k value recommendation based on result set sizes
   */
  static getOptimalK(fts5Count: number, vectorCount: number): number {
    // Research suggests k=60 is optimal for most cases
    // But we can adjust based on result set sizes
    const totalResults = fts5Count + vectorCount;
    
    if (totalResults < 10) {
      return 30; // Lower k for smaller result sets
    } else if (totalResults < 50) {
      return 60; // Standard optimal value
    } else {
      return 90; // Higher k for larger result sets
    }
  }

  /**
   * Normalize scores to 0-1 range
   */
  static normalizeScores(results: SearchResult[]): SearchResult[] {
    if (results.length === 0) return results;

    const scores = results.map(r => r.relevanceScore);
    const minScore = Math.min(...scores);
    const maxScore = Math.max(...scores);
    const scoreRange = maxScore - minScore;

    if (scoreRange === 0) {
      // All scores are the same
      return results.map(r => ({
        ...r,
        relevanceScore: 1.0
      }));
    }

    return results.map(r => ({
      ...r,
      relevanceScore: (r.relevanceScore - minScore) / scoreRange
    }));
  }

  /**
   * Apply boosting to specific categories or node types
   */
  applyBoosts(results: SearchResult[], boosts: Map<string, number>): SearchResult[] {
    return results.map(result => {
      let boost = 1.0;

      // Check for category boost
      if (result.category && boosts.has(result.category)) {
        boost *= boosts.get(result.category)!;
      }

      // Check for node type boost
      if (boosts.has(result.nodeType)) {
        boost *= boosts.get(result.nodeType)!;
      }

      return {
        ...result,
        relevanceScore: result.relevanceScore * boost,
        metadata: {
          ...result.metadata,
          appliedBoost: boost
        }
      };
    });
  }

  /**
   * Update RRF parameters
   */
  updateParameters(k: number, weights?: { fts5: number; vector: number }): void {
    const validation = RRFFusion.validateParameters(k, weights || this.weights);
    if (!validation.valid) {
      throw new Error(`Invalid RRF parameters: ${validation.errors.join(', ')}`);
    }

    this.k = k;
    if (weights) {
      this.weights = weights;
    }

    logger.debug(`RRF parameters updated: k=${k}, weights=${JSON.stringify(this.weights)}`);
  }

  /**
   * Get current RRF parameters
   */
  getParameters(): { k: number; weights: { fts5: number; vector: number } } {
    return {
      k: this.k,
      weights: { ...this.weights }
    };
  }
}