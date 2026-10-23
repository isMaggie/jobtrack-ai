CREATE TABLE gmail_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  email TEXT NOT NULL,
  tokens TEXT NOT NULL
);
CREATE TABLE gmail_imports (
  email TEXT NOT NULL,
  message_id TEXT NOT NULL,
  draft JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (email, message_id)
);
