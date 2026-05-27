import { useEffect, useRef, useState } from "react";
import { STREAM_PATH } from "../lib/api";

export type StreamEventType =
  | "order_created"
  | "order_updated"
  | "order_submitted"
  | "order_completed"
  | "menu_update"
  | "ping";

export type StreamEvent<T = unknown> = { type: StreamEventType; data: T };

export function useOliveStream(onEvent: (ev: StreamEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let es: EventSource | null = null;
    let retryDelay = 1000;
    let cancelled = false;

    const open = () => {
      if (cancelled) return;
      es = new EventSource(STREAM_PATH);
      es.onopen = () => {
        setConnected(true);
        retryDelay = 1000;
        // Refetch state on reconnect — bus has no replay.
        window.dispatchEvent(new CustomEvent("olive:stream-reconnected"));
      };
      es.onerror = () => {
        setConnected(false);
        es?.close();
        if (!cancelled) {
          setTimeout(open, retryDelay);
          retryDelay = Math.min(retryDelay * 2, 15_000);
        }
      };
      const types: StreamEventType[] = [
        "order_created", "order_updated", "order_submitted", "order_completed",
        "menu_update", "ping",
      ];
      for (const t of types) {
        es.addEventListener(t, (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            onEventRef.current({ type: t, data });
          } catch { /* ignore */ }
        });
      }
    };
    open();
    return () => { cancelled = true; es?.close(); };
  }, []);

  return { connected };
}
