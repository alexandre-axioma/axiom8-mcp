-- Semantic Search Schema Extension
-- Extends the existing nodes table with embedding columns for vector search

-- Add embedding columns to existing nodes table
-- These columns will be added via migration, not recreated
ALTER TABLE nodes ADD COLUMN embedding_vector BLOB;
ALTER TABLE nodes ADD COLUMN embedding_content_hash TEXT;
ALTER TABLE nodes ADD COLUMN embedding_generated_at DATETIME;
ALTER TABLE nodes ADD COLUMN embedding_model TEXT DEFAULT 'text-embedding-3-small';
ALTER TABLE nodes ADD COLUMN embedding_dimensions INTEGER DEFAULT 1536;

-- Create index for content hash lookups (for efficient change detection)
CREATE INDEX IF NOT EXISTS idx_embedding_content_hash ON nodes(embedding_content_hash);

-- Create index for embedding generation tracking
CREATE INDEX IF NOT EXISTS idx_embedding_generated_at ON nodes(embedding_generated_at);

-- Create index for embedding model tracking
CREATE INDEX IF NOT EXISTS idx_embedding_model ON nodes(embedding_model);

-- Templates table embedding extensions
ALTER TABLE templates ADD COLUMN embedding_vector BLOB;
ALTER TABLE templates ADD COLUMN embedding_content_hash TEXT;
ALTER TABLE templates ADD COLUMN embedding_generated_at DATETIME;
ALTER TABLE templates ADD COLUMN embedding_model TEXT DEFAULT 'text-embedding-3-small';
ALTER TABLE templates ADD COLUMN embedding_dimensions INTEGER DEFAULT 1536;

-- Create indexes for templates embeddings
CREATE INDEX IF NOT EXISTS idx_template_embedding_content_hash ON templates(embedding_content_hash);
CREATE INDEX IF NOT EXISTS idx_template_embedding_generated_at ON templates(embedding_generated_at);

-- Create search statistics table for monitoring
CREATE TABLE IF NOT EXISTS search_statistics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  search_method TEXT NOT NULL CHECK(search_method IN ('fts5', 'vector', 'hybrid')),
  results_count INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  user_agent TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  
  -- Performance metrics
  fts_time_ms INTEGER,
  vector_time_ms INTEGER,
  rrf_time_ms INTEGER,
  cohere_time_ms INTEGER,
  
  -- Cost tracking
  embedding_cost REAL DEFAULT 0,
  cohere_cost REAL DEFAULT 0,
  
  -- Result quality
  clicked_result_rank INTEGER,
  user_satisfaction INTEGER CHECK(user_satisfaction BETWEEN 1 AND 5)
);

-- Create indexes for search statistics
CREATE INDEX IF NOT EXISTS idx_search_stats_timestamp ON search_statistics(timestamp);
CREATE INDEX IF NOT EXISTS idx_search_stats_method ON search_statistics(search_method);
CREATE INDEX IF NOT EXISTS idx_search_stats_query ON search_statistics(query);

-- Create embedding generation log table
CREATE TABLE IF NOT EXISTS embedding_generation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL,
  node_type TEXT,
  template_id INTEGER,
  content_hash TEXT NOT NULL,
  embedding_model TEXT NOT NULL,
  generation_time_ms INTEGER NOT NULL,
  token_count INTEGER,
  cost REAL,
  status TEXT NOT NULL CHECK(status IN ('success', 'failed', 'skipped')),
  error_message TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for embedding generation log
CREATE INDEX IF NOT EXISTS idx_embedding_log_batch_id ON embedding_generation_log(batch_id);
CREATE INDEX IF NOT EXISTS idx_embedding_log_timestamp ON embedding_generation_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_embedding_log_status ON embedding_generation_log(status);
CREATE INDEX IF NOT EXISTS idx_embedding_log_content_hash ON embedding_generation_log(content_hash);

-- Create search cache table for performance optimization
CREATE TABLE IF NOT EXISTS search_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query_hash TEXT NOT NULL UNIQUE,
  query_text TEXT NOT NULL,
  search_options TEXT NOT NULL, -- JSON string
  results TEXT NOT NULL, -- JSON string
  search_method TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  hit_count INTEGER DEFAULT 0,
  last_accessed DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for search cache
CREATE INDEX IF NOT EXISTS idx_search_cache_query_hash ON search_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_search_cache_expires_at ON search_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_search_cache_created_at ON search_cache(created_at);

-- Create triggers to update FTS5 tables when embeddings are added
-- This ensures both lexical and semantic search indexes stay in sync

