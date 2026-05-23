import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { OrdersPanel } from "./components/OrdersPanel";
import { MenuPanel } from "./components/MenuPanel";
import { CallPanel } from "./components/CallPanel";
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
      case "call_started":
        window.dispatchEvent(new CustomEvent("olive:call-started", { detail: ev.data }));
        break;
      case "call_ended":
        window.dispatchEvent(new CustomEvent("olive:call-ended", { detail: ev.data }));
        break;
      case "transcript_chunk": {
        const d = ev.data as { role: "agent" | "user"; text: string; timestamp: string };
        window.dispatchEvent(new CustomEvent("olive:transcript", { detail: { role: d.role, text: d.text, ts: d.timestamp } }));
        break;
      }
    }
  });

  useEffect(() => {
    // Allow the operator to drop in their X-Olive-Token via URL ?token=... once,
    // stored in localStorage. Then re-strip from URL.
    const url = new URL(window.location.href);
    const tok = url.searchParams.get("token");
    if (tok) {
      localStorage.setItem("olive.token", tok);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  return (
    <div className="h-full flex flex-col">
      <Header streamConnected={connected} />
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-3 overflow-hidden">
        <OrdersPanel pulseIds={pulseIds} />
        <MenuPanel />
        <CallPanel />
      </main>
    </div>
  );
}
