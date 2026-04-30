import React, { useState, useEffect, lazy, Suspense, memo } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import AuthScreen from './AuthScreen';

const VaultLayout = lazy(() => import('./VaultLayout'));

const App: React.FC = () => {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    // Initialize fullscreen on first run
    (async () => {
      const appWindow = getCurrentWindow();
      try {
        await appWindow.setFullscreen(true);
      } catch (err) {
        console.error('Failed to set initial fullscreen:', err);
      }
    })();
    const handleKeyDown = async (e: KeyboardEvent) => {
      const appWindow = getCurrentWindow();
      if (e.key === 'F11') {
        e.preventDefault();
        try {
          const isFullscreen = await appWindow.isFullscreen();
          await appWindow.setFullscreen(!isFullscreen);
        } catch (err) {
          console.error('Failed to toggle fullscreen:', err);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        try {
          await appWindow.setFullscreen(false);
        } catch (err) {
          console.error('Failed to exit fullscreen:', err);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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
