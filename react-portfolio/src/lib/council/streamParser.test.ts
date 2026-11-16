import { describe, expect, it } from 'vitest';
import { CouncilEvent, SEAT_IDS, SeatId } from './contract';
import { CouncilStreamParser, FALLBACK_ROUTING_REASON, ParsePlan } from './streamParser';

const routedPlan: ParsePlan = { routing: true, allowedSeats: SEAT_IDS, synthesis: false, replyTo: {}, allowAsk: true, fallback: null };

function seatsPlan(seats: SeatId[], extra: Partial<ParsePlan> = {}): ParsePlan {
  return { routing: false, allowedSeats: seats, synthesis: false, replyTo: {}, allowAsk: false, fallback: null, ...extra };
}

function run(plan: ParsePlan, chunks: string[]): CouncilEvent[] {
  let n = 0;
  const parser = new CouncilStreamParser(plan, { newTurnId: () => `t${++n}` });
  const events: CouncilEvent[] = [];
  for (const chunk of chunks) events.push(...parser.push(chunk));
  events.push(...parser.end());
  return events;
}

interface Summary {
  routing: { seatIds: SeatId[]; reason: string } | null;
  turns: { role: string; seatId?: SeatId; replyToSeatId?: SeatId; text: string; ended: boolean }[];
  followUp: string | null;
}

/** Collapses deltas, and checks the event grammar while doing so. */
function summarize(events: CouncilEvent[]): Summary {
  const summary: Summary = { routing: null, turns: [], followUp: null };
  const byId = new Map<string, Summary['turns'][number]>();
  let openTurn: string | null = null;
  for (const event of events) {
    switch (event.type) {
      case 'routing':
        expect(summary.routing).toBeNull();
        expect(summary.turns).toHaveLength(0);
        summary.routing = { seatIds: event.seatIds, reason: event.reason };
        break;
      case 'turn_start': {
        expect(openTurn).toBeNull();
        expect(byId.has(event.turnId)).toBe(false);
        const turn = { role: event.role, seatId: event.seatId, replyToSeatId: event.replyToSeatId, text: '', ended: false };
        byId.set(event.turnId, turn);
        summary.turns.push(turn);
        openTurn = event.turnId;
        break;
      }
      case 'delta':
        expect(event.turnId).toBe(openTurn);
        expect(event.text.length).toBeGreaterThan(0);
        byId.get(event.turnId)!.text += event.text;
        break;
      case 'turn_end':
        expect(event.turnId).toBe(openTurn);
        byId.get(event.turnId)!.ended = true;
        openTurn = null;
        break;
      case 'follow_up':
        expect(summary.followUp).toBeNull();
        expect(openTurn).toBeNull();
        summary.followUp = event.question;
        break;
      default:
        throw new Error(`parser must not emit ${event.type}`);
    }
  }
  return summary;
}

function chunkEvery(text: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

// Deterministic pseudo-random splits, so a failure is reproducible.
function chunkRandomly(text: string, seed: number): string[] {
  const out: string[] = [];
  let state = seed;
  let i = 0;
  while (i < text.length) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    const size = 1 + (state % 9);
    out.push(text.slice(i, i + size));
    i += size;
  }
  return out;
}

const WELL_FORMED = `@@ROUTE stoic, pragmatist, marxist | Three places to put the weight: your judgment, the results, the conditions.
@@SEAT stoic
Separate skill from character. You can admire a thing made without admiring its maker.

The admiration is yours to aim.
@@SEAT pragmatist
Ask what the admiration leads you to do. Email me @ noon is not a marker.
@@SEAT marxist
Ask whose labor made the work possible.
@@ASK When you say admire, do you mean learn from or look up to?
@@END
`;

