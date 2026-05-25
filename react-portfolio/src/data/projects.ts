import { Project } from '@/types';

export const PROJECTS: Project[] = [
  {
    id: 'yotta',
    name: 'YottaBuilder',
    subtitle: '@ Yottaflex.ai',
    tagline: 'Shipped AI tools used by 50+ teams',
    color: '#e85d3a',
    icon: '🚀',
    period: 'CURRENT · STEALTH',
    role: 'Leading Engineering',
    description:
      'Building an AI-powered SDLC platform that transforms requirements into production code. Turning agile teams from doers to reviewers.',
    techStack: ['React', 'TypeScript', 'Python', 'LLMs', 'AWS'],
    rotation: -2,
  },
  {
    id: 'intripid',
    name: 'Intripid',
    subtitle: '(formally Travana)',
    tagline: '15K travelers found their next adventure',
    color: '#2d6cdf',
    icon: '✈️',
    period: 'FOUNDER · 2022-2023',
    role: 'Co-founder & Tech Lead',
    description:
      'Founded an AI travel planning app. Built "What\'s Next" — predicting activities based on mood, location, and patterns. Antler-backed.',
    techStack: ['React Native', 'Node.js', 'MongoDB', 'ML'],
    rotation: 2,
  },
  {
    id: 'flock',
    name: 'Flock Shopping',
    subtitle: '',
    tagline: 'Antler-backed social commerce platform',
    color: '#3a7d44',
    icon: '🛍️',
    period: 'FIRST STARTUP · INTERN',
    role: 'Engineering Intern',
    description:
      'My first startup gig. Social commerce platform — now pivoted to AI image generation for beauty brands.',
    techStack: ['React', 'Node.js', 'PostgreSQL'],
    rotation: -1,
  },
];
