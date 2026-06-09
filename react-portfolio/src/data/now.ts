export interface NowFocus {
  /** Current headline role. */
  role: string;
  /** Doers → reviewers thesis, expanded to one strong line. */
  thesis: string;
  /** 1-2 short paragraphs on YottaBuilder and what Rohan personally owns. */
  body: string[];
  /** Real, non-numeric signals only (this is stealth, no invented metrics). */
  signals: string[];
}

export const NOW: NowFocus = {
  role: 'Product Manager & AI Consultant @ Yottaflex',
  thesis:
    'Getting agile teams from doers to reviewers, where AI writes the first draft and people own the judgment.',
  body: [
    'YottaBuilder is an AI-powered SDLC platform that turns requirements into production code. My lane is the product, not the codebase: I own the strategy and roadmap, and I translate messy, half-formed requirements into specs the system can actually build.',
    'The bigger job is the shift itself: turning Yottaflex from a dev shop into an AI company, and getting teams comfortable reviewing what AI ships instead of typing every line themselves.',
  ],
  signals: ['Stealth', 'AI-native SDLC', 'Requirements → production code'],
};
