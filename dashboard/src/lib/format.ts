export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function phoneMasked(phone: string | null | undefined): string {
  if (!phone) return "—";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return phone;
  return `(•••) •••-${digits.slice(-4)}`;
}

export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  const diff = (Date.now() - t) / 1000;
  if (diff < 30) return "just now";
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return new Date(iso).toLocaleString();
}

export function etaText(pickupIso: string | null | undefined): string {
  if (!pickupIso) return "—";
  const ms = new Date(pickupIso).getTime() - Date.now();
  if (ms <= 0) return "Ready now";
  const min = Math.round(ms / 60_000);
  return `Ready in ${min} min`;
}

export function modifiersText(mods: Record<string, unknown>): string {
  const parts: string[] = [];
  if (mods.spice_level) parts.push(String(mods.spice_level));
  if (mods.no_onions) parts.push("no onions");
  if (mods.no_garlic) parts.push("no garlic");
  if (Array.isArray(mods.extra)) for (const e of mods.extra) parts.push(String(e));
  return parts.join(", ");
}
