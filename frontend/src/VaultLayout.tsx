import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Sidebar, { Section } from './Sidebar';
import EntryTable from './EntryTable';
import FolderTree from './FolderTree';
import AddEntryModal from './AddEntryModal';
import { invoke, EntrySummary, GroupSummary } from './api';
import { Search, Plus, CheckCircle2, XCircle, Eye, EyeOff, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import InfoModal from './InfoModal';
import SettingsView from './SettingsView';
import MiniVaultView from './MiniVaultView';
import MergeGroupsModal from './MergeGroupsModal';
import RenameGroupModal from './RenameGroupModal';
import DashboardView from './DashboardView';
import { normalizedEmailKey, displayUsername, sortEmailFilterOptions, isEmailLike } from './entryDisplay';

interface VaultLayoutProps {
  onLocked: () => void;
}

const VaultLayout: React.FC<VaultLayoutProps> = ({ onLocked }) => {
  const [section, setSection] = useState<Section>('all');
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
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Modals state
  const [groupRibbonExpanded, setGroupRibbonExpanded] = useState(true);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [renameGroup, setRenameGroup] = useState<GroupSummary | null>(null);

  const [infoEntry, setInfoEntry] = useState<EntrySummary | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'trash' | 'delete' | 'restore' | 'lock' | 'showAllPasswords' | 'deleteGroup';
    id?: string;
  } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

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
    } catch (e) {
      console.error('fetch failed', e);
    }
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

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
    if (section === 'dashboard') {
      setEntries([]);
      return;
    }

    let source: EntrySummary[];
    switch (section) {
      case 'favorites': source = favEntries; break;
      case 'trash': source = trashEntries; break;
      default: source = allEntries;
    }

    if (section === 'tree') {
      if (selectedGroupId) {
        source = source.filter((entry) => entry.group_id === selectedGroupId);
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        source = source.filter((entry) => {
          if (!entry.group_id) {
            return 'uncategorized'.includes(q);
          }
          const g = groups.find((gr) => gr.group_id === entry.group_id);
          if (!g) return false;
          return g.name.toLowerCase().includes(q);
        });
      }
      setEntries(source);
      return;
    }

    if (selectedGroupId) {
      source = source.filter((entry) => entry.group_id === selectedGroupId);
    }

    if (emailFilter) {
      source = source.filter((e) => normalizedEmailKey(e.username) === emailFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      source = source.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.username.toLowerCase().includes(q) ||
          e.url.toLowerCase().includes(q),
      );
    }

    setEntries(source);
  }, [section, allEntries, favEntries, trashEntries, search, emailFilter, selectedGroupId, groups]);

  const handleSaved = (title: string) => {
    setShowModal(false);
    showToast(`"${title}" saved to vault.`);
    fetchAll();
  };

  const handleToggleFavorite = async (id: string, current: boolean) => {
    try {
      await invoke('set_favorite', { entryId: id, favorite: !current });
      fetchAll();
    } catch {
      showToast('Failed to update favorite.', 'error');
    }
  };

  const handleTrash = async (id: string) => {
    setConfirmAction({ type: 'trash', id });
  };
  
  const executeTrash = async (id: string) => {
    try {
      await invoke('move_to_trash', { entryId: id });
      showToast('Moved to trash.');
      fetchAll();
    } catch {
      showToast('Failed to move to trash.', 'error');
    }
  };

  const handleRestore = async (id: string) => {
    setConfirmAction({ type: 'restore', id });
  };
  
  const executeRestore = async (id: string) => {
    try {
      await invoke('restore_from_trash', { entryId: id });
      showToast('Restored from trash.');
      fetchAll();
    } catch {
      showToast('Failed to restore.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    setConfirmAction({ type: 'delete', id });
  };
  
  const executeDelete = async (id: string) => {
    try {
      await invoke('delete_entry', { entryId: id });
      showToast('Permanently deleted.');
      fetchAll();
    } catch {
      showToast('Failed to delete.', 'error');
    }
  };

  const handleDeleteGroup = async (id: string) => {
    setConfirmAction({ type: 'deleteGroup', id });
  };

  const executeDeleteGroup = async (id: string) => {
    try {
      await invoke('delete_group', { groupId: id, group_id: id });
      showToast('Group deleted.');
      fetchAll();
    } catch (e: any) {
      showToast(`Failed to delete group: ${e}`, 'error');
    }
  };

  const handleCreateGroup = async (name: string, color: string) => {
    try {
      await invoke('create_group', { input: { name, color } });
      showToast(`Group "${name}" created.`);
      fetchAll();
    } catch (e: any) {
      showToast(e?.message || 'Failed to create group.', 'error');
    }
  };

  const handleRenameGroup = async (name: string) => {
    if (!renameGroup) return;
    try {
      await invoke<GroupSummary>('update_group', { input: { group_id: renameGroup.group_id, name } });
      showToast(`Group renamed to "${name}".`);
      setRenameGroup(null);
      fetchAll();
    } catch (e: any) {
      showToast(e?.message || 'Failed to rename group.', 'error');
    }
  };

  const handleMergeGroups = async (sourceGroupIds: string[], name: string, color: string) => {
    try {
      await invoke<GroupSummary>('merge_groups', {
        input: { source_group_ids: sourceGroupIds, name, color },
      });
      showToast(`Merged into "${name}".`);
      setMergeModalOpen(false);
      setSelectedGroupId('');
      fetchAll();
    } catch (e: any) {
      showToast(e?.message || 'Failed to merge groups.', 'error');
    }
  };

  const treeDisplayGroups = useMemo(() => {
    if (section !== 'tree') return groups;
    let g = groups;
    if (selectedGroupId) {
      g = g.filter((x) => x.group_id === selectedGroupId);
    } else if (search.trim()) {
      const q = search.trim().toLowerCase();
      g = g.filter((gr) => gr.name.toLowerCase().includes(q));
    }
    return g;
  }, [section, groups, selectedGroupId, search]);

  const handleLock = async () => {
    setConfirmAction({ type: 'lock' });
  };
  
  const executeLock = async () => {
    try {
      await invoke('lock_vault');
    } catch {}
    onLocked();
  };

  const openAddModal = () => {
    setEditEntryId(undefined);
    setShowModal(true);
  };

  const openEditModal = (id: string) => {
    setEditEntryId(id);
    setShowModal(true);
  };

  const openInfoModal = (id: string) => {
    const entry =
      allEntries.find((e) => e.entry_id === id) ||
      favEntries.find((e) => e.entry_id === id) ||
      trashEntries.find((e) => e.entry_id === id);
    if (entry) setInfoEntry(entry);
  };

  const sectionLabels: Record<Section, string> = {
    dashboard: 'Dashboard',
    all: 'All Items',
    tree: 'Folder Tree',
    favorites: 'Favorites',
    trash: 'Trash',
    settings: 'Settings',
    mini_vault: 'Mini Vault',
  };

  return (
    <div className="vault-layout">
      <Sidebar
        section={section}
        onSectionChange={setSection}
        counts={{
          all: allEntries.length,
          favorites: favEntries.length,
          trash: trashEntries.length,
        }}
        onLock={handleLock}
      />

      <div className="main-content">
        {section !== 'settings' && section !== 'mini_vault' && section !== 'dashboard' && (
          <div className="toolbar">
            <h1 className="toolbar-title">{sectionLabels[section]}</h1>
            <span className="toolbar-spacer" />

            {(section === 'all' || section === 'favorites' || section === 'trash') && (
              <select
                className="toolbar-email-filter"
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                title="Filter by email or username (sorted by provider, then address)"
                aria-label="Filter by email or username"
              >
                <option value="">All emails / usernames</option>
                {emailOptionsGrouped.emails.length > 0 && (
                  <optgroup label="Email addresses (Gmail & common providers first)">
                    {emailOptionsGrouped.emails.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </optgroup>
                )}
                {emailOptionsGrouped.other.length > 0 && (
                  <optgroup label="Usernames & other">
                    {emailOptionsGrouped.other.map(({ value, label }) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            )}

            <div className="search-box">
              <span className="search-box-icon"><Search size={16} /></span>
              <input
                id="search-input"
                placeholder={section === 'tree' ? 'Search group names...' : 'Search accounts...'}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {section !== 'trash' && (
              <button
                id="add-entry-btn"
                className="btn btn-add"
                onClick={openAddModal}
              >
                <Plus size={16} /> Add Account
              </button>
            )}

            <button
              className="btn btn-ghost"
              onClick={() => {
                if (!showAllPasswords) {
                  setConfirmAction({ type: 'showAllPasswords' });
                } else {
                  setShowAllPasswords(false);
                }
              }}
              title={showAllPasswords ? 'Hide all passwords' : 'Show all passwords'}
            >
              {showAllPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        )}

        {section !== 'settings' && section !== 'mini_vault' && section !== 'dashboard' && (
          <div className={`group-filter-bar ${groupRibbonExpanded ? '' : 'collapsed'}`}>
            <button
              type="button"
              className="group-ribbon-toggle"
              onClick={() => setGroupRibbonExpanded((v) => !v)}
              title={groupRibbonExpanded ? 'Collapse group list' : 'Expand group list'}
            >
              {groupRibbonExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              <Layers size={16} />
              <span>Groups</span>
            </button>
            {!groupRibbonExpanded && (
              <span className="group-ribbon-summary">
                {selectedGroupId
                  ? groups.find((g) => g.group_id === selectedGroupId)?.name ?? 'Group'
                  : 'All groups'}
              </span>
            )}
            {groupRibbonExpanded && (
              <>
                <button
                  className={`group-chip ${selectedGroupId ? '' : 'active'}`}
                  onClick={() => setSelectedGroupId('')}
                >
                  All
                </button>
                {groups.map((group) => (
                  <button
                    key={group.group_id}
                    className={`group-chip ${selectedGroupId === group.group_id ? 'active' : ''}`}
                    onClick={() => setSelectedGroupId(group.group_id)}
                  >
                    <span className="group-color-dot" style={{ background: group.color }} />
                    {group.name}
                    {selectedGroupId === group.group_id && (
                      <span
                        className="group-clear-btn"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedGroupId('');
                        }}
                      >
                        x
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>
        )}

        <div className={`entry-list-container${section === 'dashboard' ? ' entry-list-container--flush' : ''}`}>
          {section === 'settings' ? (
            <SettingsView onShowToast={showToast} onLogout={executeLock} />
          ) : section === 'mini_vault' ? (
            <MiniVaultView onShowToast={showToast} onClose={() => setSection('all')} />
          ) : section === 'dashboard' ? (
            <DashboardView onRefreshVault={fetchAll} onOpenEntry={openInfoModal} />
          ) : section === 'tree' ? (
            <FolderTree
              entries={entries}
              groups={treeDisplayGroups}
              allGroups={groups}
              onInfoClick={openInfoModal}
              onDeleteGroup={handleDeleteGroup}
              onCreateGroup={handleCreateGroup}
              onRenameGroup={(g) => setRenameGroup(g)}
              onOpenMerge={() => setMergeModalOpen(true)}
            />
          ) : (
            <EntryTable
              entries={entries}
              section={section}
              onToggleFavorite={handleToggleFavorite}
              onTrash={handleTrash}
              onRestore={handleRestore}
              onDelete={handleDelete}
              onAddClick={openAddModal}
              onEditClick={openEditModal}
              onInfoClick={openInfoModal}
              showAllPasswords={showAllPasswords}
              groups={groups}
            />
          )}
        </div>
      </div>

      {showModal && (
        <AddEntryModal 
           editEntryId={editEntryId}
           entries={allEntries}
           onClose={() => setShowModal(false)} 
           onSaved={handleSaved} 
        />
      )}

      {infoEntry && (
        <InfoModal entry={infoEntry} onClose={() => setInfoEntry(null)} />
      )}

      {mergeModalOpen && (
        <MergeGroupsModal
          groups={groups}
          onClose={() => setMergeModalOpen(false)}
          onMerge={(ids, name, color) => void handleMergeGroups(ids, name, color)}
        />
      )}

      {renameGroup && (
        <RenameGroupModal
          group={renameGroup}
          onClose={() => setRenameGroup(null)}
          onSave={(name) => void handleRenameGroup(name)}
        />
      )}

      {confirmAction && (
        <ConfirmModal
          title={
            confirmAction.type === 'delete' ? 'Delete Permanently' :
            confirmAction.type === 'deleteGroup' ? 'Delete Group' :
            confirmAction.type === 'trash' ? 'Move to Trash' :
            confirmAction.type === 'restore' ? 'Recover Account' :
            confirmAction.type === 'showAllPasswords' ? 'Show All Passwords' :
            'Lock Vault'
          }
          message={
            confirmAction.type === 'delete' ? 'This will permanently delete the account. This action cannot be undone.' :
            confirmAction.type === 'deleteGroup' ? 'Are you sure you want to delete this group? All accounts inside will be moved to Uncategorized.' :
            confirmAction.type === 'trash' ? 'Are you sure you want to move this account to the trash?' :
            confirmAction.type === 'restore' ? 'This will restore the account to your main list.' :
            confirmAction.type === 'showAllPasswords' ? 'This will expose all your credentials on screen. Are you sure you are in a safe and private area?' :
            'Your session will be ended and the vault will be locked.'
          }
          confirmText={
            confirmAction.type === 'delete' ? 'Delete Permanently' :
            confirmAction.type === 'deleteGroup' ? 'Delete Group' :
            confirmAction.type === 'trash' ? 'Move to Trash' :
            confirmAction.type === 'restore' ? 'Recover' :
            confirmAction.type === 'showAllPasswords' ? 'Yes, Show Passwords' :
            'Lock Vault'
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

      {toast && (
        <div className={`toast ${toast.type}`}>
          <span>
            {toast.type === 'success' ? <CheckCircle2 size={16} color="var(--success)" /> : <XCircle size={16} color="var(--danger)" />}
          </span>
          {toast.msg}
        </div>
      )}
    </div>
  );
};

export default VaultLayout;
