import { useState } from "react";
import { Header } from "./components/Header";
import { OrdersPanel } from "./components/OrdersPanel";
import { MenuPanel } from "./components/MenuPanel";
import { useOliveStream } from "./hooks/useOliveStream";

export default function App() {
  const [pulseIds, setPulseIds] = useState<Set<number>>(new Set());

  const { connected } = useOliveStream((ev) => {
    switch (ev.type) {
      case "order_submitted": {
        const data = ev.data as { id: number };
        setPulseIds((prev) => {
          const next = new Set(prev);
          next.add(data.id);
          return next;
        });
        setTimeout(() => setPulseIds((prev) => {
          const next = new Set(prev);
          next.delete(data.id);
          return next;
        }), 3000);
        window.dispatchEvent(new CustomEvent("olive:order-event", { detail: ev.data }));
        break;
      }
      case "order_created":
      case "order_updated":
      case "order_completed":
        window.dispatchEvent(new CustomEvent("olive:order-event", { detail: ev.data }));
        break;
      case "menu_update":
        window.dispatchEvent(new CustomEvent("olive:menu-update", { detail: ev.data }));
        break;
    }
  });

  return (
    <div className="h-full flex flex-col">
      <Header streamConnected={connected} />
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        <OrdersPanel pulseIds={pulseIds} />
        <MenuPanel />
      </main>
    </div>
  );
}
