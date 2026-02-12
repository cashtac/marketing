-- ═══════════════════════════════════════════════════════
-- Secure Access Architecture — D1 Schema
-- ═══════════════════════════════════════════════════════

-- Admin users (only you — not publicly accessible)
CREATE TABLE IF NOT EXISTS admin_users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT    UNIQUE NOT NULL,
  email         TEXT    UNIQUE NOT NULL,
  password_hash TEXT    NOT NULL,
  totp_secret   TEXT    NOT NULL,
  name          TEXT    NOT NULL,
  created_at    TEXT    DEFAULT (datetime('now')),
  updated_at    TEXT    DEFAULT (datetime('now'))
);

-- Active sessions (refresh tokens)
CREATE TABLE IF NOT EXISTS sessions (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id             TEXT    NOT NULL REFERENCES admin_users(user_id),
  refresh_token_hash  TEXT    UNIQUE NOT NULL,
  device_fingerprint  TEXT,
  ip_address          TEXT,
  geo_country         TEXT,
  geo_city            TEXT,
  user_agent          TEXT,
  expires_at          TEXT    NOT NULL,
  created_at          TEXT    DEFAULT (datetime('now')),
  revoked             INTEGER DEFAULT 0
);

-- Delegated share links
CREATE TABLE IF NOT EXISTS share_links (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash          TEXT    UNIQUE NOT NULL,
  label               TEXT,
  role                TEXT    NOT NULL,
  allowed_tabs        TEXT,           -- JSON array: ["dashboard","tasks","locations"]
  allowed_modules     TEXT,           -- JSON array: ["campaigns","approvals"]
  data_scope          TEXT,           -- JSON: {"campus":"gmu","department":"marketing"}
  read_only           INTEGER DEFAULT 1,
  device_bound        INTEGER DEFAULT 0,
  device_fingerprint  TEXT,           -- Set on first access if device_bound=1
  max_uses            INTEGER,        -- NULL = unlimited
  use_count           INTEGER DEFAULT 0,
  expires_at          TEXT    NOT NULL,
  revoked             INTEGER DEFAULT 0,
  created_by          TEXT    NOT NULL REFERENCES admin_users(user_id),
  created_at          TEXT    DEFAULT (datetime('now')),
  last_used_at        TEXT
);

-- Rate limiting log
CREATE TABLE IF NOT EXISTS rate_limits (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ip_address    TEXT    NOT NULL,
  endpoint      TEXT    NOT NULL,
  attempts      INTEGER DEFAULT 1,
  window_start  TEXT    DEFAULT (datetime('now')),
  blocked_until TEXT
);

-- Access audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type    TEXT    NOT NULL,  -- 'admin_login', 'link_created', 'link_used', 'link_revoked', 'auth_failed'
  actor_id      TEXT,
  ip_address    TEXT,
  geo_country   TEXT,
  details       TEXT,              -- JSON blob
  created_at    TEXT    DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user     ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token    ON sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_links_token       ON share_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_links_revoked     ON share_links(revoked);
CREATE INDEX IF NOT EXISTS idx_rate_ip_endpoint  ON rate_limits(ip_address, endpoint);
CREATE INDEX IF NOT EXISTS idx_audit_type        ON audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_time        ON audit_log(created_at);
