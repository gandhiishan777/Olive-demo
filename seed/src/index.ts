import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { parseJsonFile } from "./parsers/json.js";
import { parseCsvFile } from "./parsers/csv.js";
import { parseTextFile } from "./parsers/text.js";
import { parseImageFile } from "./parsers/vision.js";
import { preview } from "./lib/preview.js";
import type { Menu } from "./lib/schema.js";

type Args = { input: string; out?: string; yes?: boolean; help?: boolean };

function parseArgs(argv: string[]): Args {
  const args: Args = { input: "" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--yes" || a === "-y") args.yes = true;
    else if (a.startsWith("--out=")) args.out = a.slice("--out=".length);
    else if (a === "--out") args.out = argv[++i];
    else if (!args.input) args.input = a;
  }
  return args;
}

const HELP = `
Olive menu ingest pipeline

Usage:
  pnpm --filter @olive/seed parse <input-file> [--out=path] [--yes]

Detected formats by extension:
  .json                  → JSON pass-through (with schema validation)
  .csv                   → CSV (semicolon-separated multi-values)
  .md, .txt              → heuristic text parser
  .png, .jpg, .jpeg, .webp, .gif → vision (Claude Sonnet)
                                   requires ANTHROPIC_API_KEY in env

If --out is not given, output is written to:
  seed/<sluggified-restaurant-name>_menu.json

Examples:
  pnpm --filter @olive/seed parse seed/sample/menu.csv
  pnpm --filter @olive/seed parse ~/Downloads/paradise_menu.txt --yes
  ANTHROPIC_API_KEY=sk-... pnpm --filter @olive/seed parse menu_photo.jpg
`;

async function confirm(prompt: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${prompt} [y/N] `, (a) => {
      rl.close();
      resolve(/^y/i.test(a.trim()));
    });
  });
}

async function dispatch(filePath: string): Promise<Menu> {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".json": return parseJsonFile(filePath);
    case ".csv": return parseCsvFile(filePath);
    case ".txt":
    case ".md": return parseTextFile(filePath);
    case ".png":
    case ".jpg":
    case ".jpeg":
    case ".webp":
    case ".gif": return parseImageFile(filePath);
    default: throw new Error(`Unsupported extension: ${ext}`);
  }
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.input) {
    console.log(HELP);
    process.exit(args.help ? 0 : 1);
  }

  const inputPath = path.resolve(process.cwd(), args.input);
  if (!fs.existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`Parsing ${path.relative(process.cwd(), inputPath)}...`);
  const menu = await dispatch(inputPath);

  console.log("\n" + preview(menu) + "\n");

  // Compute output path
  const outPath = args.out
    ? path.resolve(process.cwd(), args.out)
    : path.resolve(process.cwd(), `${slugify(menu.restaurant)}_menu.json`);

  if (!args.yes) {
    const ok = await confirm(`Write ${menu.items.length} items to ${outPath}?`);
    if (!ok) {
      console.log("Aborted. No file written.");
      process.exit(0);
    }
  }

  fs.writeFileSync(outPath, JSON.stringify({ ...menu, generated_at: new Date().toISOString() }, null, 2));
  console.log(`✓ Wrote ${outPath}`);
  console.log(`\nNext: SEED_FILE=${path.relative(path.resolve(process.cwd(), "../backend"), outPath)} pnpm --filter @olive/backend seed`);
}

main().catch((err) => {
  console.error(`✗ ${err.message}`);
  process.exit(1);
});
