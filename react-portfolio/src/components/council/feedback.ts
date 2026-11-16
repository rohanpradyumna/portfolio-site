'use client';

import { feel } from './feel';

// The single seam for sound and haptics in the scene. Components call
// feedback('select') and never touch audio or vibration themselves. The
// palette itself (which sound, which haptic) lives in feel/events.ts, and a
// type-level test there fails if this union gains an event feel lacks.

export type FeedbackEvent =
  | 'select' // a seat was chosen or cleared
  | 'page' // the stance pager settled on a neighbouring seat
  | 'send' // a question or follow-up was submitted
  | 'turnStart' // a seat began replying
  | 'turnEnd' // a reply finished
  | 'challenge' // the visitor pushed back on a seat
  | 'stop' // the visitor interrupted
  | 'limit' // the thread or the day ran out
  | 'error';

export function feedback(event: FeedbackEvent): void {
  feel(event);
}
