import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'svt_session_timeout_minutes';

export function getSessionTimeout(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v) { const n = parseInt(v, 10); if (n >= 1 && n <= 60) return n; }
  } catch {}
  return 5;
}

export function setSessionTimeout(minutes: number) {
  localStorage.setItem(STORAGE_KEY, String(minutes));
}

export function useSessionTimer(onLock: () => void) {
  const timeoutMinutes = getSessionTimeout();
  const [remaining, setRemaining] = useState(timeoutMinutes * 60);
  const [isWarning, setIsWarning] = useState(false);
  const lastActivity = useRef(Date.now());
  const intervalRef = useRef<number | null>(null);
  const lockRef = useRef(onLock);
  lockRef.current = onLock;

  const reset = useCallback(() => {
    lastActivity.current = Date.now();
    setRemaining(getSessionTimeout() * 60);
    setIsWarning(false);
  }, []);

  useEffect(() => {
    const handle = () => reset();
    window.addEventListener('mousemove', handle, { passive: true });
    window.addEventListener('keydown', handle, { passive: true });
    window.addEventListener('mousedown', handle, { passive: true });
    window.addEventListener('touchstart', handle, { passive: true });
    window.addEventListener('wheel', handle, { passive: true });
    return () => {
      window.removeEventListener('mousemove', handle);
      window.removeEventListener('keydown', handle);
      window.removeEventListener('mousedown', handle);
      window.removeEventListener('touchstart', handle);
      window.removeEventListener('wheel', handle);
    };
  }, [reset]);

  useEffect(() => {
    const tm = getSessionTimeout() * 60;
    setRemaining(tm);
    setIsWarning(false);

    intervalRef.current = window.setInterval(() => {
      setRemaining(prev => {
        if (prev <= 61 && prev > 1) setIsWarning(true);
        if (prev <= 1) { lockRef.current(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current != null) clearInterval(intervalRef.current); };
  }, []);

  return { remaining, isWarning, reset };
}
