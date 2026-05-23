-- Olive V0 — SQLite schema
-- Single-restaurant local demo. All money in INTEGER cents.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS items (
  id              INTEGER PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  price_cents     INTEGER NOT NULL,
  in_stock        INTEGER NOT NULL DEFAULT 1,    -- bool
  allergens       TEXT NOT NULL DEFAULT '[]',    -- JSON array
  spice_levels    TEXT NOT NULL DEFAULT '[]',    -- JSON array
  prep_minutes    INTEGER NOT NULL DEFAULT 15,
  category        TEXT NOT NULL,
  ingredients     TEXT NOT NULL DEFAULT '[]',    -- JSON array
  is_vegetarian   INTEGER NOT NULL DEFAULT 0,
  is_vegan        INTEGER NOT NULL DEFAULT 0,
  is_gluten_free  INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_items_in_stock ON items(in_stock);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);

CREATE TABLE IF NOT EXISTS orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  status            TEXT NOT NULL DEFAULT 'open',  -- open|submitted|completed|cancelled
  customer_name     TEXT,
  customer_phone    TEXT,
  conversation_id   TEXT UNIQUE,
  total_cents       INTEGER NOT NULL DEFAULT 0,
  order_number      TEXT UNIQUE,                   -- e.g. P-1042 (assigned on submit)
  created_at        TEXT NOT NULL DEFAULT (datetime('now')),
  submitted_at      TEXT,
  completed_at      TEXT,
  pickup_eta        TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_conversation ON orders(conversation_id);

CREATE TABLE IF NOT EXISTS order_lines (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id          INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_id           INTEGER NOT NULL REFERENCES items(id),
  item_name         TEXT NOT NULL,                 -- snapshot
  quantity          INTEGER NOT NULL DEFAULT 1,
  unit_price_cents  INTEGER NOT NULL,              -- snapshot
  modifiers         TEXT NOT NULL DEFAULT '{}',    -- JSON object
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines(order_id);

CREATE TABLE IF NOT EXISTS calls (
  conversation_id     TEXT PRIMARY KEY,
  from_number         TEXT,
  started_at          TEXT NOT NULL DEFAULT (datetime('now')),
  ended_at            TEXT,
  duration_seconds    INTEGER,
  ended_reason        TEXT,
  estimated_cost_usd  REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_calls_from_number ON calls(from_number);
CREATE INDEX IF NOT EXISTS idx_calls_started ON calls(started_at);

-- Counter for human-readable order numbers
CREATE TABLE IF NOT EXISTS counters (
  name   TEXT PRIMARY KEY,
  value  INTEGER NOT NULL
);

INSERT OR IGNORE INTO counters (name, value) VALUES ('order_number', 1041);
