import { Card } from '@/types';

export const CARDS: Card[] = [
  // HOOK: Lead with intrigue and impact, not just identity
  {
    kind: 'intro',
    body: "I help teams ship AI products that actually work. Along the way, I've built tools used by 50+ dev teams and helped 15K travelers find their next adventure.",
    foot: 'rohan · ai builder · dc via hyderabad',
  },
  // WHAT: Clear value proposition
  {
    kind: 'bullets',
    title: 'what I actually do',
    items: [
      'Turn "we should use AI" → working product in weeks',
      'Build YottaBuilder — AI-powered SDLC for dev teams',
      'Make engineers reviewers, not typers',
      'Ship messy first, polish later (it works)',
    ],
  },
  // PROOF: Show the receipts
  {
    kind: 'bullets',
    title: 'things I built',
    items: [
      'YottaBuilder — AI dev tools, 50+ teams shipping faster',
      'Intripid — AI travel planning, 15K users, Antler-backed',
      'Flock — social events platform (they pivoted to AI too)',
      'This portfolio — yes, it counts',
    ],
  },
  // WISDOM: Create a pause, build credibility
  {
    kind: 'quote',
    body: '"Ship the ugly version. Your users\' problems matter more than your clever solution."',
    foot: '— learned this the expensive way',
  },
  // DEPTH: Now they want to know more
  {
    kind: 'bullets',
    title: 'hard-won lessons',
    items: [
      'Nobody cares how you built it, only that it works',
      'Immigrant founder visa math is its own startup',
      'The compound effect is annoyingly real',
      'DC is underrated for building things',
    ],
  },
  // HUMAN: Show personality
  {
    kind: 'bullets',
    title: 'when not shipping',
    items: [
      'Losing gracefully at pickleball, tennis, and TT',
      'Researching coffee origins like a thesis defense',
      'Reading stoic philosophy, applying it nowhere',
      'Driving to Annapolis for the 12th time',
    ],
  },
  // VALUES: What drives me
  {
    kind: 'bullets',
    title: 'what I believe',
    items: [
      'Knowledge is freedom',
      'Small steps compound into mountains',
      'You can build great things from anywhere',
      'Someday: go home, ship products, eat biryani daily',
    ],
  },
  // CTA: End with momentum
  {
    kind: 'cta',
    title: 'say hello',
    body: "Building with AI? Navigating founder chaos? Want to debate coffee origins or why Marcus Aurelius was onto something? The stickers around here actually work.",
    foot: 'pradyumnarohan@gmail.com',
  },
];
