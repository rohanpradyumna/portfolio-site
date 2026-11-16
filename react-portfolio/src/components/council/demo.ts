import { COUNCIL_LIMITS, CouncilEvent, FollowUpAction, SeatId, Starter } from '@/lib/council/contract';
import { CouncilState, RequestIntent, councilReducer, initialCouncilState } from './state/reducer';
import { chunkText, fixtureEvents } from './transport/fixture';

// ?fixtures=1&demo=<name> jumps straight to a state, for screenshots and
// review. Every state is produced by running real events through the real
// reducer, so a demo can never show something the scene could not reach.

export const DEMO_NAMES = [
  'empty',
  'seat-selected',
  'routing',
  'streaming',
  'opening-complete',
  'push-back',
  'follow-up-complete',
  'debate',
  'everyone',
  'thread-limit',
  'visitor-limit',
  'live-off',
  'budget-exhausted',
  'follow-up-failed',
  'objection-kept',
  'council-note',
  'stopped',
  'error',
  'error-composer',
  'timeout',
  'long',
  'short',
] as const;
export type DemoName = (typeof DEMO_NAMES)[number];

export const isDemoName = (value: string | null): value is DemoName =>
  value !== null && (DEMO_NAMES as readonly string[]).includes(value);

const READY: CouncilState = {
  ...initialCouncilState,
  live: 'available',
  visitorLeft: COUNCIL_LIMITS.visitorDailyGenerations - 1,
};

let serial = 0;

function start(state: CouncilState, intent: RequestIntent, expectedSeatIds: SeatId[] = []): CouncilState {
  serial += 1;
  return councilReducer(state, {
    type: 'request/start',
    requestId: `demo-${serial}`,
    exchangeId: `demo-x-${serial}`,
    intent,
    expectedSeatIds,
  });
}

function feed(state: CouncilState, events: CouncilEvent[]): CouncilState {
  return state.request ? councilReducer(state, { type: 'request/events', requestId: state.request.id, events }) : state;
}

function openStarter(starter: Starter, events?: (all: CouncilEvent[]) => CouncilEvent[]): CouncilState {
  const all = fixtureEvents(starter.id, 'open', starter.opening, chunkText);
  const started = start(READY, { action: 'open', source: 'fixture', question: starter.question, starterId: starter.id });
  return feed(started, events ? events(all) : all);
}

/** Everything up to, and including, roughly `fraction` of the given turn's text. */
function until(all: CouncilEvent[], turnIndex: number, fraction: number): CouncilEvent[] {
  const starts = all.flatMap((event, index) => (event.type === 'turn_start' ? [index] : []));
  const from = starts[turnIndex];
  if (from === undefined) return all;
  const end = all.findIndex((event, index) => index > from && event.type === 'turn_end');
  return all.slice(0, from + 1 + Math.floor((end - from - 1) * fraction));
}

function followUp(
  state: CouncilState,
  starter: Starter,
  action: FollowUpAction,
  source: 'fixture' | 'live',
): CouncilState {
  const scripted = starter.followUps[action];
  if (!scripted) return state;
  const seatIds = scripted.seatIds;
  const target = seatIds
    ? [...state.turns].reverse().find((turn) => turn.seatId === seatIds[seatIds.length - 1])
    : undefined;
  const started = start(
    state,
    {
      action,
      source,
      question: state.question,
      starterId: starter.id,
      seatIds: action === 'hear_everyone' ? undefined : seatIds,
      targetTurnId: target?.id,
      text: action === 'push_back' ? scripted.visitorText : undefined,
    },
    action === 'differ' ? [] : (seatIds ?? []),
  );
  const events = fixtureEvents(starter.id, action, scripted, chunkText).map((event) =>
    event.type === 'session' && source === 'live'
      ? { ...event, exchangesLeft: 0, visitorLeft: Math.max(0, (state.visitorLeft ?? 1) - 1) }
      : event,
  );
  return feed(started, events);
}

