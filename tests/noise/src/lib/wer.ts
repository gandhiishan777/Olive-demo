// Word Error Rate. Levenshtein on word arrays normalized by reference length.
// No library — small enough to own. Result is a fraction in [0, 1+]; values >1
// happen when the hypothesis has many more inserted words than the reference.

function normalize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

export function wer(reference: string, hypothesis: string): number {
  const ref = normalize(reference);
  const hyp = normalize(hypothesis);
  if (ref.length === 0) return hyp.length === 0 ? 0 : 1;
  // dp[i][j] = edit distance between ref[0..i) and hyp[0..j)
  const dp: number[][] = Array.from({ length: ref.length + 1 }, () =>
    new Array(hyp.length + 1).fill(0),
  );
  for (let i = 0; i <= ref.length; i++) dp[i][0] = i;
  for (let j = 0; j <= hyp.length; j++) dp[0][j] = j;
  for (let i = 1; i <= ref.length; i++) {
    for (let j = 1; j <= hyp.length; j++) {
      const cost = ref[i - 1] === hyp[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost, // substitution
      );
    }
  }
  return dp[ref.length][hyp.length] / ref.length;
}

export function itemRecall(expected: string[], hypothesis: string): {
  matched: string[];
  missed: string[];
  recall: number;
} {
  const hypLower = hypothesis.toLowerCase();
  const matched: string[] = [];
  const missed: string[] = [];
  for (const item of expected) {
    if (hypLower.includes(item.toLowerCase())) matched.push(item);
    else missed.push(item);
  }
  const recall = expected.length === 0 ? 1 : matched.length / expected.length;
  return { matched, missed, recall };
}
