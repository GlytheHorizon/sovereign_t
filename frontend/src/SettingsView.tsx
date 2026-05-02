import React, { useState } from 'react';
import { Shield, Key, Info, User, CheckCircle2, XCircle, Eye, EyeOff, Cpu, Code, Zap, Download, Upload, FileJson, Lock } from 'lucide-react';
import { invoke } from './api';

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

  return (
    <div className="settings-view">
      <div className="settings-layout-v2">
        {/* Row 1: Primary Settings */}
        <div className="settings-row">
          {/* Change Password Container */}
          <div className="settings-card flex-1">
            <div className="card-header">
              <Key size={20} className="card-icon" />
              <div>
                <h2 className="card-title">Security Settings</h2>
                <p className="card-subtitle">Manage your vault's protection</p>
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
            </div>
          </div>

          {/* About / Info Container */}
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
                  <span>v4.5 Stable</span>
                </div>
              </div>
              <div className="about-item-v2">
                <Shield size={16} />
                <div className="about-item-content">
                  <label>Build</label>
                  <span style={{ fontSize: '10px' }}>0502261541PMS</span>
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

        {/* Row 2: Data Management - Separate Container */}
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
                <Info size={14} />
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
    </div>
  );
};

export default SettingsView;
