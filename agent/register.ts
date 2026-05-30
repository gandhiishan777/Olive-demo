/**
 * Registers the Olive voice agent's server tools with ElevenLabs and links them
 * to the agent. Re-runnable: looks up existing tools by name and updates them
 * (so re-running after an ngrok restart just refreshes URLs), otherwise creates.
 *
 * Usage:
 *   cd agent
 *   cp .env.example .env   # fill in values
 *   pnpm install
 *   pnpm register
 *
 * Env:
 *   ELEVENLABS_API_KEY   — workspace API key
 *   ELEVENLABS_AGENT_ID  — the agent these tools attach to
 *   NGROK_BASE_URL       — public base URL of the dashboard (no trailing slash)
 *
 * If the installed SDK surface differs from what this expects, pass --dry to
 * print the tool payloads instead of calling the API:
 *   pnpm register --dry
 */

import "dotenv/config";
import { ElevenLabsClient, type ElevenLabs } from "@elevenlabs/elevenlabs-js";
import { TOOLS, type ToolDef, type ToolParam } from "./tools";

type WebhookToolConfig = ElevenLabs.ToolRequestModelToolConfig.Webhook;
type LiteralParamType = ElevenLabs.LiteralJsonSchemaPropertyType;

/** Methods that require a request_body_schema even when the body is empty. */
const BODY_METHODS = new Set<ToolDef["method"]>(["POST", "PATCH"]);

const DRY = process.argv.includes("--dry");

function env(name: string, required = true): string {
  const v = process.env[name];
  if (!v && required) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return v ?? "";
}

const API_KEY = env("ELEVENLABS_API_KEY", !DRY);
const AGENT_ID = env("ELEVENLABS_AGENT_ID", !DRY);
const BASE_URL = env("NGROK_BASE_URL").replace(/\/$/, "");

function toLiteralSchemaProperty(
  p: ToolParam,
): ElevenLabs.LiteralJsonSchemaProperty {
  return {
    type: p.type as LiteralParamType,
    description: p.description,
  };
}

function toPathSchemaProperty(
  p: ToolParam,
): ElevenLabs.LiteralJsonSchemaProperty {
  if (p.dynamicVariable) {
    // Mutually exclusive with description — value comes from a conversation variable.
    return {
      type: p.type as LiteralParamType,
      dynamicVariable: p.dynamicVariable,
    };
  }
  return toLiteralSchemaProperty(p);
}

function toBodySchemaProperty(
  p: ToolParam,
): ElevenLabs.ObjectJsonSchemaPropertyInputPropertiesValue {
  if (p.type === "object") {
    return { type: "object", description: p.description };
  }
  return toLiteralSchemaProperty(p);
}

