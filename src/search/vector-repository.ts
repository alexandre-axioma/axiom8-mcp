/**
 * Vector Repository for Semantic Search
 * 
 * Handles storage and retrieval of embeddings in SQLite using BLOB storage.
 * Mirrors the pattern from node-repository.ts
 */

import { DatabaseAdapter } from '../database/database-adapter';
import { SearchResult, EmbeddingRow, VectorSearchOptions } from '../types/search-types';
import { logger } from '../utils/logger';

export class VectorRepository {
  constructor(private db: DatabaseAdapter) {}

  /**
   * Save embedding for a node
   */
  async saveEmbedding(
    nodeType: string, 
    embedding: Float32Array, 
    contentHash: string,
    model: string = 'text-embedding-3-small'
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE nodes 
      SET embedding_vector = ?, 
          embedding_content_hash = ?, 
          embedding_generated_at = CURRENT_TIMESTAMP,
          embedding_model = ?,
          embedding_dimensions = ?
      WHERE node_type = ?
    `);

    try {
      // Convert Float32Array to Buffer for SQLite storage
      const buffer = Buffer.from(embedding.buffer);
      
      stmt.run(
        buffer,
        contentHash,
        model,
        embedding.length,
        nodeType
      );

      logger.debug(`Saved embedding for node: ${nodeType}`);
    } catch (error) {
      logger.error(`Failed to save embedding for node ${nodeType}:`, error);
      throw error;
    }
  }

  /**
   * Save embedding for a template
   */
  async saveTemplateEmbedding(
    templateId: number, 
    embedding: Float32Array, 
    contentHash: string,
    model: string = 'text-embedding-3-small'
  ): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE templates 
      SET embedding_vector = ?, 
          embedding_content_hash = ?, 
          embedding_generated_at = CURRENT_TIMESTAMP,
          embedding_model = ?,
          embedding_dimensions = ?
      WHERE id = ?
    `);

