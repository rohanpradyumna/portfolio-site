import { Project } from '@/types';

export const PROJECTS: Project[] = [
  {
    id: 'yotta',
    name: 'YottaBuilder',
    monogram: 'YB',
    subtitle: '@ Yottaflex.ai',
    tagline: 'Turning requirements into production code',
    color: '#d95f3e',
    period: 'CURRENT · STEALTH',
    role: 'Product Manager & AI Consultant',
    description:
      'An AI-powered SDLC platform that turns requirements into production code, moving agile teams from doers to reviewers. I shape the product, not the codebase.',
    highlights: [
      'Own product strategy and the roadmap for an AI-native SDLC platform',
      'Translate vague, half-formed requirements into specs an AI can actually build',
      'Drive the doers → reviewers shift, so teams ship by reviewing AI output instead of hand-typing it',
    ],
    techStack: ['LLMs', 'AI product', 'SDLC automation', 'Roadmapping'],
    rotation: -2,
  },
  {
    id: 'nsp',
    name: 'NSP Systems',
    monogram: 'NS',
    subtitle: '',
    tagline: 'Making Fortune 500 chatbots actually work',
    color: '#8e5ba6',
    period: 'CONSULTING · 2023-2024',
    role: 'AI Consultant',
    description:
      'Consulted on Fortune 500 conversational AI programs: RLHF strategy, evals, and governance for voicebots and IVRs, plus AI-native POCs that grew into production-scale projects.',
    highlights: [
      'Shaped the RLHF strategy that made a telecom client\u2019s voicebots and IVRs land better with their users',
      'Built eval frameworks and governance so chatbot quality was measured, not guessed',
      'Delivered AI-native POCs that were later scaled into production projects',
    ],
    techStack: ['RLHF', 'Conversational AI', 'Evals', 'AI governance'],
    rotation: 1,
  },
  {
    id: 'intripid',
    name: 'Intripid',
    monogram: 'In',
    subtitle: '(formerly Travana)',
    tagline: '15K travelers found their next adventure',
    color: '#3d6fa8',
    period: 'FOUNDER · 2022-2023',
    role: 'Co-founder & Tech Lead',
    description:
      'Founded an AI travel planning app. Built "What\'s Next" to predict activities from mood, location, and patterns. Antler-backed.',
    highlights: [
      'Co-founded and led engineering, growing the app to 15K travelers',
      "Designed 'What's Next' to predict a traveler's next move from mood, location, and patterns",
      'Earned Antler backing on the vision and early traction',
    ],
    techStack: ['React Native', 'Node.js', 'MongoDB', 'ML'],
    rotation: 2,
  },
  {
    id: 'flock',
    name: 'Flock Shopping',
    monogram: 'Fl',
    subtitle: '',
    tagline: 'Where I learned to ship fast',
    color: '#4a8b54',
    period: 'FIRST STARTUP · INTERN',
    role: 'Engineering Intern',
    description:
      'My first startup gig. A social commerce platform that has since pivoted to AI image generation for beauty brands.',
    highlights: [
      'Shipped product fast as an early engineer on a social-commerce platform',
      'Learned to validate ideas in code first and polish later',
    ],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    rotation: -1,
  },
];
