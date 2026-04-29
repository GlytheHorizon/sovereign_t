import React, { useState, useCallback, useEffect } from 'react';
import { invoke, NewEntryInput, UpdateEntryInput, EntrySummary, GroupSummary } from './api';
import { Plus, Edit3, X, AlertTriangle, Eye, EyeOff, Dices, Save } from 'lucide-react';

interface AddEntryModalProps {
  editEntryId?: string;
  entries: EntrySummary[];
  onClose: () => void;
  onSaved: (title: string) => void;
}

const AddEntryModal: React.FC<AddEntryModalProps> = ({ editEntryId, entries, onClose, onSaved }) => {
  const [loginMethod, setLoginMethod] = useState<'password' | 'google' | 'apple' | 'facebook' | 'crypto'>('password');
  const [title, setTitle] = useState('');
  const [username, setUsername] = useState('');
  const [url, setUrl] = useState('');
  const [groupId, setGroupId] = useState<string>('');
  const [password, setPassword] = useState('');
  const [notes, setNotes] = useState('');
  const [favorite, setFavorite] = useState(false);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#2f80ed');
  const [creatingGroup, setCreatingGroup] = useState(false);
  
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!!editEntryId);
  const [error, setError] = useState('');

  // Prefix matching logic
  useEffect(() => {
    invoke<GroupSummary[]>('list_groups')
      .then((res) => setGroups(res))
      .catch(() => setGroups([]));
  }, []);

  useEffect(() => {
    if (editEntryId) {
      const entry = entries.find(e => e.entry_id === editEntryId);
      if (entry) {
        setTitle(entry.title);
        setUrl(entry.url);
        setFavorite(entry.favorite);
        setGroupId(entry.group_id || '');
        
        const match = entry.username.match(/^\$\$(google|apple|facebook|crypto)\$\$(.*)$/);
        if (match) {
           setLoginMethod(match[1] as any);
           setUsername(match[2]);
        } else {
           setLoginMethod('password');
           setUsername(entry.username);
        }

        // Fetch securely
        invoke<{password: string, notes: string}>('get_entry_secrets', { entryId: editEntryId })
          .then(res => {
             if (!match || match[1] === 'crypto') {
                 setPassword(res.password);
             }
             setNotes(res.notes);
          })
          .catch(err => setError('Failed to load secrets.'))
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }
  }, [editEntryId, entries]);

  // Password strength
  const getStrength = useCallback((pw: string) => {
    if (!pw) return 0;
    if (loginMethod === 'crypto') return 4; // Seed phrase is always considered strong by default
    let score = 0;
    if (pw.length >= 12) score++;
    if (pw.length >= 16) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    return Math.min(score, 4);
  }, [loginMethod]);

  const strengthLevel = getStrength(password);
  const strengthLabels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthClasses = ['', 'weak', 'fair', 'good', 'strong'];

  const handleGenerate = async () => {
    try {
      const pw = await invoke<string>('generate_password', {
        input: { length: 20, numbers: true, symbols: true },
      });
      setPassword(pw);
      setShowPassword(true);
    } catch (e) {
      console.error('generate failed', e);
    }
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      setError('Group name is required.');
      return;
    }
    setCreatingGroup(true);
    try {
      const created = await invoke<GroupSummary>('create_group', {
        input: { name, color: newGroupColor },
      });
      setGroups((prev) => [...prev, created]);
      setGroupId(created.group_id);
      setNewGroupName('');
    } catch (e: any) {
      setError(e?.message || 'Failed to create group.');
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleSave = async () => {
    setError('');
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    
    let finalUsername = username.trim();
    let finalPassword = password;

    const isSocial = loginMethod !== 'password' && loginMethod !== 'crypto';
    
    if (loginMethod !== 'password') {
       finalUsername = `$$${loginMethod}$$${finalUsername}`;
    }

    if (isSocial) {
      finalPassword = `SOCIAL_LOGIN_${loginMethod.toUpperCase()}_ACCOUNT`;
    } else if (!password) {
      setError(loginMethod === 'crypto' ? 'Seed phrase/key is required.' : 'Password is required.');
      return;
    }

    setSaving(true);
    try {
      if (editEntryId) {
         const input: UpdateEntryInput = {
           entry_id: editEntryId,
           title: title.trim(),
           username: finalUsername,
           url: url.trim(),
           group_id: groupId || null,
           password: finalPassword,
           notes: notes.trim() || undefined,
           favorite: favorite,
           trashed: false,
         };
         await invoke('update_entry', { input });
      } else {
         const input: NewEntryInput = {
           title: title.trim(),
           username: finalUsername,
           url: url.trim(),
           group_id: groupId || null,
           password: finalPassword,
           notes: notes.trim() || undefined,
           favorite: favorite,
         };
         await invoke('add_entry', { input });
      }
      onSaved(title.trim());
    } catch (e: any) {
      setError(e?.message || 'Failed to save entry.');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  if (loading) return (
     <div className="modal-overlay">
        <div className="modal" style={{ textAlign: 'center', padding: 40 }}>
           <span className="spinner" style={{ width: 32, height: 32 }} />
        </div>
     </div>
  );

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {editEntryId ? <><Edit3 size={18} /> Edit Account</> : <><Plus size={18} /> Add New Account</>}
          </h2>
          <button id="modal-close-btn" className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {error && (
            <div className="auth-error">
              <span><AlertTriangle size={16} /></span> {error}
            </div>
          )}

          {/* Title */}
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input
              id="entry-title"
              className="form-input"
              placeholder="e.g. Google, Discord, Binance..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Group */}
          <div className="form-group">
            <label className="form-label">Group</label>
            <select
              className="form-input"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
            >
              <option value="">No group</option>
              {groups.map((group) => (
                <option key={group.group_id} value={group.group_id}>
                  {group.name}
                </option>
              ))}
            </select>

            <div className="group-create-row">
              <input
                className="form-input"
                placeholder="New group name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
              />
              <input
                className="group-color-input"
                type="color"
                value={newGroupColor}
                onChange={(e) => setNewGroupColor(e.target.value)}
                aria-label="Group color"
              />
              <button
                type="button"
                className="btn btn-ghost"
                onClick={handleCreateGroup}
                disabled={creatingGroup}
              >
                {creatingGroup ? <span className="spinner" /> : 'Create'}
              </button>
            </div>
          </div>

          {/* Login Method */}
          <div className="form-group">
            <label className="form-label">Type / Method</label>
            <select
              className="form-input"
              value={loginMethod}
              onChange={(e) => setLoginMethod(e.target.value as any)}
            >
              <option value="password">Standard Password</option>
              <option value="crypto">Crypto Wallet / Seed Phrase</option>
              <option value="google">Login with Google</option>
              <option value="apple">Login with Apple</option>
              <option value="facebook">Login with Facebook</option>
            </select>
          </div>

          {/* Email / Username */}
          <div className="form-group">
            <label className="form-label">Email / Username</label>
            <input
              id="entry-username"
              className="form-input"
              placeholder={loginMethod === 'crypto' ? 'e.g. Wallet Name / Email' : 'e.g. user@gmail.com'}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>

          {/* URL */}
          <div className="form-group">
            <label className="form-label">URL (Optional)</label>
            <input
              id="entry-url"
              className="form-input"
              placeholder="https://..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>

          {/* Password / Crypto Seed */}
          {(loginMethod === 'password' || loginMethod === 'crypto') && (
            <div className="form-group">
              <label className="form-label">
                  {loginMethod === 'crypto' ? 'Seed Phrase / Private Key *' : 'Password *'}
              </label>
              <div className="password-generate-row">
                <div className="form-input-wrapper" style={{ flex: 1 }}>
                  {loginMethod === 'crypto' ? (
                    <textarea 
                        className="form-input"
                      placeholder="Enter seed phrase or private key"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        style={{ fontFamily: "'JetBrains Mono', monospace", resize: 'vertical' }}
                        rows={2}
                     />
                  ) : (
                     <input
                       id="entry-password"
                       className="form-input"
                       type={showPassword ? 'text' : 'password'}
                       placeholder="Enter password"
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       style={{ fontFamily: showPassword ? "'JetBrains Mono', monospace" : 'inherit' }}
                     />
                  )}
                  {loginMethod !== 'crypto' && (
                     <button
                       type="button"
                       className="form-input-btn"
                       onClick={() => setShowPassword(!showPassword)}
                       title={showPassword ? 'Hide password' : 'Show password'}
                     >
                       {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                     </button>
                  )}
                </div>
                {loginMethod !== 'crypto' && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={handleGenerate}
                    title="Generate secure password"
                    style={{ flexShrink: 0 }}
                  >
                    <Dices size={16} /> Generate
                  </button>
                )}
              </div>
              {/* Strength meter */}
              {password && loginMethod !== 'crypto' && (
                <div style={{ marginTop: 6 }}>
                  <div className="password-strength">
                    {[1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`password-strength-bar ${
                          i <= strengthLevel ? strengthClasses[strengthLevel] : ''
                        }`}
                      />
                    ))}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      marginTop: 4,
                      color:
                        strengthLevel <= 1
                          ? 'var(--danger)'
                          : strengthLevel === 2
                          ? 'var(--warning)'
                          : strengthLevel === 3
                          ? 'var(--accent)'
                          : 'var(--success)',
                    }}
                  >
                    {strengthLabels[strengthLevel]}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea
              id="entry-notes"
              className="form-input"
              placeholder="Optional notes, backup codes, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button
            id="save-entry-btn"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? <span className="spinner" /> : <Save size={16} />} {editEntryId ? 'Update' : 'Save'} Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddEntryModal;
