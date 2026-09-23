'use client';

import React, { useState } from 'react';
import { WheelTopicFlat } from '@/types';
import styles from './wheel.module.css';

const BODY_MIN = 40;
const BODY_MAX = 4000;

interface ResponseFormProps {
  topic: WheelTopicFlat;
  onSubmitted: () => void;
}

export function ResponseForm({ topic, onSubmitted }: ResponseFormProps) {
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const trimmedBody = body.trim();
  const bodyTooShort = trimmedBody.length < BODY_MIN;
  const bodyTooLong = trimmedBody.length > BODY_MAX;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (bodyTooShort || bodyTooLong) {
      setError(`Your response should be between ${BODY_MIN} and ${BODY_MAX} characters.`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/wheel/submissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicId: topic.id,
          authorName: isAnonymous ? null : name,
          isAnonymous,
          body: trimmedBody,
          website,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError('Something went wrong submitting your response. Try again in a moment.');
        setSubmitting(false);
        return;
      }

      onSubmitted();
    } catch {
      setError('Something went wrong submitting your response. Try again in a moment.');
      setSubmitting(false);
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.segmented}>
        <button
          type="button"
          className={`${styles.segmentButton} ${!isAnonymous ? styles.active : ''}`}
          onClick={() => setIsAnonymous(false)}
        >
          Sign with my name
        </button>
        <button
          type="button"
          className={`${styles.segmentButton} ${isAnonymous ? styles.active : ''}`}
          onClick={() => setIsAnonymous(true)}
        >
          Post anonymously
        </button>
      </div>

      {!isAnonymous && (
        <input
          className={styles.input}
          type="text"
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
        />
      )}

      <textarea
        className={styles.textarea}
        placeholder="Research the topic, then write your take here."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={BODY_MAX}
      />
      <div className={styles.hint}>
        {trimmedBody.length}/{BODY_MAX} characters (minimum {BODY_MIN})
      </div>

      {/* Honeypot: real visitors never see or fill this field. */}
      <input
        className={styles.honeypot}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        aria-hidden="true"
      />

      {error && <div className={styles.errorText}>{error}</div>}

      <button className={styles.submitButton} type="submit" disabled={submitting || bodyTooShort || bodyTooLong}>
        {submitting ? 'Submitting...' : 'Submit response'}
      </button>
    </form>
  );
}
