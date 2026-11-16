import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import { PortraitMood, SEAT_IDS, SeatId, isSeatId } from '@/lib/council/contract';
import { SEATS } from '@/data/council/seats';
import { CouncilEntryArt, SeatPortrait } from '@/components/council/portraits';

// Dev gallery for reviewing the council art. Not linked from anywhere.
//   ?mood=thinking          every seat in that mood
//   ?seat=marxist           one seat only
//   ?view=moods             seats down, moods across
//   ?view=row               the six in a line, as they sit on the board
//   ?view=entry             the homepage entry sticker
//   ?size=120               size for the moods and row views
//   ?bare=1                 hide the heading and nav (for screenshots)

export const metadata: Metadata = {
  title: 'Council portraits (dev gallery)',
  robots: { index: false, follow: false },
};

const MOODS: PortraitMood[] = ['idle', 'thinking', 'speaking', 'challenged', 'dimmed'];
const SIZES = [64, 96, 160, 280];

const board: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 0,
  backgroundColor: 'var(--paper)',
  backgroundImage:
    'linear-gradient(to right, var(--grid) 1px, transparent 1px), linear-gradient(to bottom, var(--grid) 1px, transparent 1px), radial-gradient(ellipse at 50% 40%, #fffbef 0%, #faf5e4 55%, #f2e9cf 100%)',
  backgroundSize: '28px 28px, 28px 28px, 100% 100%',
};
// The site body is overflow: hidden for the sticker board, so this page
// scrolls inside its own fixed container (same pattern as /wheel).
const scroll: CSSProperties = { position: 'fixed', inset: 0, overflowY: 'auto', zIndex: 1 };
const wrap: CSSProperties = { maxWidth: 1960, margin: '0 auto', padding: '28px 28px 96px' };
const label: CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-secondary)' };
const heading: CSSProperties = { fontFamily: 'var(--font-serif)', fontSize: 30, fontWeight: 400, color: 'var(--ink)', margin: 0 };
const shadow: CSSProperties = { filter: 'var(--shadow-sticker)' };

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function Nav({ mood, seat, view }: { mood: PortraitMood; seat?: SeatId; view?: string }) {
  const href = (next: { mood?: string; seat?: string | null; view?: string | null }) => {
    const params = new URLSearchParams();
    const m = next.mood ?? mood;
    const s = next.seat === null ? undefined : (next.seat ?? seat);
    const v = next.view === null ? undefined : (next.view ?? view);
    if (m !== 'idle') params.set('mood', m);
    if (s) params.set('seat', s);
    if (v) params.set('view', v);
    const qs = params.toString();
    return qs ? `/council-portraits?${qs}` : '/council-portraits';
  };
  const chip = (active: boolean): CSSProperties => ({
    ...label,
    padding: '6px 10px',
    borderRadius: 100,
    textDecoration: 'none',
    border: '1.5px solid var(--ink)',
    background: active ? 'var(--ink)' : 'transparent',
    color: active ? 'var(--paper)' : 'var(--ink)',
  });
  return (
    <nav style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', margin: '14px 0 28px' }}>
      <span style={label}>mood</span>
      {MOODS.map((m) => (
        <a key={m} href={href({ mood: m })} style={chip(m === mood)}>
          {m}
        </a>
      ))}
      <span style={{ ...label, marginLeft: 16 }}>seat</span>
      <a href={href({ seat: null })} style={chip(!seat)}>
        all
      </a>
      {SEAT_IDS.map((id) => (
        <a key={id} href={href({ seat: id })} style={chip(id === seat)}>
          {id}
        </a>
      ))}
      <span style={{ ...label, marginLeft: 16 }}>view</span>
      <a href={href({ view: null })} style={chip(!view)}>
        sizes
      </a>
      {['moods', 'row', 'entry'].map((v) => (
        <a key={v} href={href({ view: v })} style={chip(v === view)}>
          {v}
        </a>
      ))}
    </nav>
  );
}

export default async function CouncilPortraitsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // Review page for development only. It must not ship.
  if (process.env.NODE_ENV === 'production') notFound();
  const params = await searchParams;
  const moodParam = first(params.mood);
  const mood: PortraitMood = MOODS.includes(moodParam as PortraitMood) ? (moodParam as PortraitMood) : 'idle';
  const seatParam = first(params.seat);
  const seat = isSeatId(seatParam) ? seatParam : undefined;
  const view = first(params.view);
  const size = Math.min(400, Math.max(32, Number(first(params.size)) || 120));
  const seats = seat ? [seat] : [...SEAT_IDS];
  const bare = first(params.bare) === '1';

  return (
    <>
      <div style={board} />
      <div style={scroll}>
        <div style={wrap}>
          {!bare && (
            <>
              <h1 style={heading}>Council portraits</h1>
              <Nav mood={mood} seat={seat} view={view} />
            </>
          )}

          {view === 'entry' && (
            <div style={{ display: 'flex', gap: 56, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {[116, 232, 348].map((s) => (
                <figure key={s} style={{ margin: 0 }}>
                  <div style={shadow}>
                    <CouncilEntryArt size={s} />
                  </div>
                  <figcaption style={{ ...label, marginTop: 14 }}>{s}px</figcaption>
                </figure>
              ))}
            </div>
          )}

          {view === 'row' && (
            <div style={{ display: 'flex', gap: 28, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              {seats.map((id) => (
                <figure key={id} style={{ margin: 0, textAlign: 'center' }}>
                  <div style={shadow}>
                    <SeatPortrait seatId={id} size={size} mood={mood} />
                  </div>
                  <figcaption style={{ ...label, marginTop: 10 }}>{SEATS[id].school}</figcaption>
                </figure>
              ))}
            </div>
          )}

          {view === 'moods' && (
            <div style={{ display: 'grid', gap: 22 }}>
              {seats.map((id) => (
                <div key={id} style={{ display: 'flex', gap: 26, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                  {MOODS.map((m) => (
                    <figure key={m} style={{ margin: 0, textAlign: 'center' }}>
                      <div style={shadow}>
                        <SeatPortrait seatId={id} size={size} mood={m} />
                      </div>
                      <figcaption style={{ ...label, marginTop: 8 }}>{m}</figcaption>
                    </figure>
                  ))}
                  <span style={{ ...label, alignSelf: 'center' }}>
                    {SEATS[id].figure} · {SEATS[id].school}
                  </span>
                </div>
              ))}
            </div>
          )}

          {!view && (
            <div style={{ display: 'grid', gap: 34 }}>
              {seats.map((id) => (
                <section key={id}>
                  <div style={{ ...label, marginBottom: 10 }}>
                    {SEATS[id].figure} · {SEATS[id].school} · {id} · {mood}
                  </div>
                  <div style={{ display: 'flex', gap: 36, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    {SIZES.map((s) => (
                      <figure key={s} style={{ margin: 0 }}>
                        <div style={shadow}>
                          <SeatPortrait seatId={id} size={s} mood={mood} />
                        </div>
                        <figcaption style={{ ...label, marginTop: 8 }}>{s}px</figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              ))}
              <section>
                <div style={{ ...label, marginBottom: 10 }}>entry sticker</div>
                <div style={{ display: 'flex', gap: 36, alignItems: 'flex-end' }}>
                  <div style={shadow}>
                    <CouncilEntryArt size={116} />
                  </div>
                  <div style={shadow}>
                    <CouncilEntryArt size={232} />
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
