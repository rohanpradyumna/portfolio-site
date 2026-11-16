'use client';

import React, { CSSProperties, FormEvent, KeyboardEvent, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Seat } from '@/lib/council/contract';
import { composerHints } from './composerHints';
import { COUNCIL_COPY } from '@/data/council/copy';
import { ArrowIcon, CloseIcon } from './doodles';
import { useEscape } from './hooks';
import { DURATIONS, FADE, FADE_OUT, SPRINGS } from './motion';
import styles from './council.module.css';

const COPY = COUNCIL_COPY.scene;

/** Grows a textarea with its content, up to the cap set in CSS. */
export function useAutoGrow(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [value]);
  return ref;
}

/** On a phone the keyboard resizes the visual viewport after focus. Bring the field back into view once it has. */
export function useKeepVisibleWhileFocused(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const onResize = () => {
      const element = ref.current;
      if (element && document.activeElement === element) element.scrollIntoView({ block: 'nearest' });
    };
    viewport.addEventListener('resize', onResize);
    return () => viewport.removeEventListener('resize', onResize);
  }, [ref]);
}

interface RecipientProps {
  seat: Seat | null;
  onClear?: () => void;
}

function Recipient({ seat, onClear }: RecipientProps) {
  return (
    <p className={styles.recipient}>
      <span>{COPY.recipientLabel}</span>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={seat?.id ?? 'council'}
          className={styles.recipientChip}
          style={seat ? ({ '--seat-accent': seat.accent } as CSSProperties) : undefined}
          data-seat={seat?.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: FADE_OUT }}
          transition={SPRINGS.chip}
        >
          {seat && <span className={styles.recipientDot} aria-hidden="true" />}
          {seat ? seat.lensLabel : COPY.wholeCouncil}
          {seat && onClear && (
            <button type="button" className={styles.recipientClear} onClick={onClear} aria-label={COPY.backToCouncil} title={COPY.backToCouncil}>
              <CloseIcon />
            </button>
          )}
        </motion.span>
      </AnimatePresence>
    </p>
  );
}

export interface ComposerProps {
  draft: string;
  seat: Seat | null;
  /** Live questions left today, when known and worth showing. */
  visitorLeft: number | null;
  /** False when a question cannot be sent right now. The reason is shown beside the card. */
  canSend: boolean;
  onDraft: (text: string) => void;
  onClearSeat: () => void;
  onSubmit: () => void;
  /** Called when the visitor tries to send while sending is not possible. */
  onBlocked: () => void;
}

export function Composer({ draft, seat, visitorLeft, canSend, onDraft, onClearSeat, onSubmit, onBlocked }: ComposerProps) {
  const fieldId = useId();
  const hintId = useId();
  const noticeId = useId();
  const textareaRef = useAutoGrow(draft);
  useKeepVisibleWhileFocused(textareaRef);
  const [attempted, setAttempted] = useState(false);

  const { blocked, problem, hint, spoken } = composerHints(draft, attempted);

  const submit = () => {
    if (blocked) {
      setAttempted(true);
      textareaRef.current?.focus();
      return;
    }
    if (!canSend) {
      onBlocked();
      return;
    }
    setAttempted(false);
    onSubmit();
  };

  const onFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter breaks the line. Never mid-composition (IME).
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className={styles.cardBody} onSubmit={onFormSubmit} noValidate>
      <div className={styles.cardTop}>
        <Recipient seat={seat} onClear={onClearSeat} />
        {visitorLeft !== null && <p className={styles.quota}>{COUNCIL_COPY.limits.visitorLeft(visitorLeft)}</p>}
      </div>

      <label className="sr-only" htmlFor={fieldId}>
        {COPY.composerLabel}
      </label>
      <textarea
        id={fieldId}
        ref={textareaRef}
        className={styles.field}
        rows={2}
        value={draft}
        placeholder={COPY.placeholder}
        enterKeyHint="send"
        autoComplete="off"
        spellCheck
        aria-invalid={problem !== null || undefined}
        aria-describedby={`${hint ? hintId : ''} ${noticeId}`.trim()}
        onChange={(event) => onDraft(event.target.value)}
        onKeyDown={onKeyDown}
      />

      <p id={hintId} className={styles.fieldHint} data-tone={problem ? 'warn' : undefined}>
        {hint}
      </p>
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {spoken}
      </span>

      <div className={styles.cardBottom}>
        <p id={noticeId} className={styles.sendNotice}>
          {COPY.sendNotice}{' '}
          {/* A new tab: following this in place would throw away the question being typed. */}
          <a href="/council/privacy" target="_blank" rel="noopener noreferrer" className={styles.cardLink}>
            {COPY.privacyLink}
            <span className="sr-only"> ({COUNCIL_COPY.opensInNewTab})</span>
          </a>
        </p>
        <button type="submit" className={styles.primary} aria-disabled={!canSend || undefined}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={seat?.id ?? 'council'}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: FADE_OUT }}
              transition={SPRINGS.chip}
            >
              {seat ? COPY.askSeat(seat.lensLabel) : COPY.askCouncil}
            </motion.span>
          </AnimatePresence>
          <ArrowIcon />
        </button>
      </div>
    </form>
  );
}

export interface AskedProps {
  question: string;
  seat: Seat | null;
  newQuestion: React.ReactNode;
}

export function Asked({ question, seat, newQuestion }: AskedProps) {
  return (
    <div className={styles.cardBody}>
      <div className={styles.cardTop}>
        <Recipient seat={seat} />
        {newQuestion}
      </div>
      {/* A very long question scrolls inside the card instead of burying the replies. */}
      <div className={styles.askedScroll} tabIndex={question.length > 420 ? 0 : undefined} role={question.length > 420 ? 'group' : undefined} aria-label={question.length > 420 ? COPY.composerLabel : undefined}>
        <h2 className={styles.asked}>{question}</h2>
      </div>
    </div>
  );
}

export interface NewQuestionButtonProps {
  label: string;
  variant: 'ghost' | 'primary';
  /** null: start over at once. Otherwise the sentence explaining what would be lost. */
  confirmBody: string | null;
  onConfirm: () => void;
}

/** New question, with a small in-place confirmation when there is something to lose. */
export function NewQuestionButton({ label, variant, confirmBody, onConfirm }: NewQuestionButtonProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const copy = COUNCIL_COPY.confirmNew;

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };
  useEscape(open, close);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onPointerDown = (event: globalThis.PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  return (
    <span className={styles.newWrap} ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={variant === 'primary' ? styles.primary : styles.cardGhost}
        aria-haspopup={confirmBody ? 'dialog' : undefined}
        aria-expanded={confirmBody ? open : undefined}
        onClick={() => (confirmBody ? setOpen((value) => !value) : onConfirm())}
      >
        {label}
      </button>
      <AnimatePresence>
        {open && confirmBody && (
          <motion.div
            className={styles.confirm}
            role="alertdialog"
            aria-modal="false"
            aria-labelledby={titleId}
            aria-describedby={bodyId}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, transition: { duration: DURATIONS.exit } }}
            transition={FADE}
          >
            <p id={titleId} className={styles.confirmTitle}>
              {copy.title}
            </p>
            <p id={bodyId} className={styles.confirmBody}>
              {confirmBody}
            </p>
            <div className={styles.confirmActions}>
              <button ref={cancelRef} type="button" className={styles.paperButton} onClick={close}>
                {copy.cancel}
              </button>
              <button
                type="button"
                className={styles.inkButton}
                onClick={() => {
                  setOpen(false);
                  onConfirm();
                }}
              >
                {copy.confirm}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
