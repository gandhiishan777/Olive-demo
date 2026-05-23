import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { MenuSchema, type Menu } from "../lib/schema.js";
import { applyDefaults } from "../lib/normalize.js";

const EXTRACTION_PROMPT = `You are a restaurant menu extractor. From the attached image of a menu, extract every distinct item.

Return ONLY a JSON object of the shape:
{
  "items": [
    {
      "name": "string",
      "description": "string (omit if not shown)",
      "price_cents": integer (e.g. 1699 for $16.99),
      "category": "biryani"|"curry"|"appetizer"|"bread"|"dessert"|"drink"|"side"
    }
  ]
}

Rules:
- Do NOT guess ingredients or allergens — leave those for a human to fill in.
- Do NOT invent items.
- If a price is not clearly readable, skip the item.
- If an item lists multiple sizes, emit one item per size with the size in the name.
- Output STRICT JSON only. No code fences, no commentary.`;

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function parseImageFile(imagePath: string, opts: { model?: string; apiKey?: string } = {}): Promise<Menu> {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY required for vision parsing");
  const ext = path.extname(imagePath).toLowerCase().slice(1);
  const mediaTypeMap: Record<string, "image/jpeg" | "image/png" | "image/webp" | "image/gif"> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  };
  const media_type = mediaTypeMap[ext];
  if (!media_type) throw new Error(`Unsupported image type: ${ext}`);

  const stat = fs.statSync(imagePath);
  if (stat.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image too large: ${(stat.size / 1024 / 1024).toFixed(1)} MB (max ${MAX_IMAGE_BYTES / 1024 / 1024} MB). Resize before parsing.`);
  }

  const data = fs.readFileSync(imagePath).toString("base64");
  const client = new Anthropic({ apiKey });
  const res = await client.messages.create({
    model: opts.model ?? process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type, data } },
          { type: "text", text: EXTRACTION_PROMPT },
        ],
      },
    ],
  });

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("Empty response from vision model");
  const jsonText = textBlock.text.trim().replace(/^```json\s*|\s*```$/g, "");
  const parsed = JSON.parse(jsonText) as { items: unknown[] };

  const items = (parsed.items as Record<string, unknown>[]).map((i) =>
    applyDefaults({
      name: String(i.name),
      description: typeof i.description === "string" ? i.description : "",
      price_cents: Number(i.price_cents),
      category: typeof i.category === "string" ? i.category : undefined,
    }),
  );

  return MenuSchema.parse({ items });
}
