import React, { useState, useEffect, useCallback } from 'react';
import Sidebar, { Section } from './Sidebar';
import EntryTable from './EntryTable';
import AddEntryModal from './AddEntryModal';
import { invoke, EntrySummary, GroupSummary } from './api';
import { Search, Plus, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';

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
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

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

  useEffect(() => {
    let source: EntrySummary[];
    switch (section) {
      case 'favorites': source = favEntries; break;
      case 'trash': source = trashEntries; break;
      default: source = allEntries;
    }

    if (selectedGroupId) {
      source = source.filter((entry) => entry.group_id === selectedGroupId);
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
  }, [section, allEntries, favEntries, trashEntries, search, selectedGroupId]);

  const handleSaved = (title: string) => {
    setShowModal(false);
    showToast(`"${title}" saved to vault.`);
    fetchAll();
  };

  const handleToggleFavorite = async (id: string, current: boolean) => {
    try {
      await invoke('set_favorite', { entry_id: id, favorite: !current });
      fetchAll();
    } catch {
      showToast('Failed to update favorite.', 'error');
    }
  };

  const handleTrash = async (id: string) => {
    try {
      await invoke('move_to_trash', { entry_id: id });
      showToast('Moved to trash.');
      fetchAll();
    } catch {
      showToast('Failed to move to trash.', 'error');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await invoke('restore_from_trash', { entry_id: id });
      showToast('Restored from trash.');
      fetchAll();
    } catch {
      showToast('Failed to restore.', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await invoke('delete_entry', { entry_id: id });
      showToast('Permanently deleted.');
      fetchAll();
    } catch {
      showToast('Failed to delete.', 'error');
    }
  };

  const handleLock = async () => {
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

  const sectionLabels: Record<Section, string> = {
    all: 'All Items',
    favorites: 'Favorites',
    trash: 'Trash',
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
        <div className="toolbar">
          <h1 className="toolbar-title">{sectionLabels[section]}</h1>
          <span className="toolbar-spacer" />

          <div className="search-box">
            <span className="search-box-icon"><Search size={16} /></span>
            <input
              id="search-input"
              placeholder="Search accounts..."
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
            onClick={() => setShowAllPasswords((prev) => !prev)}
            title={showAllPasswords ? 'Hide all passwords' : 'Show all passwords'}
          >
            {showAllPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <div className="group-filter-bar">
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
        </div>

        <div className="entry-list-container">
          <EntryTable
            entries={entries}
            section={section}
            onToggleFavorite={handleToggleFavorite}
            onTrash={handleTrash}
            onRestore={handleRestore}
            onDelete={handleDelete}
            onAddClick={openAddModal}
            onEditClick={openEditModal}
            showAllPasswords={showAllPasswords}
          />
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
