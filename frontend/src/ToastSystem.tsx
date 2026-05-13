import React, { useCallback, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, XCircle, AlertTriangle, Info,
  Shield, RefreshCw, Lock, HardDrive, X,
} from 'lucide-react';

export type ToastType =
  | 'success' | 'error' | 'warning' | 'sync'
  | 'encryption' | 'lock' | 'backup' | 'security';

export interface Toast {
  id: string;
  msg: string;
  type: ToastType;
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success:    <CheckCircle2 size={16} />,
  error:      <XCircle size={16} />,
  warning:    <AlertTriangle size={16} />,
  sync:       <RefreshCw size={16} />,
  encryption: <Shield size={16} />,
  lock:       <Lock size={16} />,
  backup:     <HardDrive size={16} />,
  security:   <Shield size={16} />,
};

const COLORS: Record<ToastType, string> = {
  success:    '#3fb950',
  error:      '#f44747',
  warning:    '#d29922',
  sync:       '#00b4d8',
  encryption: '#a855f7',
  lock:       '#f59e0b',
  backup:     '#64748b',
  security:   '#ef4444',
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const color = COLORS[toast.type];
  const isSync = toast.type === 'sync';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.88, transition: { duration: 0.2 } }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="toast-item"
      style={{ '--toast-color': color } as React.CSSProperties}
    >
      <div className="toast-accent-bar" />
      <motion.span
        className="toast-icon"
        animate={isSync ? { rotate: 360 } : {}}
        transition={isSync ? { duration: 1.5, repeat: Infinity, ease: 'linear' } : {}}
        style={{ color }}
      >
        {ICONS[toast.type]}
      </motion.span>
      <span className="toast-msg">{toast.msg}</span>
      <button className="toast-close" onClick={() => onDismiss(toast.id)}>
        <X size={12} />
      </button>
      {/* auto-dismiss progress bar */}
      <motion.div
        className="toast-progress"
        style={{ background: color }}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: 3.5, ease: 'linear' }}
      />
    </motion.div>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────
let _nextId = 1;

export function useToastSystem() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((msg: string, type: ToastType = 'success') => {
    const id = String(_nextId++);
    setToasts((prev) => [...prev.slice(-4), { id, msg, type }]);
    const timer = setTimeout(() => dismiss(id), 3500);
    timers.current.set(id, timer);
  }, [dismiss]);

  return { toasts, showToast, dismiss };
}

// ── Renderer ─────────────────────────────────────────────────────────────────
interface ToastSystemProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export const ToastSystem: React.FC<ToastSystemProps> = ({ toasts, onDismiss }) => (
  <div className="toast-container" aria-live="polite">
    <AnimatePresence mode="popLayout">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </AnimatePresence>
  </div>
);

export default ToastSystem;
