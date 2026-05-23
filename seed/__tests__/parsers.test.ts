import { describe, it, expect } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonFile } from "../src/parsers/json.js";
import { parseCsvFile } from "../src/parsers/csv.js";
import { parseTextFile, parseText } from "../src/parsers/text.js";
import { priceToCents, applyDefaults } from "../src/lib/normalize.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sample = (f: string) => path.resolve(__dirname, "..", "sample", f);

describe("normalize", () => {
  it("dollars to cents", () => {
    expect(priceToCents("$16.99")).toBe(1699);
    expect(priceToCents("14.50")).toBe(1450);
    expect(priceToCents(16.99)).toBe(1699);
    expect(priceToCents(1699)).toBe(1699);
  });
  it("applyDefaults infers category", () => {
    const r = applyDefaults({ name: "Chicken Biryani", price_cents: 1699 });
    expect(r.category).toBe("biryani");
    expect(r.prep_minutes).toBe(22);
  });
});

describe("csv parser", () => {
  it("parses sample menu", () => {
    const m = parseCsvFile(sample("menu.csv"));
    expect(m.items.length).toBe(5);
    expect(m.items[0]!.name).toBe("Chicken Biryani");
    expect(m.items[0]!.price_cents).toBe(1699);
    expect(m.items[0]!.spice_levels).toEqual(["mild", "medium", "hot"]);
    expect(m.items[0]!.allergens).toEqual(["dairy"]);
  });
});

describe("text parser", () => {
  it("parses dotted-leader format", () => {
    const m = parseTextFile(sample("menu.txt"));
    expect(m.items.length).toBe(6);
    expect(m.items[0]!.name).toBe("Chicken Biryani");
    expect(m.items[0]!.price_cents).toBe(1699);
  });
  it("parses markdown with category headers", () => {
    const m = parseTextFile(sample("menu.md"));
    expect(m.items.length).toBeGreaterThan(5);
    expect(m.items.find((i) => i.name === "Chicken Biryani")?.category).toBe("biryani");
    expect(m.items.find((i) => i.name === "Garlic Naan")?.category).toBe("bread");
  });
  it("skips lines without price", () => {
    const m = parseText("# Header without price\nChicken Biryani $16.99\nAnother decorative line");
    expect(m.items.length).toBe(1);
  });
});

describe("json parser", () => {
  it("parses placeholder menu", () => {
    const m = parseJsonFile(path.resolve(__dirname, "..", "placeholder_menu.json"));
    expect(m.items.length).toBe(12);
    expect(m.items[0]!.name).toBe("Chicken Biryani");
  });
});