const LONG_QUESTION =
  'My closest friend from university started a company three years ago and asked me to join as the second employee. I said no because I had just been promoted and my partner was nervous about money. The company is now doing well, he has stopped asking, and I notice that every time he posts about it I feel something between envy and grief that I cannot name properly, and I have started quietly resenting a job I used to love. Is that feeling telling me something true about what I want, or is it just the ordinary sting of watching a road I did not take, which would have its own regrets if I had taken it? And does it even matter which one it is if I have to decide what to do next either way, with a mortgage, a team that depends on me, and no guarantee that a second offer would ever come?';

const LONG_REPLY =
  'Start by separating the event from your reading of it. The event is small and fixed: an offer was made, you declined, time passed. The reading is large and still moving: that you chose safety over yourself, that the road is closed, that your present work is now a consolation prize. None of those are facts about the past. They are judgments you are making today, and they are the only part of this that is yours to change. Notice too that the envy arrives only when he posts. It is tied to a picture of his life, not to a wish about your own days, and a picture leaves out the payroll he cannot sleep over. So ask the narrower question. If a second offer came tomorrow, from anyone, with the same risks, would you take it? If yes, you have learned something about what you want and can act on it without his company at all. If no, then the grief is for an imagined self, and it deserves a little kindness and no obedience. Either way the decision in front of you was never about three years ago. Averyveryveryverylongunbrokenwordthatshouldwrapinsteadofpushingthenotewiderthanthepagewhichwouldbeabug.';