describe('well-formed output', () => {
  it('maps sections to the right seats, in order, with routing first and one follow-up', () => {
    const s = summarize(run(routedPlan, [WELL_FORMED]));
    expect(s.routing).toEqual({
      seatIds: ['stoic', 'pragmatist', 'marxist'],
      reason: 'Three places to put the weight: your judgment, the results, the conditions.',
    });
    expect(s.turns.map((t) => t.seatId)).toEqual(['stoic', 'pragmatist', 'marxist']);
    expect(s.turns.every((t) => t.role === 'seat' && t.ended)).toBe(true);
    expect(s.turns[0].text).toBe('Separate skill from character. You can admire a thing made without admiring its maker.\n\nThe admiration is yours to aim.');
    expect(s.turns[1].text).toBe('Ask what the admiration leads you to do. Email me @ noon is not a marker.');
    expect(s.followUp).toBe('When you say admire, do you mean learn from or look up to?');
  });

  it('streams text before the section is complete', () => {
    let n = 0;
    const parser = new CouncilStreamParser(seatsPlan(['stoic']), { newTurnId: () => `t${++n}` });
    const early = parser.push('@@SEAT stoic\nThe first sentence is already here, and the rest');
    expect(early.map((e) => e.type)).toEqual(['turn_start', 'delta']);
    expect(early[1]).toMatchObject({ text: 'The first sentence is already here, and the rest' });
  });
});

describe('chunk boundaries', () => {
  const whole = summarize(run(routedPlan, [WELL_FORMED]));

  it('gives the same result one character at a time', () => {
    expect(summarize(run(routedPlan, chunkEvery(WELL_FORMED, 1)))).toEqual(whole);
  });

  it('gives the same result for every fixed chunk size and many random splits', () => {
    for (let size = 2; size <= 40; size++) expect(summarize(run(routedPlan, chunkEvery(WELL_FORMED, size)))).toEqual(whole);
    for (let seed = 1; seed <= 200; seed++) expect(summarize(run(routedPlan, chunkRandomly(WELL_FORMED, seed)))).toEqual(whole);
  });

  it('never leaks any part of a marker, however the stream is cut', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const event of run(routedPlan, chunkRandomly(WELL_FORMED, seed))) {
        const text = event.type === 'delta' ? event.text : event.type === 'follow_up' ? event.question : event.type === 'routing' ? event.reason : '';
        expect(text).not.toMatch(/@@|SEAT|ROUTE|ASK|END/);
      }
    }
  });

  it('holds a marker split exactly between the two @ signs', () => {
    const s = summarize(run(seatsPlan(['stoic', 'marxist']), ['@', '@SEAT stoic\nOne.\n@', '@SEAT marxist\nTwo.\n@', '@END']));
    expect(s.turns.map((t) => [t.seatId, t.text])).toEqual([
      ['stoic', 'One.'],
      ['marxist', 'Two.'],
    ]);
  });
});

