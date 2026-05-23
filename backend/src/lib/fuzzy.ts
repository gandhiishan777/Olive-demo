// Dice coefficient fuzzy match — small, no deps. Good enough for ~50-item menus.
export function diceCoefficient(a: string, b: string): number {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (x === y) return 1;
  if (x.length < 2 || y.length < 2) return 0;

  const bigrams = (s: string): Map<string, number> => {
    const m = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const g = s.slice(i, i + 2);
      m.set(g, (m.get(g) ?? 0) + 1);
    }
    return m;
  };

  const ax = bigrams(x);
  const bx = bigrams(y);
  let intersection = 0;
  for (const [g, count] of ax) {
    const c = bx.get(g);
    if (c) intersection += Math.min(count, c);
  }
  const total = [...ax.values()].reduce((a, b) => a + b, 0) + [...bx.values()].reduce((a, b) => a + b, 0);
  return total === 0 ? 0 : (2 * intersection) / total;
}

export function fuzzyScore(query: string, item: { name: string; description?: string }): number {
  const name = diceCoefficient(query, item.name);
  const desc = item.description ? diceCoefficient(query, item.description) * 0.4 : 0;
  // Substring boost — "biryani" should always match "Chicken Biryani"
  const sub = item.name.toLowerCase().includes(query.toLowerCase()) ? 0.5 : 0;
  return Math.max(name, desc, sub);
}
