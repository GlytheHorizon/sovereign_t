import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar, { Section } from './Sidebar';
import EntryTable from './EntryTable';
import FolderTree from './FolderTree';
import AddEntryModal from './AddEntryModal';
import { invoke, EntrySummary, GroupSummary } from './api';
import { Search, Plus, Eye, EyeOff, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import InfoModal from './InfoModal';
import SettingsView from './SettingsView';
import MiniVaultView from './MiniVaultView';
import MergeGroupsModal from './MergeGroupsModal';
import RenameGroupModal from './RenameGroupModal';
import DashboardView from './DashboardView';
import IntelligenceView from './IntelligenceView';
import DecoyProtocolView from './DecoyProtocolView';
import { normalizedEmailKey, displayUsername, sortEmailFilterOptions, isEmailLike } from './entryDisplay';
import { ToastSystem, useToastSystem, ToastType } from './ToastSystem';

interface VaultLayoutProps { onLocked: () => void; }

const VaultLayout: React.FC<VaultLayoutProps> = ({ onLocked }) => {
  const [section, setSection] = useState<Section>('all');
  const [healthScore, setHealthScore] = useState<number | undefined>(undefined);
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [allEntries, setAllEntries] = useState<EntrySummary[]>([]);
  const [favEntries, setFavEntries] = useState<EntrySummary[]>([]);
  const [trashEntries, setTrashEntries] = useState<EntrySummary[]>([]);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [editEntryId, setEditEntryId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [emailFilter, setEmailFilter] = useState('');
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  // Groups ribbon: hidden by default
  const [groupRibbonExpanded, setGroupRibbonExpanded] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [renameGroup, setRenameGroup] = useState<GroupSummary | null>(null);
  const [infoEntry, setInfoEntry] = useState<EntrySummary | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'trash' | 'delete' | 'restore' | 'lock' | 'showAllPasswords' | 'deleteGroup';
    id?: string;
  } | null>(null);
  const [activeVaultName, setActiveVaultName] = useState('');

  const { toasts, showToast: _showToast, dismiss } = useToastSystem();

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    _showToast(msg, type as ToastType);
  }, [_showToast]);

  const fetchAll = useCallback(async () => {
    try {
      const [all, favs, trash, groupList] = await Promise.all([
        invoke<EntrySummary[]>('list_entries', { section: 'all' }),
        invoke<EntrySummary[]>('list_entries', { section: 'favorites' }),
        invoke<EntrySummary[]>('list_entries', { section: 'trash' }),
        invoke<GroupSummary[]>('list_groups'),
      ]);
      setAllEntries(all);
      setFavEntries(favs);
      setTrashEntries(trash);
      setGroups(groupList);
      
      // Update health score for sidebar
      invoke<any>('get_vault_dashboard_stats').then(stats => {
        setHealthScore(stats.vault_health_score);
      }).catch(() => {});

      invoke<string>('get_active_vault').then(setActiveVaultName);
    } catch (e) { console.error('fetch failed', e); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const emailOptions = useMemo(() => {
    const map = new Map<string, string>();
    const add = (e: EntrySummary) => {
      const key = normalizedEmailKey(e.username);
      if (!key) return;
      if (!map.has(key)) map.set(key, displayUsername(e.username).trim() || key);
    };
    allEntries.forEach(add);
    trashEntries.forEach(add);
    return sortEmailFilterOptions(Array.from(map.entries()).map(([value, label]) => ({ value, label })));
  }, [allEntries, trashEntries]);

  const emailOptionsGrouped = useMemo(() => {
    const emails = emailOptions.filter((o) => isEmailLike(o.label));
    const other = emailOptions.filter((o) => !isEmailLike(o.label));
    return { emails, other };
  }, [emailOptions]);

  useEffect(() => {
    if (section === 'dashboard') { setEntries([]); return; }
    let source: EntrySummary[];
    switch (section) {
      case 'favorites': source = favEntries; break;
      case 'trash': source = trashEntries; break;
      default: source = allEntries;
    }
    if (section === 'tree') {
      if (selectedGroupId) source = source.filter((e) => e.group_id === selectedGroupId);
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        source = source.filter((entry) => {
          if (!entry.group_id) return 'uncategorized'.includes(q);
          const g = groups.find((gr) => gr.group_id === entry.group_id);
          return g ? g.name.toLowerCase().includes(q) : false;
        });
      }
      setEntries(source); return;
    }
    if (selectedGroupId) source = source.filter((e) => e.group_id === selectedGroupId);
    if (emailFilter) source = source.filter((e) => normalizedEmailKey(e.username) === emailFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      source = source.filter((e) =>
        e.title.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q),
      );
    }
    setEntries(source);
  }, [section, allEntries, favEntries, trashEntries, search, emailFilter, selectedGroupId, groups]);

  const handleSaved = (title: string) => { setShowModal(false); showToast(`"${title}" saved to vault.`); fetchAll(); };
  const handleToggleFavorite = async (id: string, current: boolean) => {
    try { await invoke('set_favorite', { entryId: id, favorite: !current }); fetchAll(); }
    catch { showToast('Failed to update favorite.', 'error'); }
  };
  const handleTrash = (id: string) => setConfirmAction({ type: 'trash', id });
  const executeTrash = async (id: string) => {
    try { await invoke('move_to_trash', { entryId: id }); showToast('Moved to trash.'); fetchAll(); }
    catch { showToast('Failed to move to trash.', 'error'); }
  };
  const handleRestore = (id: string) => setConfirmAction({ type: 'restore', id });
  const executeRestore = async (id: string) => {
    try { await invoke('restore_from_trash', { entryId: id }); showToast('Restored from trash.'); fetchAll(); }
    catch { showToast('Failed to restore.', 'error'); }
  };
  const handleDelete = (id: string) => setConfirmAction({ type: 'delete', id });
  const executeDelete = async (id: string) => {
    try { await invoke('delete_entry', { entryId: id }); showToast('Permanently deleted.'); fetchAll(); }
    catch { showToast('Failed to delete.', 'error'); }
  };
  const handleDeleteGroup = (id: string) => setConfirmAction({ type: 'deleteGroup', id });
  const executeDeleteGroup = async (id: string) => {
    try { await invoke('delete_group', { groupId: id, group_id: id }); showToast('Group deleted.'); fetchAll(); }
    catch (e: any) { showToast(`Failed to delete group: ${e}`, 'error'); }
  };
  const handleCreateGroup = async (name: string, color: string) => {
    try { await invoke('create_group', { input: { name, color } }); showToast(`Group "${name}" created.`); fetchAll(); }
    catch (e: any) { showToast(e?.message || 'Failed to create group.', 'error'); }
  };
  const handleRenameGroup = async (name: string) => {
    if (!renameGroup) return;
    try {
      await invoke<GroupSummary>('update_group', { input: { group_id: renameGroup.group_id, name } });
      showToast(`Group renamed to "${name}".`); setRenameGroup(null); fetchAll();
    } catch (e: any) { showToast(e?.message || 'Failed to rename group.', 'error'); }
  };
  const handleMergeGroups = async (sourceGroupIds: string[], name: string, color: string) => {
    try {
      await invoke<GroupSummary>('merge_groups', { input: { source_group_ids: sourceGroupIds, name, color } });
      showToast(`Merged into "${name}".`); setMergeModalOpen(false); setSelectedGroupId(''); fetchAll();
    } catch (e: any) { showToast(e?.message || 'Failed to merge groups.', 'error'); }
  };

  const treeDisplayGroups = useMemo(() => {
    if (section !== 'tree') return groups;
    let g = groups;
    if (selectedGroupId) g = g.filter((x) => x.group_id === selectedGroupId);
    else if (search.trim()) { const q = search.trim().toLowerCase(); g = g.filter((gr) => gr.name.toLowerCase().includes(q)); }
    return g;
  }, [section, groups, selectedGroupId, search]);

  const handleLock = () => setConfirmAction({ type: 'lock' });
  const executeLock = async () => { try { await invoke('lock_vault'); } catch {} onLocked(); };
  const openAddModal = () => { setEditEntryId(undefined); setShowModal(true); };
  const openEditModal = (id: string) => { setEditEntryId(id); setShowModal(true); };
  const openInfoModal = (id: string) => {
    const entry = allEntries.find((e) => e.entry_id === id) ||
      favEntries.find((e) => e.entry_id === id) ||
      trashEntries.find((e) => e.entry_id === id);
    if (entry) setInfoEntry(entry);
  };

  const sectionLabels: Record<Section, string> = {
    dashboard: 'Dashboard', all: 'All Items', tree: 'Folder Tree',
    favorites: 'Favorites', trash: 'Trash', settings: 'Settings', mini_vault: 'Mini Vault',
    intelligence: 'Sovereign Intelligence',
    decoy: 'Decoy Protocol',
  };

  const showToolbar = section !== 'settings' && section !== 'mini_vault' && section !== 'dashboard' && section !== 'intelligence' && section !== 'decoy';

  return (
    <div className="vault-layout">
      <Sidebar 
        section={section} 
        onSectionChange={setSection} 
        counts={{ all: allEntries.length, favorites: favEntries.length, trash: trashEntries.length }} 
        healthScore={healthScore}
        onLock={handleLock}
        isGhostMode={activeVaultName === 'Ghost Mode'}
      />

      <div className="main-content">
        <AnimatePresence mode="wait">
          {showToolbar && (
            <motion.div
              key="toolbar"
              className="toolbar"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
            >
              <h1 className="toolbar-title">{sectionLabels[section]}</h1>
              <span className="toolbar-spacer" />

              {(section === 'all' || section === 'favorites' || section === 'trash') && (
                <select
                  className="toolbar-email-filter"
                  value={emailFilter}
                  onChange={(e) => setEmailFilter(e.target.value)}
                  title="Filter by email or username"
                  aria-label="Filter by email or username"
                >
                  <option value="">All emails / usernames</option>
                  {emailOptionsGrouped.emails.length > 0 && (
                    <optgroup label="Email addresses">
                      {emailOptionsGrouped.emails.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </optgroup>
                  )}
                  {emailOptionsGrouped.other.length > 0 && (
                    <optgroup label="Usernames & other">
                      {emailOptionsGrouped.other.map(({ value, label }) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}

              <div className="search-box">
                <span className="search-box-icon"><Search size={15} /></span>
                <input
                  id="search-input"
                  placeholder={section === 'tree' ? 'Search groups…' : 'Search accounts…'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {section !== 'trash' && (
                <motion.button
                  id="add-entry-btn"
                  className="btn btn-add"
                  onClick={openAddModal}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Plus size={15} /> Add Account
                </motion.button>
              )}

              <motion.button
                className="btn btn-ghost"
                onClick={() => {
                  if (!showAllPasswords) setConfirmAction({ type: 'showAllPasswords' });
                  else setShowAllPasswords(false);
                }}
                title={showAllPasswords ? 'Hide all passwords' : 'Show all passwords'}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
              >
                {showAllPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Groups ribbon — hidden by default, animated reveal */}
        {showToolbar && (
          <div className={`group-filter-bar ${groupRibbonExpanded ? 'expanded' : 'collapsed'}`}>
            <button
              type="button"
              className="group-ribbon-toggle"
              onClick={() => setGroupRibbonExpanded((v) => !v)}
              title={groupRibbonExpanded ? 'Collapse groups' : 'Expand groups'}
            >
              {groupRibbonExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <Layers size={14} />
              <span>Groups</span>
              {!groupRibbonExpanded && selectedGroupId && (
                <span className="group-ribbon-active-badge">
                  {groups.find((g) => g.group_id === selectedGroupId)?.name ?? 'Group'}
                </span>
              )}
            </button>

            <AnimatePresence>
              {groupRibbonExpanded && (
                <motion.div
                  className="group-chips-wrap"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: 'easeInOut' }}
                >
                  <button
                    className={`group-chip ${!selectedGroupId ? 'active' : ''}`}
                    onClick={() => setSelectedGroupId('')}
                  >All</button>
                  {groups.map((group) => (
                    <button
                      key={group.group_id}
                      className={`group-chip ${selectedGroupId === group.group_id ? 'active' : ''}`}
                      onClick={() => setSelectedGroupId(group.group_id)}
                    >
                      <span className="group-color-dot" style={{ background: group.color }} />
                      {group.name}
                      {selectedGroupId === group.group_id && (
                        <span className="group-clear-btn" onClick={(ev) => { ev.stopPropagation(); setSelectedGroupId(''); }}>×</span>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className={`entry-list-container${section === 'dashboard' ? ' entry-list-container--flush' : ''}`}>
          {section === 'settings' ? (
            <SettingsView onShowToast={showToast} onLogout={executeLock} />
          ) : section === 'mini_vault' ? (
            <MiniVaultView onShowToast={showToast} onClose={() => setSection('all')} />
          ) : section === 'dashboard' ? (
            <DashboardView onRefreshVault={fetchAll} onOpenEntry={openInfoModal} />
          ) : section === 'intelligence' ? (
            <IntelligenceView entries={allEntries} />
          ) : section === 'decoy' ? (
            <DecoyProtocolView />
          ) : section === 'tree' ? (
            <FolderTree
              entries={entries} groups={treeDisplayGroups} allGroups={groups}
              onInfoClick={openInfoModal} onDeleteGroup={handleDeleteGroup}
              onCreateGroup={handleCreateGroup} onRenameGroup={(g) => setRenameGroup(g)}
              onOpenMerge={() => setMergeModalOpen(true)}
            />
          ) : (
            <EntryTable
              entries={entries} section={section}
              onToggleFavorite={handleToggleFavorite} onTrash={handleTrash}
              onRestore={handleRestore} onDelete={handleDelete}
              onAddClick={openAddModal} onEditClick={openEditModal}
              onInfoClick={openInfoModal} showAllPasswords={showAllPasswords}
              groups={groups}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      {showModal && (
        <AddEntryModal editEntryId={editEntryId} entries={allEntries}
          onClose={() => setShowModal(false)} onSaved={handleSaved} />
      )}
      {infoEntry && <InfoModal entry={infoEntry} onClose={() => setInfoEntry(null)} />}
      {mergeModalOpen && (
        <MergeGroupsModal groups={groups} onClose={() => setMergeModalOpen(false)}
          onMerge={(ids, name, color) => void handleMergeGroups(ids, name, color)} />
      )}
      {renameGroup && (
        <RenameGroupModal group={renameGroup} onClose={() => setRenameGroup(null)}
          onSave={(name) => void handleRenameGroup(name)} />
      )}
      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.type === 'delete' ? 'Delete Permanently' :
            confirmAction.type === 'deleteGroup' ? 'Delete Group' :
            confirmAction.type === 'trash' ? 'Move to Trash' :
            confirmAction.type === 'restore' ? 'Recover Account' :
            confirmAction.type === 'showAllPasswords' ? 'Show All Passwords' : 'Lock Vault'
          }
          message={
            confirmAction.type === 'delete' ? 'This will permanently delete the account. This cannot be undone.' :
            confirmAction.type === 'deleteGroup' ? 'Delete this group? Accounts will move to Uncategorized.' :
            confirmAction.type === 'trash' ? 'Move this account to the trash?' :
            confirmAction.type === 'restore' ? 'Restore the account to your main list.' :
            confirmAction.type === 'showAllPasswords' ? 'This exposes all credentials. Are you in a private area?' :
            'Your session will be ended and the vault will be locked.'
          }
          confirmText={
            confirmAction.type === 'delete' ? 'Delete Permanently' :
            confirmAction.type === 'deleteGroup' ? 'Delete Group' :
            confirmAction.type === 'trash' ? 'Move to Trash' :
            confirmAction.type === 'restore' ? 'Recover' :
            confirmAction.type === 'showAllPasswords' ? 'Yes, Show Passwords' : 'Lock Vault'
          }
          danger={['delete', 'deleteGroup', 'trash', 'showAllPasswords', 'lock'].includes(confirmAction.type)}
          onConfirm={() => {
            if (confirmAction.type === 'delete') executeDelete(confirmAction.id!);
            if (confirmAction.type === 'deleteGroup') executeDeleteGroup(confirmAction.id!);
            if (confirmAction.type === 'trash') executeTrash(confirmAction.id!);
            if (confirmAction.type === 'restore') executeRestore(confirmAction.id!);
            if (confirmAction.type === 'lock') executeLock();
            if (confirmAction.type === 'showAllPasswords') setShowAllPasswords(true);
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* Premium Toast System */}
      <ToastSystem toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};

export default VaultLayout;