/** Build the ElevenLabs webhook tool config from our ToolDef. */
function toToolConfig(tool: ToolDef): WebhookToolConfig {
  const bodyProperties: Record<
    string,
    ElevenLabs.ObjectJsonSchemaPropertyInputPropertiesValue
  > = {};
  const bodyRequired: string[] = [];
  const pathParams: ToolParam[] = [];
  const queryParams: ToolParam[] = [];

  for (const p of tool.params) {
    if (p.location === "path") pathParams.push(p);
    else if (p.location === "query") queryParams.push(p);
    else {
      bodyProperties[p.name] = toBodySchemaProperty(p);
      if (p.required) bodyRequired.push(p.name);
    }
  }

  const url = `${BASE_URL}${tool.path}`;

  const apiSchema: ElevenLabs.WebhookToolApiSchemaConfigInput = {
    url,
    method: tool.method,
    // API rejects null — always send an object, even when empty.
    pathParamsSchema: Object.fromEntries(
      pathParams.map((p) => [p.name, toPathSchemaProperty(p)]),
    ),
  };

  if (queryParams.length > 0) {
    apiSchema.queryParamsSchema = {
      properties: Object.fromEntries(
        queryParams.map((p) => [p.name, toLiteralSchemaProperty(p)]),
      ),
      required: queryParams.filter((p) => p.required).map((p) => p.name),
    };
  }

  if (Object.keys(bodyProperties).length > 0 || BODY_METHODS.has(tool.method)) {
    apiSchema.requestBodySchema = {
      type: "object",
      properties: bodyProperties,
      required: bodyRequired,
    };
  }

  // Any dynamic variable this tool references in a path param must have a
  // placeholder ON THE TOOL ITSELF — EL validates each tool's own
  // dynamicVariablePlaceholders at conversation start, not the agent-level one.
  // Without this, a tool referencing {order_id} fails the call before it begins
  // with "Missing required dynamic variables in tools: {'order_id'}".
  const placeholders: Record<string, string> = {};
  for (const p of pathParams) {
    if (p.dynamicVariable) placeholders[p.dynamicVariable] = "0";
  }

  return {
    type: "webhook",
    name: tool.name,
    description: tool.description,
    apiSchema,
    dynamicVariables: {
      dynamicVariablePlaceholders: placeholders,
    },
    // API rejects null — always send an array, even when empty.
    assignments: tool.assignments
      ? Object.entries(tool.assignments).map(([variable, source]) => ({
          source: "response" as const,
          dynamicVariable: variable,
          valuePath: source,
        }))
      : [],
  };
}

async function main() {
  const configs = TOOLS.map(toToolConfig);

  if (DRY) {
    console.log(JSON.stringify({ base_url: BASE_URL, tools: configs }, null, 2));
    console.log(`\n[dry] ${configs.length} tool(s). No API calls made.`);
    return;
  }

  const client = new ElevenLabsClient({ apiKey: API_KEY });

  // 1. List existing tools so we can update-in-place by name.
  const existing = await client.conversationalAi.tools.list();
  const byName = new Map<string, string>(); // name -> tool id
  for (const t of existing.tools ?? []) {
    const cfg = t.toolConfig;
    if (cfg.type === "webhook" && cfg.name && t.id) {
      byName.set(cfg.name, t.id);
    }
  }

  const toolIds: string[] = [];
  for (const cfg of configs) {
    const found = byName.get(cfg.name);
    if (found) {
      await client.conversationalAi.tools.update(found, { toolConfig: cfg });
      toolIds.push(found);
      console.log(`updated  ${cfg.name} (${found})`);
    } else {
      const created = await client.conversationalAi.tools.create({
        toolConfig: cfg,
      });
      if (created.id) toolIds.push(created.id);
      console.log(`created  ${cfg.name} (${created.id})`);
    }
  }

  // 2. Link tool ids to the agent (prompt.toolIds), and declare a default
  //    placeholder for order_id. ElevenLabs validates at conversation START
  //    that every dynamic variable referenced by a tool already has a value —
  //    but order_id only exists after create_order runs DURING the call. Without
  //    a placeholder the conversation fails immediately with
  //    "Missing required dynamic variables in tools: {'order_id'}".
  //    create_order's response assignment overwrites this before any order tool
  //    that needs a real id is called.
  //    Native system tools (transfer_call / end_call) are dashboard-configured.
  await client.conversationalAi.agents.update(AGENT_ID, {
    conversationConfig: {
      agent: {
        prompt: { toolIds },
        dynamicVariables: {
          dynamicVariablePlaceholders: { order_id: "0" },
        },
      },
    },
  });
  console.log(`\nlinked ${toolIds.length} tool(s) to agent ${AGENT_ID}`);
  console.log(`base_url -> ${BASE_URL}`);
}

main().catch((err) => {
  console.error("register failed:", err);
  console.error(
    "\nIf this is an SDK shape mismatch, run `pnpm register --dry` to inspect " +
      "the payloads and adjust toToolConfig() / the SDK calls to match your " +
      "installed @elevenlabs/elevenlabs-js version.",
  );
  process.exit(1);
});
