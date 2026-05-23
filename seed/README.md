# Menu ingest pipeline

Takes the founder's real menu in whatever format they give us (JSON, CSV, pasted text/markdown, or a photo) and normalizes it into `<restaurant>_menu.json` that the backend can seed from.

## When to use this

You're the founder, the restaurant just handed you their menu, and you want it live in Olive in under 60 seconds.

```bash
# 1. Pick whatever format you have:
pnpm --filter @olive/seed parse ~/Downloads/paradise.csv
pnpm --filter @olive/seed parse ~/Downloads/paradise.txt
pnpm --filter @olive/seed parse ~/Downloads/paradise.json
pnpm --filter @olive/seed parse ~/Downloads/paradise_photo.jpg     # vision (needs ANTHROPIC_API_KEY)

# 2. A preview table prints. Confirm with y. Output goes to seed/paradise_biryani_menu.json.

# 3. Seed the backend:
SEED_FILE=../seed/paradise_biryani_menu.json pnpm --filter @olive/backend seed
```

## Input formats

### JSON

Already in the target shape (`docs/API_CONTRACT.md` → `Item`). Use this for the canonical source of truth once the menu stabilizes. Accepts `price` (string `"$16.99"` or number) as well as `price_cents`.

```json
{
  "restaurant": "Paradise Biryani",
  "items": [
    { "name": "Chicken Biryani", "price_cents": 1699, "category": "biryani" }
  ]
}
```

### CSV

Columns (case-insensitive, all optional except `name` + `price`):

```
name,description,price,category,allergens,spice_levels,ingredients,is_vegetarian,is_vegan,is_gluten_free,prep_minutes,in_stock
Chicken Biryani,Aromatic basmati...,$16.99,biryani,dairy,mild;medium;hot,basmati;chicken;saffron,false,false,true,22,true
```

Multi-value cells use `;` or `,` (inside quotes) — e.g. `mild;medium;hot`. See `sample/menu.csv`.

### Markdown / text

Heuristic parser. Recognizes:
- `Chicken Biryani — $16.99 [description]` (em dash optional)
- `Chicken Biryani $16.99` (price after name)
- `Chicken Biryani ........ $16.99` (dotted leaders)
- `## Biryanis` headers → inferred category for following items
- Bullet markers (`*`, `-`, `•`) are stripped

Lines without a price are ignored. See `sample/menu.md` and `sample/menu.txt`.

### Photo / PDF page (vision)

Uses **Claude Sonnet** via the Anthropic SDK to extract items from an image of a menu. Requires `ANTHROPIC_API_KEY` in env. Cost: roughly **$0.01–0.03 per image** at current pricing. The model is instructed to **leave ingredients/allergens empty** rather than guess — fill those in after.

```bash
ANTHROPIC_API_KEY=sk-... pnpm --filter @olive/seed parse menu_photo.jpg
```

Supported: `.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`.

## What the pipeline does after parsing

1. **Normalize prices** to integer cents (`$16.99` → `1699`).
2. **Infer category** by keywords if none provided (`biryani`, `naan` → `bread`, `lassi` → `drink`, etc.).
3. **Default prep time** by category (`biryani` = 22 min, `curry` = 18, `bread` = 6, `dessert` = 4, `drink` = 3).
4. **Lowercase allergen tags** for case-insensitive matching.
5. **Validate** with zod. If a row fails, the parser reports which row and which field.
6. **Print a preview table** so a human eyeballs it before commit. Look for `⚠no-allergens` / `⚠no-ingredients` flags — those are fields the parser couldn't determine and someone should fill in for quality.
7. **Write** to `<sluggified-restaurant>_menu.json` in `seed/`.

## Validate an existing menu file

```bash
pnpm --filter @olive/seed validate seed/paradise_biryani_menu.json
```

Pass: exits 0 with item count. Fail: prints schema issues per row.

## Sample inputs

`sample/` contains testable fixtures for each parser:
- `sample/menu.csv`
- `sample/menu.md`
- `sample/menu.txt`

Run `pnpm test` to confirm all parsers still produce valid items from these.

## Honest limits

- **Vision is not perfect.** The model will miss items on busy photo menus, mis-OCR italic prices, and conflate items with descriptions. Treat the output as a draft; review every row in the preview table.
- **The parser does NOT guess ingredients or allergens.** Empty `ingredients: []` or `allergens: []` means "unknown" — not "none." If the founder doesn't supply these, the agent's allergen Q&A will be limited. Plan a 15-minute review pass before demo.
- **Spice levels.** If the CSV/text doesn't specify, `spice_levels: []` and the agent won't offer spice options for that item. Fill these in for biryanis and curries.
- **prep_minutes.** Defaults are reasonable per category but the restaurant should overwrite.

## Adding a new parser

1. Create `src/parsers/<format>.ts` exporting `parse<Format>File(path: string): Menu`.
2. Add a case branch in `src/index.ts:dispatch()`.
3. Drop a fixture in `sample/` and a test in `__tests__/parsers.test.ts`.

That's it.
