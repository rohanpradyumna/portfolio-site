// The third reel of the rabbit-hole machine: how to learn the topic. Each mode
// turns the topic into a prompt the visitor takes to their own AI.

export interface RabbitHoleMode {
  id: string;
  label: string;
  prompt: (topic: string) => string;
}

export const RABBIT_HOLE_MODES: RabbitHoleMode[] = [
  {
    id: 'ten-minutes',
    label: '10-minute read',
    prompt: (t) =>
      `Teach me this in about 10 minutes of reading, not a shallow summary and not an exhaustive deep dive:

"${t}"

Cover what it actually means, why it matters, one concrete example or story, and one common misconception about it. Assume I'm curious and reasonably smart, but new to this topic.`,
  },
  {
    id: 'quiz-me',
    label: 'Quiz me',
    prompt: (t) =>
      `I want to learn this by being questioned, not lectured:

"${t}"

Ask me one question at a time. Start from what I might already know and build up. When I'm wrong, correct me gently and say why. After about 8 questions, sum up what I learned and what to read next.`,
  },
  {
    id: 'steelman',
    label: 'Steelman both sides',
    prompt: (t) =>
      `"${t}"

Give me a short, plain explanation first. Then make the strongest case for the main view and the strongest case against it, the way their best defenders would. Finish with where the real disagreement lies and what evidence would settle it.`,
  },
  {
    id: 'explain-simply',
    label: 'Explain it simply',
    prompt: (t) =>
      `Explain this to me like I'm a sharp 12-year-old:

"${t}"

Use plain words, one everyday analogy and one real example. Then tell me the one thing most people get wrong about it, and one question I could ask to sound like I get it.`,
  },
  {
    id: 'as-a-story',
    label: 'Tell it as a story',
    prompt: (t) =>
      `Teach me this through a story:

"${t}"

Who was involved, the moment it mattered, and what changed after. Keep it true to the facts and about 600 words. End with why it still matters today. If any detail is uncertain, say so.`,
  },
  {
    id: 'use-it',
    label: 'Use it this week',
    prompt: (t) =>
      `"${t}"

Explain it in a few short paragraphs, then show me how it shows up in everyday life or work. Give me one small thing I could try, notice or decide differently this week because of it.`,
  },
  {
    id: 'weekend',
    label: 'Weekend deep dive',
    prompt: (t) =>
      `Build me a weekend learning plan for this:

"${t}"

Start with a 5-minute overview. Then give me 3 to 5 of the best books, essays, lectures or papers on it, why each one, and only ones you're confident exist. Add the key questions to hold while reading, and a way to check I really understood it.`,
  },
];

export function findModeById(id: string | undefined): number {
  const i = RABBIT_HOLE_MODES.findIndex((m) => m.id === id);
  return i < 0 ? 0 : i;
}
