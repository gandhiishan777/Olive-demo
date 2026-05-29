"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

type Modifiers = Record<string, unknown> | null;

type OrderLine = {
  id: number;
  item_name: string;
  quantity: number;
  unit_price_cents: number;
  modifiers: Modifiers;
  notes: string | null;
};

type Order = {
  id: number;
  status: "open" | "submitted" | "completed";
  customer_name: string | null;
  customer_phone: string | null;
  conversation_id: string | null;
  total_cents: number;
  created_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  pickup_eta: string | null;
  order_number: string | null;
  order_lines: OrderLine[];
};

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const formatTime = (iso: string | null) => {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
};

const minutesAgo = (iso: string | null) => {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return "just now";
  if (m === 1) return "1 min ago";
  return `${m} min ago`;
};

function ModifierTags({ modifiers }: { modifiers: Modifiers }) {
  if (!modifiers || Object.keys(modifiers).length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1 pl-5 pt-0.5">
      {Object.entries(modifiers).map(([k, v]) => (
        <span
          key={k}
          className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800"
        >
          {k}: {String(v)}
        </span>
      ))}
    </span>
  );
}

export default function KitchenPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch("/api/orders?status=submitted,completed", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setOrders((data.orders ?? []) as Order[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, 3000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  const completeOrder = async (id: number) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? { ...o, status: "completed", completed_at: new Date().toISOString() }
          : o,
      ),
    );
    try {
      const res = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      fetchOrders();
    }
  };

  const { active, done } = useMemo(() => {
    const a: Order[] = [];
    const d: Order[] = [];
    for (const o of orders) (o.status === "submitted" ? a : d).push(o);
    a.sort(
      (x, y) =>
        new Date(x.submitted_at ?? x.created_at).getTime() -
        new Date(y.submitted_at ?? y.created_at).getTime(),
    );
    d.sort(
      (x, y) =>
        new Date(y.completed_at ?? y.submitted_at ?? "").getTime() -
        new Date(x.completed_at ?? x.submitted_at ?? "").getTime(),
    );
    return { active: a, done: d };
  }, [orders]);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Kitchen</h2>
          <p className="text-sm text-neutral-500">
            Live submitted orders. Polls every 3 seconds.
          </p>
        </div>
        <span className="text-sm text-neutral-500">
          {loading ? "loading..." : `${active.length} active`}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {active.length === 0 && done.length === 0 && !loading && !error && (
        <div className="rounded-lg border border-dashed border-neutral-300 px-6 py-12 text-center text-neutral-500">
          No active orders. Place one through the voice agent or the API.
        </div>
      )}

      {active.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {active.map((o) => (
            <OrderCard key={o.id} order={o} onDone={completeOrder} />
          ))}
        </div>
      )}

      {done.length > 0 && (
        <>
          <h3 className="mt-10 mb-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Recently completed
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {done.map((o) => (
              <OrderCard key={o.id} order={o} onDone={completeOrder} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OrderCard({
  order: o,
  onDone,
}: {
  order: Order;
  onDone: (id: number) => void;
}) {
  const isDone = o.status === "completed";
  return (
    <article
      className={`flex flex-col rounded-lg border p-5 shadow-sm transition-opacity ${
        isDone
          ? "border-neutral-200 bg-neutral-50 opacity-70"
          : "border-neutral-200 bg-white"
      }`}
    >
      <header className="mb-3 flex items-baseline justify-between">
        <div className="flex items-baseline gap-2">
          <h3 className="text-lg font-semibold">Order #{o.id}</h3>
          {isDone ? (
            <span className="rounded-full bg-neutral-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-600">
              Done
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Submitted
            </span>
          )}
        </div>
        <span className="text-xs text-neutral-500">
          {isDone
            ? `Done ${minutesAgo(o.completed_at)}`
            : minutesAgo(o.submitted_at ?? o.created_at)}
        </span>
      </header>

      {(o.customer_name || o.customer_phone) && (
        <p className="mb-2 text-sm text-neutral-600">
          {o.customer_name ?? "Caller"}
          {o.customer_phone ? ` · ${o.customer_phone}` : ""}
        </p>
      )}

      <ul className="mb-4 flex-1 space-y-1.5 text-sm">
        {o.order_lines.map((l) => (
          <li key={l.id}>
            <div className="flex justify-between gap-3">
              <span>
                <span className="font-medium">{l.quantity}x</span>{" "}
                {l.item_name}
                {l.notes && (
                  <span className="block pl-5 text-xs italic text-neutral-500">
                    {l.notes}
                  </span>
                )}
              </span>
              <span className="tabular-nums text-neutral-500">
                {formatPrice(l.quantity * l.unit_price_cents)}
              </span>
            </div>
            <ModifierTags modifiers={l.modifiers} />
          </li>
        ))}
      </ul>

      <div className="mb-3 flex items-center justify-between border-t border-neutral-100 pt-3 text-sm">
        <span className="text-neutral-500">
          {o.pickup_eta && !isDone ? `Ready ~${formatTime(o.pickup_eta)}` : "Total"}
        </span>
        <span className="font-semibold tabular-nums">
          {formatPrice(o.total_cents)}
        </span>
      </div>

      {!isDone && (
        <button
          onClick={() => onDone(o.id)}
          className="w-full rounded-md bg-emerald-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          Done
        </button>
      )}
    </article>
  );
}
