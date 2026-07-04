import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { EntrySummary, GroupSummary, invoke } from './api';
import {
  Star, Trash2, Copy, RefreshCw, Shield, Plus,
  Edit2, Info, ChevronLeft, ChevronRight,
  Eye, Lock, MoreVertical, LayoutGrid, List,
  Key, CopyCheck,
} from 'lucide-react';
import { displayUsername } from './entryDisplay';
import ContextMenu, { ContextMenuItem } from './components/ContextMenu';
import EmptyState from './EmptyState';

interface EntryTableProps {
  entries: EntrySummary[];
  section: 'all' | 'favorites' | 'trash' | string;
  onToggleFavorite: (id: string, current: boolean) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onAddClick: () => void;
  onEditClick: (id: string) => void;
  onInfoClick: (id: string) => void;
  showAllPasswords: boolean;
  groups: GroupSummary[];
  onShowToast?: (msg: string, type: 'success' | 'error') => void;
}

type ViewMode = 'card' | 'table';
type SortKey = 'title' | 'username' | 'group' | 'updated' | 'favorite';
type SortDir = 'asc' | 'desc';

const ITEMS_PER_PAGE = 12;

// ── Sort Helpers ──
function useSortableEntries(entries: EntrySummary[], groups: GroupSummary[]) {
  const [sortKey, setSortKey] = useState<SortKey>('updated');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir(key === 'updated' ? 'desc' : 'asc'); }
  };

  const sorted = useMemo(() => {
    const copy = [...entries];
    const dir = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      let c = 0;
      if (sortKey === 'title') c = a.title.localeCompare(b.title);
      else if (sortKey === 'username') c = a.username.localeCompare(b.username);
      else if (sortKey === 'group') {
        const ga = groups.find(g => g.group_id === a.group_id)?.name || '';
        const gb = groups.find(g => g.group_id === b.group_id)?.name || '';
        c = ga.localeCompare(gb);
      } else if (sortKey === 'favorite') c = Number(a.favorite) - Number(b.favorite);
      else c = a.updated_at - b.updated_at;
      return c * dir;
    });
    return copy;
  }, [entries, sortKey, sortDir, groups]);

  return { sorted, sortKey, sortDir, toggleSort };
}

// ── Sort Header Button ──
const SortTh: React.FC<{ label: string; k: SortKey; current: SortKey; dir: SortDir; onSort: (k: SortKey) => void }> = ({
  label, k, current, dir, onSort,
}) => (
  <th>
    <button type="button" className="th-sort-btn" onClick={() => onSort(k)} aria-label={`Sort by ${label}`}>
      {label}
      {current === k && (
        <span className="sort-arrow">{dir === 'asc' ? ' ▲' : ' ▼'}</span>
      )}
    </button>
  </th>
);

// ── Sortable Card Component ──
interface SortableCardProps {
  entry: EntrySummary;
  section: string;
  group?: GroupSummary;
  isSocial: boolean;
  userDisp: string;
  customLabel: string;
  showAllPasswords: boolean;
  revealedPassword?: string;
  onToggleFavorite: (id: string, curr: boolean) => void;
  onCopyPassword: (id: string) => void;
  onCopyUsername: (u: string) => void;
  onEdit: (id: string) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onInfo: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: EntrySummary) => void;
}

