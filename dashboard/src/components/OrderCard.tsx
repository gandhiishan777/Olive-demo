import { useState } from "react";
import clsx from "clsx";
import type { Order } from "../lib/api";
import { money, phoneMasked, relativeTime, etaText, modifiersText } from "../lib/format";

export function OrderCard({
  order,
  pulse,
  onComplete,
  busy,
}: {
  order: Order;
  pulse?: boolean;
  onComplete?: () => void;
  busy?: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div
      className={clsx(
        "bg-cream-50 rounded-lg shadow-card p-4 border-l-4",
        order.status === "submitted" && "border-burgundy-700",
        order.status === "completed" && "border-leaf-600 opacity-60",
        order.status === "open" && "border-cream-300",
        order.status === "cancelled" && "border-cream-300 opacity-50",
        pulse && "animate-pulse-highlight",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-ink-900 text-lg tracking-tight">
            {order.order_number ?? `Order #${order.id}`}
            {order.customer_name && <span className="text-ink-700 font-normal"> — {order.customer_name}</span>}
          </div>
          <div className="text-xs text-ink-700 mt-0.5">
            {phoneMasked(order.customer_phone)} · {relativeTime(order.submitted_at ?? order.created_at)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-burgundy-700 tabular-nums">{money(order.total_cents)}</div>
          {order.status === "submitted" && <div className="text-xs text-leaf-700 mt-0.5">{etaText(order.pickup_eta)}</div>}
        </div>
      </div>

      <button
        onClick={() => setExpanded((v) => !v)}
        className="text-xs text-burgundy-700 hover:underline mt-2"
      >
        {expanded ? "Hide items" : `Show ${order.lines.length} item${order.lines.length === 1 ? "" : "s"}`}
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1 text-sm">
          {order.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span>
                <span className="font-medium text-ink-900">{l.quantity}× {l.item_name}</span>
                {modifiersText(l.modifiers) && <span className="text-ink-700"> · {modifiersText(l.modifiers)}</span>}
                {l.notes && <span className="text-ink-700 italic"> — {l.notes}</span>}
              </span>
              <span className="text-ink-700 tabular-nums">{money(l.quantity * l.unit_price_cents)}</span>
            </li>
          ))}
        </ul>
      )}

      {order.status === "submitted" && onComplete && (
        <button
          onClick={onComplete}
          disabled={busy}
          className="mt-3 w-full bg-burgundy-700 hover:bg-burgundy-800 text-cream-100 font-medium py-2 rounded-md transition disabled:opacity-50"
        >
          {busy ? "Marking…" : "Mark Complete"}
        </button>
      )}
    </div>
  );
}
