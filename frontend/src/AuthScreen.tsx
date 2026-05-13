import React, { useState } from 'react';
import { invoke } from './api';
import { Shield, Eye, EyeOff, Lock, Unlock, AlertTriangle, Key, ArrowRight, X } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import Waves from './Waves';

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
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [showRecoveryConfirm, setShowRecoveryConfirm] = useState(false);
  const [showRecoveryInput, setShowRecoveryInput] = useState(false);
  const [recoveryInput, setRecoveryInput] = useState('');


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

    const hasRecovery = recoveryInput.trim().length > 0;
    if ((mode === 'create' || !hasRecovery) && password.length < 12) {
      setError('Master password must be at least 12 characters.');
      return;
    }

    if (mode === 'create' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    setProgress(10); // Feedback immediately
    try {
      let pendingRecovery: string | null = null;
      if (mode === 'create') {
        const res = await invoke<{ phrase: string }>('create_vault', { input: { password } });
        pendingRecovery = res?.phrase || null;
        if (pendingRecovery) {
          setRecoveryPhrase(pendingRecovery);
        }
      } else {
        const recoveryValue = recoveryInput.trim();
        if (recoveryValue) {
          const res = await invoke<{ phrase: string }>('unlock_vault_with_recovery', { input: { recoveryKey: recoveryValue } });
          pendingRecovery = res?.phrase || null;
          if (pendingRecovery) {
            setRecoveryPhrase(pendingRecovery);
          }
        } else {
          await invoke('unlock_vault', { input: { password } });
        }
      }
      
      setProgress(100);
      setPassword('');
      setConfirmPassword('');
      setRecoveryInput('');
      
      setLoading(false);
      if (pendingRecovery) {
        setShowRecoveryModal(true);
      } else {
        onUnlocked();
      }
    } catch (e: any) {
      setError(e?.message || 'Authentication failed.');
      setLoading(false);
      setProgress(0);
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

  const handleCopyRecovery = async () => {
    if (!recoveryPhrase) return;
    try {
      await invoke('copy_to_clipboard', { input: { text: recoveryPhrase, ttl_seconds: 15 } });
      setRecoveryCopied(true);
    } catch {
      setRecoveryCopied(false);
    }
  };

  const requestFinalizeRecovery = () => {
    setShowRecoveryConfirm(true);
  };

  const finalizeRecovery = () => {
    setShowRecoveryConfirm(false);
    setShowRecoveryModal(false);
    setRecoveryPhrase(null);
    setRecoveryCopied(false);
    onUnlocked();
  };

  const cancelFinalizeRecovery = () => {
    setShowRecoveryConfirm(false);
  };

  return (
    <div className="auth-screen relative">
      <Waves
        lineColor="rgba(0, 212, 255, 0.15)"
        backgroundColor="#080b12"
        waveSpeedX={0.02}
        waveSpeedY={0.01}
        waveAmpX={40}
        waveAmpY={20}
        friction={0.9}
        tension={0.01}
        maxCursorMove={120}
        xGap={12}
        yGap={36}
      />

      <header className="auth-brand-header relative z-10">
        <div className="auth-brand-row">
          <div className="auth-ruler auth-ruler--left" aria-hidden="true">
            <span className="auth-ruler__baseline" />
            <span className="auth-ruler__ticks" />
            <span className="auth-ruler__shimmer" />
          </div>

          <div className="auth-brand-cluster">
            <h1 className="auth-brand-title" aria-label="Sovereigni-T">
              SOVEREIGN-T
            </h1>
          </div>

          <div className="auth-ruler auth-ruler--right" aria-hidden="true">
            <span className="auth-ruler__baseline" />
            <span className="auth-ruler__ticks" />
            <span className="auth-ruler__shimmer" />
          </div>
        </div>
        <p className="auth-brand-subtitle auth-brand-subtitle--header">Secure Digital Vault</p>
      </header>

      <div className="auth-card-polished relative z-10">
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

          <span
            className="auth-recovery-link"
            onClick={() => setShowRecoveryInput(!showRecoveryInput)}
            role="button"
          >
            Initiate Recovery Protocol?
          </span>

          {showRecoveryInput && (
            <div style={{ marginTop: 16 }}>
              <label className="auth-label-polished">Recovery Key</label>
              <div className="auth-input-wrapper-polished">
                <span className="auth-input-icon-left"><Key size={18} /></span>
                <input
                  className="auth-input-polished"
                  type="text"
                  placeholder="Enter recovery key (XXXXX-XXXXX-XXXXX-XXXXX-XXXXX)"
                  value={recoveryInput}
                  onChange={(e) => setRecoveryInput(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          )}
        </form>
        <div className="auth-footer-session">
          <Lock size={12} /> End-to-end Encrypted Session
        </div>
      </div>

      {showRecoveryModal && recoveryPhrase && (
        <div className="modal-overlay">
          <div className="modal auth-modal">
            <div className="modal-header">
              <div className="auth-modal-header">
                <Shield size={20} className="accent-color" />
                <h3 className="modal-title">Recovery Key</h3>
              </div>
              <button
                className="modal-close"
                onClick={requestFinalizeRecovery}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="auth-modal-desc">
                Save this recovery key now. It is shown only once.
              </p>
              <div className="auth-input-wrapper-polished" style={{ marginBottom: 12 }}>
                <input
                  className="auth-input-polished"
                  type="text"
                  readOnly
                  value={recoveryPhrase}
                />
              </div>
              <button type="button" className="btn btn-primary" onClick={handleCopyRecovery}>
                {recoveryCopied ? 'Copied' : 'Copy Recovery Key'}
              </button>

            </div>
            <div className="modal-footer">
              <button
                className="btn btn-primary"
                onClick={requestFinalizeRecovery}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}

      {showRecoveryConfirm && (
        <ConfirmModal
          title="Confirm Recovery Key"
          message="Did you already copy the recovery key? It will not be shown again."
          confirmText="I Copied It"
          cancelText="Go Back"
          onConfirm={finalizeRecovery}
          onCancel={cancelFinalizeRecovery}
        />
      )}
    </div>
  );
};

export default AuthScreen;
