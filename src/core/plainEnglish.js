/**
 * Render recommendations as 1–3 plain-English sentences for a single window.
 *
 * Honest uncertainty language only: "very likely", "chance of", "looking
 * clear" — never false certainty. Items are emitted in priority order
 * (safety → comfort → convenience) and capped at three to keep the widget
 * view honest.
 */

const TEMPLATES = {
  raincoat: (label) =>
    `Rain with high winds during your ${label} — an umbrella won't help. Take a raincoat.`,
  waterproof_layer: (label) =>
    `Cold and wet during your ${label}. A waterproof layer is more useful than an umbrella.`,
  umbrella_likely: (label, note) =>
    `Very likely to rain during your ${label}. Carry an umbrella.${note ? ' ' + note : ''}`,
  umbrella_possible: (label, note) =>
    `Chance of rain during your ${label}. Worth bringing an umbrella.${note ? ' ' + note : ''}`,
  umbrella_unlikely: (label, note) =>
    `Slight chance of rain during your ${label} — probably fine without one.${note ? ' ' + note : ''}`,
  // Windy-caveat variants: light rain + high wind. Raincoat isn't useful here;
  // umbrella works but the wind makes it annoying.
  umbrella_likely_windy: (label) =>
    `Very likely to rain during your ${label}. Carry an umbrella, but it's breezy — hold on tight.`,
  umbrella_possible_windy: (label) =>
    `Chance of rain during your ${label}. Carry an umbrella, but it's breezy — hold on tight.`,
  umbrella_unlikely_windy: (label) =>
    `Slight chance of rain during your ${label} — probably fine, but it'll be breezy.`,
  windcheater: (label) =>
    `Strong winds during your ${label}. A windcheater would help.`,
  scarf: (label) => `It'll feel cold during your ${label}. A scarf and warm layers advised.`,
  hat: (label) => `Hat or cap recommended for your ${label}.`,
  sunscreen: (label) => `Apply sunscreen before your ${label} — UV is high.`,
  light_clothing: (label) => `Hot during your ${label}. Dress light, drink water.`,
  all_clear: (label) => `Looking clear for your ${label}. Nothing extra needed.`,
};

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

function renderItem(rec, label) {
  if (rec.item === 'umbrella') {
    const confidence = rec.confidence ?? 'possible';
    if (rec.windyCaveat) {
      const key = `umbrella_${confidence}_windy`;
      return (TEMPLATES[key] ?? TEMPLATES.umbrella_possible_windy)(label);
    }
    const key = `umbrella_${confidence}`;
    return (TEMPLATES[key] ?? TEMPLATES.umbrella_possible)(label, rec.note);
  }
  const tpl = TEMPLATES[rec.item];
  return tpl ? tpl(label) : null;
}

/**
 * @param {Array} recommendations  output of recommendEngine.generateRecommendations
 * @param {string} [label='trip']  the user's window label, e.g. "morning commute"
 * @returns {{ summary: string, sentences: string[] }}
 */
export function generatePlainEnglish(recommendations = [], label = 'trip') {
  const active = recommendations.filter((r) => r.carry);

  if (active.length === 0) {
    const s = TEMPLATES.all_clear(label);
    return { summary: s, sentences: [s] };
  }

  const ordered = [...active].sort((a, b) => {
    const ai = PRIORITY.indexOf(a.item);
    const bi = PRIORITY.indexOf(b.item);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  const sentences = [];
  for (const rec of ordered.slice(0, 3)) {
    const s = renderItem(rec, label);
    if (s) sentences.push(s);
  }

  return { summary: sentences.join(' '), sentences };
}
