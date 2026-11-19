'use client';

import React, { useEffect, useRef, useState } from 'react';
import styles from './UmdRoll.module.css';

// Prints from the UMD years. Sizes are the files' real pixels, so the strip
// reserves each print's width before the image arrives and never jumps.
const PHOTOS = [
  { src: 'testudo', w: 600, h: 800, alt: 'Rohan in a suit, leaning on the Testudo statue at UMD' },
  { src: 'graduation', w: 600, h: 800, alt: 'Rohan at graduation in cap and gown with a tricolour stole' },
  { src: 'costume-party', w: 939, h: 800, alt: 'Rohan and friends dressed up for a costume party' },
  { src: 'flag', w: 620, h: 800, alt: 'Rohan waving the Indian flag on stage' },
  { src: 'white-house', w: 600, h: 800, alt: 'Rohan smiling on the White House lawn' },
  { src: 'shoulders', w: 450, h: 800, alt: "Rohan up on a friend's shoulders at a house party" },
  { src: 'beach', w: 1067, h: 800, alt: 'Rohan and friends piled onto each other in the sea' },
  { src: 'stamp', w: 473, h: 800, alt: 'Rohan in a suit outside the Stamp Student Union' },
];

// Alternating hand-placed tilts, so the roll reads as prints, not a carousel.
const TILTS = [-2, 1.5, -1, 2, -1.5, 1, -2.5, 1.5];

function Chevron({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d={dir === 'left' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** A swipeable roll of photo prints for the terrapin modal. */
export function UmdRoll() {
  const rollRef = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  useEffect(() => {
    const el = rollRef.current;
    if (!el) return;
    const update = () =>
      setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
    update();
    el.addEventListener('scroll', update, { passive: true });
    return () => el.removeEventListener('scroll', update);
  }, []);

  const step = (dir: 1 | -1) => {
    const el = rollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: 'smooth' });
  };

  return (
    <div className={styles.wrap}>
      <div ref={rollRef} className={styles.roll} tabIndex={0} role="region" aria-label="Photos from my UMD years">
        {PHOTOS.map((p, i) => (
          <figure key={p.src} className={styles.print} style={{ '--tilt': `${TILTS[i]}deg` } as React.CSSProperties}>
            <img
              src={`/assets/umd/${p.src}.webp`}
              alt={p.alt}
              width={p.w}
              height={p.h}
              loading={i < 3 ? 'eager' : 'lazy'}
              decoding="async"
              draggable={false}
            />
          </figure>
        ))}
      </div>
      <div className={styles.controls}>
        <button type="button" className={styles.step} onClick={() => step(-1)} disabled={edge.start} aria-label="Previous photos">
          <Chevron dir="left" />
        </button>
        <button type="button" className={styles.step} onClick={() => step(1)} disabled={edge.end} aria-label="More photos">
          <Chevron dir="right" />
        </button>
      </div>
    </div>
  );
}
