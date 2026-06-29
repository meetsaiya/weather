// Single source of truth for consequence-level copy. Used by the routine
// editor's selectable cards and the dashboard window-card tag.
//
// The internal level values ('high' | 'medium' | 'low') map to the same
// probability bars used previously by riskTolerance — see recommendEngine.

export const CONSEQUENCE_OPTIONS = {
  high: {
    title: "I'd rather stay dry",
    description:
      'Getting wet would be a problem — heading to work, a meeting, a dinner, anything where it matters.',
    note: "Note: This setting recommends carrying an umbrella more often. You may carry it on days it doesn't rain.",
    tag: 'Staying dry matters',
  },
  medium: {
    title: "I prefer to stay dry, but I'll manage",
    description: 'Moderate inconvenience if I get wet, but not a disaster.',
    note: 'Note: Balanced recommendations. Umbrella suggested when rain is reasonably likely.',
    tag: 'Prefer to stay dry',
  },
  low: {
    title: 'A bit of rain is fine',
    description:
      "Getting lightly wet doesn't bother me — heading home, a casual errand, outdoor activity where I expect to get a bit weathered.",
    note: 'Note: This setting avoids unnecessary recommendations. You may occasionally get caught in rain without a heads-up.',
    tag: 'Rain is fine',
  },
};

// Display order in the selector (cards rendered top-to-bottom).
export const CONSEQUENCE_LEVELS = ['high', 'medium', 'low'];