export function buildDemoState(name: DemoName, starters: Starter[]): CouncilState | null {
  const starter = starters[0];
  if (!starter) return name === 'empty' ? READY : null;

  switch (name) {
    case 'empty':
      return READY;

    case 'seat-selected':
      return {
        ...READY,
        selectedSeatId: 'existentialist',
        draft: 'Should I leave a stable job for something I can’t explain yet?',
      };

    case 'routing':
      return openStarter(starter, (all) => all.filter((event) => event.type === 'session'));

    case 'streaming':
      return openStarter(starter, (all) => until(all, 1, 0.55));

    case 'opening-complete':
      return openStarter(starter);

    case 'push-back': {
      const opened = openStarter(starter);
      const scripted = starter.followUps.push_back;
      const seatId = scripted?.seatIds?.[0];
      const turn = opened.turns.find((candidate) => candidate.seatId === seatId);
      if (!seatId || !turn) return opened;
      return councilReducer(opened, { type: 'pushBack/open', turnId: turn.id, seatId, text: '' });
    }

    case 'follow-up-complete':
      return followUp(openStarter(starter), starter, 'push_back', 'fixture');

    case 'debate':
      return followUp(openStarter(starter), starter, 'debate', 'fixture');

    case 'everyone':
      return followUp(openStarter(starter), starter, 'hear_everyone', 'fixture');

    case 'thread-limit':
      return followUp(openStarter(starter), starter, 'differ', 'live');

    case 'visitor-limit': {
      // A stable, plausible reset time: the top of the hour, five hours out.
      const reset = new Date();
      reset.setHours(reset.getHours() + 5, 0, 0, 0);
      return { ...READY, visitorLeft: 0, resetAt: reset.toISOString(), draft: 'Is ambition just fear with better posture?' };
    }

    case 'live-off':
      return councilReducer(READY, { type: 'status/loaded', status: { live: false, offReason: 'live_disabled', visitorLeft: 3, resetAt: null } });

    case 'budget-exhausted': {
      // What the status call reports once the site-wide ceiling is reached:
      // live is off for everyone, and this visitor's own allowance is untouched.
      const midnight = new Date();
      midnight.setUTCHours(24, 0, 0, 0);
      const typed = councilReducer(READY, { type: 'draft/set', text: 'Is ambition just fear with better posture?' });
      return councilReducer(typed, {
        type: 'status/loaded',
        status: { live: false, offReason: 'budget_exhausted', visitorLeft: 3, resetAt: midnight.toISOString() },
      });
    }

    case 'follow-up-failed':
    case 'objection-kept': {
      // A typed objection goes out, the server counts it, then fails before a
      // word comes back. The exchange is given back and the objection returns
      // to its composer. In the second variant live goes off with the failure,
      // so the objection is kept but can no longer be sent.
      const opened = openStarter(starter);
      const seatId = starter.opening.routing?.seatIds[0] ?? opened.turns[0]?.seatId;
      const turn = opened.turns.find((candidate) => candidate.seatId === seatId);
      if (!seatId || !turn) return opened;
      const sending = start(
        opened,
        {
          action: 'push_back',
          source: 'live',
          question: opened.question,
          starterId: starter.id,
          text: 'You keep saying judgment as if mine were reliable. What if it is the thing I trust least?',
          seatIds: [seatId],
          targetTurnId: turn.id,
        },
        [seatId],
      );
      return feed(sending, [
        { type: 'session', threadToken: 'demo', exchangesLeft: 0, visitorLeft: 2, resetAt: null },
        name === 'follow-up-failed'
          ? { type: 'error', code: 'timeout', message: 'No reply in time.', retryable: true, exchangesLeft: 1, visitorLeft: 3 }
          : { type: 'error', code: 'live_disabled', message: 'Live was switched off.', retryable: false, exchangesLeft: 1, visitorLeft: 3 },
      ]);
    }

    case 'council-note': {
      // The council answering as one voice while it streams: no routing, no seat.
      const started = start(READY, { action: 'open', source: 'live', question: 'What should I have for dinner tonight?', starterId: null });
      return feed(started, [
        { type: 'session', threadToken: 'demo', exchangesLeft: 1, visitorLeft: 2, resetAt: null },
        { type: 'turn_start', turnId: 'council-1', role: 'synthesis' },
        {
          type: 'delta',
          turnId: 'council-1',
          text: 'This one is outside what the council is for. The six seats argue about how to live, and a menu is not really a dilemma, unless the question underneath is',
        },
      ]);
    }

    case 'stopped': {
      const streaming = openStarter(starter, (all) => until(all, 1, 0.45));
      return councilReducer(streaming, { type: 'request/abort' });
    }

    case 'error': {
      const streaming = openStarter(starter, (all) => until(all, 1, 0.35));
      return feed(streaming, [
        { type: 'error', code: 'provider_error', message: 'Upstream closed the stream.', retryable: true },
      ]);
    }

    case 'error-composer':
    case 'timeout': {
      const question = 'Do I owe my past self loyalty?';
      const started = start(READY, { action: 'open', source: 'live', question, starterId: null });
      return feed(started, [
        name === 'timeout'
          ? { type: 'error', code: 'timeout', message: 'No reply in time.', retryable: true }
          : { type: 'error', code: 'provider_error', message: 'Upstream failed.', retryable: true },
      ]);
    }

    case 'long': {
      const started = start(READY, { action: 'open', source: 'live', question: LONG_QUESTION, starterId: null, seatIds: ['stoic'] }, [
        'stoic',
      ]);
      return feed(started, [
        { type: 'session', threadToken: 'demo', exchangesLeft: 1, visitorLeft: 2, resetAt: null },
        { type: 'turn_start', turnId: 'long-1', role: 'seat', seatId: 'stoic' },
        { type: 'delta', turnId: 'long-1', text: LONG_REPLY },
        { type: 'turn_end', turnId: 'long-1' },
        { type: 'follow_up', question: 'If the offer came again tomorrow from a stranger, what would you say?' },
        { type: 'done' },
      ]);
    }

    case 'short': {
      const started = start(READY, { action: 'open', source: 'live', question: 'Why?', starterId: null });
      return feed(started, [
        { type: 'session', threadToken: 'demo', exchangesLeft: 1, visitorLeft: 2, resetAt: null },
        { type: 'routing', seatIds: ['absurdist', 'advaita'], reason: 'Short question.' },
        { type: 'turn_start', turnId: 'short-1', role: 'seat', seatId: 'absurdist' },
        { type: 'delta', turnId: 'short-1', text: 'Why not?' },
        { type: 'turn_end', turnId: 'short-1' },
        { type: 'turn_start', turnId: 'short-2', role: 'seat', seatId: 'advaita' },
        { type: 'delta', turnId: 'short-2', text: 'Who asks?' },
        { type: 'turn_end', turnId: 'short-2' },
        { type: 'done' },
      ]);
    }

    default:
      return null;
  }
}
