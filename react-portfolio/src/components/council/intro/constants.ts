// Height over width of every council portrait (a 200 by 240 viewBox, the same
// number portraits/index.tsx exports). Kept here as a plain constant so the
// layout maths and its tests do not pull in the portrait components.
export const PORTRAIT_ASPECT = 1.2;

/** localStorage key for "this visitor has met the council". */
export const SEEN_KEY = 'council:intro-seen';

// Interface strings the intro adds around the owner's script. They live here,
// not in data/council/copy.ts, only because that file is not the intro's to edit.
export const INTRO_UI = {
  title: 'Meet the council',
  /** The verb on the scroll cue, by input: a wheel or trackpad scrolls, a finger swipes. */
  cueScroll: 'scroll',
  cueSwipe: 'swipe up',
  /** Who the scrolling unlocks. Members are named; these are the three beats that follow them. */
  cueNext: (name: string) => `next: ${name}`,
  cueAssembly: 'all six, together',
  cueLimit: 'the one rule',
  cueInvite: 'your turn',
  /** The cue's spoken label. It is a button: pressing it scrolls one step. */
  cueLabel: (name: string) => `Keep scrolling, or press to continue. Next: ${name}`,
  soundOn: 'Sound is on. Turn it off',
  soundOff: 'Sound is off. Turn it on',
  lineupLabel: 'The six members',
  cardLabel: 'How this works',
  cardName: 'The Council',
} as const;
