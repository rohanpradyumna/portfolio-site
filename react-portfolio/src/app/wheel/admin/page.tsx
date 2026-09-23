'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { WheelSubmission, WheelSubmissionStatus } from '@/types';
import styles from '@/components/wheel/wheelAdmin.module.css';

const TOKEN_KEY = 'wheel_admin_token';
const TABS: (WheelSubmissionStatus | 'all')[] = ['pending', 'approved', 'rejected', 'all'];

export default function WheelAdminPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<WheelSubmissionStatus | 'all'>('pending');
  const [items, setItems] = useState<WheelSubmission[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TOKEN_KEY);
      if (stored) setToken(stored);
    } catch {}
  }, []);

  const load = useCallback(
    async (activeToken: string, status: WheelSubmissionStatus | 'all') => {
      setLoading(true);
      const res = await fetch(`/api/wheel/admin/submissions?status=${status}`, {
        headers: { Authorization: `Bearer ${activeToken}` },
      });

      if (res.status === 401) {
        setError('Incorrect token.');
        setToken(null);
        try {
          localStorage.removeItem(TOKEN_KEY);
        } catch {}
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.ok) setItems(data.items);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    if (token) load(token, tab);
  }, [token, tab, load]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      localStorage.setItem(TOKEN_KEY, tokenInput);
    } catch {}
    setToken(tokenInput);
  };

  const handleAction = async (id: number, status: 'approved' | 'rejected') => {
    if (!token) return;
    const res = await fetch(`/api/wheel/admin/submissions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      setItems((prev) => (tab === 'all' ? prev.map((i) => (i.id === id ? { ...i, status } : i)) : prev.filter((i) => i.id !== id)));
    }
  };

  if (!token) {
    return (
      <div className={styles.wrap}>
        <div className={styles.inner}>
          <div className={styles.title}>Wheel Admin</div>
          <form className={styles.unlockForm} onSubmit={handleUnlock}>
            <input
              className={styles.tokenInput}
              type="password"
              placeholder="Admin token"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
            />
            <button className={styles.unlockButton} type="submit">
              Unlock
            </button>
          </form>
          {error && <div className={styles.errorText}>{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.inner}>
        <div className={styles.title}>Wheel Admin</div>
        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t}
              className={`${styles.tab} ${tab === t ? styles.active : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        {loading && <div className={styles.emptyState}>Loading...</div>}
        {!loading && items.length === 0 && <div className={styles.emptyState}>Nothing here.</div>}

        {items.map((item) => (
          <div key={item.id} className={styles.card}>
            <div className={styles.cardTopic}>
              {item.category} · {item.topicText}
            </div>
            <div className={styles.cardBody}>{item.body}</div>
            <div className={styles.cardMeta}>
              {item.isAnonymous ? 'Anonymous' : item.authorName || 'Anonymous'} ·{' '}
              {new Date(item.createdAt).toLocaleString()} ·{' '}
              <span className={`${styles.statusBadge} ${styles[item.status]}`}>{item.status}</span>
            </div>
            {item.status === 'pending' && (
              <div className={styles.cardActions}>
                <button className={styles.approveButton} onClick={() => handleAction(item.id, 'approved')}>
                  Approve
                </button>
                <button className={styles.rejectButton} onClick={() => handleAction(item.id, 'rejected')}>
                  Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
