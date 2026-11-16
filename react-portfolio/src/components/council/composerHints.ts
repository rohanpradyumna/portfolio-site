import { COUNCIL_LIMITS } from '@/lib/council/contract';
import { COUNCIL_COPY } from '@/data/council/copy';

/** The server rejects a question shorter than this. */
export const MIN_QUESTION_CHARS = 2;

/** Characters left at which the countdown is read out. */
export const COUNT_MILESTONES: readonly number[] = [100, 50, 20, 10, 0];

export interface ComposerHints {
  /** The question cannot be sent as it stands. */
  blocked: boolean;
  /** A validation message, or null. Shown in the warning tone. */
  problem: string | null;
  /** The visible line under the field: the problem, or the countdown near the limit. */
  hint: string | null;
  /**
   * What a screen reader is told unprompted. A real problem always; the
   * countdown only at a few milestones. The visible counter changes on every
   * keystroke, and announcing each one would talk over the visitor's typing.
   */
  spoken: string;
}

export function composerHints(draft: string, attempted: boolean): ComposerHints {
  const copy = COUNCIL_COPY.scene;
  const left = COUNCIL_LIMITS.maxInputChars - draft.length;
  const tooLong = left < 0;
  const tooShort = draft.trim().length < MIN_QUESTION_CHARS;
  const problem = tooLong ? copy.tooLong(COUNCIL_LIMITS.maxInputChars) : attempted && tooShort ? copy.emptyQuestion : null;
  return {
    blocked: tooLong || tooShort,
    problem,
    hint: problem ?? (left <= 200 ? copy.charsLeft(left) : null),
    spoken: problem ?? (COUNT_MILESTONES.includes(left) ? copy.charsLeft(left) : ''),
  };
}
