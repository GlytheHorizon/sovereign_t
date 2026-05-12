import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Lock, Unlock, Plus, Trash2, Key, X, Edit3, Save, ChevronRight, Hash, Eye, EyeOff, LayoutGrid, Globe, FileText, ExternalLink, Copy, AlertTriangle, Dices, User, Clock } from 'lucide-react';
import { invoke } from './api';
import ConfirmModal from './ConfirmModal';

interface MiniVaultViewProps {
  onShowToast: (msg: string, type: 'success' | 'error') => void;
  onClose: () => void;
}

const MiniVaultView: React.FC<MiniVaultViewProps> = ({ onShowToast, onClose }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [pin, setPin] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [editingEntry, setEditingEntry] = useState<any | null>(null);
  const [newEntry, setNewEntry] = useState({ title: '', username: '', category: 'Standard Password', url: '', password: '', notes: '' });
  const [showPassForm, setShowPassForm] = useState(false);

  // Info Modal state
  const [infoEntry, setInfoEntry] = useState<any | null>(null);
  const [showInfoPass, setShowInfoPass] = useState(false);
  const [confirmShowInfoPass, setConfirmShowInfoPass] = useState(false);
  const [confirmShowEditPass, setConfirmShowEditPass] = useState(false);

  // Lock confirmation
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ type: 'entry' | 'note', id: any, title: string } | null>(null);

  const [isAddingNote, setIsAddingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<any | null>(null);
  const [showNoteContent, setShowNoteContent] = useState<any | null>(null);
  const [newNote, setNewNote] = useState({ title: '', content: '' });
  const [showChangePin, setShowChangePin] = useState(false);
  const [changePinData, setChangePinData] = useState({ currentPin: '', newPin: '', confirmPin: '' });
  const [confirmPinChange, setConfirmPinChange] = useState(false);
  const [showPinFields, setShowPinFields] = useState({ current: false, new: false, confirm: false });
  const [showClearConfirm, setShowClearConfirm] = useState(false);


  const fetchStatus = useCallback(async () => {
    try {
      const status: any = await invoke('get_mini_vault_status');
      setIsSetup(status.is_setup);
      setIsUnlocked(status.is_unlocked);
      if (status.is_unlocked) {
        fetchData();
      }
    } catch (e) {
      console.error('Failed to fetch mini vault status', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [e, n]: any = await Promise.all([
        invoke('list_mini_entries'),
        invoke('list_mini_notes')
      ]);
      console.log('Fetched data - Entries:', e.length, 'Notes:', n.length);
      console.log('Notes data:', n);
      setEntries(e);
      setNotes(n);
    } catch (e) {
      onShowToast('Failed to load mini vault data', 'error');
    }
  }, [onShowToast]);

  const handleAuth = useCallback(async () => {
    if (pin.length < 4) {
      onShowToast('PIN must be at least 4 digits', 'error');
      return;
    }

    try {
      if (!isSetup) {
        await invoke('setup_mini_vault', { input: { pin } });
        onShowToast('Mini Vault setup successfully!', 'success');
        setIsSetup(true);
      } else {
        await invoke('unlock_mini_vault', { input: { pin } });
      }
      setPin('');
      setIsUnlocked(true);
      fetchData();
    } catch (e: any) {
      console.error('Mini Vault Auth Error:', e);
      const msg = typeof e === 'string' ? e : e?.message || 'Authentication failed';
      onShowToast(msg, 'error');
      setPin('');
    }
  }, [pin, isSetup, onShowToast, fetchData]);

  useEffect(() => {
    if (isUnlocked) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 8) setPin(prev => prev + e.key);
      } else if (e.key === 'Backspace') {
        setPin(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter') {
        handleAuth();
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isUnlocked, pin, handleAuth, onClose]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleLock = async () => {
    try {
      await invoke('lock_mini_vault');
      setIsUnlocked(false);
      setShowLockConfirm(false);
      onClose();
    } catch (e) {
      onShowToast('Failed to lock mini vault', 'error');
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.type === 'entry') {
        await invoke('delete_mini_entry', { entryId: confirmDelete.id });
        onShowToast('Account deleted', 'success');
        setInfoEntry(null);
      } else {
        await invoke('delete_mini_note', { id: confirmDelete.id });
        onShowToast('Note deleted', 'success');
        if (showNoteContent?.id === confirmDelete.id) setShowNoteContent(null);
      }
      setConfirmDelete(null);
      fetchData();
    } catch (e: any) {
      onShowToast(e?.message || 'Deletion failed', 'error');
    }
  };

  const handleClearMiniVault = async () => {
    try {
      await invoke('clear_mini_vault');
      setEntries([]);
      setNotes([]);
      setIsUnlocked(false);
      setIsSetup(false);
      setPin('');
      setShowClearConfirm(false);
      onShowToast('Mini vault reset. Please set up a new PIN.', 'success');
    } catch (e: any) {
      const msg = typeof e === 'string' ? e : e?.message || 'Failed to clear mini vault';
      onShowToast(msg, 'error');
    }
  };

  const handleKeyPress = (num: string) => {
    if (pin.length < 8) setPin(pin + num);
  };

  const handleClear = () => setPin('');

  const handleSaveEntry = async () => {
    if (!newEntry.title) {
       onShowToast('Title is required', 'error');
       return;
    }
    
    // Validate password only if not a social login
    const isSocial = newEntry.category.startsWith('Login with');
    if (!isSocial && !editingEntry && !newEntry.password) {
        onShowToast('Password is required for this method', 'error');
        return;
    }

    try {
      if (editingEntry) {
        await invoke('update_mini_entry', { 
            input: { 
                entryId: editingEntry.entry_id,
                title: newEntry.title,
                username: newEntry.username,
                category: newEntry.category,
                url: newEntry.url,
                password: isSocial ? 'SOCIAL_LOGIN' : (newEntry.password || null),
                notes: newEntry.notes
            } 
        });
        onShowToast('Entry updated', 'success');
      } else {
        await invoke('add_mini_entry', { 
            input: {
                ...newEntry,
                password: isSocial ? 'SOCIAL_LOGIN' : newEntry.password
            } 
        });
        onShowToast('Entry added', 'success');
      }
      setShowAddEntry(false);
      setEditingEntry(null);
      setNewEntry({ title: '', username: '', category: 'Standard Password', url: '', password: '', notes: '' });
      fetchData();
    } catch (e: any) {
      onShowToast(e?.message || 'Failed to save entry', 'error');
    }
  };

  const handleGeneratePassword = async () => {
    try {
      const pw = await invoke<string>('generate_password', {
        input: { length: 20, numbers: true, symbols: true },
      });
      setNewEntry({ ...newEntry, password: pw });
      setShowPassForm(true);
      onShowToast('Secure password generated', 'success');
    } catch (e) {
      console.error('generate failed', e);
      onShowToast('Failed to generate password', 'error');
    }
  };

  const startEditEntry = async (entry: any) => {
    try {
        console.log('Fetching secrets for edit:', entry.entry_id);
        const secrets: any = await invoke('get_mini_entry_secrets', { entryId: entry.entry_id });
        console.log('Secrets received for edit:', secrets);
        setEditingEntry(entry);
        setNewEntry({ 
            title: entry.title, 
            username: entry.username, 
            category: entry.category || 'Standard Password', 
            url: entry.url || '',
            password: secrets.password || '', 
            notes: secrets.notes || ''
        });
        setShowAddEntry(true);
        setInfoEntry(null);
        setShowPassForm(false);
    } catch (e: any) {
        console.error('Failed to load entry details for edit:', e);
        onShowToast(e?.message || 'Failed to load entry details', 'error');
    }
  };


  const handleShowInfo = async (entry: any) => {
    try {
        console.log('Fetching secrets for info:', entry.entry_id);
        const secrets: any = await invoke('get_mini_entry_secrets', { entryId: entry.entry_id });
        console.log('Secrets received for info:', secrets);
        setInfoEntry({ ...entry, ...secrets });
        setShowInfoPass(false);
        setConfirmShowInfoPass(false);
    } catch (e: any) {
        console.error('Failed to load entry details for info:', e);
        onShowToast(e?.message || 'Failed to load entry details', 'error');
    }
  };

  const handleCopy = async (text: string, label: string) => {
    if (!text || text === 'SOCIAL_LOGIN') return;
    try {
      await invoke('copy_to_clipboard', { input: { text, ttl_seconds: 15 } });
      onShowToast(`${label} copied to clipboard (15s)`, 'success');
    } catch {
      onShowToast(`Failed to copy ${label}`, 'error');
    }
  };

  const handleSaveNote = async () => {
    if (!newNote.title || !newNote.content) {
      onShowToast('Title and Content are required', 'error');
      return;
    }
    try {
      console.log('Saving note:', newNote, editingNote ? 'Editing' : 'New');
      if (editingNote) {
        await invoke('update_mini_note', { input: { id: editingNote.id, ...newNote } });
        onShowToast('Note updated', 'success');
      } else {
        await invoke('add_mini_note', { input: newNote });
        onShowToast('Note added', 'success');
      }
      setIsAddingNote(false);
      setEditingNote(null);
      setNewNote({ title: '', content: '' });
      fetchData();
    } catch (e: any) {
      console.error('Failed to save note:', e);
      onShowToast(e?.message || 'Failed to save note', 'error');
    }
  };

  const startEditNote = async (note: any) => {
    try {
        console.log('Fetching note content for edit:', note.id);
        const content: string = await invoke('get_mini_note_content', { id: note.id });
        console.log('Note content received for edit');
        setEditingNote(note);
        setNewNote({ title: note.title, content });
        setIsAddingNote(true);
    } catch (e: any) {
        console.error('Failed to load note content for edit:', e);
        onShowToast('Failed to load note content', 'error');
    }
};

  const handleViewNote = async (note: any) => {
    try {
      console.log('Fetching note content for view:', note.id);
      const content: string = await invoke('get_mini_note_content', { id: note.id });
      console.log('Note content received for view');
      setShowNoteContent({ ...note, content });
    } catch (e: any) {
      console.error('Failed to load note content for view:', e);
      onShowToast('Failed to load note content', 'error');
    }
  };

  const handleChangePin = async () => {
    if (changePinData.newPin.length < 4) {
      onShowToast('New PIN must be at least 4 digits', 'error');
      return;
    }
    if (changePinData.newPin !== changePinData.confirmPin) {
      onShowToast('New PINs do not match', 'error');
      return;
    }

    try {
      // Verify old pin first
      await invoke('unlock_mini_vault', { input: { pin: changePinData.currentPin } });
      setConfirmPinChange(true);
    } catch (e: any) {
      onShowToast(e?.message || 'Incorrect current PIN', 'error');
    }
  };

  const executePinChange = async () => {
    try {
      await invoke('setup_mini_vault', { input: { pin: changePinData.newPin } });
      onShowToast('PIN changed successfully!', 'success');
      setShowChangePin(false);
      setConfirmPinChange(false);
      setShowPinFields({ current: false, new: false, confirm: false });
      setChangePinData({ currentPin: '', newPin: '', confirmPin: '' });
    } catch (e: any) {
      onShowToast(e?.message || 'Update failed', 'error');
    }
  };

  if (loading) return <div className="mini-vault-loading"><span className="spinner" /></div>;

  if (!isUnlocked) {
    return (
      <div className="mini-vault-auth">
        <div className="mini-vault-auth-card">
          <div className="mini-vault-header">
             <div className="mini-vault-logo-wrapper">
                <img src="/stv2.png" alt="Sovereign_T" className="mini-vault-logo" />
             </div>
             <h2>{isSetup ? 'Unlock Mini Vault' : 'Setup Mini Vault'}</h2>
             <p>{isSetup ? 'Enter your PIN to access secure items' : 'Create a 4-8 digit PIN for your mini vault'}</p>
          </div>

          <div className="mini-vault-display">
             <div className="display-monitor">
                {pin.split('').map((_, i) => <span key={i} className="display-dot">•</span>)}
                {pin === '' && <span className="display-placeholder">ENTER PIN</span>}
             </div>
          </div>

          <div className="mini-vault-keypad">
             {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
               <button key={n} className="keypad-btn" onClick={() => handleKeyPress(n.toString())}>{n}</button>
             ))}
             <button className="keypad-btn clear" onClick={handleClear}>C</button>
             <button className="keypad-btn" onClick={() => handleKeyPress('0')}>0</button>
             <button className="keypad-btn submit" onClick={handleAuth}>
                <ChevronRight size={28} />
             </button>
          </div>
          
          <button className="mini-vault-close-abs" onClick={onClose} title="Close"><X size={20} /></button>
        </div>
      </div>
    );
  }

  const isSocialEntry = newEntry.category.startsWith('Login with');

  return (
    <div className="mini-vault-dashboard">
      <div className="mini-vault-toolbar">
         <div className="toolbar-left">
            <img src="/stv2.png" alt="Logo" style={{ width: 24, height: 24 }} />
            <h1>Mini Vault</h1>
         </div>
         <div className="toolbar-right" style={{ display: 'flex', gap: '8px' }}>
            <button className="mini-vault-close-btn" onClick={() => setShowChangePin(true)} title="Change PIN">
               <Key size={18} />
            </button>
            <button className="mini-vault-close-btn" onClick={() => setShowLockConfirm(true)} title="Lock and Close">
               <X size={20} />
            </button>
         </div>
      </div>

      <div className="mini-vault-grid">
        {/* Column 1: Accounts */}
        <div className="mini-vault-col">
          <div className="col-header">
            <h3>Accounts</h3>
            <button className="btn-mini-add" onClick={() => { setShowAddEntry(true); setEditingEntry(null); setNewEntry({title:'', username:'', category:'Standard Password', url:'', password:'', notes:''}); }}>
              <Plus size={16} />
            </button>
          </div>

          <div className="mini-entry-list">
            {entries.length === 0 ? (
              <p className="empty-msg">No accounts in mini vault.</p>
            ) : (
              entries.map(e => (
                <div key={e.entry_id} className="mini-entry-card" onClick={() => handleShowInfo(e)}>
                  <div className="entry-info">
                    <div className="entry-title-row">
                        <span className="entry-title">{e.title}</span>
                        {e.category && <span className="entry-category">{e.category}</span>}
                    </div>
                    <span className="entry-user">{e.username || 'no username'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Column 2: Notes */}
        <div className="mini-vault-col">
          <div className="col-header">
            <h3>Important Notes</h3>
            <button className="btn-mini-add" onClick={() => { setIsAddingNote(true); setEditingNote(null); setNewNote({title:'', content:''}); }}>
              <Plus size={16} />
            </button>
          </div>

          <div className="mini-notes-list">
            {notes.length === 0 ? (
              <p className="empty-msg">No important notes.</p>
            ) : (
              notes.map(n => (
                <div key={n.id} className="mini-note-card" onClick={() => handleViewNote(n)}>
                  <div className="note-preview">
                    <span className="note-title">{n.title}</span>
                    <span className="note-date">{new Date(n.created_at * 1000).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add/Edit Entry Modal */}
      {showAddEntry && (
        <div className="modal-overlay" onClick={() => setShowAddEntry(false)} style={{ zIndex: 150 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 600 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={18} /> {editingEntry ? 'Edit Account' : 'Add New Account'}
              </h2>
              <button className="modal-close" onClick={() => setShowAddEntry(false)}><X size={18} /></button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">TITLE *</label>
                    <input 
                      className="form-input"
                      placeholder="e.g. Google, Discord..." 
                      value={newEntry.title} 
                      onChange={e => setNewEntry({...newEntry, title: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">TYPE / METHOD</label>
                    <select className="form-input" value={newEntry.category} onChange={e => setNewEntry({...newEntry, category: e.target.value})}>
                      <option value="Standard Password">Standard Password</option>
                      <option value="Crypto Wallet / Seed Phrase">Crypto Wallet / Seed Phrase</option>
                      <option value="Login with Google">Login with Google</option>
                      <option value="Login with Apple">Login with Apple</option>
                      <option value="Login with Facebook">Login with Facebook</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">URL (OPTIONAL)</label>
                    <input 
                      className="form-input"
                      placeholder="https://..." 
                      value={newEntry.url} 
                      onChange={e => setNewEntry({...newEntry, url: e.target.value})}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">EMAIL / USERNAME</label>
                    <input 
                      className="form-input"
                      placeholder="e.g. user@gmail.com" 
                      value={newEntry.username} 
                      onChange={e => setNewEntry({...newEntry, username: e.target.value})}
                    />
                  </div>
                  {!isSocialEntry && (
                    <div className="form-group">
                        <label className="form-label">PASSWORD *</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div style={{ position: 'relative', flex: 1 }}>
                                <input 
                                    className="form-input"
                                    type={showPassForm ? "text" : "password"}
                                    placeholder="Enter password" 
                                    value={newEntry.password} 
                                    onChange={e => setNewEntry({...newEntry, password: e.target.value})}
                                    style={{ paddingRight: '40px' }}
                                />
                                <button 
                                    onClick={() => {
                                        if (!showPassForm) setConfirmShowEditPass(true);
                                        else setShowPassForm(false);
                                    }}
                                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                                >
                                    {showPassForm ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            <button className="btn btn-ghost" onClick={handleGeneratePassword} title="Generate">
                                <Dices size={16} />
                            </button>
                        </div>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">NOTES</label>
                    <textarea 
                      className="form-input"
                      placeholder="Optional notes..." 
                      value={newEntry.notes} 
                      onChange={e => setNewEntry({...newEntry, notes: e.target.value})}
                      style={{ minHeight: '80px' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowAddEntry(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveEntry}>
                <Save size={18} /> Save Account
              </button>
            </div>
          </div>
        </div>
      )}

      {showClearConfirm && (
        <ConfirmModal
          title="Reset Mini Vault"
          message="This will delete all Mini Vault accounts, notes, and PIN. This action cannot be undone."
          confirmText="Reset"
          cancelText="Cancel"
          danger
          onConfirm={handleClearMiniVault}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}

      {/* Account Info Modal (Updated to match InfoModal.tsx) */}
      {infoEntry && (
        <div className="modal-overlay" onClick={() => setInfoEntry(null)} style={{ zIndex: 150 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 450 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Shield size={18} /> Account Information
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="modal-close" onClick={() => startEditEntry(infoEntry)} title="Edit"><Edit3 size={16} /></button>
                <button className="modal-close" onClick={() => setConfirmDelete({ type: 'entry', id: infoEntry.entry_id, title: infoEntry.title })} title="Delete"><Trash2 size={16} /></button>
                <button className="modal-close" onClick={() => setInfoEntry(null)}><X size={18} /></button>
              </div>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>Title</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{infoEntry.title}</div>
              </div>

              {infoEntry.url && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>
                    <Globe size={14} /> URL
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--accent)' }}>
                    <a href={infoEntry.url.startsWith('http') ? infoEntry.url : `https://${infoEntry.url}`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                      {infoEntry.url}
                    </a>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <div className="label-with-icon"><User size={14} /> Username / Email</div>
                  <div style={{ fontSize: 14 }}>{infoEntry.username || '(None)'}</div>
                </div>
                <div>
                  <div className="label-with-icon"><Shield size={14} /> Type</div>
                  <div style={{ fontSize: 14 }}>{infoEntry.category}</div>
                </div>
              </div>

              {infoEntry.password !== 'SOCIAL_LOGIN' && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div className="label-with-icon"><Key size={14} /> Password / Secret</div>
                    <button 
                      onClick={() => {
                        if (!showInfoPass) setConfirmShowInfoPass(true);
                        else setShowInfoPass(false);
                      }}
                      style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
                    >
                      {showInfoPass ? <><EyeOff size={14} /> Hide</> : <><Eye size={14} /> Show</>}
                    </button>
                  </div>
                  <div style={{ fontSize: 14, background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8, fontFamily: showInfoPass ? "'JetBrains Mono', monospace" : 'inherit', letterSpacing: showInfoPass ? 'normal' : '4px', overflowWrap: 'break-word', border: '1px solid var(--border-subtle)' }}>
                    {showInfoPass ? infoEntry.password : '••••••••••••'}
                  </div>
                </div>
              )}

              <div>
                <div className="label-with-icon"><FileText size={14} /> Notes</div>
                <div style={{ fontSize: 14, background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', border: '1px solid var(--border-subtle)', minHeight: '60px' }}>
                  {infoEntry.notes || 'No notes available.'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                <div>
                  <div className="label-with-icon"><Clock size={12} /> Created At</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(infoEntry.created_at * 1000).toLocaleString()}</div>
                </div>
                <div>
                  <div className="label-with-icon"><Clock size={12} /> Last Edited</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(infoEntry.updated_at * 1000).toLocaleString()}</div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setInfoEntry(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Note Modal */}
      {isAddingNote && (
        <div className="modal-overlay" onClick={() => setIsAddingNote(false)} style={{ zIndex: 150 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 500 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} /> {editingNote ? 'Edit Note' : 'Add New Note'}
              </h2>
              <button className="modal-close" onClick={() => setIsAddingNote(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">NOTE TITLE</label>
                <input 
                  className="form-input"
                  placeholder="e.g. Master Seed, API Keys..." 
                  value={newNote.title}
                  onChange={e => setNewNote({...newNote, title: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">CONTENT</label>
                <textarea 
                  className="form-input"
                  placeholder="Write your sensitive information here..."
                  value={newNote.content}
                  onChange={e => setNewNote({...newNote, content: e.target.value})}
                  style={{ minHeight: '200px' }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setIsAddingNote(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveNote}>
                <Save size={18} /> Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Note Modal */}
      {showNoteContent && (
        <div className="modal-overlay" onClick={() => setShowNoteContent(null)} style={{ zIndex: 150 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 550 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={18} /> {showNoteContent.title}
              </h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="modal-close" onClick={() => { setShowNoteContent(null); startEditNote(showNoteContent); }} title="Edit"><Edit3 size={16} /></button>
                <button className="modal-close" onClick={() => setConfirmDelete({ type: 'note', id: showNoteContent.id, title: showNoteContent.title })} title="Delete"><Trash2 size={16} /></button>
                <button className="modal-close" onClick={() => setShowNoteContent(null)}><X size={18} /></button>
              </div>
            </div>
            <div className="modal-body">
              <div style={{ background: 'var(--bg-tertiary)', padding: '20px', borderRadius: '12px', whiteSpace: 'pre-wrap', border: '1px solid var(--border-subtle)', minHeight: '150px', maxHeight: '400px', overflowY: 'auto', fontStyle: showNoteContent.content ? 'normal' : 'italic', color: showNoteContent.content ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {showNoteContent.content || 'No content available.'}
              </div>
              <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                 <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Created: {new Date(showNoteContent.created_at * 1000).toLocaleString()}
                 </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-primary" onClick={() => setShowNoteContent(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modals */}
      {showLockConfirm && (
        <ConfirmModal
          title="Lock Mini Vault"
          message="Your secure session will be ended. You will need your PIN to access these items again."
          confirmText="Lock & Close"
          danger={true}
          onConfirm={handleLock}
          onCancel={() => setShowLockConfirm(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`Delete ${confirmDelete.type === 'entry' ? 'Account' : 'Note'}`}
          message={`Are you sure you want to delete "${confirmDelete.title}"? This action cannot be undone.`}
          confirmText="Yes, Delete"
          danger={true}
          onConfirm={executeDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {confirmShowInfoPass && (
        <ConfirmModal
          title="Expose Secret?"
          message="This will show your sensitive password/seed on the screen. Please ensure you are in a private area."
          confirmText="Show Secret"
          danger={true}
          onConfirm={() => {
            setShowInfoPass(true);
            setConfirmShowInfoPass(false);
          }}
          onCancel={() => setConfirmShowInfoPass(false)}
        />
      )}

      {confirmShowEditPass && (
        <ConfirmModal
          title="Expose Secret?"
          message="This will show the password on the screen. Please ensure you are in a private area."
          confirmText="Show Password"
          danger={true}
          onConfirm={() => {
            setShowPassForm(true);
            setConfirmShowEditPass(false);
          }}
          onCancel={() => setConfirmShowEditPass(false)}
        />
      )}

      {showChangePin && (
        <div className="modal-overlay" onClick={() => setShowChangePin(false)} style={{ zIndex: 160 }}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: 400 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} /> Change PIN Code
              </h2>
              <button className="modal-close" onClick={() => setShowChangePin(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">CURRENT PIN</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPinFields.current ? "text" : "password"}
                    className="form-input"
                    placeholder="Enter current PIN"
                    value={changePinData.currentPin}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setChangePinData({...changePinData, currentPin: val});
                    }}
                    maxLength={8}
                    style={{ paddingRight: '40px' }}
                  />
                  <button 
                    onClick={() => setShowPinFields({...showPinFields, current: !showPinFields.current})}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showPinFields.current ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">NEW PIN (4-8 DIGITS)</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPinFields.new ? "text" : "password"}
                    className="form-input"
                    placeholder="Enter new PIN"
                    value={changePinData.newPin}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setChangePinData({...changePinData, newPin: val});
                    }}
                    maxLength={8}
                    style={{ paddingRight: '40px' }}
                  />
                  <button 
                    onClick={() => setShowPinFields({...showPinFields, new: !showPinFields.new})}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showPinFields.new ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">CONFIRM NEW PIN</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPinFields.confirm ? "text" : "password"}
                    className="form-input"
                    placeholder="Confirm new PIN"
                    value={changePinData.confirmPin}
                    onChange={e => {
                      const val = e.target.value.replace(/[^0-9]/g, '');
                      setChangePinData({...changePinData, confirmPin: val});
                    }}
                    maxLength={8}
                    style={{ paddingRight: '40px' }}
                  />
                  <button 
                    onClick={() => setShowPinFields({...showPinFields, confirm: !showPinFields.confirm})}
                    style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    {showPinFields.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowChangePin(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleChangePin}>
                Update PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmPinChange && (
        <ConfirmModal
          title="Change PIN Code?"
          message="Are you sure you want to change your Mini Vault PIN? You will need this new PIN for future access."
          confirmText="Confirm Change"
          danger={true}
          onConfirm={executePinChange}
          onCancel={() => setConfirmPinChange(false)}
        />
      )}
    </div>
  );
};

export default MiniVaultView;
