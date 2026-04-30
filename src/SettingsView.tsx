import React, { useState } from 'react';
import { Shield, Key, Info, User, CheckCircle2, XCircle, Eye, EyeOff, Cpu, Code, Zap } from 'lucide-react';
import { invoke } from './api';

interface SettingsViewProps {
  onShowToast: (msg: string, type: 'success' | 'error') => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ onShowToast }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  return (
    <div className="settings-view">
      <div className="settings-grid">
        {/* Column 1: Password */}
        <div className="settings-section">
          <h2 className="settings-title">
            <Key size={20} /> Change Master Password
          </h2>
          <p className="settings-description">
            Changing your master password will re-encrypt your entire vault.
            Make sure to remember your new password, as it cannot be recovered.
          </p>

          <form className="settings-form" onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Current Master Password</label>
              <div className="form-input-wrapper">
                <input
                  type={showOldPassword ? "text" : "password"}
                  className="form-input"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
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
            
            <div className="form-group">
              <label className="form-label">New Master Password</label>
              <div className="form-input-wrapper">
                <input
                  type={showNewPassword ? "text" : "password"}
                  className="form-input"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 12 characters"
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
            
            <div className="form-group">
              <label className="form-label">Confirm New Master Password</label>
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

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Update Master Password'}
            </button>
          </form>
        </div>

        {/* Column 2: Information */}
        <div className="settings-section">
          <h2 className="settings-title">
            <Info size={20} /> About Sovereign_T
          </h2>
          <div className="about-card">
            <div className="about-item">
              <User size={18} className="about-icon" />
              <div className="about-content">
                <span className="about-label">Developer</span>
                <span className="about-value">Jerwin Cruz</span>
              </div>
            </div>
            <div className="about-item">
              <Shield size={18} className="about-icon" />
              <div className="about-content">
                <span className="about-label">Version  </span>
                <span className="about-value">V3.5 </span>
              </div>
            </div>
            <div className="about-item">
              <Shield size={18} className="about-icon" />
              <div className="about-content">
                <span className="about-label">Build</span>
                <span className="about-value">Build 0430260123PMS</span>
              </div>
            </div>
          </div>
          
          <h2 className="settings-title" style={{ marginTop: 32 }}>
            <Cpu size={20} /> Technology & Features
          </h2>
          <div className="about-card">
            <div className="about-item">
              <Code size={18} className="about-icon" />
              <div className="about-content">
                <span className="about-label">Core Tech Stack</span>
                <span className="about-value">React, Vite, Tauri, SQLite, Rust</span>
              </div>
            </div>
            <div className="about-item">
              <Zap size={18} className="about-icon" />
              <div className="about-content">
                <span className="about-label">Special Features</span>
                <span className="about-value" style={{ lineHeight: 1.4 }}>
                  AES-256-GCM Encryption, Mini Vault,<br/>
                  Glassmorphism UI, Zero-Knowledge Architecture
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsView;
