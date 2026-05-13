import React, { useEffect, useMemo, useState } from 'react';
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
  Edit2, Info, ChevronLeft, ChevronRight, ExternalLink,
  Eye, Lock, MoreVertical,
} from 'lucide-react';
import { displayUsername } from './entryDisplay';

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
}

// ── Sortable Card Component ──────────────────────────────────────────────────
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
}

const EntryCard: React.FC<SortableCardProps> = ({
  entry, section, group, isSocial, userDisp, customLabel,
  showAllPasswords, revealedPassword,
  onToggleFavorite, onCopyPassword, onCopyUsername,
  onEdit, onTrash, onRestore, onDelete, onInfo,
}) => {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: entry.entry_id, disabled: section !== 'favorites' });

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
        <div className="card-field" onClick={(e) => { e.stopPropagation(); if (!isSocial) onCopyPassword(entry.entry_id); }}>
           <span className="card-field-label">Password</span>
           <div className="card-password-wrap">
              <span className="card-password-mask">
                {showAllPasswords
                  ? (isSocial ? customLabel : (revealedPassword || '••••••••••••'))
                  : '••••••••••••'}
              </span>
              {!isSocial && <Copy size={12} className="card-copy-icon" />}
           </div>
        </div>
      </div>

      <div className="card-footer">
        {section === 'trash' ? (
          <>
            <button className="card-footer-btn" onClick={() => onRestore(entry.entry_id)} title="Restore">
              <RefreshCw size={14} />
            </button>
            <button className="card-footer-btn danger" onClick={() => onDelete(entry.entry_id)} title="Delete Forever">
              <Trash2 size={14} />
            </button>
          </>
        ) : (
          <>
            <button className="card-footer-btn" onClick={() => onEdit(entry.entry_id)} title="Edit">
              <Edit2 size={14} />
            </button>
            <button className="card-footer-btn" onClick={() => onInfo(entry.entry_id)} title="Details">
              <Info size={14} />
            </button>
            <button className="card-footer-btn danger" onClick={() => onTrash(entry.entry_id)} title="Move to Trash">
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
      
      {/* Decorative glass highlight */}
      <div className="card-glass-shine" />
    </motion.div>
  );
};

// ── Main View ───────────────────────────────────────────────────────────────
const EntryTable: React.FC<EntryTableProps> = React.memo(({
  entries, section, onToggleFavorite, onTrash, onRestore,
  onDelete, onAddClick, onEditClick, onInfoClick,
  showAllPasswords, groups,
}) => {
  const [items, setItems] = useState<EntrySummary[]>(entries);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, string>>({});
  const ITEMS_PER_PAGE = 12;
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { setItems(entries); setCurrentPage(1); }, [entries, section]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.entry_id === active.id);
        const newIndex = prev.findIndex((i) => i.entry_id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
      // In a real app, we would invoke a backend command to save order here.
      console.log('New favorite order saved.');
    }
  };

  const handleCopyPassword = async (id: string) => {
    try {
      const secrets = await invoke<{ password: string }>('get_entry_secrets', { entryId: id });
      await navigator.clipboard.writeText(secrets.password);
    } catch (e) { console.error('copy failed', e); }
  };

  const handleCopyUsername = async (u: string) => {
    try { await navigator.clipboard.writeText(u); } catch {}
  };

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

  if (entries.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">
          {section === 'trash' ? <Trash2 size={48} /> : section === 'favorites' ? <Star size={48} /> : <Shield size={48} />}
        </div>
        <div className="empty-state-title">
          {section === 'trash' ? 'Trash is empty' : section === 'favorites' ? 'No favorites yet' : 'No accounts saved yet'}
        </div>
        <button className="btn btn-add" onClick={onAddClick}><Plus size={16} /> Add Your First Account</button>
      </div>
    );
  }

  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE);
  const paginated = items.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="entry-grid-view">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((i) => i.entry_id)}
          strategy={verticalListSortingStrategy}
        >
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
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </SortableContext>
      </DndContext>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="btn btn-ghost" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}><ChevronLeft size={16} /></button>
          <span>Page {currentPage} of {totalPages}</span>
          <button className="btn btn-ghost" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}><ChevronRight size={16} /></button>
        </div>
      )}
    </div>
  );
});

export default EntryTable;