const EntryCard: React.FC<SortableCardProps> = ({
  entry, section, group, isSocial, userDisp, customLabel,
  showAllPasswords, revealedPassword,
  onToggleFavorite, onCopyPassword, onCopyUsername,
  onEdit, onTrash, onRestore, onDelete, onInfo, onContextMenu,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.entry_id, disabled: section !== 'favorites' });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.6 : 1,
  };

  const badgeStyle = group ? { background: group.color } : {};
  const initial = entry.title.charAt(0).toUpperCase();

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={`entry-card ${isDragging ? 'dragging' : ''}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      layout
      onContextMenu={(e) => onContextMenu(e, entry)}
    >
      <div className="card-top-row">
        <div className="card-badge-wrap">
          <div className="card-favicon" style={badgeStyle}>{initial}</div>
          {group && <span className="card-group-tag" style={{ color: group.color }}>{group.name}</span>}
        </div>
        <div className="card-actions-mini">
          <button
            className={`card-star-btn ${entry.favorite ? 'active' : ''}`}
            onClick={() => onToggleFavorite(entry.entry_id, entry.favorite)}
            aria-label={entry.favorite ? 'Remove favorite' : 'Add to favorites'}
          >
            <Star size={14} fill={entry.favorite ? 'currentColor' : 'none'} />
          </button>
          {section === 'favorites' && (
            <div className="card-drag-handle" {...attributes} {...listeners}>
              <MoreVertical size={14} />
            </div>
          )}
        </div>
      </div>

      <div className="card-content" onClick={() => onInfo(entry.entry_id)}>
        <h3 className="card-title">{entry.title}</h3>
        <div className="card-field" onClick={(e) => { e.stopPropagation(); onCopyUsername(userDisp); }}>
          <span className="card-field-label">Username</span>
          <span className="card-field-value">{userDisp || '—'}</span>
        </div>
        <div className="card-field card-password-hover" onClick={(e) => { e.stopPropagation(); if (!isSocial) onCopyPassword(entry.entry_id); }}>
          <span className="card-field-label">Password</span>
          <div className="card-password-wrap">
            <span className="card-password-mask">
              {showAllPasswords
                ? (isSocial ? customLabel : (revealedPassword || '••••••••••••'))
                : '••••••••••••'}
            </span>
            {!isSocial && (
              <span className="card-password-reveal-hint">
                <Copy size={12} className="card-copy-icon" />
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="card-footer">
        {section === 'trash' ? (
          <>
            <button className="card-footer-btn" onClick={() => onRestore(entry.entry_id)} title="Restore" aria-label="Restore entry">
              <RefreshCw size={14} />
            </button>
            <button className="card-footer-btn danger" onClick={() => onDelete(entry.entry_id)} title="Delete Forever" aria-label="Delete permanently">
              <Trash2 size={14} />
            </button>
          </>
        ) : (
          <>
            <button className="card-footer-btn" onClick={() => onEdit(entry.entry_id)} title="Edit" aria-label="Edit entry">
              <Edit2 size={14} />
            </button>
            <button className="card-footer-btn" onClick={() => onInfo(entry.entry_id)} title="Details" aria-label="View details">
              <Info size={14} />
            </button>
            <button className="card-footer-btn danger" onClick={() => onTrash(entry.entry_id)} title="Move to Trash" aria-label="Move to trash">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
      <div className="card-glass-shine" />
    </motion.div>
  );
};

// ── Compact Table Row ──
interface TableRowProps {
  entry: EntrySummary;
  section: string;
  group?: GroupSummary;
  isSocial: boolean;
  userDisp: string;
  customLabel: string;
  showAllPasswords: boolean;
  revealedPassword?: string;
  selected: boolean;
  inlineEdit: { id: string; field: 'title' | 'username'; value: string } | null;
  onToggleSelect: (id: string) => void;
  onToggleFavorite: (id: string, curr: boolean) => void;
  onCopyPassword: (id: string) => void;
  onCopyUsername: (u: string) => void;
  onEdit: (id: string) => void;
  onTrash: (id: string) => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  onInfo: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, entry: EntrySummary) => void;
  onInlineEdit: (id: string, field: 'title' | 'username', value: string) => void;
  onInlineSave: () => void;
  onInlineChange: (value: string) => void;
}

const TableRow: React.FC<TableRowProps> = React.memo(({
  entry, section, group, userDisp, showAllPasswords, revealedPassword,
  selected, inlineEdit,
  onToggleSelect,
  onToggleFavorite, onCopyPassword, onEdit, onTrash, onInfo, onContextMenu,
  onInlineEdit, onInlineSave, onInlineChange,
}) => {
  const isEditing = inlineEdit?.id === entry.entry_id;

  return (
    <tr
      className={`entry-table-row ${selected ? 'selected' : ''}`}
      onContextMenu={(e) => onContextMenu(e, entry)}
      onClick={() => { if (!isEditing) onInfo(entry.entry_id); }}
    >
      <td className="td-fav" style={{ width: 30 }} onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" className="select-checkbox" checked={selected} onChange={() => onToggleSelect(entry.entry_id)} aria-label="Select entry" />
      </td>
      <td className="td-fav" style={{ width: 30 }}>
        <button
          className={`card-star-btn ${entry.favorite ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onToggleFavorite(entry.entry_id, entry.favorite); }}
          aria-label={entry.favorite ? 'Remove favorite' : 'Add to favorites'}
        >
          <Star size={13} fill={entry.favorite ? 'currentColor' : 'none'} />
        </button>
      </td>
      <td className="td-title" onDoubleClick={(e) => { e.stopPropagation(); onInlineEdit(entry.entry_id, 'title', entry.title); }}>
        {isEditing && inlineEdit?.field === 'title' ? (
          <input className="inline-edit-input" value={inlineEdit.value} onChange={(e) => onInlineChange(e.target.value)} onBlur={onInlineSave} onKeyDown={(e) => { if (e.key === 'Enter') onInlineSave(); if (e.key === 'Escape') onInfo(entry.entry_id); }} autoFocus onClick={(e) => e.stopPropagation()} />
        ) : entry.title}
      </td>
      <td className="td-username" onDoubleClick={(e) => { e.stopPropagation(); onInlineEdit(entry.entry_id, 'username', userDisp); }}>
        {isEditing && inlineEdit?.field === 'username' ? (
          <input className="inline-edit-input" value={inlineEdit.value} onChange={(e) => onInlineChange(e.target.value)} onBlur={onInlineSave} onKeyDown={(e) => { if (e.key === 'Enter') onInlineSave(); if (e.key === 'Escape') onInfo(entry.entry_id); }} autoFocus onClick={(e) => e.stopPropagation()} />
        ) : (userDisp || '—')}
      </td>
      <td className="td-group">{group?.name || '—'}</td>
      <td className="td-password">
        <span className={`table-password ${showAllPasswords ? 'revealed' : ''}`}>
          {showAllPasswords ? (revealedPassword || '••••••••••••') : '••••••••••••'}
        </span>
      </td>
      <td className="td-actions">
        <button className="action-btn" onClick={(e) => { e.stopPropagation(); onCopyPassword(entry.entry_id); }} title="Copy password" aria-label="Copy password">
          <Copy size={13} />
        </button>
        <button className="action-btn" onClick={(e) => { e.stopPropagation(); onEdit(entry.entry_id); }} title="Edit" aria-label="Edit entry">
          <Edit2 size={13} />
        </button>
        <button className="action-btn danger" onClick={(e) => { e.stopPropagation(); onTrash(entry.entry_id); }} title="Trash" aria-label="Move to trash">
          <Trash2 size={13} />
        </button>
      </td>
    </tr>
  );
});

