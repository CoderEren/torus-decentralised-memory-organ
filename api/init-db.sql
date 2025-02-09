CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY,
    wallet TEXT NOT NULL,
    data TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    timestamp TIMESTAMP NOT NULL DEFAULT now(),
    deleted BOOLEAN DEFAULT false
);
