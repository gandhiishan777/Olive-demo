import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { api } from "../lib/api";

export function Header({ streamConnected }: { streamConnected: boolean }) {
  const { data, isError } = useQuery({
    queryKey: ["healthz"],
    queryFn: api.health,
    refetchInterval: 10_000,
  });
  const backendUp = !isError && data?.ok === true;

  return (
    <header className="bg-burgundy-700 text-cream-100 px-6 py-4 shadow-card">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-cream-100 text-burgundy-700 grid place-items-center font-bold text-lg">O</div>
          <div>
            <div className="text-xl font-semibold tracking-tight">Olive — Paradise Biryani</div>
            <div className="text-xs text-cream-200 opacity-80">V0 demo console</div>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <StatusPill ok={backendUp} okLabel="Backend live" badLabel="Backend offline" />
          <StatusPill ok={streamConnected} okLabel="Stream live" badLabel="Reconnecting…" />
        </div>
      </div>
    </header>
  );
}

function StatusPill({ ok, okLabel, badLabel }: { ok: boolean; okLabel: string; badLabel: string }) {
  return (
    <span className={clsx("px-2 py-1 rounded-full font-medium tabular-nums", ok ? "bg-leaf-700 text-cream-100" : "bg-cream-200 text-burgundy-800")}>
      <span className={clsx("inline-block w-1.5 h-1.5 rounded-full mr-1.5", ok ? "bg-cream-100" : "bg-burgundy-700")} />
      {ok ? okLabel : badLabel}
    </span>
  );
}
