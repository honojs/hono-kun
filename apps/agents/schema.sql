-- Shadow-mode evaluation records. hono-kun-github inserts the metadata row when it dispatches
-- an evaluation; the Reviewer agent's record_verdict tool fills in the verdict.
CREATE TABLE IF NOT EXISTS evaluations (
  delivery_id TEXT PRIMARY KEY,
  repository TEXT,
  pr_number INTEGER,
  pr_url TEXT,
  author TEXT,
  title TEXT,
  trigger_kind TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  summary TEXT,
  risks TEXT,
  quality TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