    try {
      // Convert Float32Array to Buffer for SQLite storage
      const buffer = Buffer.from(embedding.buffer);
      
      stmt.run(
        buffer,
        contentHash,
        model,
        embedding.length,
        templateId
      );

      logger.debug(`Saved embedding for template: ${templateId}`);
    } catch (error) {
      logger.error(`Failed to save embedding for template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Get embedding for a node
   */
  async getEmbedding(nodeType: string): Promise<Float32Array | null> {
    const stmt = this.db.prepare(`
      SELECT embedding_vector, embedding_dimensions 
      FROM nodes 
      WHERE node_type = ? AND embedding_vector IS NOT NULL
    `);

    try {
      const row = stmt.get(nodeType) as { embedding_vector: Buffer; embedding_dimensions: number } | undefined;
      
      if (!row) {
        return null;
      }

      // Convert Buffer back to Float32Array
      const embedding = new Float32Array(row.embedding_vector.buffer);
      
      return embedding;
    } catch (error) {
      logger.error(`Failed to get embedding for node ${nodeType}:`, error);
      return null;
    }
  }

  /**
   * Find similar nodes using cosine similarity
   */
  async findSimilarNodes(
    queryVector: Float32Array, 
    options: VectorSearchOptions
  ): Promise<SearchResult[]> {
    const { limit, threshold = 0.5, includeDistances = false } = options;

    try {
      // Get all nodes with embeddings
      const nodesWithEmbeddings = this.db.prepare(`
        SELECT 
          node_type, 
          display_name, 
          description, 
          category, 
          package_name,
          embedding_vector,
          embedding_dimensions
        FROM nodes 
        WHERE embedding_vector IS NOT NULL
      `).all() as Array<{
        node_type: string;
        display_name: string;
        description: string;
        category: string;
        package_name: string;
        embedding_vector: Buffer;
        embedding_dimensions: number;
      }>;

      // Calculate cosine similarity for each node
      const similarities: Array<{
        node: typeof nodesWithEmbeddings[0];
        similarity: number;
      }> = [];

      for (const node of nodesWithEmbeddings) {
        try {
          const nodeEmbedding = new Float32Array(node.embedding_vector.buffer);
          const similarity = this.calculateCosineSimilarity(queryVector, nodeEmbedding);
          
          if (similarity >= threshold) {
            similarities.push({ node, similarity });
          }
        } catch (error) {
          logger.debug(`Failed to calculate similarity for node ${node.node_type}:`, error);
        }
      }

      // Sort by similarity (descending) and limit results
      similarities.sort((a, b) => b.similarity - a.similarity);
      const topResults = similarities.slice(0, limit);

      // Convert to SearchResult format
      const results: SearchResult[] = topResults.map(({ node, similarity }) => ({
        nodeType: node.node_type,
        displayName: node.display_name,
        description: node.description || '',
        category: node.category || '',
        package: node.package_name,
        relevanceScore: similarity,
        searchMethod: 'vector',
        metadata: includeDistances ? { vectorSimilarity: similarity } : undefined
      }));

      logger.debug(`Found ${results.length} similar nodes with similarity >= ${threshold}`);
      return results;

    } catch (error) {
      logger.error('Failed to find similar nodes:', error);
      return [];
    }
  }

  /**
   * Find similar templates using cosine similarity
   */
  async findSimilarTemplates(
    queryVector: Float32Array, 
    options: VectorSearchOptions
  ): Promise<SearchResult[]> {
    const { limit, threshold = 0.5, includeDistances = false } = options;

    try {
      // Get all templates with embeddings
      const templatesWithEmbeddings = this.db.prepare(`
        SELECT 
          id,
          workflow_id,
          name, 
          description, 
          categories,
          nodes_used,
          embedding_vector,
          embedding_dimensions
        FROM templates 
        WHERE embedding_vector IS NOT NULL
      `).all() as Array<{
        id: number;
        workflow_id: number;
        name: string;
        description: string;
        categories: string;
        nodes_used: string;
        embedding_vector: Buffer;
        embedding_dimensions: number;
      }>;

      // Calculate cosine similarity for each template
      const similarities: Array<{
        template: typeof templatesWithEmbeddings[0];
        similarity: number;
      }> = [];

      for (const template of templatesWithEmbeddings) {
        try {
          const templateEmbedding = new Float32Array(template.embedding_vector.buffer);
          const similarity = this.calculateCosineSimilarity(queryVector, templateEmbedding);
          
          if (similarity >= threshold) {
            similarities.push({ template, similarity });
          }
        } catch (error) {
          logger.debug(`Failed to calculate similarity for template ${template.id}:`, error);
        }
      }

      // Sort by similarity (descending) and limit results
      similarities.sort((a, b) => b.similarity - a.similarity);
      const topResults = similarities.slice(0, limit);

      // Convert to SearchResult format
      const results: SearchResult[] = topResults.map(({ template, similarity }) => ({
        nodeType: `template:${template.id}`,
        displayName: template.name,
        description: template.description || '',
        category: 'template',
        package: 'n8n-templates',
        relevanceScore: similarity,
        searchMethod: 'vector',
        metadata: includeDistances ? { vectorSimilarity: similarity } : undefined
      }));

      logger.debug(`Found ${results.length} similar templates with similarity >= ${threshold}`);
      return results;

    } catch (error) {
      logger.error('Failed to find similar templates:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(a: Float32Array, b: Float32Array): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have the same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    
    // Handle NaN cases (zero vectors)
    return isNaN(similarity) ? 0 : similarity;
  }

  /**
   * Get nodes that need embeddings (missing or outdated)
   */
  async getNodesNeedingEmbeddings(): Promise<Array<{
    node_type: string;
    display_name: string;
    description: string;
    category: string;
    documentation: string;
    operations: string;
    current_hash?: string;
  }>> {
    const stmt = this.db.prepare(`
      SELECT 
        node_type, 
        display_name, 
        description, 
        category, 
        documentation, 
        operations,
        embedding_content_hash as current_hash
      FROM nodes 
      WHERE embedding_vector IS NULL 
         OR embedding_content_hash IS NULL
         OR embedding_generated_at < updated_at
    `);

    try {
      const nodes = stmt.all() as Array<{
        node_type: string;
        display_name: string;
        description: string;
        category: string;
        documentation: string;
        operations: string;
        current_hash?: string;
      }>;

      logger.debug(`Found ${nodes.length} nodes needing embeddings`);
      return nodes;
    } catch (error) {
      logger.error('Failed to get nodes needing embeddings:', error);
      return [];
    }
  }

  /**
   * Get templates that need embeddings (missing or outdated)
   */
  async getTemplatesNeedingEmbeddings(): Promise<Array<{
    id: number;
    name: string;
    description: string;
    categories: string;
    current_hash?: string;
  }>> {
    const stmt = this.db.prepare(`
      SELECT 
        id,
        name, 
        description, 
        categories,
        embedding_content_hash as current_hash
      FROM templates 
      WHERE embedding_vector IS NULL 
         OR embedding_content_hash IS NULL
         OR embedding_generated_at < updated_at
    `);

    try {
      const templates = stmt.all() as Array<{
        id: number;
        name: string;
        description: string;
        categories: string;
        current_hash?: string;
      }>;

      logger.debug(`Found ${templates.length} templates needing embeddings`);
      return templates;
    } catch (error) {
      logger.error('Failed to get templates needing embeddings:', error);
      return [];
    }
  }

  /**
   * Get embedding statistics
   */
  async getEmbeddingStats(): Promise<{
    nodes: { total: number; withEmbeddings: number; percentage: number };
    templates: { total: number; withEmbeddings: number; percentage: number };
    totalEmbeddingSize: number;
    oldestEmbedding?: Date;
    newestEmbedding?: Date;
  }> {
    try {
      // Node statistics
      const nodeStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(embedding_vector) as with_embeddings,
          MIN(embedding_generated_at) as oldest,
          MAX(embedding_generated_at) as newest
        FROM nodes
      `).get() as { 
        total: number; 
        with_embeddings: number; 
        oldest?: string; 
        newest?: string; 
      };

      // Template statistics
      const templateStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(embedding_vector) as with_embeddings
        FROM templates
      `).get() as { total: number; with_embeddings: number };

      // Embedding size statistics
      const sizeStats = this.db.prepare(`
        SELECT 
          SUM(LENGTH(embedding_vector)) as total_size
        FROM (
          SELECT embedding_vector FROM nodes WHERE embedding_vector IS NOT NULL
          UNION ALL
          SELECT embedding_vector FROM templates WHERE embedding_vector IS NOT NULL
        )
      `).get() as { total_size: number };

      return {
        nodes: {
          total: nodeStats.total,
          withEmbeddings: nodeStats.with_embeddings,
          percentage: nodeStats.total > 0 ? (nodeStats.with_embeddings / nodeStats.total) * 100 : 0
        },
        templates: {
          total: templateStats.total,
          withEmbeddings: templateStats.with_embeddings,
          percentage: templateStats.total > 0 ? (templateStats.with_embeddings / templateStats.total) * 100 : 0
        },
        totalEmbeddingSize: sizeStats.total_size || 0,
        oldestEmbedding: nodeStats.oldest ? new Date(nodeStats.oldest) : undefined,
        newestEmbedding: nodeStats.newest ? new Date(nodeStats.newest) : undefined
      };
    } catch (error) {
      logger.error('Failed to get embedding statistics:', error);
      return {
        nodes: { total: 0, withEmbeddings: 0, percentage: 0 },
        templates: { total: 0, withEmbeddings: 0, percentage: 0 },
        totalEmbeddingSize: 0
      };
    }
  }

  /**
   * Delete embeddings for a node
   */
  async deleteEmbedding(nodeType: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE nodes 
      SET embedding_vector = NULL, 
          embedding_content_hash = NULL, 
          embedding_generated_at = NULL,
          embedding_model = NULL,
          embedding_dimensions = NULL
      WHERE node_type = ?
    `);