describe('malformed output', () => {
  it('drops sections for unknown seats, and their text with them', () => {
    const s = summarize(
      run(seatsPlan(['stoic', 'marxist']), ['@@SEAT stoic\nReal one.\n@@SEAT nihilist\nThis seat does not exist.\n@@SEAT marxist\nReal two.\n@@END']),
    );
    expect(s.turns.map((t) => [t.seatId, t.text])).toEqual([
      ['stoic', 'Real one.'],
      ['marxist', 'Real two.'],
    ]);
  });

  it('drops a valid seat that is not part of this exchange', () => {
    const s = summarize(run(seatsPlan(['stoic']), ['@@SEAT stoic\nMine.\n@@SEAT absurdist\nUninvited.\n@@END']));
    expect(s.turns).toHaveLength(1);
    expect(s.turns[0].text).toBe('Mine.');
  });

  it('drops a repeated section for the same seat', () => {
    const s = summarize(run(seatsPlan(['stoic']), ['@@SEAT stoic\nFirst.\n@@SEAT stoic\nAgain.\n@@END']));
    expect(s.turns.map((t) => t.text)).toEqual(['First.']);
  });

  it('drops text before the first marker and after @@END', () => {
    const s = summarize(run(seatsPlan(['stoic']), ['Sure! Here is the council:\n\n@@SEAT stoic\nThe reply.\n@@END\nHope that helps!']));
    expect(s.turns.map((t) => t.text)).toEqual(['The reply.']);
  });

  it('drops unknown markers and stops attributing text to the previous speaker', () => {
    const s = summarize(run(seatsPlan(['stoic']), ['@@SEAT stoic\nThe reply.\n@@NOTES internal\nscratch work\n@@END']));
    expect(s.turns.map((t) => t.text)).toEqual(['The reply.']);
  });

  it('tolerates markdown and label noise around markers', () => {
    const text = '**@@ROUTE:** Stoic, Marxism | Two angles.\n\n### @@SEAT: Stoic lens\n**Bold start** of reply.\n\n**@@SEAT marxist**\nSecond reply.\n\n**@@END**';
    const s = summarize(run(routedPlan, [text]));
    expect(s.routing?.seatIds).toEqual(['stoic', 'marxist']);
    expect(s.turns.map((t) => [t.seatId, t.text])).toEqual([
      ['stoic', 'Bold start** of reply.'],
      ['marxist', 'Second reply.'],
    ]);
  });

  it('streams a reply the model started on the marker line', () => {
    const text = '@@SEAT stoic You are asking the wrong question, and here is why that matters for you.\n@@END';
    for (const chunks of [[text], chunkEvery(text, 1), chunkEvery(text, 7)]) {
      const s = summarize(run(seatsPlan(['stoic']), chunks));
      expect(s.turns.map((t) => t.text)).toEqual(['You are asking the wrong question, and here is why that matters for you.']);
    }
  });

  it('limits a routed opening to three seats and ignores invalid names in the route line', () => {
    const text = '@@ROUTE stoic, plato, marxist, advaita, absurdist | Why.\n@@SEAT stoic\nA.\n@@SEAT marxist\nB.\n@@SEAT advaita\nC.\n@@SEAT absurdist\nD.\n@@END';
    const s = summarize(run(routedPlan, [text]));
    expect(s.routing?.seatIds).toEqual(['stoic', 'marxist', 'advaita']);
    expect(s.turns.map((t) => t.seatId)).toEqual(['stoic', 'marxist', 'advaita']);
  });

  it('still puts routing first when the model forgets the route line', () => {
    const text = '@@SEAT existentialist\nA.\n@@SEAT stoic\nB.\n@@SEAT marxist\nC.\n@@SEAT advaita\nD.\n@@END';
    for (const chunks of [[text], chunkEvery(text, 3)]) {
      const events = run(routedPlan, chunks);
      expect(events[0]).toEqual({ type: 'routing', seatIds: ['existentialist', 'stoic', 'marxist'], reason: FALLBACK_ROUTING_REASON });
      expect(summarize(events).turns.map((t) => t.seatId)).toEqual(['existentialist', 'stoic', 'marxist']);
    }
  });

  it('ignores a route line when the visitor chose the seats', () => {
    const s = summarize(run(seatsPlan(['stoic']), ['@@ROUTE marxist | Because.\n@@SEAT stoic\nReply.\n@@END']));
    expect(s.routing).toBeNull();
    expect(s.turns.map((t) => t.seatId)).toEqual(['stoic']);
  });

  it('closes the last turn when the output is cut off mid-sentence', () => {
    const s = summarize(run(seatsPlan(['stoic']), ['@@SEAT stoic\nThis sentence never fini']));
    expect(s.turns).toEqual([{ role: 'seat', seatId: 'stoic', replyToSeatId: undefined, text: 'This sentence never fini', ended: true }]);
  });

  it('emits no turn for an empty section', () => {
    const s = summarize(run(seatsPlan(['stoic', 'marxist']), ['@@SEAT stoic\n\n@@SEAT marxist\nOnly me.\n@@END']));
    expect(s.turns.map((t) => t.seatId)).toEqual(['marxist']);
  });

  it('caps a runaway section', () => {
    let n = 0;
    const parser = new CouncilStreamParser(seatsPlan(['stoic']), { newTurnId: () => `t${++n}`, maxTurnChars: 50 });
    const events = [...parser.push(`@@SEAT stoic\n${'word '.repeat(100)}`), ...parser.end()];
    expect(summarize(events).turns[0].text.length).toBeLessThanOrEqual(50);
  });
});

