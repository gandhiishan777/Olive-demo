import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import clsx from "clsx";
import { api, type Order } from "../lib/api";
import { OrderCard } from "./OrderCard";

type Filter = "submitted" | "completed" | "all";

export function OrdersPanel({ pulseIds }: { pulseIds: Set<number> }) {
  const [filter, setFilter] = useState<Filter>("submitted");
  const qc = useQueryClient();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", filter],
    queryFn: () => api.ordersByStatus(filter === "all" ? undefined : filter),
    refetchInterval: 20_000,
  });

  const completeMut = useMutation({
    mutationFn: (id: number) => api.markComplete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
  });

  useEffect(() => {
    const handler = () => qc.invalidateQueries({ queryKey: ["orders"] });
    window.addEventListener("olive:order-event", handler);
    window.addEventListener("olive:stream-reconnected", handler);
    return () => {
      window.removeEventListener("olive:order-event", handler);
      window.removeEventListener("olive:stream-reconnected", handler);
    };
  }, [qc]);

  return (
    <section className="flex flex-col h-full bg-cream-100 border-r border-cream-300">
      <div className="p-4 border-b border-cream-300 bg-cream-50">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-burgundy-800">Live Orders</h2>
          <span className="text-xs text-ink-700 tabular-nums">{orders.length}</span>
        </div>
        <div className="flex gap-1.5">
          <Pill active={filter === "submitted"} onClick={() => setFilter("submitted")}>Kitchen</Pill>
          <Pill active={filter === "completed"} onClick={() => setFilter("completed")}>Done</Pill>
          <Pill active={filter === "all"} onClick={() => setFilter("all")}>All</Pill>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 thin-scroll">
        {isLoading && <div className="text-sm text-ink-700">Loading…</div>}
        {!isLoading && orders.length === 0 && (
          <div className="text-sm text-ink-700 text-center mt-12 px-6">
            <p className="mb-2 text-base">No orders here yet.</p>
            <p>When Olive takes a call, orders will appear here in real time.</p>
          </div>
        )}
        {orders.map((o: Order) => (
          <OrderCard
            key={o.id}
            order={o}
            pulse={pulseIds.has(o.id)}
            onComplete={() => completeMut.mutate(o.id)}
            busy={completeMut.isPending && completeMut.variables === o.id}
          />
        ))}
      </div>
    </section>
  );
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "px-3 py-1 rounded-full text-xs font-medium transition",
        active ? "bg-burgundy-700 text-cream-100" : "bg-cream-200 text-ink-900 hover:bg-cream-300",
      )}
    >
      {children}
    </button>
  );
}
