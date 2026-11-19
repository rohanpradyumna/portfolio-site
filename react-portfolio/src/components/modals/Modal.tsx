'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useResponsive } from '@/hooks/useDimensions';
import styles from './Modal.module.css';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  color?: string;
  noAnimation?: boolean;
}

// Exit lengths, matching Modal.module.css. The dialog stays mounted this long
// after `open` flips false so the exit can play, then unmounts.
const EXIT_MS_DIALOG = 150;
const EXIT_MS_SHEET = 200;

// The board never tells the Modal which sticker opened it, so every Modal
// shares one capture-phase record of the last pointer / activation key. At open
// time a fresh record says where the panel should grow from.
const FRESH_MS = 1000;
let lastPointer: { x: number; y: number; t: number } | null = null;
let lastActivationKeyAt = -Infinity;
let listening = false;

function listenForTriggers() {
  if (listening || typeof document === 'undefined') return;
  listening = true;
  const onPointer = (e: PointerEvent) => {
    // framer-motion fires synthetic pointer events (at 0,0) for keyboard presses
    if (!e.isTrusted) return;
    lastPointer = { x: e.clientX, y: e.clientY, t: performance.now() };
  };
  document.addEventListener('pointerdown', onPointer, true);
  document.addEventListener('pointerup', onPointer, true);
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Enter' || e.key === ' ') lastActivationKeyAt = performance.now();
    },
    true
  );
}

function triggerPoint(): { x: number; y: number } | null {
  const now = performance.now();
  const pointerFresh = lastPointer && now - lastPointer.t < FRESH_MS;
  const keyFresh = now - lastActivationKeyAt < FRESH_MS;

  if (keyFresh && (!pointerFresh || lastActivationKeyAt > lastPointer!.t)) {
    const el = document.activeElement;
    if (el instanceof HTMLElement && el !== document.body) {
      const r = el.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
  }
  return pointerFresh ? { x: lastPointer!.x, y: lastPointer!.y } : null;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, children, title, color = '#1a1a1a', noAnimation = false }: ModalProps) {
  const { isMobile } = useResponsive();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  // `rendered` outlives `open` by the exit length; `closing` marks that tail.
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setRendered(true);
      setClosing(false);
    } else if (rendered) {
      if (noAnimation) setRendered(false);
      else setClosing(true);
    }
  }

  const exitMs = isMobile ? EXIT_MS_SHEET : EXIT_MS_DIALOG;
  useEffect(() => {
    if (!closing) return;
    const id = window.setTimeout(() => {
      setRendered(false);
      setClosing(false);
    }, exitMs + 30);
    return () => window.clearTimeout(id);
  }, [closing, exitMs]);

  useEffect(() => {
    listenForTriggers();
  }, []);

  // Grow from the tapped sticker: point transform-origin at it, measured against
  // the panel's own untransformed box before the first paint. Clamped so a far
  // sticker on a huge monitor tilts the growth without dragging the panel across
  // the screen. Phones keep the bottom sheet, which needs no origin.
  useLayoutEffect(() => {
    const panel = modalRef.current;
    if (!rendered || !panel || isMobile || noAnimation) return;
    const p = triggerPoint();
    if (!p) {
      panel.style.transformOrigin = '';
      return;
    }
    const r = panel.getBoundingClientRect();
    const w = panel.offsetWidth;
    const h = panel.offsetHeight;
    const left = r.left + r.width / 2 - w / 2;
    const top = r.top + r.height / 2 - h / 2;
    const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
    const ox = clamp(p.x - left, -0.5 * w, 1.5 * w);
    const oy = clamp(p.y - top, -0.5 * h, 1.5 * h);
    panel.style.transformOrigin = `${Math.round(ox)}px ${Math.round(oy)}px`;
    // Only on mount: an interrupted close that reopens keeps its origin so the
    // retargeted transition doesn't jump.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rendered]);

  // Focus: remember the trigger, move into the dialog, hand focus back on close.
  useEffect(() => {
    if (open) {
      const active = document.activeElement;
      if (active instanceof HTMLElement && !modalRef.current?.contains(active)) {
        restoreFocusRef.current = active;
      }
      closeButtonRef.current?.focus({ preventScroll: true });
      return;
    }
    const target = restoreFocusRef.current;
    restoreFocusRef.current = null;
    const active = document.activeElement;
    const focusLost = !active || active === document.body || modalRef.current?.contains(active);
    if (target?.isConnected && focusLost) target.focus({ preventScroll: true });
  }, [open]);

  // Escape closes, Tab stays inside the dialog
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;
      const items = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !modalRef.current.contains(active);
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!rendered) return null;

  const overlayClass = [styles.overlay, noAnimation && styles.instant].filter(Boolean).join(' ');

  return (
    <div
      className={overlayClass}
      data-state={closing ? 'closing' : 'open'}
      data-variant={isMobile ? 'sheet' : 'dialog'}
      // preventDefault stops the follow-on mousedown from blurring to <body>
      // after focus has been handed back to the sticker.
      onPointerDown={
        closing
          ? undefined
          : (e) => {
              e.preventDefault();
              onClose();
            }
      }
      style={{
        alignItems: isMobile ? 'flex-end' : 'center',
        padding: isMobile ? 0 : 20,
      }}
      role="dialog"
      aria-modal={closing ? undefined : true}
      aria-labelledby={title ? 'modal-title' : undefined}
      inert={closing}
    >
      <div className={styles.backdrop} />
      <div
        ref={modalRef}
        className={isMobile ? styles.sheet : styles.content}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          background: color,
          borderRadius: isMobile ? '20px 20px 0 0' : 16,
          padding: isMobile ? '24px 20px 32px' : '28px 32px',
          maxWidth: isMobile ? '100%' : 460,
          minWidth: isMobile ? '100%' : 340,
          width: isMobile ? '100%' : 'auto',
          maxHeight: isMobile ? '85vh' : 'none',
        }}
      >
        {/* Drag handle for mobile */}
        {isMobile && <div className={styles.dragHandle} />}

        <button
          ref={closeButtonRef}
          onClick={onClose}
          className={styles.closeButton}
          style={{
            top: isMobile ? 20 : 12,
            right: isMobile ? 16 : 14,
          }}
          aria-label="Close modal"
        >
          ×
        </button>

        {title && (
          <div id="modal-title" className={styles.title} style={{ fontSize: isMobile ? 24 : 28 }}>
            {title}
          </div>
        )}

        <div className={styles.body} style={{ fontSize: 14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
