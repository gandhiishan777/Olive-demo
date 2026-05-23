// Test scenarios. Each is a (transcript, expected-items, expected-modifiers)
// triple. The transcript is what a customer would say; the expected items are
// the canonical menu names we want to see survive the noise mix. We use a
// case-insensitive substring match against the STT output as the order-accuracy
// proxy demanded by BUILD_SPEC (>=85% under noise).
//
// Add new scenarios here. Keep the transcripts realistic — accents, fillers,
// modifications mid-sentence. The harness's value is only as good as the
// scenarios.

export interface Scenario {
  name: string;
  transcript: string;
  expected_items: string[];
  expected_modifiers: Record<string, string | boolean | number>;
  // optional override; otherwise the per-condition threshold from index.ts wins
  wer_max_quiet?: number;
}

export const SCENARIOS: Scenario[] = [
  {
    name: 'simple-order',
    transcript:
      "Hi, can I get a chicken biryani, medium spice, and a garlic naan please?",
    expected_items: ['Chicken Biryani', 'Garlic Naan'],
    expected_modifiers: { spice_level: 'medium' },
  },
  {
    name: 'complex-modifiers',
    transcript:
      "I'd like two lamb biryanis, one extra hot one mild, no onions on both, and three garlic naans on the side.",
    expected_items: ['Lamb Biryani', 'Garlic Naan'],
    expected_modifiers: { spice_level: 'extra_hot', no_onions: true, quantity_naan: 3 },
  },
  {
    name: 'mid-order-change',
    transcript:
      "Let me get a paneer tikka masala, actually make that chicken tikka masala, and add a mango lassi please.",
    expected_items: ['Chicken Tikka Masala', 'Mango Lassi'],
    expected_modifiers: {},
  },
  {
    name: 'allergen-question',
    transcript:
      "Quick question — does the chicken biryani have any nuts or dairy? My kid is allergic. If it's safe I'll take one mild.",
    expected_items: ['Chicken Biryani'],
    expected_modifiers: { spice_level: 'mild', asks_allergens: true },
  },
  {
    name: '86d-item-asked-for',
    // Item is intentionally one the dashboard would have toggled out of stock
    // during the live demo. The agent should hear it correctly even under
    // noise; the policy logic (offering an alternative) is tested elsewhere.
    transcript:
      "Yeah I'll have the goat biryani extra hot, and a sweet lassi, that's it.",
    expected_items: ['Goat Biryani', 'Sweet Lassi'],
    expected_modifiers: { spice_level: 'extra_hot' },
  },
];

export function getScenario(name: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.name === name);
}