-- Update nodes_fts trigger to include embedding metadata
DROP TRIGGER IF EXISTS nodes_fts_update;
CREATE TRIGGER IF NOT EXISTS nodes_fts_update AFTER UPDATE ON nodes
BEGIN
  UPDATE nodes_fts 
  SET node_type = new.node_type,
      display_name = new.display_name,
      description = new.description,
      documentation = new.documentation,
      operations = new.operations,
      node_source_code = new.node_source_code
  WHERE rowid = new.rowid;
END;

-- Update templates_fts trigger to include embedding metadata
DROP TRIGGER IF EXISTS templates_fts_update;
CREATE TRIGGER IF NOT EXISTS templates_fts_update AFTER UPDATE ON templates
BEGIN
  UPDATE templates_fts 
  SET name = new.name,
      description = new.description
  WHERE rowid = new.id;
END;

-- Create cleanup triggers for old cache entries
CREATE TRIGGER IF NOT EXISTS cleanup_expired_cache 
AFTER INSERT ON search_cache
BEGIN
  DELETE FROM search_cache 
  WHERE expires_at < datetime('now');
END;

-- Create cleanup triggers for old logs (keep last 30 days)
CREATE TRIGGER IF NOT EXISTS cleanup_old_search_stats
AFTER INSERT ON search_statistics
BEGIN
  DELETE FROM search_statistics 
  WHERE timestamp < datetime('now', '-30 days');
END;

-- Create cleanup triggers for old embedding logs (keep last 90 days)
CREATE TRIGGER IF NOT EXISTS cleanup_old_embedding_logs
AFTER INSERT ON embedding_generation_log
BEGIN
  DELETE FROM embedding_generation_log 
  WHERE timestamp < datetime('now', '-90 days');
END;

-- Create views for easy access to embedding statistics
CREATE VIEW IF NOT EXISTS embedding_coverage AS
SELECT 
  'nodes' as table_name,
  COUNT(*) as total_records,
  COUNT(embedding_vector) as records_with_embeddings,
  ROUND(COUNT(embedding_vector) * 100.0 / COUNT(*), 2) as coverage_percentage,
  MIN(embedding_generated_at) as first_embedding_date,
  MAX(embedding_generated_at) as last_embedding_date
FROM nodes
UNION ALL
SELECT 
  'templates' as table_name,
  COUNT(*) as total_records,
  COUNT(embedding_vector) as records_with_embeddings,
  ROUND(COUNT(embedding_vector) * 100.0 / COUNT(*), 2) as coverage_percentage,
  MIN(embedding_generated_at) as first_embedding_date,
  MAX(embedding_generated_at) as last_embedding_date
FROM templates;

-- Create view for search performance metrics
CREATE VIEW IF NOT EXISTS search_performance_summary AS
SELECT 
  search_method,
  COUNT(*) as total_searches,
  ROUND(AVG(response_time_ms), 2) as avg_response_time_ms,
  ROUND(AVG(results_count), 2) as avg_results_count,
  SUM(embedding_cost + cohere_cost) as total_cost,
  DATE(timestamp) as date
FROM search_statistics
GROUP BY search_method, DATE(timestamp)
ORDER BY date DESC, search_method;

-- Create view for cost analysis
CREATE VIEW IF NOT EXISTS search_cost_analysis AS
SELECT 
  DATE(timestamp) as date,
  SUM(embedding_cost) as daily_embedding_cost,
  SUM(cohere_cost) as daily_cohere_cost,
  SUM(embedding_cost + cohere_cost) as daily_total_cost,
  COUNT(*) as daily_searches
FROM search_statistics
GROUP BY DATE(timestamp)
ORDER BY date DESC;

-- Validation queries to ensure schema is correct
-- These will be run during migration to verify the schema

-- Check if all required columns exist
SELECT 
  name, 
  type, 
  dflt_value, 
  notnull, 
  pk 
FROM pragma_table_info('nodes') 
WHERE name IN ('embedding_vector', 'embedding_content_hash', 'embedding_generated_at', 'embedding_model', 'embedding_dimensions');

-- Check if all required indexes exist
SELECT name, tbl_name, sql 
FROM sqlite_master 
WHERE type = 'index' 
AND name IN ('idx_embedding_content_hash', 'idx_embedding_generated_at', 'idx_embedding_model');

-- Check if all required tables exist
SELECT name, type, sql 
FROM sqlite_master 
WHERE type = 'table' 
AND name IN ('search_statistics', 'embedding_generation_log', 'search_cache');

-- Check if all required views exist
SELECT name, type, sql 
FROM sqlite_master 
WHERE type = 'view' 
AND name IN ('embedding_coverage', 'search_performance_summary', 'search_cost_analysis');