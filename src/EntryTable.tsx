import React, { useEffect, useState } from 'react';
import { EntrySummary, invoke } from './api';
import { Star, Trash2, Copy, RefreshCcw, Shield, Plus, Edit2 } from 'lucide-react';

interface EntryTableProps {
  entries: EntrySummary[];
  section: 'all' | 'favorites' | 'trash';
  onToggleFavorite: (id: string, current: boolean) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onAddClick: () => void;
  onEditClick: (id: string) => void;
  showAllPasswords: boolean;
}

const EntryTable: React.FC<EntryTableProps> = ({
  entries,
  section,
  onToggleFavorite,
  onTrash,
  onRestore,
  onDelete,
  onAddClick,
  onEditClick,
  showAllPasswords,
}) => {
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, string>>({});

  const handleCopyPassword = async (entryId: string) => {
    try {
      const secrets = await invoke<{password: string, notes: string}>('get_entry_secrets', { entryId: entryId });
      try {
        await navigator.clipboard.writeText(secrets.password);
      } catch {
        await invoke('copy_to_clipboard', {
          input: { text: secrets.password, ttl_seconds: 15 },
        });
      }
    } catch (e) {
      console.error('copy failed', e);
    }
  };

  const handleCopyUsername = async (username: string) => {
    try {
      await invoke('copy_to_clipboard', {
        input: { text: username, ttl_seconds: 15 },
      });
    } catch {
      try { await navigator.clipboard.writeText(username); } catch {}
    }
  };

  useEffect(() => {
    let active = true;

    if (!showAllPasswords) {
      setVisiblePasswords({});
      return undefined;
    }

    const loadAll = async () => {
      const pairs = await Promise.all(
        entries.map(async (entry) => {
          const match = entry.username.match(/^\$\$(google|apple|facebook|crypto)\$\$(.*)$/);
          const customType = match ? match[1] : null;
          const isSocial = customType && customType !== 'crypto';
          if (isSocial) {
            return [entry.entry_id, ''] as const;
          }
          try {
            const secrets = await invoke<{password: string, notes: string}>('get_entry_secrets', { entryId: entry.entry_id });
            return [entry.entry_id, secrets.password] as const;
          } catch {
            return [entry.entry_id, ''] as const;
          }
        }),
      );

      if (!active) return;
      const next: Record<string, string> = {};
      for (const [id, value] of pairs) {
        next[id] = value;
      }
      setVisiblePasswords(next);
    };

    loadAll();
    return () => {
      active = false;
    };
  }, [entries, showAllPasswords]);

  const getInitial = (title: string) => {
    return title.charAt(0).toUpperCase();
  };

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          {section === 'trash' ? <Trash2 size={48} /> : section === 'favorites' ? <Star size={48} /> : <Shield size={48} />}
        </div>
        <div className="empty-state-title">
          {section === 'trash'
            ? 'Trash is empty'
            : section === 'favorites'
            ? 'No favorites yet'
            : 'No accounts saved yet'}
        </div>
        <div className="empty-state-desc">
          {section === 'trash'
            ? 'Items you delete will appear here.'
            : section === 'favorites'
            ? 'Star an account to add it to your favorites.'
            : 'Click the Add Account button above to add your first account to the vault.'}
        </div>
        {section === 'all' && (
          <button className="btn btn-add" onClick={onAddClick}>
            <Plus size={16} /> Add Your First Account
          </button>
        )}
      </div>
    );
  }

  return (
    <table className="entry-table">
      <thead>
        <tr>
          <th style={{ width: 36 }}></th>
          <th>Title</th>
          <th>Email / Username</th>
          <th>Password / Phrase</th>
          <th>URL</th>
          <th style={{ width: 140 }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => {
          const match = entry.username.match(/^\$\$(google|apple|facebook|crypto)\$\$(.*)$/);
          const customType = match ? match[1] : null;
          const displayUsername = match ? match[2] : entry.username;

          let customLabel = '';
          if (customType === 'google') customLabel = 'Google Login';
          if (customType === 'apple') customLabel = 'Apple Login';
          if (customType === 'facebook') customLabel = 'Facebook Login';
          if (customType === 'crypto') customLabel = 'Crypto Seed/Key';

          const isSocial = customType && customType !== 'crypto';

          return (
            <tr key={entry.entry_id} id={`entry-${entry.entry_id}`}>
              <td>
                <button
                  className={`action-btn star ${entry.favorite ? 'active' : ''}`}
                  onClick={() => onToggleFavorite(entry.entry_id, entry.favorite)}
                  title={entry.favorite ? 'Remove from favorites' : 'Add to favorites'}
                  style={{ opacity: 1 }}
                >
                  <Star size={16} fill={entry.favorite ? 'currentColor' : 'none'} />
                </button>
              </td>

              <td>
                <div className="entry-title-cell">
                  <div className="entry-favicon">{getInitial(entry.title)}</div>
                  <span className="entry-title-text">{entry.title}</span>
                  {customType === 'crypto' && (
                     <span style={{ fontSize: 10, background: 'var(--success)', color: '#000', padding: '2px 6px', borderRadius: 4, marginLeft: 8, fontWeight: 'bold' }}>CRYPTO</span>
                  )}
                </div>
              </td>

              <td>
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleCopyUsername(displayUsername)}
                  title="Click to copy"
                >
                  {displayUsername || '—'}
                </span>
              </td>

              <td>
                {isSocial ? (
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: 4 }}>
                    {customLabel}
                  </span>
                ) : (
                  <div className="entry-password-cell" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                     <span style={{ fontFamily: showAllPasswords ? 'monospace' : 'inherit' }}>
                       {showAllPasswords && visiblePasswords[entry.entry_id]
                         ? visiblePasswords[entry.entry_id]
                         : '••••••••••••'}
                     </span>
                  </div>
                )}
              </td>

              <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.url ? (
                  <span style={{ color: 'var(--accent)', fontSize: 12 }}>
                    {entry.url.replace(/^https?:\/\//, '')}
                  </span>
                ) : (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                )}
              </td>

              <td>
                <div className="entry-actions" style={{ opacity: 1 }}>
                  {!isSocial && (
                    <button
                      className="action-btn"
                      onClick={() => handleCopyPassword(entry.entry_id)}
                      title="Copy secret"
                    >
                      <Copy size={14} />
                    </button>
                  )}
                  {section === 'trash' ? (
                    <>
                      <button className="action-btn" onClick={() => onRestore(entry.entry_id)} title="Restore">
                        <RefreshCcw size={14} />
                      </button>
                      <button className="action-btn danger" onClick={() => onDelete(entry.entry_id)} title="Delete permanently">
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="action-btn" onClick={() => onEditClick(entry.entry_id)} title="Edit Account">
                        <Edit2 size={14} />
                      </button>
                      <button className="action-btn danger" onClick={() => onTrash(entry.entry_id)} title="Move to trash">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default EntryTable;
