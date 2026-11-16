import type { Metadata } from 'next';
import Link from 'next/link';
import { COUNCIL_COPY } from '@/data/council/copy';
import styles from '@/components/council/council.module.css';

export const metadata: Metadata = {
  title: `${COUNCIL_COPY.privacy.title} · The Council`,
  description: COUNCIL_COPY.privacy.paragraphs[0],
  alternates: {
    canonical: '/council/privacy',
  },
};

export default function CouncilPrivacyPage() {
  const [lead, ...rest] = COUNCIL_COPY.privacy.paragraphs;

  return (
    <>
      <div className={styles.board} aria-hidden="true" />
      <div className={styles.scroll}>
        <div className={styles.page} data-mode="empty">
          <Link className={styles.brand} href="/" aria-label={COUNCIL_COPY.scene.brandAria}>
            <span className={styles.brandName}>rohan</span>
            <span className={styles.brandDot} />
          </Link>

          <main className={styles.prose}>
            <Link className={styles.backLink} href="/council">
              {COUNCIL_COPY.privacy.back}
            </Link>
            <h1 className={styles.title}>{COUNCIL_COPY.privacy.title}</h1>
            <p className={styles.proseLead}>{lead}</p>
            {rest.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </main>
        </div>
      </div>
    </>
  );
}
