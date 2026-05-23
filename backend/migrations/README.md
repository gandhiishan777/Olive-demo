# Migrations

Lightweight migrations against the Supabase Postgres instance. Apply in order.

## Files

| File | What it does | When to run |
|---|---|---|
| `001_baseline.sql` | Informational only — documents the pre-existing schema. **Do not run.** | — |
| `002_add_missing_columns.sql` | Adds the columns the API contract needs (spice_levels, prep_minutes, category, ingredients, dietary flags, customer_phone, completed_at, pickup_eta, order_number, modifiers, calls table, order-number sequence). All `ADD COLUMN IF NOT EXISTS`. | Once, before starting the backend |
| `003_populate_existing_rows.sql.template` | Template to fill in the new columns on existing menu rows. **Edit before running** (the rules are case-insensitive `LIKE` matches against item names that may not all hit). | Once, after `002`. Copy the `.template` to `.sql`, customize, then run. |

## How to run

### Option A — Supabase SQL editor (easiest)

1. Open your Supabase project → **SQL editor**.
2. Paste the contents of `002_add_missing_columns.sql`. Click **Run**.
3. Open `003_populate_existing_rows.sql.template`. Copy. Edit name patterns to match your real Paradise Biryani menu. Paste into SQL editor. Run.
4. Verify with:
   ```sql
   SELECT name, category, prep_minutes, spice_levels FROM items WHERE category = 'side';
   ```
   Anything in the result is unmatched — add `UPDATE` rules for those names.

### Option B — `psql` CLI

```bash
# Get URL from .env (SUPABASE_DB_URL)
psql "$SUPABASE_DB_URL" -f 002_add_missing_columns.sql
cp 003_populate_existing_rows.sql.template 003_populate_existing_rows.sql
# edit 003 ...
psql "$SUPABASE_DB_URL" -f 003_populate_existing_rows.sql
```

## Safety

- `002` is **idempotent** — every statement uses `IF NOT EXISTS` / `DO $$ IF NOT EXISTS`. Safe to re-run.
- `003` uses `UPDATE … WHERE LOWER(name) LIKE …` — running it twice just rewrites the same values. Safe to re-run.

## Adding new migrations later

Number them `004_…`, `005_…`, etc. The backend doesn't manage migrations automatically (no Prisma / Drizzle / Knex) — for V0, the founder runs them manually. If we move past V0, swap in a migration runner like `node-pg-migrate` or `dbmate`.

## What about a rollback?

We don't write down-migrations for V0. If something breaks, restore from Supabase point-in-time recovery (Pro plan and up) or drop the new columns manually. The price of "no rollback" for V0 is acceptable because the schema changes only add nullable/default columns — they don't break existing app code.