describe('a model that ignores the format', () => {
  const prose = 'Honestly, the past is not yours to change, but the judgment that it was wasted is. Start there.';

  it('reports zero turns for a multi-seat exchange, so the caller can repair', () => {
    let n = 0;
    const parser = new CouncilStreamParser(routedPlan, { newTurnId: () => `t${++n}` });
    const events = [...parser.push(prose), ...parser.end()];
    expect(events).toEqual([]);
    expect(parser.turnCount).toBe(0);
  });

  it('shows the prose as the reply when exactly one turn was expected', () => {
    const s = summarize(run(seatsPlan(['stoic'], { fallback: { role: 'seat', seatId: 'stoic' } }), chunkEvery(prose, 5)));
    expect(s.turns).toEqual([{ role: 'seat', seatId: 'stoic', replyToSeatId: undefined, text: prose, ended: true }]);
  });

  it('does not treat a few stray words as a reply', () => {
    let n = 0;
    const parser = new CouncilStreamParser(seatsPlan(['stoic'], { fallback: { role: 'seat', seatId: 'stoic' } }), { newTurnId: () => `t${++n}` });
    expect([...parser.push('Okay.'), ...parser.end()]).toEqual([]);
    expect(parser.turnCount).toBe(0);
  });
});

describe('special sections', () => {
  it('turns @@SYNTHESIS into a synthesis turn and drops seat sections around it', () => {
    const plan = seatsPlan([], { synthesis: true, fallback: { role: 'synthesis' } });
    const s = summarize(run(plan, ['@@SYNTHESIS\nThey differ on what admiration does.\n@@SEAT stoic\nNot asked.\n@@END']));
    expect(s.turns).toEqual([{ role: 'synthesis', seatId: undefined, replyToSeatId: undefined, text: 'They differ on what admiration does.', ended: true }]);
  });

  it('lets @@COUNCIL replace the seats: one shared-voice turn, no routing, no follow-up', () => {
    const text = '@@COUNCIL\nThis deserves a real person, not a debate.\n@@SEAT stoic\nIgnored.\n@@ASK Clever question?\n@@END';
    const s = summarize(run(routedPlan, chunkEvery(text, 4)));
    expect(s.routing).toBeNull();
    expect(s.followUp).toBeNull();
    expect(s.turns.map((t) => [t.role, t.text])).toEqual([['synthesis', 'This deserves a real person, not a debate.']]);
  });

  it('ignores a synthesis the model tacks on after the seats', () => {
    const s = summarize(run(seatsPlan(['stoic']), ['@@SEAT stoic\nReply.\n@@SYNTHESIS\nA summary nobody asked for.\n@@END']));
    expect(s.turns.map((t) => t.text)).toEqual(['Reply.']);
  });

  it('marks both debate turns with the seat they answer', () => {
    const plan = seatsPlan(['marxist', 'stoic'], { replyTo: { marxist: 'stoic', stoic: 'marxist' } });
    const s = summarize(run(plan, ['@@SEAT marxist\nObjection.\n@@SEAT stoic\nAnswer.\n@@END']));
    expect(s.turns.map((t) => [t.seatId, t.replyToSeatId])).toEqual([
      ['marxist', 'stoic'],
      ['stoic', 'marxist'],
    ]);
  });

  it('allows one follow-up question at most, and only where the action allows it', () => {
    const text = '@@SEAT stoic\nReply.\n@@ASK First?\n@@ASK Second?\n@@END';
    expect(summarize(run(seatsPlan(['stoic'], { allowAsk: true }), [text])).followUp).toBe('First?');
    expect(summarize(run(seatsPlan(['stoic']), [text])).followUp).toBeNull();
  });
});

