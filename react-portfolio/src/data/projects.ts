import { Project } from '@/types';

// Each entry is one app in the "what I've shipped" Dock, in Dock order.
// Briefs stick to what's true and public: YottaBuilder is in stealth, so no
// metrics there.
export const PROJECTS: Project[] = [
  {
    id: 'yotta',
    name: 'YottaBuilder',
    company: 'Yottaflex.ai',
    monogram: 'YB',
    subtitle: '@ Yottaflex.ai',
    tagline: 'Turning requirements into production code',
    color: '#d95f3e',
    period: 'Current · stealth',
    role: 'Product Manager & AI Consultant',
    description:
      'An AI-powered SDLC platform that turns requirements into production code, moving agile teams from doers to reviewers. I shape the product, not the codebase.',
    brief: {
      problem:
        'Agile teams spend most of their week typing code an AI could draft. The bottleneck has moved: it is knowing what to build and judging what comes back.',
      owned:
        'Product strategy and the roadmap. I translate messy, half-formed requirements into specs the system can actually build.',
      call:
        'Make people reviewers, not typists. AI writes the first draft, people own the judgment, and every roadmap call gets tested against that line.',
      result:
        'Still in stealth. Alongside the product, it is turning Yottaflex from a dev shop into an AI company.',
    },
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
    name: 'Voicebots & IVRs',
    company: 'NSP Systems',
    monogram: 'NS',
    subtitle: '',
    tagline: 'Making Fortune 500 chatbots actually work',
    color: '#8e5ba6',
    period: 'Consulting · 2023-2024',
    role: 'AI Consultant',
    description:
      'Consulted on Fortune 500 conversational AI programs: RLHF strategy, evals, and governance for voicebots and IVRs, plus AI-native POCs that grew into production-scale projects.',
    brief: {
      problem:
        'Fortune 500 voicebots and IVRs that technically worked but frustrated the people calling them, with no shared way to tell whether they were getting better.',
      owned:
        'RLHF strategy, eval frameworks, and governance for conversational AI programs, plus AI-native proofs of concept.',
      call:
        'Measure before you tune. Evals and governance came first, so chatbot quality was measured, not guessed.',
      result:
        'A telecom client’s voicebots and IVRs landed better with their users, and the POCs were scaled into production projects.',
    },
    highlights: [
      'Shaped the RLHF strategy that made a telecom client’s voicebots and IVRs land better with their users',
      'Built eval frameworks and governance so chatbot quality was measured, not guessed',
      'Delivered AI-native POCs that were later scaled into production projects',
    ],
    techStack: ['RLHF', 'Conversational AI', 'Evals', 'AI governance'],
    rotation: 1,
  },
  {
    id: 'intripid',
    name: 'Intripid',
    company: 'Founder',
    monogram: 'In',
    subtitle: '(formerly Travana)',
    tagline: '15K travelers found their next adventure',
    color: '#3d6fa8',
    period: 'Founder · 2022-2023',
    role: 'Co-founder & Tech Lead',
    description:
      'Founded an AI travel planning app. Built "What\'s Next" to predict activities from mood, location, and patterns. Antler-backed.',
    brief: {
      problem:
        'Trip planning is twenty tabs and a spreadsheet. Travelers know the mood they are in, not the itinerary they need.',
      owned: 'Co-founded it and led engineering: the app, the team, and a big share of the pitch.',
      call: 'Predict the next move instead of planning the whole trip up front. That bet became What’s Next.',
      result: '15K travelers, and Antler backing on the vision and early traction.',
    },
    highlights: [
      'Co-founded and led engineering, growing the app to 15K travelers',
      "Designed 'What's Next' to predict a traveler's next move from mood, location, and patterns",
      'Earned Antler backing on the vision and early traction',
    ],
    techStack: ['React Native', 'Node.js', 'MongoDB', 'ML'],
    rotation: 2,
  },
  {
    id: 'whatsnext',
    name: 'What’s Next',
    company: 'Intripid',
    monogram: 'WN',
    tagline: 'Predicting a traveler’s next move',
    color: '#2f8f8a',
    period: 'Intripid · 2022-2023',
    role: 'Product & engineering',
    description:
      'The feature inside Intripid that predicts what a traveler wants to do next from their mood, location, and patterns.',
    brief: {
      problem: 'Travel apps plan the trip up front. Real trips change by the hour.',
      owned: 'Designed the feature end to end, from the idea to the signals the model reads.',
      call:
        'Use the signals a traveler already gives off (mood, location, patterns) instead of asking them to fill out a form.',
      result: 'Shipped inside Intripid. Still convinced it is a billion dollar idea.',
    },
    techStack: ['Recommendation', 'ML', 'React Native'],
  },
  {
    id: 'flock',
    name: 'Flock Shopping',
    company: 'First startup',
    monogram: 'Fl',
    subtitle: '',
    tagline: 'Where I learned to ship fast',
    color: '#4a8b54',
    period: 'First startup · intern',
    role: 'Engineering Intern',
    description:
      'My first startup gig. A social commerce platform that has since pivoted to AI image generation for beauty brands.',
    brief: {
      problem: 'An early social commerce startup that needed to learn what shoppers wanted, fast.',
      owned: 'Shipped product as an early engineer on the platform.',
      call: 'Validate ideas in code first, polish later.',
      result:
        'Learned to ship fast. Flock has since pivoted to AI image generation for beauty brands.',
    },
    highlights: [
      'Shipped product fast as an early engineer on a social-commerce platform',
      'Learned to validate ideas in code first and polish later',
    ],
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    rotation: -1,
  },
];
