import fs from "node:fs";
import { MenuSchema, type Menu, type Item } from "../lib/schema.js";
import { applyDefaults, priceToCents } from "../lib/normalize.js";

/**
 * Heuristic parser for pasted menu text. Handles common shapes:
 *   - "Chicken Biryani — $16.99"
 *   - "Chicken Biryani  $16.99  Aromatic basmati rice with..."
 *   - "## Biryanis" → inferred category for following items
 *   - "* Chicken Biryani $16.99"
 *
 * Lines without a price are skipped (treated as headers/decoration).
 */
const HEADER_RE = /^(?:#+|=+|-{3,})\s*(.+?)\s*(?:#+|=+|-{3,})?$/;
const PRICE_RE = /\$?\s*(\d{1,3}(?:[.,]\d{2})?)/;

const KNOWN_CATEGORIES = ["biryani", "curry", "appetizer", "bread", "dessert", "drink", "side"];

export function parseTextFile(path: string): Menu {
  const text = fs.readFileSync(path, "utf8");
  return parseText(text);
}

export function parseText(text: string): Menu {
  const lines = text.split(/\r?\n/);
  let currentCategory: string | undefined;
  const items: Item[] = [];

  for (let raw of lines) {
    raw = raw.replace(/^[*\-•·>]\s*/, "").trim();
    if (!raw) continue;

    const headerMatch = raw.match(HEADER_RE);
    if (headerMatch && headerMatch[1] && !PRICE_RE.test(headerMatch[1])) {
      const inferred = KNOWN_CATEGORIES.find((c) => headerMatch[1].toLowerCase().includes(c));
      if (inferred) currentCategory = inferred;
      continue;
    }

    const priceMatch = raw.match(/[\$£€]\s*\d{1,3}(?:[.,]\d{2})?/);
    if (!priceMatch) continue;
    const price = priceMatch[0];
    const priceIdx = raw.indexOf(price);

    // Strip dotted leaders, em-dashes, and trailing currency-line ornaments
    const before = raw.slice(0, priceIdx).replace(/[.\s–—-]+$/, "").trim();
    const after = raw.slice(priceIdx + price.length).trim();

    if (!before) continue;

    items.push(
      applyDefaults({
        name: before,
        description: after,
        price_cents: priceToCents(price),
        category: currentCategory,
      }),
    );
  }

  return MenuSchema.parse({ items });
}