describe('dashes', () => {
  it('rewrites em and en dashes, the same way wherever the chunks break', () => {
    const text = '@@SEAT stoic\nThe days themselves \u2014 the work, the people\u2014are here. Ages 25\u201331 count \u2013 all of them.\n@@END';
    const expected = 'The days themselves, the work, the people, are here. Ages 25-31 count, all of them.';
    for (const chunks of [[text], chunkEvery(text, 1), chunkEvery(text, 2), chunkEvery(text, 5), chunkRandomly(text, 7)]) {
      expect(summarize(run(seatsPlan(['stoic']), chunks)).turns[0].text).toBe(expected);
    }
  });

  it('rewrites them in the routing reason and the follow-up question too', () => {
    const s = summarize(run(routedPlan, ['@@ROUTE stoic, marxist | Two views \u2014 one inward, one outward.\n@@SEAT stoic\nA.\n@@SEAT marxist\nB.\n@@ASK What \u2014 exactly \u2014 do you owe?\n@@END']));
    expect(s.routing?.reason).toBe('Two views, one inward, one outward.');
    expect(s.followUp).toBe('What, exactly, do you owe?');
  });
});

describe('a route line with unusable seat names', () => {
  it('keeps the reason and takes the seats from the sections that follow', () => {
    const text = '@@ROUTE seat_id, seat_id, seat_id | Each weighs trust differently.\n\n@@SEAT pragmatist\nA.\n@@SEAT stoic\nB.\n@@END';
    const events = run(routedPlan, chunkEvery(text, 6));
    expect(events[0]).toEqual({ type: 'routing', seatIds: ['pragmatist', 'stoic'], reason: 'Each weighs trust differently.' });
  });
});

// Every way of cutting `text` into chunks must give the same events.
function expectChunkInvariant(plan: ParsePlan, text: string): Summary {
  const whole = summarize(run(plan, [text]));
  for (let at = 1; at < text.length; at++) expect(summarize(run(plan, [text.slice(0, at), text.slice(at)])), `split at ${at}`).toEqual(whole);
  for (let size = 1; size <= 9; size++) expect(summarize(run(plan, chunkEvery(text, size))), `chunks of ${size}`).toEqual(whole);
  for (let seed = 1; seed <= 100; seed++) {
    const events = run(plan, chunkRandomly(text, seed));
    expect(summarize(events), `seed ${seed}`).toEqual(whole);
    expect(JSON.stringify(events)).not.toContain('@@');
  }
  return whole;
}

describe('reply text on the marker line', () => {
  it('keeps a short first line that starts right after the seat id', () => {
    const s = expectChunkInvariant(seatsPlan(['stoic']), '@@SEAT stoic I agree with you.\nBut there is more to say about it than that, obviously.\n@@END');
    expect(s.turns.map((t) => t.text)).toEqual(['I agree with you.\nBut there is more to say about it than that, obviously.']);
  });

  it('keeps a one-word reply and a reply in another script', () => {
    expect(expectChunkInvariant(seatsPlan(['stoic']), '@@SEAT stoic No.\n@@END').turns.map((t) => t.text)).toEqual(['No.']);
    expect(expectChunkInvariant(seatsPlan(['stoic']), '@@SEAT stoic 你好，世界。\n@@END').turns.map((t) => t.text)).toEqual(['你好，世界。']);
  });

  it('keeps an opening quote that belongs to the first word', () => {
    const s = expectChunkInvariant(seatsPlan(['stoic']), '@@SEAT stoic "Wasted" is a harsh word.\n@@END');
    expect(s.turns[0].text).toBe('"Wasted" is a harsh word.');
  });

  it('still drops a label, in any of the shapes a model gives it', () => {
    for (const label of [' (Stoic lens)', ': Stoic lens', ' lens', ' - Marcus Aurelius', ' **', ' (the Stoic seat):', '']) {
      const s = expectChunkInvariant(seatsPlan(['stoic']), `@@SEAT stoic${label}\nThe reply itself.\n@@END`);
      expect(s.turns.map((t) => t.text), label).toEqual(['The reply itself.']);
    }
  });

  it('skips a label and then streams the reply that follows it on the same line', () => {
    const s = expectChunkInvariant(seatsPlan(['stoic']), '@@SEAT stoic (Stoic lens) Sort what is yours from what is not.\n@@END');
    expect(s.turns[0].text).toBe('Sort what is yours from what is not.');
  });
});

