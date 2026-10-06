-- Cloudflare D1: revocable admin sessions, login rate limiting and idempotent editor publications.
CREATE TABLE IF NOT EXISTS sessions (
 token_hash TEXT PRIMARY KEY, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
 ip_hash TEXT PRIMARY KEY, attempts INTEGER NOT NULL, window_start INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS editor_publications (
 request_id TEXT PRIMARY KEY, revision TEXT NOT NULL, content_hash TEXT NOT NULL, created_at INTEGER NOT NULL
);
