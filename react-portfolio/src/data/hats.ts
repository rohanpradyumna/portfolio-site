import type { HatId } from '@/components/hats/portrait/hats';

export interface Hat {
  id: HatId;
  label: string;
  /** Hat colour, used for the card's accent rule. */
  accent: string;
  /** What Rohan says when the hat lands. DRAFT: in his voice, for him to rewrite. */
  line: string;
  /** One line: what a team gets when Rohan wears this hat. */
  youGet: string;
  /** One real, checkable moment that proves it. */
  receipt: string;
  /** Where the receipt lives: a Dock window id, or an outside href. */
  proof: { projectId: string; label: string } | { href: string; label: string };
  /** 4-5 specific skill tags. */
  skills: string[];
}

export const HAT_LIST: Hat[] = [
  {
    id: 'pm',
    label: 'Product',
    accent: '#3d6fa8',
    line: 'Okay. What are we not building?',
    youGet: 'Someone who turns a fuzzy "we should" into a roadmap a team can actually ship.',
    receipt:
      'Owns strategy and the roadmap for YottaBuilder, an AI SDLC platform built on one call: make teams reviewers, not typists.',
    proof: { projectId: 'yotta', label: 'open YottaBuilder' },
    skills: [
      'Fuzzy asks → buildable specs',
      'Roadmap triage',
      'Saying no, politely',
      'Translating between execs and engineers',
      'AI-native SDLC',
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    accent: '#c9951a',
    line: 'Cool demo. Where are the evals?',
    youGet: 'Someone who knows where AI actually works, and how to prove that it does.',
    receipt:
      'Shaped the RLHF strategy behind a Fortune 500 telecom client’s voicebots and IVRs, and turned AI POCs into production projects.',
    proof: { projectId: 'nsp', label: 'open Voicebots & IVRs' },
    skills: [
      'RLHF strategy',
      'Prompt & eval design',
      'POC → production',
      'Conversational AI',
      'Knowing when not to use AI',
    ],
  },
  {
    id: 'consulting',
    label: 'Consulting',
    accent: '#7d4a78',
    line: 'Put me on the client call.',
    youGet:
      'A PM who can sit across from the customer: run the discovery, demo the work, and bring back what they actually need.',
    receipt:
      'Consulted directly with a Fortune 500 telecom client on their voicebots and IVRs, from the first POC to production projects.',
    proof: { projectId: 'nsp', label: 'open Voicebots & IVRs' },
    skills: [
      'Customer discovery',
      'Demos that land',
      'Customer feedback → roadmap',
      'Explaining AI to non-technical buyers',
      'Setting honest expectations',
    ],
  },
  {
    id: 'designer',
    label: 'Design',
    accent: '#c4472a',
    line: 'It works. Does it feel right?',
    youGet: 'Someone who cares how it feels, not just whether it works.',
    receipt:
      'Designed and built this sticker board, and The Council on it: six philosophical lenses that argue about your question.',
    proof: { href: '/council', label: 'try The Council' },
    skills: [
      'Interaction design',
      'Motion & micro-feedback',
      'Playful, tactile UI',
      'Prototyping in code',
      'Copy that sounds human',
    ],
  },
  {
    id: 'entrepreneur',
    label: 'Founder',
    accent: '#2f8f8a',
    line: 'Ship the ugly version first.',
    youGet: 'A PM who has been the founder: took an idea from zero to real users and investors, and still owns the whole product.',
    receipt: 'Co-founded Intripid, an AI travel app: 15K travelers and Antler backing.',
    proof: { projectId: 'intripid', label: 'open Intripid' },
    skills: [
      '0 → 1 on a runway',
      'Pitching (Antler-backed)',
      'Building a first team',
      'User problems over clever solutions',
      'Owning the whole product',
    ],
  },
];
