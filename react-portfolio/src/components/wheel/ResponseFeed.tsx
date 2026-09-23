'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import styles from './wheel.module.css';

interface PublicSubmission {
  id: number;
  topicId: string;
  category: string;
  topicText: string;
  authorName: string | null;
  isAnonymous: boolean;
  body: string;
  createdAt: string;
}

interface ResponseFeedProps {
  topicId?: string;
  heading: string;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// Clamped to one line by default; measures whether the text actually
// overflows that line so the "Show more" toggle only appears when needed.
function FeedItemBody({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    setOverflowing(el.scrollWidth > el.clientWidth + 1);
  }, [text, expanded]);

  return (
    <>
      <div
        ref={ref}
        className={`${styles.feedBody} ${expanded ? '' : styles.feedBodyClamped}`}
        onClick={() => (overflowing || expanded) && setExpanded((e) => !e)}
      >
        {text}
      </div>
      {(overflowing || expanded) && (
        <button type="button" className={styles.feedToggle} onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </>
  );
}

export function ResponseFeed({ topicId, heading }: ResponseFeedProps) {
  const [items, setItems] = useState<PublicSubmission[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (afterCursor?: number) => {
      setLoading(true);
      setError(false);
      const params = new URLSearchParams();
      if (topicId) params.set('topicId', topicId);
      if (afterCursor) params.set('cursor', String(afterCursor));

      try {
        const res = await fetch(`/api/wheel/submissions?${params.toString()}`);
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data?.error ?? 'request_failed');
        setItems((prev) => (afterCursor ? [...prev, ...data.items] : data.items));
        setCursor(data.nextCursor);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [topicId]
  );

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className={styles.feedSection}>
      <div className={styles.feedHeading}>{heading}</div>
      {error && <div className={styles.emptyFeed}>Couldn&apos;t load responses right now. Try again later.</div>}
      {!error && !loading && items.length === 0 && (
        <div className={styles.emptyFeed}>No responses yet. Be the first.</div>
      )}
      {items.map((item) => (
        <div key={item.id} className={styles.feedCard}>
          {!topicId && <div className={styles.feedTopic}>{item.topicText}</div>}
          <FeedItemBody text={item.body} />
          <div className={styles.feedMeta}>
            {item.isAnonymous ? 'Anonymous' : item.authorName || 'Anonymous'} · {formatDate(item.createdAt)}
          </div>
        </div>
      ))}
      {cursor && !error && (
        <button className={styles.loadMore} onClick={() => load(cursor)} disabled={loading}>
          {loading ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  );
}
