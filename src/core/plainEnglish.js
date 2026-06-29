/**
 * Render recommendations as 1–3 plain-English sentences for a single window.
 *
 * Probability figures are embedded inline ("(65% chance)") so the number
 * becomes ambient over time — users absorb that recommendations are anchored
 * to probabilities without us ever lecturing them about uncertainty.
 *
 * Templates are pure functions over a context bag:
 *   { label, prob (raw probability %), note }
 * so callers don't need to know which template signature applies.
 */

const TEMPLATES = {
  raincoat: ({ label, prob }) =>
    `Heavy rain with high winds during your ${label}${probSuffix(prob)} — an umbrella won't help. Take a raincoat.`,
  waterproof_layer: ({ label }) =>
    `Cold and wet during your ${label}. A waterproof layer is more useful than an umbrella.`,

  umbrella_likely: ({ label, prob, note }) =>
    `Rain is likely during your ${label} (${pct(prob, 'a high chance')}). Carry an umbrella.${appendNote(note)}`,
  umbrella_possible: ({ label, prob, note }) =>
    `There's a ${pct(prob, 'real chance')} of rain on your ${label}. Worth bringing an umbrella.${appendNote(note)}`,
  umbrella_unlikely: ({ label, prob, note }) =>
    `Low chance of rain${probParen(prob)}. Probably fine without one.${appendNote(note)}`,

  // Windy-caveat variants: light rain + high wind. Raincoat isn't useful here;
  // umbrella works but the wind makes it annoying.
  umbrella_likely_windy: ({ label, prob }) =>
    `Rain is likely during your ${label} (${pct(prob, 'a high chance')}). Carry an umbrella, but it's breezy — hold on tight.`,
  umbrella_possible_windy: ({ label, prob }) =>
    `There's a ${pct(prob, 'real chance')} of rain on your ${label}. Carry an umbrella, but it's breezy — hold on tight.`,
  umbrella_unlikely_windy: ({ label, prob }) =>
    `Low chance of rain${probParen(prob)} — probably fine, but it'll be breezy.`,

  windcheater: ({ label }) => `Strong winds during your ${label}. A windcheater would help.`,
  scarf: ({ label }) => `It'll feel cold during your ${label}. A scarf and warm layers advised.`,
  hat: ({ label }) => `Hat or cap recommended for your ${label}.`,
  sunscreen: ({ label }) => `Apply sunscreen before your ${label} — UV is high.`,
  light_clothing: ({ label }) => `Very hot during your ${label}. Dress light, drink water.`,

  // No-trigger fallback. We still embed the prob so the user sees that
  // "looking clear" is a probabilistic statement, not a guarantee.
  all_clear: ({ label, prob }) => {
    if (prob == null) {
      return `Looking clear for your ${label}. Nothing extra needed.`;
    }
    return `Looking clear for your ${label} (${pct(prob, 'low chance')} of rain). Nothing extra needed.`;
  },
};

function pct(prob, fallback) {
  if (prob == null || !Number.isFinite(prob)) return fallback;
  return `${Math.round(prob)}% chance`;
}

function probSuffix(prob) {
  if (prob == null || !Number.isFinite(prob)) return '';
  return ` (${Math.round(prob)}% chance)`;
}

// Bare percentage in parens — used when "chance" appears earlier in the
// sentence ("Low chance of rain (22%).") to avoid duplication.
function probParen(prob) {
  if (prob == null || !Number.isFinite(prob)) return '';
  return ` (${Math.round(prob)}%)`;
}

function appendNote(note) {
  return note ? ' ' + note : '';
}

// Safety → comfort → convenience.
const PRIORITY = [
  'raincoat',
  'waterproof_layer',
  'umbrella',
  'scarf',
  'windcheater',
  'sunscreen',
  'hat',
  'light_clothing',
];

function renderItem(rec, ctx) {
  if (rec.item === 'umbrella') {
    const confidence = rec.confidence ?? 'possible';
    const suffix = rec.windyCaveat ? '_windy' : '';
    const key = `umbrella_${confidence}${suffix}`;
    const tpl = TEMPLATES[key] ?? TEMPLATES[`umbrella_possible${suffix}`];
    return tpl({ ...ctx, note: rec.note });
  }
  const tpl = TEMPLATES[rec.item];
  return tpl ? tpl(ctx) : null;
}

/**
 * @param {Array} recommendations  output of recommendEngine.generateRecommendations
 * @param {string} [label='trip']  the user's window label, e.g. "morning commute"
 * @param {object} [aggregated]    aggregated window weather (used to pull the
 *                                 raw probability for "all clear" + umbrella
 *                                 templates so the number is ambient)
 * @returns {{ summary: string, sentences: string[] }}
 */
export function generatePlainEnglish(recommendations = [], label = 'trip', aggregated = null) {
  const active = recommendations.filter((r) => r.carry);
  const prob = aggregated?.precipitation_probability ?? null;
  const ctx = { label, prob };

  if (active.length === 0) {
    const s = TEMPLATES.all_clear(ctx);
    return { summary: s, sentences: [s] };
  }

  const ordered = [...active].sort((a, b) => {
    const ai = PRIORITY.indexOf(a.item);
    const bi = PRIORITY.indexOf(b.item);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const sentences = [];
  for (const rec of ordered.slice(0, 3)) {
    const s = renderItem(rec, ctx);
    if (s) sentences.push(s);
  }

  return { summary: sentences.join(' '), sentences };
}
