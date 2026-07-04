import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EntrySummary, GroupSummary, invoke } from './api';
import {
  Folder, FolderOpen, ChevronRight, ChevronDown,
  FileText, Trash2, Pencil, GitMerge, Plus,
} from 'lucide-react';

interface FolderTreeProps {
  entries: EntrySummary[];
  groups: GroupSummary[];
  allGroups: GroupSummary[];
  onInfoClick: (id: string) => void;
  onDeleteGroup: (id: string) => void;
  onCreateGroup: (name: string, color: string) => void;
  onRenameGroup: (group: GroupSummary) => void;
  onOpenMerge: () => void;
}

const ENTRY_VARIANTS = {
  hidden: { opacity: 0, x: -10 },
  visible: (i: number) => ({
    opacity: 1, x: 0,
    transition: { delay: i * 0.04, type: 'spring' as const, stiffness: 340, damping: 28 },
  }),
  exit: { opacity: 0, x: -8, transition: { duration: 0.14 } },
};

const GROUP_VARIANTS = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, type: 'spring' as const, stiffness: 320, damping: 26 },
  }),
};

const FolderTree: React.FC<FolderTreeProps> = ({
  entries, groups, allGroups,
  onInfoClick, onDeleteGroup, onCreateGroup, onRenameGroup, onOpenMerge,
}) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#8A2BE2');
  const [hoveredEntry, setHoveredEntry] = useState<string | null>(null);
  const [availableColors, setAvailableColors] = useState<string[] | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    invoke<string[]>('get_unused_group_colors').then(colors => {
      if (colors && colors.length > 0) {
        setAvailableColors(colors);
        setNewGroupColor(colors[0]);
      }
    }).catch(() => {});
  }, []);

  const toggle = (id: string) => setExpandedGroups((p) => ({ ...p, [id]: !p[id] }));
  const uncategorized = entries.filter((e) => !e.group_id);

  const renderEntry = (entry: EntrySummary, index: number) => (
    <motion.div
      key={entry.entry_id}
      className="tree-item"
      custom={index}
      variants={ENTRY_VARIANTS}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
      onHoverStart={() => setHoveredEntry(entry.entry_id)}
      onHoverEnd={() => setHoveredEntry(null)}
      onClick={() => onInfoClick(entry.entry_id)}
      whileTap={{ scale: 0.98 }}
    >
      {/* connector line */}
      <div className="tree-connector">
        <div className="tree-connector-line" />
        <div className="tree-connector-dot" />
      </div>
      <motion.div
        className="tree-item-icon"
        animate={hoveredEntry === entry.entry_id ? { scale: 1.15, color: 'var(--accent)' } : { scale: 1 }}
      >
        <FileText size={13} />
      </motion.div>
      <span className="tree-item-title">{entry.title}</span>
      {hoveredEntry === entry.entry_id && (
        <motion.span
          className="tree-item-hint"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          view →
        </motion.span>
      )}
    </motion.div>
  );

  const renderGroup = (group: GroupSummary, groupEntries: EntrySummary[], index: number) => {
    const isExpanded = expandedGroups[group.group_id] === true;
    return (
      <motion.div
        key={group.group_id}
        className="tree-group"
        custom={index}
        variants={GROUP_VARIANTS}
        initial="hidden"
        animate="visible"
        layout
      >
        {/* group header */}
        <motion.div
          className="tree-group-header"
          onClick={() => toggle(group.group_id)}
          whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
          style={{ borderLeft: `3px solid ${group.color}` }}
        >
          <motion.span
            className="tree-chevron"
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
          >
            <ChevronRight size={13} />
          </motion.span>

          <motion.span
            className="tree-folder-icon"
            style={{ color: group.color }}
            animate={isExpanded ? { scale: 1.1 } : { scale: 1 }}
          >
            {isExpanded
              ? <FolderOpen size={16} fill="currentColor" fillOpacity={0.2} />
              : <Folder size={16} fill="currentColor" fillOpacity={0.2} />}
          </motion.span>

          <span className="tree-group-name">{group.name}</span>
          <span className="tree-group-count">{groupEntries.length}</span>

          <div className="tree-group-actions" onClick={(e) => e.stopPropagation()}>
            <motion.button
              type="button"
              className="action-btn"
              onClick={() => onRenameGroup(group)}
              title="Rename group"
              whileHover={{ scale: 1.1, color: 'var(--accent)' }}
              whileTap={{ scale: 0.9 }}
            >
              <Pencil size={12} />
            </motion.button>
            <motion.button
              type="button"
              className="action-btn danger"
              onClick={() => onDeleteGroup(group.group_id)}
              title="Delete group"
              whileHover={{ scale: 1.1, color: 'var(--danger)' }}
              whileTap={{ scale: 0.9 }}
            >
              <Trash2 size={12} />
            </motion.button>
          </div>
        </motion.div>

        {/* animated children */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="tree-group-items"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
            >
              {groupEntries.length === 0 ? (
                <div className="tree-empty-group">No accounts in this group</div>
              ) : (
                groupEntries.map((e, i) => renderEntry(e, i))
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  };

  return (
    <div className="folder-tree-container">
      <div className="tree-graph-header-label">Folder Tree</div>
      {/* toolbar */}
      <div className="tree-toolbar">
        <input
          className="form-input tree-name-input"
          placeholder="New group name…"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
        />
        <label className="tree-color-label" title="Pick group color">
          <input
            type="color"
            className="color-picker"
            value={newGroupColor}
            onChange={(e) => setNewGroupColor(e.target.value)}
          />
          <span className="tree-color-swatch" style={{ background: newGroupColor }} />
        </label>
        {availableColors && availableColors.length > 0 && (
          <div className="tree-color-suggestions">
            {availableColors.slice(0, 6).map(c => (
              <button
                key={c}
                type="button"
                className={`tree-color-chip ${c === newGroupColor ? 'active' : ''}`}
                style={{ background: c }}
                onClick={() => setNewGroupColor(c)}
                title={c}
              />
            ))}
          </div>
        )}
        <motion.button
          className="btn btn-primary"
          onClick={() => { if (newGroupName.trim()) { onCreateGroup(newGroupName.trim(), newGroupColor); setNewGroupName(''); } }}
          disabled={!newGroupName.trim()}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          <Plus size={14} /> Create
        </motion.button>
        <motion.button
          type="button"
          className="btn btn-ghost"
          onClick={onOpenMerge}
          disabled={allGroups.length < 2}
          title={allGroups.length < 2 ? 'Need at least two groups' : 'Merge groups'}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
        >
          <GitMerge size={14} /> Merge
        </motion.button>
      </div>

      {/* group nodes */}
      <div className="tree-graph">
        {/* uncategorized at the top */}
        {uncategorized.length > 0 && (
          <motion.div
            className="tree-group"
            key="uncategorized"
            initial="hidden"
            animate="visible"
            layout
          >
            <motion.div
              className="tree-group-header"
              onClick={() => toggle('uncategorized')}
              whileHover={{ backgroundColor: 'rgba(255,255,255,0.04)' }}
              style={{ borderLeft: '3px solid var(--text-muted)' }}
            >
              <motion.span
                className="tree-chevron"
                animate={{ rotate: expandedGroups['uncategorized'] === true ? 90 : 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              >
                <ChevronRight size={13} />
              </motion.span>
              <span className="tree-folder-icon" style={{ color: 'var(--text-muted)' }}>
                <Folder size={16} />
              </span>
              <span className="tree-group-name">Uncategorized</span>
              <span className="tree-group-count">{uncategorized.length}</span>
            </motion.div>
            <AnimatePresence>
              {expandedGroups['uncategorized'] === true && (
                <motion.div
                  className="tree-group-items"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                >
                  {uncategorized.map((e, i) => renderEntry(e, i))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {/* other groups */}
        {groups.map((group, idx) =>
          renderGroup(group, entries.filter((e) => e.group_id === group.group_id), idx)
        )}
      </div>
    </div>
  );
};

export default FolderTree;
