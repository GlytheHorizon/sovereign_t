import React, { useState } from 'react';
import { Shield, Key, Info, User, CheckCircle2, XCircle, Eye, EyeOff, Cpu, Code, Zap, Download, Upload, FileJson, Lock, Sun, Moon, Clock, Monitor, Smartphone, Palette, Sliders, AlertTriangle, LogOut } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import { invoke } from './api';
import { useTheme } from './ThemeContext';
import { getSessionTimeout, setSessionTimeout } from './useSessionTimer';

interface SettingsViewProps {
  onShowToast: (msg: string, type: 'success' | 'error') => void;
  onLogout: () => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onShowToast, onLogout }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password confirmation for export/import
  const [showAuthModal, setShowAuthModal] = useState<'export' | 'import' | null>(null);
  const [authPassword, setAuthPassword] = useState('');
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{ type: 'lock' } | null>(null);
  const [recoveryStep, setRecoveryStep] = useState<'confirm' | 'show' | null>(null);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [showRecoveryPassword, setShowRecoveryPassword] = useState(false);
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [showRecoveryDoneConfirm, setShowRecoveryDoneConfirm] = useState(false);
  const [showRecoveryGenerateConfirm, setShowRecoveryGenerateConfirm] = useState(false);

  const closeAuthModal = () => {
    setShowAuthModal(null);
    setAuthPassword('');
    setShowAuthPassword(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 12) {
      onShowToast('New password must be at least 12 characters.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      onShowToast('New passwords do not match.', 'error');
      return;
    }

    setLoading(true);
    try {
      await invoke('change_master_password', {
        input: {
          old_password: oldPassword,
          new_password: newPassword
        }
      });
      onShowToast('Master password changed successfully.', 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      onShowToast(err?.message || 'Failed to change master password.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);

    try {
      if (showAuthModal === 'export') {
        await invoke('export_vault', { password: authPassword });
        onShowToast('Vault data exported successfully.', 'success');
      } else if (showAuthModal === 'import') {
        await invoke('import_vault', { password: authPassword });
        onShowToast('Vault data imported successfully. Logging out...', 'success');
        setTimeout(() => {
          onLogout();
        }, 1500);
      }
      setShowAuthModal(null);
      setAuthPassword('');
    } catch (err: any) {
      if (err?.code !== 'cancelled') {
        onShowToast(err?.message || 'Authentication failed.', 'error');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const openRecoveryModal = () => {
    setRecoveryStep('confirm');
    setRecoveryPassword('');
    setShowRecoveryPassword(false);
    setRecoveryPhrase('');
    setRecoveryCopied(false);
  };

  const closeRecoveryModal = () => {
    setRecoveryStep(null);
    setRecoveryPassword('');
    setShowRecoveryPassword(false);
    setRecoveryPhrase('');
    setRecoveryCopied(false);
  };

  const handleRotateRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryLoading(true);
    try {
      const res = await invoke<{ phrase: string }>('rotate_recovery_key', {
        input: { password: recoveryPassword },
      });
      setRecoveryPhrase(res?.phrase || '');
      setRecoveryStep('show');
      setRecoveryPassword('');
    } catch (err: any) {
      const message =
        typeof err === 'string' ? err : err?.message || err?.toString();
      onShowToast(message || 'Failed to rotate recovery key.', 'error');
    } finally {
      setRecoveryLoading(false);
    }
  };

  const requestGenerateRecovery = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryPassword.trim()) return;
    setShowRecoveryGenerateConfirm(true);
  };

  const confirmGenerateRecovery = async () => {
    setShowRecoveryGenerateConfirm(false);
    await handleRotateRecovery(new Event('submit') as any);
  };

  const cancelGenerateRecovery = () => {
    setShowRecoveryGenerateConfirm(false);
  };

  const handleCopyRecovery = async () => {
    if (!recoveryPhrase) return;
    try {
      await invoke('copy_to_clipboard', { input: { text: recoveryPhrase, ttl_seconds: 15 } });
      setRecoveryCopied(true);
    } catch {
      setRecoveryCopied(false);
    }
  };

  const handleDoneRecovery = () => {
    setShowRecoveryDoneConfirm(true);
  };

  const confirmDoneRecovery = () => {
    setShowRecoveryDoneConfirm(false);
    closeRecoveryModal();
  };

  const cancelDoneRecovery = () => {
    setShowRecoveryDoneConfirm(false);
  };

  const [settingsTab, setSettingsTab] = useState<'security' | 'display' | 'backup' | 'advanced'>('security');
  const { theme, toggle: toggleTheme } = useTheme();
  const [sessionMinutes, setSessionMinutes] = useState(getSessionTimeout());

  const handleSessionChange = (val: number) => {
    setSessionMinutes(val);
    setSessionTimeout(val);
  };

  return (
    <div className="settings-view">
      {/* Settings Tabs */}
      <div className="settings-tabs" role="tablist" aria-label="Settings categories">
        {[
          { id: 'security' as const, label: 'Security', icon: <Shield size={15} /> },
          { id: 'display' as const, label: 'Display', icon: <Palette size={15} /> },
          { id: 'backup' as const, label: 'Backup', icon: <FileJson size={15} /> },
          { id: 'advanced' as const, label: 'Advanced', icon: <Sliders size={15} /> },
        ].map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={settingsTab === tab.id}
            className={`settings-tab ${settingsTab === tab.id ? 'active' : ''}`}
            onClick={() => setSettingsTab(tab.id)}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-tab-content">
        {/* ═══════ SECURITY TAB ═══════ */}
        {settingsTab === 'security' && (
          <div className="settings-layout-v2">
            <div className="settings-row">
              <div className="settings-card flex-1">
                <div className="card-header">
                  <Key size={20} className="card-icon" />
                  <div>
                    <h2 className="card-title">Master Password</h2>
                    <p className="card-subtitle">Change or update your vault password</p>
                  </div>
                </div>

                <div className="settings-form-container">
                  <div className="settings-info-box">
                    <Shield size={16} />
                    <span>Changing your master password will re-encrypt your entire vault.</span>
                  </div>

                  <form className="settings-form" onSubmit={handleChangePassword}>
                    <div className="form-group">
                      <label className="form-label">Current Master Password</label>
                      <div className="form-input-wrapper">
                        <input
                          type={showOldPassword ? "text" : "password"}
                          className="form-input"
                          value={oldPassword}
                          onChange={(e) => setOldPassword(e.target.value)}
                          placeholder="Required to authorize change"
                          required
                        />
                        <button
                          type="button"
                          className="form-input-btn"
                          onClick={() => setShowOldPassword(!showOldPassword)}
                        >
                          {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group flex-1">
                        <label className="form-label">New Master Password</label>
                        <div className="form-input-wrapper">
                          <input
                            type={showNewPassword ? "text" : "password"}
                            className="form-input"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Min. 12 chars"
                            required
                          />
                          <button
                            type="button"
                            className="form-input-btn"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                          >
                            {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>

                      <div className="form-group flex-1">
                        <label className="form-label">Confirm New Password</label>
                        <div className="form-input-wrapper">
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            className="form-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repeat new password"
                            required
                          />
                          <button
                            type="button"
                            className="form-input-btn"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                      {loading ? <span className="spinner" /> : (
                        <>
                          <Lock size={16} />
                          Update Master Password
                        </>
                      )}
                    </button>
                  </form>

                  <div className="settings-divider" />

                  <div className="settings-info-box">
                    <Key size={16} />
                    <span>Generate a new recovery key. It will be shown once.</span>
                  </div>
                  <button className="btn btn-ghost btn-full" onClick={openRecoveryModal}>
                    Regenerate Recovery Key
                  </button>
                </div>
              </div>

              <div className="settings-card info-column">
                <div className="card-header">
                  <Info size={20} className="card-icon" />
                  <div>
                    <h2 className="card-title">System Information</h2>
                    <p className="card-subtitle">Version and build details</p>
                  </div>
                </div>

                <div className="about-grid">
                  <div className="about-item-v2">
                    <User size={16} />
                    <div className="about-item-content">
                      <label>Developer</label>
                      <span>Jerwin Cruz</span>
                    </div>
                  </div>
                  <div className="about-item-v2">
                    <Shield size={16} />
                    <div className="about-item-content">
                      <label>Version</label>
                      <span>V7.1 Beta</span>
                    </div>
                  </div>
                  <div className="about-item-v2">
                    <Shield size={16} />
                    <div className="about-item-content">
                      <label>Build</label>
                      <span style={{ fontSize: '10px' }}>0704260544PMS</span>
                    </div>
                  </div>
                  <div className="about-item-v2">
                    <Cpu size={16} />
                    <div className="about-item-content">
                      <label>Core Stack</label>
                      <span>Rust & Tauri</span>
                    </div>
                  </div>
                  <div className="about-item-v2">
                    <Zap size={16} />
                    <div className="about-item-content">
                      <label>Encryption</label>
                      <span>AES-256-GCM</span>
                    </div>
                  </div>
                  <div className="about-item-v2">
                    <Shield size={16} />
                    <div className="about-item-content">
                      <label>Architecture</label>
                      <span>Zero-Knowledge</span>
                    </div>
                  </div>
                </div>

                <div className="tech-stack-pills">
                  <span>React</span>
                  <span>Vite</span>
                  <span>SQLite</span>
                  <span>Zero-Knowledge</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ DISPLAY TAB ═══════ */}
        {settingsTab === 'display' && (
          <div className="settings-layout-v2">
            <div className="settings-card">
              <div className="card-header">
                <Palette size={20} className="card-icon" />
                <div>
                  <h2 className="card-title">Appearance</h2>
                  <p className="card-subtitle">Customize the vault interface</p>
                </div>
              </div>

              <div className="display-settings-grid">
                <div className="display-setting-row">
                  <div className="display-setting-info">
                    <Sun size={16} />
                    <div>
                      <div className="display-setting-label">Theme</div>
                      <div className="display-setting-desc">Switch between dark and light mode</div>
                    </div>
                  </div>
                  <button className="btn btn-ghost" onClick={toggleTheme}>
                    {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                    Switch to {theme === 'dark' ? 'Light' : 'Dark'}
                  </button>
                </div>

                <div className="display-setting-row">
                  <div className="display-setting-info">
                    <Clock size={16} />
                    <div>
                      <div className="display-setting-label">Auto-lock Timer</div>
                      <div className="display-setting-desc">Lock vault after inactivity</div>
                    </div>
                  </div>
                  <select
                    className="settings-select"
                    value={sessionMinutes}
                    onChange={(e) => handleSessionChange(Number(e.target.value))}
                    aria-label="Auto-lock timeout"
                  >
                    <option value={1}>1 minute</option>
                    <option value={2}>2 minutes</option>
                    <option value={5}>5 minutes</option>
                    <option value={10}>10 minutes</option>
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ BACKUP TAB ═══════ */}
        {settingsTab === 'backup' && (
          <div className="settings-card data-management-section">
            <div className="card-header">
              <FileJson size={20} className="card-icon" />
              <div>
                <h2 className="card-title">Data Portability</h2>
                <p className="card-subtitle">Export or import your entire vault</p>
              </div>
            </div>

            <div className="data-management-grid">
              <div className="data-info-text">
                <p>
                  Maintain total control over your data. You can export your entire vault (including Mini Vault)
                  to a secure <b>.toaa</b> file for backup, or import data from an existing backup.
                </p>
                <div className="data-warning-box">
                  <AlertTriangle size={14} />
                  <span>Importing will overwrite your current vault data.</span>
                </div>
              </div>

              <div className="data-action-buttons">
                <button className="btn btn-export" onClick={() => setShowAuthModal('export')}>
                  <Download size={18} />
                  <div className="btn-text-stack">
                    <span className="btn-label">Export Vault</span>
                    <span className="btn-sub">Save as .toaa backup</span>
                  </div>
                </button>

                <button className="btn btn-import" onClick={() => setShowAuthModal('import')}>
                  <Upload size={18} />
                  <div className="btn-text-stack">
                    <span className="btn-label">Import Vault</span>
                    <span className="btn-sub">Restore from backup</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════ ADVANCED TAB ═══════ */}
        {settingsTab === 'advanced' && (
          <div className="settings-layout-v2">
            <div className="settings-card">
              <div className="card-header">
                <Sliders size={20} className="card-icon" />
                <div>
                  <h2 className="card-title">Advanced Settings</h2>
                  <p className="card-subtitle">Power user configuration</p>
                </div>
              </div>

              <div className="display-settings-grid">
                <div className="display-setting-row">
                  <div className="display-setting-info">
                    <LogOut size={16} />
                    <div>
                      <div className="display-setting-label">Lock Vault</div>
                      <div className="display-setting-desc">Immediately lock and secure your vault</div>
                    </div>
                  </div>
                  <button className="btn btn-danger" onClick={() => setConfirmAction({ type: 'lock' })}>
                    <Lock size={14} /> Lock Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Master Password Confirmation Modal */}
      {showAuthModal && (
        <div className="modal-overlay">
          <div className="modal auth-modal">
            <div className="modal-header">
              <div className="auth-modal-header">
                <Lock size={20} className="accent-color" />
                <h3 className="modal-title">Authorize {showAuthModal === 'export' ? 'Export' : 'Import'}</h3>
              </div>
              <button className="modal-close" onClick={closeAuthModal}>×</button>
            </div>
            <div className="modal-body">
              <p className="auth-modal-desc">
                Please enter your master password to proceed with the {showAuthModal}.
                This action requires high-level authorization.
              </p>
              <form id="auth-form" onSubmit={handleAuthConfirm}>
                <div className="form-group">
                  <label className="form-label">Master Password</label>
                  <div className="form-input-wrapper">
                    <input
                      type={showAuthPassword ? "text" : "password"}
                      className="form-input auth-input"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      placeholder="Enter your master password"
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      className="form-input-btn"
                      onClick={() => setShowAuthPassword(!showAuthPassword)}
                    >
                      {showAuthPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeAuthModal} disabled={authLoading}>
                Cancel
              </button>
              <button type="submit" form="auth-form" className="btn btn-primary" disabled={authLoading}>
                {authLoading ? <span className="spinner" /> : 'Authorize Action'}
              </button>
            </div>
          </div>
        </div>
      )}

      {recoveryStep && (
        <div className="modal-overlay">
          <div className="modal auth-modal">
            <div className="modal-header">
              <div className="auth-modal-header">
                <Key size={20} className="accent-color" />
                <h3 className="modal-title">Recovery Key</h3>
              </div>
              <button className="modal-close" onClick={closeRecoveryModal}>×</button>
            </div>

            {recoveryStep === 'confirm' && (
              <div className="modal-body">
                <p className="auth-modal-desc" style={{ marginBottom: 16 }}>
                  Regenerating replaces your existing recovery key. Enter your master password
                  to continue.
                </p>
                <form id="recovery-form" onSubmit={requestGenerateRecovery}>
                  <div className="form-group">
                    <label className="form-label">Master Password</label>
                    <div className="form-input-wrapper">
                      <input
                        type={showRecoveryPassword ? "text" : "password"}
                        className="form-input auth-input"
                        value={recoveryPassword}
                        onChange={(e) => setRecoveryPassword(e.target.value)}
                        placeholder="Enter your master password"
                        required
                      />
                      <button
                        type="button"
                        className="form-input-btn"
                        onClick={() => setShowRecoveryPassword(!showRecoveryPassword)}
                      >
                        {showRecoveryPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                </form>
              </div>
            )}

            {recoveryStep === 'show' && (
              <div className="modal-body">
                <p className="auth-modal-desc">Save this recovery key now. It is shown once.</p>

                {recoveryLoading && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                    This may take a while. Please wait.
                  </div>
                )}
                <div className="form-group">
                  <div className="form-input-wrapper">
                    <input className="form-input auth-input" type="text" readOnly value={recoveryPhrase} />
                  </div>
                </div>
                <button type="button" className="btn btn-primary" onClick={handleCopyRecovery}>
                  {recoveryCopied ? 'Copied' : 'Copy Recovery Key'}
                </button>
              </div>
            )}

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={closeRecoveryModal} disabled={recoveryLoading}>
                Cancel
              </button>
              {recoveryStep === 'confirm' && (
                <button
                  type="submit"
                  form="recovery-form"
                  className="btn btn-primary"
                  disabled={recoveryLoading || !recoveryPassword.trim()}
                >
                  {recoveryLoading ? <span className="spinner" /> : 'Generate Key'}
                </button>
              )}
              {recoveryStep === 'show' && (
                <button className="btn btn-primary" onClick={handleDoneRecovery}>
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showRecoveryDoneConfirm && (
        <ConfirmModal
          title="Confirm Recovery Key"
          message="Did you already copy the recovery key? It will not be shown again."
          confirmText="I Copied It"
          cancelText="Go Back"
          onConfirm={confirmDoneRecovery}
          onCancel={cancelDoneRecovery}
        />
      )}

      {showRecoveryGenerateConfirm && (
        <ConfirmModal
          title="Generate New Recovery Key"
          message="This will replace your existing recovery key. Do you want to continue?"
          confirmText="Generate"
          cancelText="Cancel"
          onConfirm={confirmGenerateRecovery}
          onCancel={cancelGenerateRecovery}
        />
      )}

      {confirmAction && confirmAction.type === 'lock' && (
        <ConfirmModal
          title="Lock Vault"
          message="Your session will be ended and the vault will be locked."
          confirmText="Lock Vault"
          danger
          onConfirm={() => { setConfirmAction(null); onLogout(); }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
};

export default SettingsView;
