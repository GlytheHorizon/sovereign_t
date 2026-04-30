import React, { useState } from 'react';
import { invoke } from './api';
import { Shield, Eye, EyeOff, Lock, Unlock, AlertTriangle, Key, ArrowRight, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import ConfirmModal from './ConfirmModal';

interface AuthScreenProps {
  onUnlocked: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onUnlocked }) => {
  const [mode, setMode] = useState<'checking' | 'create' | 'unlock'>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const handleExit = async () => {
    try {
      await getCurrentWindow().close();
    } catch (err) {
      console.error('Failed to close window:', err);
    }
  };

  const checkVault = async () => {
    try {
      const exists = await invoke<boolean>('vault_exists');
      setMode(exists ? 'unlock' : 'create');
    } catch (e) {
      setMode('create');
    }
  };

  React.useEffect(() => {
    checkVault();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 12) {
      setError('Master password must be at least 12 characters.');
      return;
    }

    if (mode === 'create' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'create') {
        await invoke('create_vault', { input: { password } });
      } else {
        await invoke('unlock_vault', { input: { password } });
      }
      setPassword('');
      setConfirmPassword('');
      
      // Speed up progress timer for faster login feel
      let p = 0;
      const interval = setInterval(() => {
        p += 10;
        setProgress(p);
        if (p >= 100) {
          clearInterval(interval);
          setLoading(false);
          onUnlocked();
        }
      }, 20);
    } catch (e: any) {
      setError(e?.message || 'Authentication failed.');
      setLoading(false);
    }
  };

  if (mode === 'checking') {
    return (
      <div className="auth-screen">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '40px auto', width: 32, height: 32 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="auth-screen">
      <button 
        className="auth-exit-btn"
        onClick={() => setShowExitConfirm(true)}
        title="Exit Application"
      >
        <X size={20} />
      </button>

      {showExitConfirm && (
        <ConfirmModal
          title="Exit Sovereign_T"
          message="Are you sure you want to close the application?"
          confirmText="Exit"
          danger={true}
          onConfirm={handleExit}
          onCancel={() => setShowExitConfirm(false)}
        />
      )}

      <div className="auth-logo-section">
        <div className="auth-logo-box">
          <img src="/stv2.png" alt="Sovereign_T" style={{ width: 50, height: 50, objectFit: 'contain' }} />
        </div>
        <h1 className="auth-brand-name">SOVEREIGN_T</h1>
        <p className="auth-brand-subtitle">Secure Digital Vault</p>
      </div>

      <div className="auth-card-polished">
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error" style={{ marginBottom: 20 }}>
              <span><AlertTriangle size={16} /></span> {error}
            </div>
          )}

          {progress > 0 && progress < 100 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8, textAlign: 'center' }}>
                Decrypting Vault... {progress}%
              </div>
              <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.05s linear' }} />
              </div>
            </div>
          )}

          <label className="auth-label-polished">Master Password</label>
          <div className="auth-input-wrapper-polished">
            <span className="auth-input-icon-left"><Key size={18} /></span>
            <input
              id="master-password"
              className="auth-input-polished"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter secure phrase..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              disabled={loading}
            />
            <button
              type="button"
              className="auth-input-icon-right"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {mode === 'create' && (
            <>
              <label className="auth-label-polished">Confirm Master Password</label>
              <div className="auth-input-wrapper-polished">
                <span className="auth-input-icon-left"><Key size={18} /></span>
                <input
                  id="confirm-password"
                  className="auth-input-polished"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat secure phrase..."
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                />
              </div>
            </>
          )}

          <button
            id="auth-submit-btn"
            className="auth-btn-cyan"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" style={{ borderTopColor: '#000' }} />
            ) : mode === 'create' ? (
              <>Initialize Vault <ArrowRight size={18} /></>
            ) : (
              <>Unlock Vault <ArrowRight size={18} /></>
            )}
          </button>

          <span className="auth-recovery-link">Initiate Recovery Protocol?</span>
        </form>
      </div>

      <div className="auth-footer-session">
        <Lock size={12} /> End-to-end Encrypted Session
      </div>
    </div>
  );
};

export default AuthScreen;
