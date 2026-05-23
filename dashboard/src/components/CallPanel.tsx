import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { phoneMasked } from "../lib/format";

type Turn = { role: "agent" | "user"; text: string; ts: string };

export function CallPanel() {
  const [activeCall, setActiveCall] = useState<{ from: string | null; startedAt: string } | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onStart = (e: Event) => {
      const ev = e as CustomEvent<{ from_number: string | null; started_at: string }>;
      setActiveCall({ from: ev.detail.from_number, startedAt: ev.detail.started_at });
      setTurns([]);
    };
    const onEnd = () => setActiveCall(null);
    const onChunk = (e: Event) => {
      const ev = e as CustomEvent<Turn>;
      setTurns((t) => [...t, ev.detail].slice(-200));
    };
    window.addEventListener("olive:call-started", onStart as EventListener);
    window.addEventListener("olive:call-ended", onEnd as EventListener);
    window.addEventListener("olive:transcript", onChunk as EventListener);
    return () => {
      window.removeEventListener("olive:call-started", onStart as EventListener);
      window.removeEventListener("olive:call-ended", onEnd as EventListener);
      window.removeEventListener("olive:transcript", onChunk as EventListener);
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns.length]);

  return (
    <section className="flex flex-col h-full bg-cream-100">
      <div className="p-4 border-b border-cream-300 bg-cream-50">
        <h2 className="text-lg font-semibold text-burgundy-800">Live Call</h2>
        {activeCall ? (
          <div className="mt-2 flex items-center gap-2">
            <span className="relative flex w-2.5 h-2.5">
              <span className="absolute inset-0 rounded-full bg-leaf-600 animate-ping opacity-75" />
              <span className="relative rounded-full w-2.5 h-2.5 bg-leaf-600" />
            </span>
            <span className="text-sm font-medium text-leaf-700">On call · {phoneMasked(activeCall.from)}</span>
          </div>
        ) : (
          <div className="mt-2 text-sm text-ink-700">Waiting for next call…</div>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2 thin-scroll">
        {turns.length === 0 && (
          <div className="text-xs text-ink-700 text-center mt-8">
            Transcript will appear here once a call connects.
          </div>
        )}
        {turns.map((t, i) => (
          <div
            key={i}
            className={clsx("rounded-md p-2.5 text-sm max-w-[90%]", t.role === "agent" ? "bg-burgundy-700/8 mr-auto" : "bg-cream-50 ml-auto shadow-card")}
          >
            <div className={clsx("text-[10px] font-semibold uppercase tracking-wider mb-0.5", t.role === "agent" ? "text-burgundy-700" : "text-leaf-700")}>
              {t.role === "agent" ? "Olive" : "Caller"}
            </div>
            <div className="text-ink-900">{t.text}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
