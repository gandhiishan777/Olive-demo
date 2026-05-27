-- ============================================================================
-- Migration 004 — Drop calls table (V0 simplification: no auth, no rate-limit)
-- ============================================================================
-- Run AFTER 002 has been applied. Idempotent.
-- Removes the `calls` table and its indexes — no longer used by the backend
-- after we ripped out auth + rate-limiting + call-lifecycle webhooks.
-- ============================================================================

DROP INDEX IF EXISTS idx_calls_from_number;
DROP INDEX IF EXISTS idx_calls_started;
DROP TABLE IF EXISTS calls;