// ── Skeleton Loader ──
const SkeletonLoader: React.FC<{ view: ViewMode }> = ({ view }) => {
  const items = [1, 2, 3, 4, 5, 6];
  if (view === 'table') {
    return (
      <table className="entry-table entry-table-compact">
        <thead>
          <tr>{[1,2,3,4,5].map(i => <th key={i}><div className="skeleton skeleton-th" /></th>)}</tr>
        </thead>
        <tbody>
          {items.map(i => (
            <tr key={i}>
              {[1,2,3,4,5].map(j => <td key={j}><div className="skeleton skeleton-td" /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  return (
    <div className="skeleton-cards">
      {items.map(i => (
        <div key={i} className="skeleton-card">
          <div className="skeleton skeleton-icon" />
          <div className="skeleton skeleton-line w-60" />
          <div className="skeleton skeleton-line w-40" />
          <div className="skeleton skeleton-line w-50" />
        </div>
      ))}
    </div>
  );
};

// ── Main View ──
const EntryTable: React.FC<EntryTableProps> = React.memo(({
  entries, section, onToggleFavorite, onTrash, onRestore,
  onDelete, onAddClick, onEditClick, onInfoClick,
  showAllPasswords, groups, onShowToast,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('card');
  const [items, setItems] = useState<EntrySummary[]>(entries);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, string>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const { sorted, sortKey, sortDir, toggleSort } = useSortableEntries(items, groups);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; entry: EntrySummary } | null>(null);
  const [loading, setLoading] = useState(false);
  const [inlineEdit, setInlineEdit] = useState<{ id: string; field: 'title' | 'username'; value: string } | null>(null);

  const startInlineEdit = useCallback((id: string, field: 'title' | 'username', currentValue: string) => {
    setInlineEdit({ id, field, value: currentValue });
  }, []);

  const saveInlineEdit = useCallback(async () => {
    if (!inlineEdit) return;
    try {
      const entry = items.find(e => e.entry_id === inlineEdit.id);
      if (entry) {
        const updates: Partial<EntrySummary> = {};
        updates[inlineEdit.field] = inlineEdit.value;
        await invoke('update_entry', { input: { entry_id: inlineEdit.id, title: updates.title || entry.title, username: updates.username || entry.username, url: entry.url, password: '', favorite: entry.favorite, trashed: entry.trashed } });
        onShowToast?.('Updated.', 'success');
      }
    } catch { onShowToast?.('Failed to update.', 'error'); }
    setInlineEdit(null);
  }, [inlineEdit, items]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === sorted.length) { setSelectedIds(new Set()); }
    else { setSelectedIds(new Set(sorted.map(e => e.entry_id))); }
  }, [sorted, selectedIds]);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const bulkTrash = useCallback(() => {
    selectedIds.forEach(id => onTrash(id));
    clearSelection();
  }, [selectedIds, onTrash, clearSelection]);

  const bulkFavorite = useCallback(() => {
    selectedIds.forEach(id => {
      const entry = items.find(e => e.entry_id === id);
      if (entry) onToggleFavorite(id, entry.favorite);
    });
    clearSelection();
  }, [selectedIds, items, onToggleFavorite, clearSelection]);
  const sensorConfig = useMemo(() => ({ activationConstraint: { distance: 5 } }), []);
  const sensors = useSensors(
    useSensor(PointerSensor, sensorConfig),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    setItems(entries);
    setCurrentPage(1);
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 400);
    return () => clearTimeout(timer);
  }, [entries, section]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.entry_id === active.id);
        const newIndex = prev.findIndex((i) => i.entry_id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleCopyPassword = useCallback(async (id: string) => {
    try {
      const secrets = await invoke<{ password: string }>('get_entry_secrets', { entryId: id });
      await navigator.clipboard.writeText(secrets.password);
    } catch (e) { console.error('copy failed', e); }
  }, []);

  const handleCopyUsername = useCallback(async (u: string) => {
    try { await navigator.clipboard.writeText(u); } catch {}
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent, entry: EntrySummary) => {
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY, entry });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const buildContextItems = useCallback((entry: EntrySummary): ContextMenuItem[] => {
    const m = entry.username.match(/^\$\$(google|apple|facebook|crypto)\$\$(.*)$/);
    const isSocial = !!(m && m[1] !== 'crypto');
    const items: ContextMenuItem[] = [
      { label: 'Copy Password', icon: <Key size={14} />, onClick: () => handleCopyPassword(entry.entry_id) },
      { label: 'Copy Username', icon: <Copy size={14} />, onClick: () => handleCopyUsername(entry.username), divider: true },
      { label: 'Edit', icon: <Edit2 size={14} />, onClick: () => onEditClick(entry.entry_id) },
      { label: 'View Details', icon: <Info size={14} />, onClick: () => onInfoClick(entry.entry_id) },
      { label: entry.favorite ? 'Remove Favorite' : 'Add to Favorites', icon: <Star size={14} />, onClick: () => onToggleFavorite(entry.entry_id, entry.favorite) },
    ];
    if (section === 'trash') {
      items.push(
        { label: 'Restore', icon: <RefreshCw size={14} />, onClick: () => onRestore(entry.entry_id), divider: true },
        { label: 'Delete Forever', icon: <Trash2 size={14} />, onClick: () => onDelete(entry.entry_id), danger: true },
      );
    } else {
      items.push(
        { label: 'Move to Trash', icon: <Trash2 size={14} />, onClick: () => onTrash(entry.entry_id), danger: true, divider: true },
      );
    }
    return items;
  }, [handleCopyPassword, handleCopyUsername, onEditClick, onInfoClick, onToggleFavorite, onRestore, onDelete, onTrash, section]);

  useEffect(() => {
    if (!showAllPasswords) { setVisiblePasswords({}); return; }
    const loadAll = async () => {
      const next: Record<string, string> = {};
      for (const entry of entries) {
        if (entry.username.includes('$$google$$') || entry.username.includes('$$apple$$')) continue;
        try {
          const secrets = await invoke<{ password: string }>('get_entry_secrets', { entryId: entry.entry_id });
          next[entry.entry_id] = secrets.password;
        } catch {}
      }
      setVisiblePasswords(next);
    };
    loadAll();
  }, [entries, showAllPasswords]);

  if (loading) {
    return <SkeletonLoader view={viewMode} />;
  }

  if (entries.length === 0) {
    const sectionConfig: Record<string, { title: string; desc: string; illustration: 'vault' | 'trash' | 'favorites'; action?: { label: string; onClick: () => void } }> = {
      trash: { title: 'Trash is empty', desc: 'Deleted accounts will appear here. They stay safely encrypted until you permanently remove them.', illustration: 'trash' },
      favorites: { title: 'No favorites yet', desc: 'Star your most-used accounts to access them quickly from one place.', illustration: 'favorites' },
    };
    const cfg = sectionConfig[section] || { title: 'No accounts saved yet', desc: 'Your encrypted vault is ready. Add your first account to get started.', illustration: 'vault', action: { label: 'Add Your First Account', onClick: onAddClick } };

    return (
      <EmptyState
        illustration={cfg.illustration}
        title={cfg.title}
        description={cfg.desc}
        action={cfg.action}
      />
    );
  }

  const totalPages = Math.ceil(sorted.length / ITEMS_PER_PAGE);
  const paginated = sorted.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="entry-grid-view">
      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            className="multi-select-bar"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <span className="multi-select-count">{selectedIds.size}</span> selected
            {section !== 'trash' && (
              <button className="btn btn-ghost" onClick={bulkFavorite} style={{ padding: '4px 10px', fontSize: 12 }}>
                <Star size={13} /> Favorite
              </button>
            )}
            <button className="btn btn-ghost" onClick={bulkTrash} style={{ padding: '4px 10px', fontSize: 12, color: 'var(--danger)' }}>
              <Trash2 size={13} /> {section === 'trash' ? 'Delete' : 'Trash'}
            </button>
            <button className="btn btn-ghost" onClick={clearSelection} style={{ padding: '4px 10px', fontSize: 12, marginLeft: 'auto' }}>
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View toggle bar */}
      <div className="view-toggle-bar">
        <div className="view-toggle-group" role="radiogroup" aria-label="View mode">
          <button
            className={`view-toggle-btn ${viewMode === 'card' ? 'active' : ''}`}
            onClick={() => setViewMode('card')}
            title="Card view"
            aria-label="Card view"
            role="radio"
            aria-checked={viewMode === 'card'}
          >
            <LayoutGrid size={15} />
          </button>
          <button
            className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
            onClick={() => setViewMode('table')}
            title="Table view"
            aria-label="Table view"
            role="radio"
            aria-checked={viewMode === 'table'}
          >
            <List size={15} />
          </button>
        </div>
        <span className="view-toggle-count">{sorted.length} account{sorted.length !== 1 ? 's' : ''}</span>
      </div>

      {viewMode === 'table' ? (
        /* ── Compact Table View ── */
        <div className="entry-table-wrap">
          <table className="entry-table entry-table-compact" aria-label="Password entries">
            <thead>
              <tr>
                <th className="th-fav" style={{ width: 30 }}>
                  <input type="checkbox" className="select-checkbox" checked={selectedIds.size === sorted.length && sorted.length > 0} onChange={selectAll} aria-label="Select all" />
                </th>
                <th className="th-fav" style={{ width: 30 }} />
                <SortTh label="Title" k="title" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Username" k="username" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <SortTh label="Group" k="group" current={sortKey} dir={sortDir} onSort={toggleSort} />
                <th>Password</th>
                <th className="th-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {paginated.map((entry) => {
                  const match = entry.username.match(/^\$\$(google|apple|facebook|crypto)\$\$(.*)$/);
                  const customType = match ? match[1] : null;
                  const userDisp = displayUsername(entry.username);
                  const group = groups.find((g) => g.group_id === entry.group_id);
                  return (
                    <TableRow
                      key={entry.entry_id}
                      entry={entry}
                      section={section}
                      group={group}
                      isSocial={!!(customType && customType !== 'crypto')}
                      userDisp={userDisp}
                      customLabel={customType || ''}
                      showAllPasswords={showAllPasswords}
                      revealedPassword={visiblePasswords[entry.entry_id]}
                      selected={selectedIds.has(entry.entry_id)}
                      inlineEdit={inlineEdit}
                      onToggleSelect={toggleSelect}
                      onToggleFavorite={onToggleFavorite}
                      onCopyPassword={handleCopyPassword}
                      onCopyUsername={handleCopyUsername}
                      onEdit={onEditClick}
                      onTrash={onTrash}
                      onRestore={onRestore}
                      onDelete={onDelete}
                      onInfo={onInfoClick}
                      onContextMenu={handleContextMenu}
                      onInlineEdit={startInlineEdit}
                      onInlineSave={saveInlineEdit}
                      onInlineChange={(val) => setInlineEdit(prev => prev ? { ...prev, value: val } : null)}
                    />
                  );
                })}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      ) : (
        /* ── Card View (existing) ── */
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((i) => i.entry_id)} strategy={verticalListSortingStrategy}>
            <div className="entry-cards-container">
              <AnimatePresence>
                {paginated.map((entry) => {
                  const match = entry.username.match(/^\$\$(google|apple|facebook|crypto)\$\$(.*)$/);
                  const customType = match ? match[1] : null;
                  const userDisp = displayUsername(entry.username);
                  const group = groups.find((g) => g.group_id === entry.group_id);
                  const isSocial = !!(customType && customType !== 'crypto');
                  let customLabel = customType ? `${customType.charAt(0).toUpperCase()}${customType.slice(1)} Login` : '';

                  return (
                    <EntryCard
                      key={entry.entry_id}
                      entry={entry}
                      section={section}
                      group={group}
                      isSocial={isSocial}
                      userDisp={userDisp}
                      customLabel={customLabel}
                      showAllPasswords={showAllPasswords}
                      revealedPassword={visiblePasswords[entry.entry_id]}
                      onToggleFavorite={onToggleFavorite}
                      onCopyPassword={handleCopyPassword}
                      onCopyUsername={handleCopyUsername}
                      onEdit={onEditClick}
                      onTrash={onTrash}
                      onRestore={onRestore}
                      onDelete={onDelete}
                      onInfo={onInfoClick}
                      onContextMenu={handleContextMenu}
                    />
                  );
                })}
              </AnimatePresence>
            </div>
          </SortableContext>
        </DndContext>
      )}

      {totalPages > 1 && (
        <div className="pagination" role="navigation" aria-label="Pagination">
          <button
            className="btn btn-ghost"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
          </button>
          <span>Page {currentPage} of {totalPages}</span>
          <button
            className="btn btn-ghost"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
            aria-label="Next page"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Context Menu */}
      <AnimatePresence>
        {ctxMenu && (
          <ContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            items={buildContextItems(ctxMenu.entry)}
            onClose={closeCtxMenu}
          />
        )}
      </AnimatePresence>
    </div>
  );
});

export default EntryTable;