    try {
      stmt.run(nodeType);
      logger.debug(`Deleted embedding for node: ${nodeType}`);
    } catch (error) {
      logger.error(`Failed to delete embedding for node ${nodeType}:`, error);
      throw error;
    }
  }

  /**
   * Delete embeddings for a template
   */
  async deleteTemplateEmbedding(templateId: number): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE templates 
      SET embedding_vector = NULL, 
          embedding_content_hash = NULL, 
          embedding_generated_at = NULL,
          embedding_model = NULL,
          embedding_dimensions = NULL
      WHERE id = ?
    `);

    try {
      stmt.run(templateId);
      logger.debug(`Deleted embedding for template: ${templateId}`);
    } catch (error) {
      logger.error(`Failed to delete embedding for template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Batch save embeddings for multiple nodes
   */
  async batchSaveEmbeddings(embeddings: Array<{
    nodeType: string;
    embedding: Float32Array;
    contentHash: string;
    model?: string;
  }>): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE nodes 
      SET embedding_vector = ?, 
          embedding_content_hash = ?, 
          embedding_generated_at = CURRENT_TIMESTAMP,
          embedding_model = ?,
          embedding_dimensions = ?
      WHERE node_type = ?
    `);

    try {
      this.db.transaction(() => {
        for (const { nodeType, embedding, contentHash, model = 'text-embedding-3-small' } of embeddings) {
          const buffer = Buffer.from(embedding.buffer);
          stmt.run(buffer, contentHash, model, embedding.length, nodeType);
        }
      });

      logger.info(`Batch saved ${embeddings.length} node embeddings`);
    } catch (error) {
      logger.error('Failed to batch save embeddings:', error);
      throw error;
    }
  }

  /**
   * Check if vector storage is ready
   */
  async isVectorStorageReady(): Promise<boolean> {
    try {
      // Check if embedding columns exist
      const nodeColumns = this.db.prepare(`
        SELECT name FROM pragma_table_info('nodes')
      `).all() as { name: string }[];

      const existingColumns = new Set(nodeColumns.map(col => col.name));
      const requiredColumns = ['embedding_vector', 'embedding_content_hash', 'embedding_generated_at'];

      return requiredColumns.every(col => existingColumns.has(col));
    } catch (error) {
      logger.error('Failed to check vector storage readiness:', error);
      return false;
    }
  }
}