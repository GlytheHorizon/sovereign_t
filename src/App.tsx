import React, { useState } from 'react';
import AuthScreen from './AuthScreen';
import VaultLayout from './VaultLayout';

const App: React.FC = () => {
  const [unlocked, setUnlocked] = useState(false);

  if (!unlocked) {
    return <AuthScreen onUnlocked={() => setUnlocked(true)} />;
  }

  return <VaultLayout onLocked={() => setUnlocked(false)} />;
};

export default App;
