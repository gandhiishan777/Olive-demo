/**
 * Server-tool definitions for the Olive voice agent (ElevenLabs Agents).
 *
 * Each entry maps 1:1 to a dashboard API endpoint. `register.ts` pushes these
 * to ElevenLabs and links them to the agent. URLs are templated with
 * ElevenLabs URL templating:
 *   {order_id}  — path segment filled from the conversation variable set by create_order
 *   {line_id}   — path segment the LLM fills per call (declared in params)
 *
 * The register script bakes NGROK_BASE_URL into each tool URL at registration time.
 *
 * Descriptions are deliberately explicit: they are the primary lever against
 * hallucination (see agent/AGENT_SPEC.md §6/§7).
 */

export type ParamType = "string" | "number" | "integer" | "boolean" | "object";

export interface ToolParam {
  /** Parameter name as the LLM/URL sees it. */
  name: string;
  type: ParamType;
  description: string;
  required: boolean;
  /** Where the param goes in the HTTP request. */
  location: "path" | "query" | "body";
  /** Path params only — value from a conversation dynamic variable, not the LLM. */
  dynamicVariable?: string;
}

export interface ToolDef {
  name: string;
  description: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** Path appended to the baked-in base URL. May contain {order_id} and {path} params. */
  path: string;
  params: ToolParam[];
  /**
   * Dot-notation paths in the JSON response to assign to dynamic variables,
   * keyed by the variable name. ElevenLabs updates these after the call.
   * e.g. { order_id: "order_id" } captures response.order_id -> {{order_id}}.
   */
  assignments?: Record<string, string>;
}

/**
 * order_id is a normal LLM-supplied path parameter — NOT a dynamic variable.
 *
 * ElevenLabs validates every dynamic variable a tool references at conversation
 * START. order_id doesn't exist until create_order runs mid-call, so binding it
 * as a dynamic variable makes EL abort the call before it begins
 * ("Missing required dynamic variables in tools: {'order_id'}"). Passing it as a
 * parameter that the agent fills from create_order's response sidesteps that
 * check entirely — there's no required variable to be missing at startup.
 */
export const ORDER_ID_PATH_PARAM: ToolParam = {
  name: "order_id",
  type: "integer",
  description:
    "The id of the current order. Use the order_id returned by create_order earlier in this call.",
  required: true,
  location: "path",
};

export const TOOLS: ToolDef[] = [
  {
    name: "get_menu",
    description:
      "Fetch the current menu ONCE at the start of the call and rely on it for the whole call. " +
      "Returns every item with: id (use this as item_id when adding), name, price_cents, " +
      "in_stock (boolean), category, spice_levels, allergens, and dietary flags. " +
      "Only offer items where in_stock is true. If a caller asks for an item with in_stock false, " +
      "say it's unavailable today and suggest an in-stock alternative. Never invent items or prices.",
    method: "GET",
    path: "/api/menu",
    params: [],
  },
  {
    name: "create_order",
    description:
      "Create a new empty order when the customer starts ordering (not every call needs one). " +
      "Returns order_id. Remember this order_id and pass it to add_item, get_order, and " +
      "submit_order for the rest of this call. Call this once, before the first add_item.",
    method: "POST",
    path: "/api/orders",
    params: [],
    assignments: { order_id: "order_id" },
  },
  {
    name: "add_item",
    description:
      "Add one menu item to the current order. item_id MUST be the numeric id of a matching item " +
      "from the menu you fetched — never guess an id; if you can't find a match, ask the caller to " +
      "clarify. quantity is a positive whole number. modifiers is an optional object of kitchen " +
      "instructions (e.g. {\"spice_level\":\"medium\",\"no_onions\":true}) and does NOT change the price. " +
      "notes is optional free text. The response includes order_total_cents — use it for the running total.",
    method: "POST",
    path: "/api/orders/{order_id}/items",
    params: [
      ORDER_ID_PATH_PARAM,
      {
        name: "item_id",
        type: "integer",
        description:
          "Numeric id of the item, taken exactly from the fetched menu. Required.",
        required: true,
        location: "body",
      },
      {
        name: "quantity",
        type: "integer",
        description: "How many of this item. Positive whole number.",
        required: true,
        location: "body",
      },
      {
        name: "modifiers",
        type: "object",
        description:
          "Optional kitchen instructions as a flat object, e.g. spice level or omissions. Does not affect price.",
        required: false,
        location: "body",
      },
      {
        name: "notes",
        type: "string",
        description: "Optional free-text note for this line (max 500 chars).",
        required: false,
        location: "body",
      },
    ],
  },
  {
    name: "update_item",
    description:
      "Change an existing line on the current order — typically its quantity. " +
      "line_id identifies the line (get it from get_order if unsure). Provide at least one of " +
      "quantity, modifiers, or notes. Only works before the order is submitted. " +
      "Response includes the updated order_total_cents.",
    method: "PATCH",
    path: "/api/orders/{order_id}/items/{line_id}",
    params: [
      ORDER_ID_PATH_PARAM,
      {
        name: "line_id",
        type: "integer",
        description: "Id of the order line to change.",
        required: true,
        location: "path",
      },
      {
        name: "quantity",
        type: "integer",
        description: "New quantity (positive whole number).",
        required: false,
        location: "body",
      },
      {
        name: "modifiers",
        type: "object",
        description: "Replacement modifiers object.",
        required: false,
        location: "body",
      },
      {
        name: "notes",
        type: "string",
        description: "Replacement note (or empty to clear).",
        required: false,
        location: "body",
      },
    ],
  },
  {
    name: "remove_item",
    description:
      "Remove a line from the current order by its line_id (from get_order if unsure). " +
      "Only works before the order is submitted. Response includes the updated order_total_cents.",
    method: "DELETE",
    path: "/api/orders/{order_id}/items/{line_id}",
    params: [
      ORDER_ID_PATH_PARAM,
      {
        name: "line_id",
        type: "integer",
        description: "Id of the order line to remove.",
        required: true,
        location: "path",
      },
    ],
  },
  {
    name: "get_order",
    description:
      "Get the full current order (all lines and the total) to read back to the caller before " +
      "submitting. Use this ONCE near the end for the read-back — do not call it after every item; " +
      "the running total comes back on each add/update/remove instead.",
    method: "GET",
    path: "/api/orders/{order_id}",
    params: [ORDER_ID_PATH_PARAM],
  },
  {
    name: "submit_order",
    description:
      "Finalize the order AFTER the caller confirms it's correct. Optionally pass customer_name " +
      "(the caller's first name, captured during read-back). Returns order_number and pickup_eta — " +
      "tell these to the caller. The order cannot be changed after this. Never submit an empty order.",
    method: "POST",
    path: "/api/orders/{order_id}/submit",
    params: [
      ORDER_ID_PATH_PARAM,
      {
        name: "customer_name",
        type: "string",
        description:
          "The caller's first name for the order ticket. Ask for it; do not invent one.",
        required: false,
        location: "body",
      },
    ],
  },
];
