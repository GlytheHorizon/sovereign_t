import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Ghost, ShieldAlert, Lock, Info, Terminal, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { invoke } from './api';

const DecoyProtocolView: React.FC = () => {
  const [enabled, setEnabled] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await invoke<{ enabled: boolean }>('get_decoy_status');
        setEnabled(status.enabled);
      } catch (e) {
        console.error('Failed to get decoy status', e);
      } finally {
        setLoading(false);
      }
    };
    checkStatus();
  }, []);

  const handleToggle = async () => {
    setSaving(true);
    try {
      if (enabled) {
        await invoke('set_decoy_protocol', { input: { password: null } });
        setEnabled(false);
        setPassword('');
      } else {
        if (password.length < 12) {
          alert('Ghost password must be at least 12 characters for sovereign security.');
          return;
        }
        await invoke('set_decoy_protocol', { input: { password } });
        setEnabled(true);
      }
    } catch (e) {
      alert('Failed to update protocol.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="protocol-view">Loading Protocol...</div>;

  return (
    <div className="protocol-view">
      <div className="protocol-header">
        <h2 className="protocol-title"><Ghost size={22} /> Decoy Protocol (Alpha)</h2>
        <p className="protocol-sub">Plausible deniability via a secondary, dummy vault layer.</p>
      </div>

      <div className="protocol-grid">
        <div className="protocol-card decoy-setup">
          <div className="protocol-card-header">
            <Lock size={18} />
            <h3>{enabled ? 'Protocol Active' : 'Configure Ghost Password'}</h3>
          </div>
          <p className="protocol-card-desc">Set a secondary password for <strong>Plausible Deniability</strong>. Entering this password at login will load a "Shadow Vault" with dummy data.</p>
          
          <div className="protocol-use-case">
             <div className="use-case-label">The "Duress" Scenario:</div>
             <p className="use-case-text">If forced to unlock your device, use the Ghost Password. The attacker sees a "real" vault, while your primary data is safely ignored.</p>
          </div>
          
          <div className="decoy-form">
            {!enabled && (
              <div className="form-group">
                <label className="form-label">Ghost Secret</label>
                <input 
                  type="password" 
                  className="form-input"
                  placeholder="Minimum 8 characters..." 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            )}
            <button 
              className={`btn ${enabled ? 'btn-danger' : 'btn-primary'} ${saving ? 'btn-loading' : ''} decoy-action-btn`}
              onClick={handleToggle}
              disabled={saving}
            >
              {enabled ? 'Disable Protocol' : 'Initialize Protocol'}
            </button>
            {enabled && (
              <div className="protocol-active-msg">
                <CheckCircle2 size={14} /> System Armed: Ghost Key Persistent
              </div>
            )}
          </div>
        </div>

        <div className="protocol-card decoy-status">
          <div className="protocol-card-header">
            <ShieldAlert size={18} />
            <h3>Security Implications</h3>
          </div>
          <div className="implication-list">
             <div className="implication-item">
               <Info size={14} />
               <span><strong>Persistence:</strong> Your Ghost Secret is now stored in the encrypted metadata. It will survive vault locks.</span>
             </div>
             <div className="implication-item">
               <Terminal size={14} />
               <span><strong>Shadow Logic:</strong> When the ghost key is used, Sovereigni-T generates a session that lacks access to your primary records.</span>
             </div>
             <div className="implication-item">
               <AlertTriangle size={14} />
               <span><strong>Isolation:</strong> Records added in Ghost Mode are ephemeral and will not contaminate your main vault.</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DecoyProtocolView;
