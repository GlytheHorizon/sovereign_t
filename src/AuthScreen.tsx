import React, { useState } from 'react';
import { invoke } from './api';
import { Shield, Eye, EyeOff, Lock, Unlock, AlertTriangle } from 'lucide-react';

interface AuthScreenProps {
  onUnlocked: () => void;
}

const AuthScreen: React.FC<AuthScreenProps> = ({ onUnlocked }) => {
  const [mode, setMode] = useState<'checking' | 'create' | 'unlock'>('checking');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      onUnlocked();
    } catch (e: any) {
      setError(e?.message || 'Authentication failed.');
    } finally {
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
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <Shield size={24} color="white" />
          </div>
          <div className="auth-logo-text">Sovereigni-T</div>
        </div>
        
        <div className="auth-subtitle" style={{ marginTop: 0 }}>
          {mode === 'create'
            ? 'Create a master password to initialize this vault.'
            : 'Enter your master password to unlock this vault.'}
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && (
            <div className="auth-error">
              <span><AlertTriangle size={16} /></span> {error}
            </div>
          )}

          <div className="form-group">
            <label className="form-label">
              {mode === 'create' ? 'Create Master Password' : 'Master Password'}
            </label>
            <div className="form-input-wrapper">
              <input
                id="master-password"
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Min. 12 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
              <button
                type="button"
                className="form-input-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {mode === 'create' && (
            <div className="form-group">
              <label className="form-label">Confirm Master Password</label>
              <input
                id="confirm-password"
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="Repeat your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          <button
            id="auth-submit-btn"
            className="btn btn-primary"
            type="submit"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner" />
            ) : mode === 'create' ? (
              <><Lock size={16} /> Create Vault</>
            ) : (
              <><Unlock size={16} /> Unlock Vault</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AuthScreen;
