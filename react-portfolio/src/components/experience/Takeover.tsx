'use client';

import React, { useCallback, useEffect, useRef } from 'react';

interface TakeoverProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  className?: string;
  children: React.ReactNode;
}

/**
 * Full-screen dialog shell shared by the work surfaces. Carries the Modal a11y
 * contract (role=dialog, focus trap, Escape, body scroll lock) without the
 * Modal chrome. Render it as a sibling of <main>, outside the scaled Stage, so
 * it sits at true viewport scale. The first element marked data-autofocus (or
 * the first focusable) gets focus on open.
 */
export function Takeover({ open, onClose, labelledBy, className, children }: TakeoverProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !overlayRef.current) return;
    const target =
      overlayRef.current.querySelector<HTMLElement>('[data-autofocus]') ??
      overlayRef.current.querySelector<HTMLElement>('button, a[href]');
    target?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !overlayRef.current) return;

      const focusable = overlayRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div
      ref={overlayRef}
      className={className}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
