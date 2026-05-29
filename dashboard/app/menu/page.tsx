"use client";

import { useEffect, useState, useCallback, useMemo } from "react";

type Item = {
  id: number;
  name: string;
  description: string | null;
  price_cents: number;
  in_stock: boolean;
  allergens: string[];
  spice_levels: string[];
  prep_minutes: number | null;
  category: string | null;
  ingredients: string[];
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_gluten_free: boolean | null;
};

const formatPrice = (cents: number) => `$${(cents / 100).toFixed(2)}`;

const CATEGORY_ORDER = [
  "biryani",
  "curry",
  "appetizer",
  "bread",
  "dessert",
  "drink",
];

function categoryRank(c: string | null): number {
  if (!c) return CATEGORY_ORDER.length;
  const i = CATEGORY_ORDER.indexOf(c.toLowerCase());
  return i === -1 ? CATEGORY_ORDER.length : i;
}

function DietaryBadges({ item }: { item: Item }) {
  const badges: { label: string; cls: string }[] = [];
  if (item.is_vegan) badges.push({ label: "VG", cls: "bg-emerald-100 text-emerald-700" });
  else if (item.is_vegetarian) badges.push({ label: "V", cls: "bg-emerald-100 text-emerald-700" });
  if (item.is_gluten_free) badges.push({ label: "GF", cls: "bg-amber-100 text-amber-700" });
  if (badges.length === 0) return null;
  return (
    <span className="ml-2 inline-flex gap-1">
      {badges.map((b) => (
        <span
          key={b.label}
          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${b.cls}`}
        >
          {b.label}
        </span>
      ))}
    </span>
  );
}

export default function MenuPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/menu", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems((data.items ?? []) as Item[]);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const toggleStock = async (id: number, next: boolean) => {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, in_stock: next } : i)),
    );
    try {
      const res = await fetch(`/api/items/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ in_stock: next }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
    } catch {
      fetchItems();
    }
  };

  const grouped = useMemo(() => {
    const byCat = new Map<string, Item[]>();
    for (const i of items) {
      const key = (i.category ?? "other").toLowerCase();
      const arr = byCat.get(key) ?? [];
      arr.push(i);
      byCat.set(key, arr);
    }
    return [...byCat.entries()].sort(
      ([a], [b]) => categoryRank(a) - categoryRank(b),
    );
  }, [items]);

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold">Menu</h2>
        <p className="text-sm text-neutral-500">
          Toggle items off to 86 them. The voice agent will stop offering them on its next call.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && <p className="text-sm text-neutral-500">Loading...</p>}

      <div className="space-y-6">
        {grouped.map(([cat, list]) => (
          <section key={cat}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
              {cat}
            </h3>
            <ul className="divide-y divide-neutral-200 rounded-lg border border-neutral-200 bg-white">
              {list.map((i) => (
                <li
                  key={i.id}
                  className={`flex items-center justify-between gap-4 px-5 py-4 transition-opacity ${
                    i.in_stock ? "" : "opacity-50"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-3">
                      <h4 className="truncate font-medium">{i.name}</h4>
                      <DietaryBadges item={i} />
                      <span className="ml-auto tabular-nums text-sm text-neutral-500">
                        {formatPrice(i.price_cents)}
                      </span>
                    </div>
                    {i.description && (
                      <p className="mt-0.5 truncate text-sm text-neutral-500">
                        {i.description}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-400">
                      {i.spice_levels.length > 0 && (
                        <span>Spice: {i.spice_levels.join(", ")}</span>
                      )}
                      {i.prep_minutes !== null && (
                        <span>{i.prep_minutes}m prep</span>
                      )}
                      {i.allergens.length > 0 && (
                        <span>Allergens: {i.allergens.join(", ")}</span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleStock(i.id, !i.in_stock)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                      i.in_stock ? "bg-emerald-600" : "bg-neutral-300"
                    }`}
                    aria-label={i.in_stock ? "Mark as 86'd" : "Restock"}
                  >
                    <span
                      className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        i.in_stock ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
