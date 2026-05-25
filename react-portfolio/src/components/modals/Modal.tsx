'use client';

import React, { useEffect, useRef } from 'react';
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

export function Modal({ open, onClose, children, title, color = '#1a1a1a', noAnimation = false }: ModalProps) {
  const { isMobile } = useResponsive();
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus management - trap focus within modal
  useEffect(() => {
    if (open && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
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

  if (!open) return null;

  return (
    <div
      className={styles.overlay}
      onPointerDown={onClose}
      style={{
        animation: noAnimation ? 'none' : 'fadeIn 0.2s ease',
        alignItems: isMobile ? 'flex-end' : 'center',
        padding: isMobile ? 0 : 20,
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        ref={modalRef}
        className={styles.content}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          background: color,
          borderRadius: isMobile ? '20px 20px 0 0' : 16,
          padding: isMobile ? '24px 20px 32px' : '28px 32px',
          maxWidth: isMobile ? '100%' : 460,
          minWidth: isMobile ? '100%' : 340,
          width: isMobile ? '100%' : 'auto',
          animation: noAnimation ? 'none' : isMobile ? 'slideUp 0.3s cubic-bezier(0.2,0.8,0.2,1)' : 'pop 0.25s cubic-bezier(0.2,0.8,0.2,1)',
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

        <div className={styles.body} style={{ fontSize: isMobile ? 13 : 14 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
