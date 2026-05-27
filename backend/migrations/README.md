# Migrations

Apply in order against your Supabase Postgres via the SQL editor or `psql $SUPABASE_DB_URL -f <file>`.

| File | When to run |
|---|---|
| `002_add_missing_columns.sql` | Once. Adds the columns + `order_number_seq` the backend needs. All idempotent. |
| `003_populate_existing_rows.sql.template` | Once. Copy to `.sql`, edit `LIKE` patterns to match your real menu, run. |
| `004_drop_calls.sql` | Only if you ran the old version of `002` that created a `calls` table. Idempotent. |

After running, sanity-check:

```sql
SELECT name, category, prep_minutes, spice_levels
  FROM items
 WHERE category = 'side';
```

Anything left in `side` didn't match a rule in `003` — add an explicit UPDATE.