describe('a literal @@ inside a reply', () => {
  it('does not cut the turn short, and reaches the client as a single @', () => {
    const s = expectChunkInvariant(seatsPlan(['stoic']), '@@SEAT stoic\nFirst part of the reply @@ second part of the reply.\nThird line.\n@@END');
    expect(s.turns).toEqual([{ role: 'seat', seatId: 'stoic', replyToSeatId: undefined, text: 'First part of the reply @ second part of the reply.\nThird line.', ended: true }]);
  });

  it('treats unknown @@words and lower-case keywords in mid-line as text', () => {
    const s = expectChunkInvariant(seatsPlan(['stoic', 'marxist']), '@@SEAT stoic\nMail me at a@@b.example, or use the @@end of the week, or @@@@ whatever.\n@@SEAT marxist\nSecond.\n@@END');
    expect(s.turns.map((t) => [t.seatId, t.text])).toEqual([
      ['stoic', 'Mail me at a@b.example, or use the @end of the week, or @ whatever.'],
      ['marxist', 'Second.'],
    ]);
  });

  it('treats a bare @@ at the start of a line as text too', () => {
    const s = expectChunkInvariant(seatsPlan(['stoic']), '@@SEAT stoic\nOne.\n@@ two, still the same reply.\n@@END');
    expect(s.turns.map((t) => t.text)).toEqual(['One.\n@ two, still the same reply.']);
  });

  it('still honors a real marker the model forgot to put on its own line', () => {
    const s = expectChunkInvariant(seatsPlan(['stoic', 'marxist']), '@@SEAT stoic\nFirst reply. @@SEAT marxist\nSecond reply. @@END trailing');
    expect(s.turns.map((t) => [t.seatId, t.text])).toEqual([
      ['stoic', 'First reply.'],
      ['marxist', 'Second reply.'],
    ]);
  });

  it('still honors a spaced marker, and still drops an unknown marker line as a boundary', () => {
    const s = expectChunkInvariant(seatsPlan(['stoic', 'marxist']), '@@ SEAT stoic\nFirst.\n@@NOTES scratch\nnot for anyone\n@@ SEAT marxist\nSecond.\n@@ END');
    expect(s.turns.map((t) => [t.seatId, t.text])).toEqual([
      ['stoic', 'First.'],
      ['marxist', 'Second.'],
    ]);
  });
});

describe('routing is held until a section has text', () => {
  it('sends nothing for a route line that no section follows', () => {
    expect(run(routedPlan, ['@@ROUTE stoic, marxist | A reason nobody should see.\n@@END'])).toEqual([]);
    expect(run(routedPlan, chunkEvery('@@ROUTE stoic, marxist | A reason nobody should see.\n@@SEAT stoic\n\n@@END', 3))).toEqual([]);
  });

  it('sends it immediately before the first turn', () => {
    let n = 0;
    const parser = new CouncilStreamParser(routedPlan, { newTurnId: () => `t${++n}` });
    expect(parser.push('@@ROUTE stoic, marxist | Two angles.\n@@SEAT stoic\n')).toEqual([]);
    expect(parser.push('First words').map((e) => e.type)).toEqual(['routing', 'turn_start', 'delta']);
  });

  it('drops it when the model answers in the council voice instead', () => {
    const events = run(routedPlan, ['@@ROUTE stoic | Why.\n@@COUNCIL\nThis deserves a real person.\n@@END']);
    expect(events.map((e) => e.type)).toEqual(['turn_start', 'delta', 'turn_end']);
  });
});

describe('marker-less output as a last resort', () => {
  it('shows a short refusal as a council note when the plan allows a synthesis fallback', () => {
    const plan: ParsePlan = { ...routedPlan, fallback: { role: 'synthesis' } };
    const s = summarize(run(plan, chunkEvery("I'm sorry, but I can't help with that.", 4)));
    expect(s.routing).toBeNull();
    expect(s.turns).toEqual([{ role: 'synthesis', seatId: undefined, replyToSeatId: undefined, text: "I'm sorry, but I can't help with that.", ended: true }]);
  });
});
