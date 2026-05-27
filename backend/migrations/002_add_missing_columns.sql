-- ============================================================================
-- Migration 002 — Add missing columns required by docs/API_CONTRACT.md
-- ============================================================================
-- Safe to re-run: every statement uses IF NOT EXISTS.
-- Run in Supabase SQL editor or via `psql $SUPABASE_DB_URL -f 002_add_missing_columns.sql`.
-- ============================================================================

-- ----- items ----------------------------------------------------------------
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS spice_levels   text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS prep_minutes   integer     NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS category       text        NOT NULL DEFAULT 'side',
  ADD COLUMN IF NOT EXISTS ingredients    text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_vegetarian  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vegan       boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_gluten_free boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();

-- Constrain category to known values (relaxed — keeps "side" as the catch-all)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'items_category_check'
  ) THEN
    ALTER TABLE items
      ADD CONSTRAINT items_category_check
      CHECK (category IN ('biryani','curry','appetizer','bread','dessert','drink','side'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_items_in_stock ON items(in_stock);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);

-- ----- orders ---------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS completed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS pickup_eta     timestamptz,
  ADD COLUMN IF NOT EXISTS order_number   text;

-- Unique-but-nullable: nulls are allowed (orders that haven't been submitted)
CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_order_number ON orders(order_number) WHERE order_number IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_conversation ON orders(conversation_id);

-- ----- order_lines ----------------------------------------------------------
ALTER TABLE order_lines
  ADD COLUMN IF NOT EXISTS modifiers jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_order_lines_order ON order_lines(order_id);

-- ----- Order-number sequence ------------------------------------------------
-- Starts at 1042 so the first issued order_number is P-1042 (matches our test fixtures).
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1042;
