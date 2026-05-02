import React, { useState, useEffect, lazy, Suspense, memo } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import AuthScreen from './AuthScreen';

const VaultLayout = lazy(() => import('./VaultLayout'));

const isTauriWindow =
  typeof window !== 'undefined' &&
  !!(
    (window as unknown as { __TAURI__?: { core?: { invoke?: unknown } } }).__TAURI__?.core?.invoke ||
    (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ ||
    (window as unknown as { __TAURI_IPC__?: unknown }).__TAURI_IPC__
  );

const App: React.FC = () => {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    if (!isTauriWindow) return undefined;

    // Initialize fullscreen on first run
    (async () => {
      const appWindow = getCurrentWindow();
      try {
        await appWindow.setFullscreen(true);
      } catch (err) {
        console.error('Failed to set initial fullscreen:', err);
      }
    })();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        void (async () => {
          try {
            const appWindow = getCurrentWindow();
            const fs = await appWindow.isFullscreen();
            await appWindow.setFullscreen(!fs);
          } catch (err) {
            console.error('Failed to toggle fullscreen:', err);
          }
        })();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        void (async () => {
          try {
            const appWindow = getCurrentWindow();
            await appWindow.setFullscreen(false);
          } catch (err) {
            console.error('Failed to exit fullscreen:', err);
          }
        })();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  return (
    <Suspense fallback={<div className="auth-screen"><div className="spinner" /></div>}>
      {!unlocked ? (
        <AuthScreen onUnlocked={() => setUnlocked(true)} />
      ) : (
        <VaultLayout onLocked={() => setUnlocked(false)} />
      )}
    </Suspense>
  );
};

export default memo(App);
