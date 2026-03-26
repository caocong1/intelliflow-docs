-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS zhparser;

-- Chinese text search configuration
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'zhparser_cfg') THEN
    CREATE TEXT SEARCH CONFIGURATION zhparser_cfg (PARSER = zhparser);
    ALTER TEXT SEARCH CONFIGURATION zhparser_cfg ADD MAPPING FOR n,v,a,i,e,l,j WITH simple;
  END IF;
END
$$;

-- GIN trigram indexes for fuzzy search (ILIKE optimization)
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm ON documents USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_description_trgm ON documents USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_name_trgm ON projects USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_projects_description_trgm ON projects USING GIN (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_workflows_name_trgm ON workflows USING GIN (name gin_trgm_ops);

-- tsvector generated columns for Chinese full-text search
ALTER TABLE documents ADD COLUMN IF NOT EXISTS title_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('zhparser_cfg', coalesce(title, ''))) STORED;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS description_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('zhparser_cfg', coalesce(description, ''))) STORED;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS name_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('zhparser_cfg', coalesce(name, ''))) STORED;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('zhparser_cfg', coalesce(description, ''))) STORED;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS name_tsv tsvector
  GENERATED ALWAYS AS (to_tsvector('zhparser_cfg', coalesce(name, ''))) STORED;

-- GIN indexes on tsvector columns for full-text search
CREATE INDEX IF NOT EXISTS idx_documents_title_fts ON documents USING GIN (title_tsv);
CREATE INDEX IF NOT EXISTS idx_documents_description_fts ON documents USING GIN (description_tsv);
CREATE INDEX IF NOT EXISTS idx_projects_name_fts ON projects USING GIN (name_tsv);
CREATE INDEX IF NOT EXISTS idx_projects_description_fts ON projects USING GIN (description_tsv);
CREATE INDEX IF NOT EXISTS idx_workflows_name_fts ON workflows USING GIN (name_tsv);
