import React, { useEffect, useRef, useCallback } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') { onCancel(); return; }
    if (e.key === 'Tab' && overlayRef.current) {
      const focusable = overlayRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }, [onCancel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    confirmBtnRef.current?.focus();
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      className="modal-overlay"
      ref={overlayRef}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      style={{ zIndex: 200 }}
    >
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
        <div className="modal-header">
          <h2
            id="confirm-title"
            className="modal-title"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', color: danger ? 'var(--danger)' : 'inherit' }}
          >
            {danger && <AlertTriangle size={18} aria-hidden="true" />}
            {title}
          </h2>
          <button className="modal-close" onClick={onCancel} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5 }}>
            {message}
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            ref={confirmBtnRef}
            className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={onConfirm}
            style={danger ? { background: 'var(--danger-glow)', borderColor: 'var(--danger)', color: 'var(--danger)' } : {}}
            autoFocus
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
