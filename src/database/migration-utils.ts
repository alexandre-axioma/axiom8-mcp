/**
 * Database Migration Utilities for Semantic Search Enhancement
 * 
 * Handles safe migration of database schema to support embedding columns
 * without breaking existing functionality.
 */

import { DatabaseAdapter } from './database-adapter';
import { logger } from '../utils/logger';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface MigrationResult {
  success: boolean;
  message: string;
  applied: boolean;
  backupPath?: string;
  errors?: string[];
}

export interface MigrationInfo {
  version: string;
  description: string;
  appliedAt?: Date;
  checksum?: string;
}

export class DatabaseMigrationUtils {
  private static readonly MIGRATION_TABLE = 'migration_history';
  private static readonly CURRENT_VERSION = '2.8.0-semantic-search';
  private static readonly BACKUP_SUFFIX = '.backup';

  constructor(private db: DatabaseAdapter) {}

  /**
   * Main migration method - safely migrate database to support semantic search
   */
  async migrateToSemanticSearch(options: {
    createBackup: boolean;
    forceReapply: boolean;
    dryRun: boolean;
  } = {
    createBackup: true,
    forceReapply: false,
    dryRun: false
  }): Promise<MigrationResult> {
    try {
      logger.info('Starting semantic search database migration...');

      // Initialize migration tracking table
      await this.initializeMigrationTable();

      // Check if migration already applied
      const currentMigration = await this.getMigrationInfo(DatabaseMigrationUtils.CURRENT_VERSION);
      if (currentMigration && !options.forceReapply) {
        logger.info('Semantic search migration already applied');
        return {
          success: true,
          message: 'Migration already applied',
          applied: false
        };
      }

      // Create backup if requested
      let backupPath: string | undefined;
      if (options.createBackup && !options.dryRun) {
        backupPath = await this.createBackup();
        logger.info(`Database backup created at: ${backupPath}`);
      }

      if (options.dryRun) {
        logger.info('Dry run mode - validating migration without applying changes');
        const validation = await this.validateMigration();
        return {
          success: validation.valid,
          message: validation.message,
          applied: false,
          errors: validation.errors
        };
      }

      // Apply migration
      const migrationResult = await this.applySemanticSearchMigration();
      
      if (migrationResult.success) {
        // Record migration in history
        await this.recordMigration({
          version: DatabaseMigrationUtils.CURRENT_VERSION,
          description: 'Add semantic search support with embedding columns',
          appliedAt: new Date(),
          checksum: await this.calculateMigrationChecksum()
        });

        logger.info('Semantic search migration completed successfully');
        return {
          success: true,
          message: 'Migration completed successfully',
          applied: true,
          backupPath
        };
      } else {
        logger.error('Migration failed:', migrationResult.message);
        return {
          success: false,
          message: `Migration failed: ${migrationResult.message}`,
          applied: false,
          backupPath,
          errors: migrationResult.errors
        };
      }

    } catch (error) {
      logger.error('Migration error:', error);
      return {
        success: false,
        message: `Migration error: ${error instanceof Error ? error.message : String(error)}`,
        applied: false,
        errors: [error instanceof Error ? error.message : String(error)]
      };
    }
  }

  /**
   * Initialize migration tracking table
   */
  private async initializeMigrationTable(): Promise<void> {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${DatabaseMigrationUtils.MIGRATION_TABLE} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        version TEXT NOT NULL UNIQUE,
        description TEXT NOT NULL,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        checksum TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    try {
      this.db.exec(createTableSQL);
      logger.debug('Migration table initialized');
    } catch (error) {
      logger.error('Failed to initialize migration table:', error);
      throw error;
    }
  }

  /**
   * Get migration info for a specific version
   */
  private async getMigrationInfo(version: string): Promise<MigrationInfo | null> {
    try {
      const result = this.db.prepare(`
        SELECT version, description, applied_at, checksum 
        FROM ${DatabaseMigrationUtils.MIGRATION_TABLE} 
        WHERE version = ?
      `).get(version) as any;

      if (!result) return null;

      return {
        version: result.version,
        description: result.description,
        appliedAt: result.applied_at ? new Date(result.applied_at) : undefined,
        checksum: result.checksum
      };
    } catch (error) {
      logger.error('Failed to get migration info:', error);
      return null;
    }
  }

