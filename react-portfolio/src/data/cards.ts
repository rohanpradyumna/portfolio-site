import { Card } from '@/types';

export const CARDS: Card[] = [
  {
    kind: 'intro',
    body: "Yo, I'm Rohan, an AI product manager. There's too much broken in the world and I keep trying to build my way out of it. Probably should see someone about that.",
    foot: 'former founder · hyderabad kid in DC',
  },
  {
    kind: 'bullets',
    title: 'what I do',
    items: [
      'PM at Yottaflex, building YottaBuilder: AI for the boring parts of dev',
      'Turn fuzzy AI asks into specs engineers can actually build',
      'Make "it feels better" measurable with evals',
      'Hats on the rack, receipts on the laptop. Go poke them.',
    ],
  },
  {
    kind: 'bullets',
    title: 'how I got here',
    items: [
      'Founded Intripid: AI travel app, 15K users, Antler-backed',
      'AI consultant on voicebots and IVRs at NSP',
      'First startup job at Flock, where I learned to ship fast',
      'Smith School at UMD. Would redo the whole thing. Go Terps.',
    ],
  },
  {
    kind: 'bullets',
    title: 'how I work',
    items: [
      'Ship the ugly version first. You can fix it once it exists.',
      "Users' problems matter more than my clever solution",
      'Nobody cares how you built it. They care that it works.',
      'Small things compound. Annoyingly true.',
    ],
  },
  {
    kind: 'bullets',
    title: 'off the clock',
    items: [
      'Losing at pickleball, tennis, badminton and table tennis',
      'Researching coffee origins and reading the Stoics, for no professional reason',
      'Ran a camp for kids in foster homes',
      'Built blood donor chains for thalassemia kids with Blood Warriors India',
    ],
  },
  {
    kind: 'cta',
    title: "let's talk",
    body: 'Building with AI and need a PM who ships? Want an AI consultant to pressure-test an idea? Or just want to argue about coffee? My inbox is open, and I actually reply.',
    foot: 'pradyumnarohan@gmail.com',
  },
];
