import React, { useEffect, useMemo, useState } from 'react';
import { EntrySummary, GroupSummary, invoke } from './api';
import { Star, Trash2, Copy, RefreshCcw, Shield, Plus, Edit2, Info, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { displayUsername } from './entryDisplay';

interface EntryTableProps {
  entries: EntrySummary[];
  section: 'all' | 'favorites' | 'trash';
  onToggleFavorite: (id: string, current: boolean) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onAddClick: () => void;
  onEditClick: (id: string) => void;
  onInfoClick: (id: string) => void;
  showAllPasswords: boolean;
  groups: GroupSummary[];
}

type EntrySortKey = 'favorite' | 'title' | 'username' | 'password';
type SortDir = 'asc' | 'desc';

function SortTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  width,
  title: thTitle,
}: {
  label: React.ReactNode;
  sortKey: EntrySortKey;
  activeKey: EntrySortKey | null;
  dir: SortDir;
  onSort: (k: EntrySortKey) => void;
  width?: number | string;
  title?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th style={width !== undefined ? { width } : undefined}>
      <button
        type="button"
        className="th-sort-btn"
        title={thTitle}
        onClick={() => onSort(sortKey)}
      >
        <span className="th-sort-label">{label}</span>
        {active ? (dir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
      </button>
    </th>
  );
}

const EntryTable: React.FC<EntryTableProps> = React.memo(({
  entries,
  section,
  onToggleFavorite,
  onTrash,
  onRestore,
  onDelete,
  onAddClick,
  onEditClick,
  onInfoClick,
  showAllPasswords,
  groups,
}) => {
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, string>>({});
  const [sortKey, setSortKey] = useState<EntrySortKey | null>('title');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const ITEMS_PER_PAGE = 8;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    setCurrentPage(1);
  }, [entries, section]);

  const handleSort = (k: EntrySortKey) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(k);
      setSortDir(k === 'favorite' ? 'desc' : 'asc');
    }
  };

  const sortedEntries = useMemo(() => {
    const arr = [...entries];
    if (!sortKey) return arr;
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      let c = 0;
      if (sortKey === 'favorite') {
        c = a.favorite === b.favorite ? 0 : a.favorite ? -1 : 1;
      } else if (sortKey === 'title') {
        c = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
      } else if (sortKey === 'username') {
        c = displayUsername(a.username).localeCompare(displayUsername(b.username), undefined, {
          sensitivity: 'base',
        });
      } else if (sortKey === 'password') {
        const pa = showAllPasswords ? visiblePasswords[a.entry_id] ?? '' : '';
        const pb = showAllPasswords ? visiblePasswords[b.entry_id] ?? '' : '';
        c = pa.localeCompare(pb) || a.entry_id.localeCompare(b.entry_id);
      }
      return c * dir;
    });
    return arr;
  }, [entries, sortKey, sortDir, showAllPasswords, visiblePasswords]);

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

  const totalPages = Math.ceil(sortedEntries.length / ITEMS_PER_PAGE);
  const paginatedEntries = sortedEntries.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE,
  );

  return (
    <>
    <table className="entry-table">
      <thead>
        <tr>
          <SortTh
            label={<Star size={14} />}
            sortKey="favorite"
            activeKey={sortKey}
            dir={sortDir}
            onSort={handleSort}
            width={44}
          />
          <SortTh label="Title" sortKey="title" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
          <SortTh
            label="Email / Username"
            sortKey="username"
            activeKey={sortKey}
            dir={sortDir}
            onSort={handleSort}
          />
          <SortTh
            label="Password / Phrase"
            sortKey="password"
            activeKey={sortKey}
            dir={sortDir}
            onSort={handleSort}
            title={
              showAllPasswords
                ? 'Sort by revealed password text'
                : 'Turn on Show all passwords to sort by secret text'
            }
          />
          <th style={{ width: 140 }}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {paginatedEntries.map((entry) => {
          const match = entry.username.match(/^\$\$(google|apple|facebook|crypto)\$\$(.*)$/);
          const customType = match ? match[1] : null;
          const userDisp = displayUsername(entry.username);
          
          const group = groups.find(g => g.group_id === entry.group_id);
          const badgeStyle = group 
              ? { background: group.color, color: '#000', borderColor: group.color } 
              : {};

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
                  <div className="entry-favicon" style={badgeStyle}>{getInitial(entry.title)}</div>
                  <span className="entry-title-text">{entry.title}</span>
                  {customType === 'crypto' && (
                     <span style={{ fontSize: 10, background: 'var(--success)', color: '#000', padding: '2px 6px', borderRadius: 4, marginLeft: 8, fontWeight: 'bold' }}>CRYPTO</span>
                  )}
                </div>
              </td>

              <td>
                <span
                  style={{ cursor: 'pointer' }}
                  onClick={() => handleCopyUsername(userDisp)}
                  title="Click to copy"
                >
                  {userDisp || '—'}
                </span>
              </td>

              <td>
                <div className="entry-password-cell" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ 
                    fontFamily: (showAllPasswords && !isSocial) ? 'monospace' : 'inherit',
                    fontSize: (showAllPasswords && isSocial) ? 12 : 'inherit',
                    fontWeight: (showAllPasswords && isSocial) ? 500 : 'normal',
                    color: (showAllPasswords && isSocial) ? 'var(--text-primary)' : 'inherit',
                    background: (showAllPasswords && isSocial) ? 'var(--bg-tertiary)' : 'transparent',
                    padding: (showAllPasswords && isSocial) ? '2px 8px' : '0',
                    borderRadius: (showAllPasswords && isSocial) ? 4 : '0',
                  }}>
                    {showAllPasswords 
                      ? (isSocial ? customLabel : (visiblePasswords[entry.entry_id] || '••••••••••••'))
                      : '••••••••••••'}
                  </span>
                </div>
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
                      <button className="action-btn" onClick={() => onInfoClick(entry.entry_id)} title="Account Information">
                        <Info size={14} />
                      </button>
                      <button className="action-btn" onClick={() => onRestore(entry.entry_id)} title="Restore">
                        <RefreshCcw size={14} />
                      </button>
                      <button className="action-btn danger" onClick={() => onDelete(entry.entry_id)} title="Delete permanently">
                        <Trash2 size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="action-btn" onClick={() => onInfoClick(entry.entry_id)} title="Account Information">
                        <Info size={14} />
                      </button>
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
    
    {totalPages > 1 && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '24px 0 8px' }}>
        <button
          className="btn btn-ghost"
          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
          disabled={currentPage === 1}
        >
          <ChevronLeft size={16} /> Previous
        </button>
        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          className="btn btn-ghost"
          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
          disabled={currentPage === totalPages}
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    )}
    </>
  );
});

export default EntryTable;
