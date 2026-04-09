-- Diricontext Schema v1
-- Complete initial schema for graph-based project knowledge.

-- ── Schema Version Tracking ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Namespaces ───────────────────────────────────────────────────────
CREATE TABLE namespaces (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('docs', 'plan', 'reference')),
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(type, name)
);

-- ── Nodes ────────────────────────────────────────────────────────────
CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  namespace_id TEXT NOT NULL REFERENCES namespaces(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'BACKLOG',
  labels TEXT DEFAULT '[]',
  metadata TEXT DEFAULT '{}',
  parent_id TEXT REFERENCES nodes(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Edges ────────────────────────────────────────────────────────────
CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  target_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'hard' CHECK(kind IN ('hard', 'soft')),
  strength TEXT CHECK(strength IN ('soft', 'medium', 'strong')),
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_id, target_id, type)
);

-- ── FTS5 Full-Text Search ────────────────────────────────────────────
CREATE VIRTUAL TABLE nodes_fts USING fts5(
  title,
  description,
  labels,
  content=nodes,
  content_rowid=rowid
);

-- ── FTS5 Sync Triggers ───────────────────────────────────────────────

CREATE TRIGGER nodes_fts_insert AFTER INSERT ON nodes BEGIN
  INSERT INTO nodes_fts(rowid, title, description, labels)
  VALUES (new.rowid, new.title, new.description, new.labels);
END;

CREATE TRIGGER nodes_fts_delete AFTER DELETE ON nodes BEGIN
  INSERT INTO nodes_fts(nodes_fts, rowid, title, description, labels)
  VALUES ('delete', old.rowid, old.title, old.description, old.labels);
END;

CREATE TRIGGER nodes_fts_update AFTER UPDATE ON nodes BEGIN
  INSERT INTO nodes_fts(nodes_fts, rowid, title, description, labels)
  VALUES ('delete', old.rowid, old.title, old.description, old.labels);
  INSERT INTO nodes_fts(rowid, title, description, labels)
  VALUES (new.rowid, new.title, new.description, new.labels);
END;

-- ── Indexes ──────────────────────────────────────────────────────────
CREATE INDEX idx_nodes_namespace ON nodes(namespace_id);
CREATE INDEX idx_nodes_type ON nodes(type);
CREATE INDEX idx_nodes_status ON nodes(status);
CREATE INDEX idx_nodes_parent ON nodes(parent_id);
CREATE INDEX idx_edges_source ON edges(source_id);
CREATE INDEX idx_edges_target ON edges(target_id);
CREATE INDEX idx_edges_type ON edges(type);

-- ── Seed Default Namespaces ──────────────────────────────────────────
INSERT OR IGNORE INTO namespaces (id, type, name, description)
  VALUES ('docs', 'docs', 'docs', 'Documentation — what IS');

INSERT OR IGNORE INTO namespaces (id, type, name, description)
  VALUES ('plan', 'plan', 'plan', 'Planning — what WILL BE');
