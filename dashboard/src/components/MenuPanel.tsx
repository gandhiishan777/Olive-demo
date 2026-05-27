import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { api, type Item } from "../lib/api";
import { money } from "../lib/format";

export function MenuPanel() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["all-items"],
    queryFn: api.allItems,
    refetchInterval: 60_000,
  });

  const toggle = useMutation({
    mutationFn: ({ id, in_stock }: { id: number; in_stock: boolean }) => api.toggleStock(id, in_stock),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-items"] }),
  });

  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: ["all-items"] });
    window.addEventListener("olive:menu-update", handler);
    window.addEventListener("olive:stream-reconnected", handler);
    return () => {
      window.removeEventListener("olive:menu-update", handler);
      window.removeEventListener("olive:stream-reconnected", handler);
    };
  }, [qc]);

  const filtered = items.filter((i) => i.name.toLowerCase().includes(q.toLowerCase()) || i.category.toLowerCase().includes(q.toLowerCase()));
  const grouped: Record<string, Item[]> = {};
  for (const i of filtered.sort((a, b) => a.name.localeCompare(b.name))) {
    (grouped[i.category] ??= []).push(i);
  }

  return (
    <section className="flex flex-col h-full bg-cream-100">
      <div className="p-4 border-b border-cream-300 bg-cream-50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-burgundy-800">Menu — 86 Toggle</h2>
          <span className="text-xs text-ink-700 tabular-nums">{filtered.length} / {items.length}</span>
        </div>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search items or category…"
          className="w-full px-3 py-2 rounded-md border border-cream-300 bg-cream-50 text-sm focus:outline-none focus:ring-2 focus:ring-burgundy-700"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 thin-scroll">
        {isLoading && <div className="text-sm text-ink-700">Loading menu…</div>}
        {Object.entries(grouped).map(([cat, group]) => (
          <div key={cat}>
            <div className="text-[10px] uppercase tracking-widest text-burgundy-700 font-semibold mb-1.5">{cat}</div>
            <div className="space-y-1.5">
              {group.map((i) => (
                <MenuRow
                  key={i.id}
                  item={i}
                  pending={toggle.isPending && toggle.variables?.id === i.id}
                  onToggle={(in_stock) => toggle.mutate({ id: i.id, in_stock })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function MenuRow({ item, onToggle, pending }: { item: Item; onToggle: (s: boolean) => void; pending?: boolean }) {
  return (
    <div className={clsx("flex items-center justify-between gap-3 p-2.5 rounded-md", item.in_stock ? "bg-cream-50" : "bg-cream-200")}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={clsx("font-medium text-sm truncate", !item.in_stock && "text-ink-700 line-through")}>{item.name}</span>
          {!item.in_stock && <span className="text-[10px] font-bold text-burgundy-700 bg-burgundy-700/10 px-1.5 py-0.5 rounded">86'd</span>}
        </div>
        <div className="text-xs text-ink-700 tabular-nums">{money(item.price_cents)}</div>
      </div>
      <button
        onClick={() => onToggle(!item.in_stock)}
        disabled={pending}
        className={clsx(
          "relative w-11 h-6 rounded-full transition shrink-0",
          item.in_stock ? "bg-leaf-600" : "bg-cream-300",
          pending && "opacity-50",
        )}
        title={item.in_stock ? "In stock — click to 86" : "86'd — click to restore"}
      >
        <span
          className={clsx(
            "absolute top-0.5 w-5 h-5 rounded-full bg-cream-50 transition-transform shadow",
            item.in_stock ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}
