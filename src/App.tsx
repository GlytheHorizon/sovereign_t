import React, { useState, useEffect, lazy, Suspense } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import AuthScreen from './AuthScreen';

const VaultLayout = lazy(() => import('./VaultLayout'));

const App: React.FC = () => {
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        try {
          const appWindow = getCurrentWindow();
          const isFullscreen = await appWindow.isFullscreen();
          await appWindow.setFullscreen(!isFullscreen);
        } catch (err) {
          console.error('Failed to toggle fullscreen:', err);
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

export default App;