  /**
   * Create database backup
   */
  private async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${process.cwd()}/data/nodes-backup-${timestamp}.db`;

    try {
      // For better-sqlite3, use backup method if available
      if (typeof (this.db as any).backup === 'function') {
        await (this.db as any).backup(backupPath);
      } else {
        // Fallback: read current database and write to backup
        const currentDbPath = path.join(process.cwd(), 'data', 'nodes.db');
        const currentDbData = await fs.readFile(currentDbPath);
        await fs.writeFile(backupPath, currentDbData);
      }

      logger.info(`Database backup created: ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error('Failed to create backup:', error);
      throw error;
    }
  }

  /**
   * Validate migration without applying
   */
  private async validateMigration(): Promise<{ valid: boolean; message: string; errors?: string[] }> {
    const errors: string[] = [];

    try {
      // Check if required tables exist
      const nodesTableExists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='nodes'
      `).get();

      if (!nodesTableExists) {
        errors.push('Nodes table does not exist');
      }

      const templatesTableExists = this.db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name='templates'
      `).get();

      if (!templatesTableExists) {
        errors.push('Templates table does not exist');
      }

      // Check if columns already exist
      const nodeColumns = this.db.prepare(`
        SELECT name FROM pragma_table_info('nodes')
      `).all() as { name: string }[];

      const existingColumns = new Set(nodeColumns.map(col => col.name));
      const requiredColumns = ['embedding_vector', 'embedding_content_hash', 'embedding_generated_at'];

      for (const column of requiredColumns) {
        if (existingColumns.has(column)) {
          logger.warn(`Column ${column} already exists in nodes table`);
        }
      }

      // Check database integrity
      const integrityCheck = this.db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
      if (integrityCheck.integrity_check !== 'ok') {
        errors.push(`Database integrity check failed: ${integrityCheck.integrity_check}`);
      }

      // Check available disk space (approximate)
      const stats = await fs.stat(path.join(process.cwd(), 'data', 'nodes.db'));
      const dbSizeBytes = stats.size;
      const requiredSpace = dbSizeBytes * 0.5; // Estimate 50% additional space needed

      try {
        const testFile = path.join(process.cwd(), 'data', 'space-test.tmp');
        await fs.writeFile(testFile, Buffer.alloc(Math.min(requiredSpace, 10 * 1024 * 1024))); // Test with up to 10MB
        await fs.unlink(testFile);
      } catch (spaceError) {
        errors.push('Insufficient disk space for migration');
      }

      return {
        valid: errors.length === 0,
        message: errors.length === 0 ? 'Migration validation passed' : 'Migration validation failed',
        errors: errors.length > 0 ? errors : undefined
      };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        valid: false,
        message: 'Migration validation failed',
        errors
      };
    }
  }

  /**
   * Apply the semantic search migration
   */
  private async applySemanticSearchMigration(): Promise<{ success: boolean; message: string; errors?: string[] }> {
    const errors: string[] = [];

    try {
      // Start transaction
      this.db.exec('BEGIN TRANSACTION');

      // Load and execute migration SQL
      const migrationSqlPath = path.join(__dirname, 'schema-semantic.sql');
      const migrationSql = await fs.readFile(migrationSqlPath, 'utf8');

      // Split SQL into individual statements
      const statements = migrationSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        try {
          // Skip view and trigger creation statements if they cause issues
          if (statement.toLowerCase().includes('create view') || 
              statement.toLowerCase().includes('create trigger')) {
            try {
              this.db.exec(statement);
            } catch (viewError) {
              logger.warn(`Non-critical statement failed: ${statement.substring(0, 50)}...`, viewError);
            }
          } else {
            this.db.exec(statement);
          }
        } catch (stmtError) {
          const errorMsg = `Failed to execute statement: ${statement.substring(0, 50)}... Error: ${stmtError}`;
          logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // Commit transaction if no critical errors
      if (errors.length === 0) {
        this.db.exec('COMMIT');
        logger.info('Migration transaction committed successfully');
        return {
          success: true,
          message: 'Migration applied successfully'
        };
      } else {
        this.db.exec('ROLLBACK');
        logger.error('Migration transaction rolled back due to errors');
        return {
          success: false,
          message: 'Migration failed and was rolled back',
          errors
        };
      }

    } catch (error) {
      try {
        this.db.exec('ROLLBACK');
      } catch (rollbackError) {
        logger.error('Failed to rollback transaction:', rollbackError);
      }

      const errorMsg = `Migration error: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(errorMsg);
      errors.push(errorMsg);

      return {
        success: false,
        message: 'Migration failed with errors',
        errors
      };
    }
  }

  /**
   * Record migration in history
   */
  private async recordMigration(info: MigrationInfo): Promise<void> {
    try {
      this.db.prepare(`
        INSERT OR REPLACE INTO ${DatabaseMigrationUtils.MIGRATION_TABLE} 
        (version, description, applied_at, checksum) 
        VALUES (?, ?, ?, ?)
      `).run(info.version, info.description, info.appliedAt?.toISOString(), info.checksum);

      logger.info(`Migration recorded: ${info.version}`);
    } catch (error) {
      logger.error('Failed to record migration:', error);
      throw error;
    }
  }

  /**
   * Calculate migration checksum for integrity verification
   */
  private async calculateMigrationChecksum(): Promise<string> {
    try {
      const migrationSqlPath = path.join(__dirname, 'schema-semantic.sql');
      const migrationSql = await fs.readFile(migrationSqlPath, 'utf8');
      return crypto.createHash('sha256').update(migrationSql).digest('hex');
    } catch (error) {
      logger.warn('Failed to calculate migration checksum:', error);
      return '';
    }
  }

  /**
   * Get migration history
   */
  async getMigrationHistory(): Promise<MigrationInfo[]> {
    try {
      const migrations = this.db.prepare(`
        SELECT version, description, applied_at, checksum 
        FROM ${DatabaseMigrationUtils.MIGRATION_TABLE} 
        ORDER BY applied_at DESC
      `).all() as any[];

      return migrations.map(m => ({
        version: m.version,
        description: m.description,
        appliedAt: m.applied_at ? new Date(m.applied_at) : undefined,
        checksum: m.checksum
      }));
    } catch (error) {
      logger.error('Failed to get migration history:', error);
      return [];
    }
  }

  /**
   * Check if database is ready for semantic search
   */
  async isSemanticSearchReady(): Promise<boolean> {
    try {
      // Check if embedding columns exist
      const nodeColumns = this.db.prepare(`
        SELECT name FROM pragma_table_info('nodes')
      `).all() as { name: string }[];

      const existingColumns = new Set(nodeColumns.map(col => col.name));
      const requiredColumns = ['embedding_vector', 'embedding_content_hash', 'embedding_generated_at'];

      return requiredColumns.every(col => existingColumns.has(col));
    } catch (error) {
      logger.error('Failed to check semantic search readiness:', error);
      return false;
    }
  }

  /**
   * Get embedding coverage statistics
   */
  async getEmbeddingCoverage(): Promise<{
    nodes: { total: number; withEmbeddings: number; percentage: number };
    templates: { total: number; withEmbeddings: number; percentage: number };
  }> {
    try {
      const nodeStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(embedding_vector) as with_embeddings
        FROM nodes
      `).get() as { total: number; with_embeddings: number };

      const templateStats = this.db.prepare(`
        SELECT 
          COUNT(*) as total,
          COUNT(embedding_vector) as with_embeddings
        FROM templates
      `).get() as { total: number; with_embeddings: number };

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
        }
      };
    } catch (error) {
      logger.error('Failed to get embedding coverage:', error);
      return {
        nodes: { total: 0, withEmbeddings: 0, percentage: 0 },
        templates: { total: 0, withEmbeddings: 0, percentage: 0 }
      };
    }
  }
}