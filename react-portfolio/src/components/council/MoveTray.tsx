'use client';

import React, { CSSProperties, KeyboardEvent, ReactNode, useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { COUNCIL_LIMITS, FollowUpAction, SEAT_IDS, SeatId } from '@/lib/council/contract';
import { COUNCIL_COPY } from '@/data/council/copy';
import { SEATS } from '@/data/council/seats';
import { SeatPortrait } from '@/components/council/portraits';
import { ArrowIcon, TickIcon } from './doodles';
import { FADE, FADE_OUT, SPRINGS } from './motion';
import { useAutoGrow, useKeepVisibleWhileFocused } from './QuestionCard';
import { PushBackDraft } from './state/reducer';
import { ThreadOptions } from './state/selectors';
import { SendResult } from './state/useCouncil';
import { useViewScale } from './scale';
import styles from './council.module.css';

const ACTIONS: FollowUpAction[] = ['push_back', 'say_more', 'differ', 'debate', 'hear_everyone'];

// The seat picker shared by Push back and Say more.
const WHICH_SEAT = COUNCIL_COPY.scene.whichSeat;

interface SeatPickerProps {
  label: string;
  seatIds: SeatId[];
  value: SeatId | null;
  onPick: (seatId: SeatId) => void;
}

function SeatPicker({ label, seatIds, value, onPick }: SeatPickerProps) {
  const scale = useViewScale();
  const labelId = useId();
  return (
    <div className={styles.picker}>
      <p id={labelId} className={styles.pickerLabel}>
        {label}
      </p>
      <div className={styles.pickerRow} role="group" aria-labelledby={labelId}>
        {seatIds.map((seatId) => {
          const seat = SEATS[seatId];
          const picked = value === seatId;
          return (
            <button
              key={seatId}
              type="button"
              className={styles.pick}
              style={{ '--seat-accent': seat.accent } as CSSProperties}
              aria-pressed={picked}
              onClick={() => onPick(seatId)}
            >
              <span className={styles.pickPortrait}>
                <SeatPortrait seatId={seatId} size={Math.round(34 * scale)} mood="idle" />
              </span>
              <span>{seat.lensLabel}</span>
              {picked && (
                <span className={styles.pickTick}>
                  <TickIcon />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export interface MoveTrayProps {
  options: ThreadOptions;
  /** Seats that have not replied yet: who Hear everyone would bring in. */
  unspokenSeatIds: SeatId[];
  /** The seat picked on the bench, offered as the default target. */
  selectedSeatId: SeatId | null;
  pushBack: PushBackDraft | null;
  /** The sentence over the tray: one follow-up left, the round is over, or why live is off. */
  title: string;
  note: string | null;
  onOpenPushBack: (seatId: SeatId, text?: string) => void;
  onPushBackText: (text: string) => void;
  onClosePushBack: () => void;
  onSendPushBack: () => SendResult;
  onSayMore: (seatId: SeatId) => SendResult;
  onDebate: (objector: SeatId, addressed: SeatId) => SendResult;
  onDiffer: () => SendResult;
  onHearEveryone: () => SendResult;
  /**
   * Phone layout: the tickets stack, so an armed move opens directly under its
   * own ticket instead of below the whole list.
   */
  inline: boolean;
  /** Shown straight under the title: the way out, once the thread has nothing live left. */
  lead?: ReactNode;
  /** A label over the tickets when they are the curated leftovers rather than the live move. */
  ticketsLabel?: string | null;
  children?: ReactNode;
}

/**
 * The visitor's one follow-up. Choosing a move arms it; a separate button
 * spends it. The gap is deliberate: with a single exchange left, a stray tap
 * should never be what uses it.
 */
export function MoveTray({
  options,
  unspokenSeatIds,
  selectedSeatId,
  pushBack,
  title,
  note,
  onOpenPushBack,
  onPushBackText,
  onClosePushBack,
  onSendPushBack,
  onSayMore,
  onDebate,
  onDiffer,
  onHearEveryone,
  inline,
  lead,
  ticketsLabel,
  children,
}: MoveTrayProps) {
  const titleId = useId();
  const fieldId = useId();
  const hintId = useId();
  const [armedLocal, setArmed] = useState<FollowUpAction | null>(null);
  const [sayMoreSeat, setSayMoreSeat] = useState<SeatId | null>(null);
  const [objector, setObjector] = useState<SeatId | null>(null);
  const [addressed, setAddressed] = useState<SeatId | null>(null);
  const [attempted, setAttempted] = useState(false);

  // An open objection always shows its composer, including one restored after a failed send.
  const armed: FollowUpAction | null = pushBack ? 'push_back' : armedLocal;

  // Arming a move sends focus into its panel, so a keyboard user does not have
  // to tab past the other tickets to reach it. Escape hands focus back.
  const trayRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const lastArmed = useRef(armed);
  useEffect(() => {
    if (lastArmed.current === armed) return;
    const previous = lastArmed.current;
    lastArmed.current = armed;
    if (armed) {
      const panel = panelRef.current;
      (panel?.querySelector<HTMLElement>('textarea') ?? panel?.querySelector<HTMLElement>('button'))?.focus();
    }
    else if (previous) trayRef.current?.querySelector<HTMLElement>(`button[data-ticket="${previous}"]`)?.focus();
  }, [armed]);

  const inOrder = (ids: SeatId[]) => SEAT_IDS.filter((id) => ids.includes(id));
  const seatEntries = SEAT_IDS.flatMap((id) => {
    const moves = options.seats[id];
    return moves ? [{ id, moves }] : [];
  });
  const pushBackSeats = seatEntries.filter((entry) => entry.moves.pushBack).map((entry) => entry.id);
  const sayMoreSeats = seatEntries.filter((entry) => entry.moves.sayMore).map((entry) => entry.id);
  const objectors = inOrder(seatEntries.flatMap((entry) => entry.moves.debate?.objectors ?? []));
  const addressedFor = (who: SeatId | null) =>
    who ? seatEntries.filter((entry) => entry.moves.debate?.objectors.includes(who)).map((entry) => entry.id) : [];
  const unspoken = unspokenSeatIds;

  const available: Record<FollowUpAction, boolean> = {
    push_back: pushBackSeats.length > 0,
    say_more: sayMoreSeats.length > 0,
    differ: options.differ !== null,
    debate: objectors.length > 0,
    hear_everyone: options.hearEveryone !== null,
  };
  const tickets = ACTIONS.filter((action) => available[action]);

  const preferred = (candidates: SeatId[]): SeatId | null =>
    selectedSeatId && candidates.includes(selectedSeatId) ? selectedSeatId : candidates.length === 1 ? candidates[0] : null;

  const pickPushBackSeat = (seatId: SeatId) => {
    const moves = options.seats[seatId];
    // With no live council, the only objection that can be answered is the curated one.
    const scriptedOnly = moves?.pushBack === 'scripted' ? (moves.canned ?? '') : undefined;
    onOpenPushBack(seatId, scriptedOnly ?? pushBack?.text ?? '');
    // The seat is chosen; the next thing to do is type.
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>('textarea')?.focus());
  };

  const arm = (action: FollowUpAction) => {
    setAttempted(false);
    if (armed === action) {
      setArmed(null);
      if (action === 'push_back') onClosePushBack();
      return;
    }
    if (armed === 'push_back') onClosePushBack();
    setArmed(action);
    if (action === 'push_back') {
      const seatId = preferred(pushBackSeats);
      if (seatId) pickPushBackSeat(seatId);
    } else if (action === 'say_more') {
      setSayMoreSeat(preferred(sayMoreSeats));
    } else if (action === 'debate') {
      const who = objectors.length === 1 ? objectors[0] : null;
      setObjector(who);
      const candidates = addressedFor(who);
      setAddressed(candidates.length === 1 ? candidates[0] : null);
    }
  };

  const disarm = () => {
    setArmed(null);
    setAttempted(false);
    if (pushBack) onClosePushBack();
  };

  const finish = (result: SendResult) => {
    if (result === 'sent') {
      setArmed(null);
      setAttempted(false);
    }
  };

  const pushBackMoves = pushBack ? options.seats[pushBack.seatId] : undefined;
  const pushBackScriptedOnly = pushBackMoves?.pushBack === 'scripted';
  // A typed objection is shown for as long as it exists, even when it can no
  // longer be sent (the thread's exchange is spent, or live went off under
  // it). Otherwise a failed send would leave the visitor's words in state
  // with no way to reach them.
  const pushBackSendable = Boolean(pushBackMoves?.pushBack);
  const showPanel = armed !== null && (available[armed] || (armed === 'push_back' && pushBack !== null));
  const pushBackText = pushBack?.text ?? '';
  const pushBackTooLong = pushBackText.length > COUNCIL_LIMITS.maxInputChars;
  const textareaRef = useAutoGrow(pushBackText);
  useKeepVisibleWhileFocused(textareaRef);

  const sendPushBack = () => {
    if (!pushBackSendable) return;
    if (pushBackText.trim() === '' || pushBackTooLong) {
      setAttempted(true);
      textareaRef.current?.focus();
      return;
    }
    finish(onSendPushBack());
  };

  const onPushBackKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      sendPushBack();
    }
  };

  const addressedCandidates = addressedFor(objector);
  const pushBackHint = pushBackTooLong
    ? COUNCIL_COPY.scene.tooLong(COUNCIL_LIMITS.maxInputChars)
    : attempted && pushBackText.trim() === ''
      ? COUNCIL_COPY.pushBack.empty
      : null;

  const panel = (
      <AnimatePresence mode="popLayout" initial={false}>
        {armed && showPanel && (
          <motion.div
            key={armed}
            ref={panelRef}
            className={styles.armed}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
                disarm();
              }
            }}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, transition: FADE_OUT }}
            transition={SPRINGS.surface}
          >
            {armed === 'push_back' && (
              <>
                {pushBackSeats.length > 1 && (
                  <SeatPicker label={WHICH_SEAT} seatIds={pushBackSeats} value={pushBack?.seatId ?? null} onPick={pickPushBackSeat} />
                )}
                {pushBack && (
                  <form
                    className={styles.objection}
                    onSubmit={(event) => {
                      event.preventDefault();
                      sendPushBack();
                    }}
                    noValidate
                  >
                    <label htmlFor={fieldId} className={styles.objectionLabel}>
                      <span>{COUNCIL_COPY.pushBack.to(SEATS[pushBack.seatId].lensLabel)}</span>
                      {COUNCIL_COPY.actions.push_back.prompt}
                    </label>
                    <textarea
                      id={fieldId}
                      ref={textareaRef}
                      className={styles.objectionField}
                      rows={2}
                      value={pushBackText}
                      readOnly={pushBackScriptedOnly}
                      placeholder={COUNCIL_COPY.pushBack.placeholder}
                      enterKeyHint="send"
                      aria-invalid={pushBackHint !== null || undefined}
                      aria-describedby={pushBackHint ? hintId : undefined}
                      onChange={(event) => onPushBackText(event.target.value)}
                      onKeyDown={onPushBackKeyDown}
                    />
                    <p id={hintId} className={styles.objectionHint} aria-live="polite">
                      {pushBackHint}
                    </p>
                    {!pushBackSendable && (
                      <p className={styles.objectionKept} role="status">
                        {COUNCIL_COPY.pushBack.kept}
                      </p>
                    )}
                    {pushBackMoves?.canned && !pushBackScriptedOnly && pushBackText.trim() !== pushBackMoves.canned.trim() && (
                      <p className={styles.suggestion}>
                        <span>{COUNCIL_COPY.pushBack.suggestionLabel}</span>
                        <button
                          type="button"
                          className={styles.suggestionChip}
                          onClick={() => {
                            onPushBackText(pushBackMoves.canned ?? '');
                            textareaRef.current?.focus();
                          }}
                        >
                          {pushBackMoves.canned}
                        </button>
                      </p>
                    )}
                    <div className={styles.armedActions}>
                      <button type="button" className={styles.textButton} onClick={disarm}>
                        {COUNCIL_COPY.pushBack.cancel}
                      </button>
                      <button type="submit" className={styles.primary} aria-disabled={!pushBackSendable || undefined}>
                        {COUNCIL_COPY.pushBack.submit}
                        <ArrowIcon />
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {armed === 'say_more' && (
              <>
                {sayMoreSeats.length > 1 && (
                  <SeatPicker label={WHICH_SEAT} seatIds={sayMoreSeats} value={sayMoreSeat} onPick={setSayMoreSeat} />
                )}
                <div className={styles.armedActions}>
                  <button type="button" className={styles.textButton} onClick={disarm}>
                    {COUNCIL_COPY.pushBack.cancel}
                  </button>
                  <button
                    type="button"
                    className={styles.primary}
                    aria-disabled={!sayMoreSeat || undefined}
                    onClick={() => sayMoreSeat && finish(onSayMore(sayMoreSeat))}
                  >
                    {COUNCIL_COPY.actions.say_more.label}
                    {sayMoreSeat ? `: ${SEATS[sayMoreSeat].lensLabel}` : ''}
                    <ArrowIcon />
                  </button>
                </div>
              </>
            )}

            {armed === 'debate' && (
              <>
                <SeatPicker
                  label={COUNCIL_COPY.debate.pickObjector}
                  seatIds={objectors}
                  value={objector}
                  onPick={(seatId) => {
                    setObjector(seatId);
                    const candidates = addressedFor(seatId);
                    setAddressed(
                      addressed && candidates.includes(addressed) ? addressed : candidates.length === 1 ? candidates[0] : null,
                    );
                  }}
                />
                {objector && (
                  <SeatPicker
                    label={COUNCIL_COPY.debate.pickAddressed}
                    seatIds={addressedCandidates}
                    value={addressed}
                    onPick={setAddressed}
                  />
                )}
                <AnimatePresence initial={false}>
                  {objector && addressed && (
                    <motion.p
                      key={`${objector}-${addressed}`}
                      className={styles.debateSummary}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={FADE}
                    >
                      {COUNCIL_COPY.debate.summary(SEATS[objector].lensLabel, SEATS[addressed].lensLabel)}
                    </motion.p>
                  )}
                </AnimatePresence>
                <div className={styles.armedActions}>
                  <button type="button" className={styles.textButton} onClick={disarm}>
                    {COUNCIL_COPY.pushBack.cancel}
                  </button>
                  <button
                    type="button"
                    className={styles.primary}
                    aria-disabled={!objector || !addressed || undefined}
                    onClick={() => objector && addressed && finish(onDebate(objector, addressed))}
                  >
                    {COUNCIL_COPY.debate.start}
                    <ArrowIcon />
                  </button>
                </div>
              </>
            )}

            {(armed === 'differ' || armed === 'hear_everyone') && (
              <>
                {armed === 'hear_everyone' && unspoken.length > 0 && (
                  <p className={styles.debateSummary}>{unspoken.map((id) => SEATS[id].lensLabel).join(', ')}</p>
                )}
                <div className={styles.armedActions}>
                  <button type="button" className={styles.textButton} onClick={disarm}>
                    {COUNCIL_COPY.pushBack.cancel}
                  </button>
                  <button
                    type="button"
                    className={styles.primary}
                    onClick={() => finish(armed === 'differ' ? onDiffer() : onHearEveryone())}
                  >
                    {COUNCIL_COPY.actions[armed].label}
                    <ArrowIcon />
                  </button>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
  );

  return (
    <section className={styles.tray} aria-labelledby={titleId} ref={trayRef}>
      <header>
        <h2 id={titleId} className={styles.trayTitle}>
          {title}
        </h2>
        {note && <p className={styles.trayNote}>{note}</p>}
      </header>

      {lead}

      {tickets.length > 0 && ticketsLabel && <p className={styles.ticketsLabel}>{ticketsLabel}</p>}
      {tickets.length > 0 && (
        <ul className={styles.tickets} data-quiet={ticketsLabel ? true : undefined}>
          {tickets.map((action) => (
            <li key={action}>
              <button
                type="button"
                className={styles.ticket}
                aria-pressed={armed === action}
                data-ticket={action}
                data-dim={(armed !== null && armed !== action) || undefined}
                onClick={() => arm(action)}
              >
                <span className={styles.ticketLabel}>{COUNCIL_COPY.actions[action].label}</span>
                <span className={styles.ticketHint}>{COUNCIL_COPY.actions[action].hint}</span>
              </button>
              {inline && armed === action && panel}
            </li>
          ))}
        </ul>
      )}

      {/* On a phone the panel sits under its ticket. With no ticket to sit under (a kept objection), it stands alone. */}
      {(!inline || (armed !== null && !tickets.includes(armed))) && panel}

      {children}
    </section>
  );
}
