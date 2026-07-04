import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Sidebar, { Section } from './Sidebar';
import EntryTable from './EntryTable';
import FolderTree from './FolderTree';
import AddEntryModal from './AddEntryModal';
import { invoke, EntrySummary, GroupSummary } from './api';
import { Search, Plus, Eye, EyeOff, ChevronDown, ChevronUp, Layers, Terminal, X, Sun, Moon, Clock, Home } from 'lucide-react';
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
import EmptyState from './EmptyState';
import OnboardingWizard from './components/OnboardingWizard';
import { useSessionTimer } from './useSessionTimer';
import { useTheme } from './ThemeContext';

interface VaultLayoutProps { onLocked: () => void; }

// ── Advanced Search Parser ──
interface ParsedSearch {
  query: string;
  filters: { group?: string; favorite?: boolean; type?: string };
}
function parseSearch(input: string): ParsedSearch {
  let query = input;
  const filters: ParsedSearch['filters'] = {};
  const groupMatch = query.match(/\bgroup:(\S+)/i);
  if (groupMatch) { filters.group = groupMatch[1].toLowerCase(); query = query.replace(groupMatch[0], ''); }
  const favMatch = query.match(/\bfav(?:orite)?:(true|false|yes|no)/i);
  if (favMatch) { filters.favorite = ['true', 'yes'].includes(favMatch[1].toLowerCase()); query = query.replace(favMatch[0], ''); }
  const typeMatch = query.match(/\btype:(password|crypto|google|apple|facebook)/i);
  if (typeMatch) { filters.type = typeMatch[1].toLowerCase(); query = query.replace(typeMatch[0], ''); }
  return { query: query.trim(), filters };
}

// ── Confetti ──
const Confetti: React.FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;
  const colors = ['#00d4ff', '#9f7aea', '#f6c90e', '#48bb78', '#f56565', '#ed8936'];
  const pieces = Array.from({ length: 60 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    delay: Math.random() * 0.5,
    color: colors[i % colors.length],
    size: 4 + Math.random() * 6,
    rotation: Math.random() * 360,
  }));
  return (
    <div className="confetti-container" aria-hidden="true">
      {pieces.map(p => (
        <motion.div
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.x}%`,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            borderRadius: 2,
            rotate: p.rotation,
          }}
          initial={{ y: -20, opacity: 1 }}
          animate={{ y: '100vh', opacity: 0, rotate: p.rotation + 360 }}
          transition={{ duration: 1.5 + Math.random(), delay: p.delay, ease: 'easeIn' }}
        />
      ))}
    </div>
  );
};

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
  const [groupRibbonExpanded, setGroupRibbonExpanded] = useState(false);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [renameGroup, setRenameGroup] = useState<GroupSummary | null>(null);
  const [infoEntry, setInfoEntry] = useState<EntrySummary | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'trash' | 'delete' | 'restore' | 'lock' | 'showAllPasswords' | 'deleteGroup';
    id?: string;
  } | null>(null);
  const [activeVaultName, setActiveVaultName] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [errorRetry, setErrorRetry] = useState<{ count: number }>({ count: 0 });
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { toasts, showToast: _showToast, dismiss } = useToastSystem();

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success', undoAction?: () => void, undoLabel?: string) => {
    _showToast(msg, type as ToastType, undoAction, undoLabel);
  }, [_showToast]);

  // ── Lock operations (must be defined before session timer) ──
  const executeLock = useCallback(async () => { try { await invoke('lock_vault'); } catch {} onLocked(); }, [onLocked]);
  const handleLock = useCallback(() => setConfirmAction({ type: 'lock' }), []);

  // Session auto-lock timer (auto-locks without confirmation when expired)
  const { remaining, isWarning, reset: resetTimer } = useSessionTimer(executeLock);
  const { theme, toggle: toggleTheme } = useTheme();

  // ── Global keyboard navigation ──
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Ctrl+L to lock vault
      if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
        e.preventDefault();
        handleLock();
      }
      // Escape to close modals / clear search
      if (e.key === 'Escape') {
        if (search) setSearch('');
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [search]);

  // ── Detect first run for onboarding ──
  useEffect(() => {
    const onboarded = localStorage.getItem('svt_onboarded');
    if (!onboarded) {
      setShowOnboarding(true);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setFetchError(null);
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

      invoke<any>('get_vault_dashboard_stats').then(stats => {
        setHealthScore(stats.vault_health_score);
      }).catch(() => {});

      invoke<string>('get_active_vault').then(setActiveVaultName);
    } catch (e) { console.error('fetch failed', e); setFetchError('Failed to load vault data. Check connection and try again.'); }
  }, []);

  useEffect(() => { fetchAll().then(() => setInitialLoad(false)); }, [fetchAll]);

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

  // ── Advanced search filter ──
  const filteredEntries = useMemo(() => {
    if (section === 'dashboard') return [];
    let source: EntrySummary[];
    switch (section) {
      case 'favorites': source = favEntries; break;
      case 'trash': source = trashEntries; break;
      default: source = allEntries;
    }

    const parsed = parseSearch(search);
    let result = source;

    // group filter
    if (parsed.filters.group) {
      result = result.filter(e => {
        const g = groups.find(gr => gr.group_id === e.group_id);
        return g && g.name.toLowerCase().includes(parsed.filters.group!);
      });
    }
    // favorite filter
    if (parsed.filters.favorite !== undefined) {
      result = result.filter(e => e.favorite === parsed.filters.favorite);
    }
    // type filter
    if (parsed.filters.type) {
      result = result.filter(e => {
        const match = e.username.match(/^\$\$(google|apple|facebook|crypto)\$\$(.*)$/);
        const entryType = match ? match[1] : 'password';
        return entryType === parsed.filters.type;
      });
    }

    // text search
    if (parsed.query) {
      const q = parsed.query.toLowerCase();
      result = result.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.username.toLowerCase().includes(q) ||
        e.url.toLowerCase().includes(q)
      );
    }

    if (section === 'tree') {
      if (selectedGroupId) result = result.filter((e) => e.group_id === selectedGroupId);
      return result;
    }

    if (selectedGroupId) result = result.filter((e) => e.group_id === selectedGroupId);
    if (emailFilter) result = result.filter((e) => normalizedEmailKey(e.username) === emailFilter);

    return result;
  }, [section, allEntries, favEntries, trashEntries, search, emailFilter, selectedGroupId, groups]);

  const handleSaved = (title: string) => {
    setShowModal(false);
    showToast(`"${title}" saved to vault.`);
    fetchAll();
  };
  const handleToggleFavorite = async (id: string, current: boolean) => {
    try { await invoke('set_favorite', { entryId: id, favorite: !current }); fetchAll(); }
    catch { showToast('Failed to update favorite.', 'error'); }
  };
  const handleTrash = (id: string) => setConfirmAction({ type: 'trash', id });
  const executeTrash = async (id: string) => {
    try {
      await invoke('move_to_trash', { entryId: id });
      showToast('Moved to trash.', 'success', () => { invoke('restore_from_trash', { entryId: id }).then(fetchAll); }, 'Undo');
      fetchAll();
    } catch { showToast('Failed to move to trash.', 'error'); }
  };
  const handleRestore = (id: string) => setConfirmAction({ type: 'restore', id });
  const executeRestore = async (id: string) => {
    try { await invoke('restore_from_trash', { entryId: id }); showToast('Restored from trash.'); fetchAll(); }
    catch { showToast('Failed to restore.', 'error'); }
  };
  const handleDelete = (id: string) => setConfirmAction({ type: 'delete', id });
  const executeDelete = async (id: string) => {
    try {
      await invoke('delete_entry', { entryId: id }); showToast('Permanently deleted.', 'success', () => { /* undo requires backup - not available */ }, 'Undo (unavailable)');
      fetchAll();
    } catch { showToast('Failed to delete.', 'error'); }
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
    else if (search.trim()) { const parsed = parseSearch(search); if (parsed.query) { const q = parsed.query.toLowerCase(); g = g.filter((gr) => gr.name.toLowerCase().includes(q)); } }
    return g;
  }, [section, groups, selectedGroupId, search]);


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

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setSearch(''); (e.target as HTMLInputElement).blur(); }
    if (e.key === 'Enter' && search.startsWith('/')) {
      e.preventDefault();
    }
  }, [search]);

  // Breadcrumb trail
  const breadcrumbs = useMemo(() => {
    const segs: { label: string; onClick?: () => void }[] = [{ label: 'Vault', onClick: () => setSection('dashboard') }];
    if (section === 'tree' && selectedGroupId) {
      const g = groups.find(gr => gr.group_id === selectedGroupId);
      if (g) segs.push({ label: 'Folders' }, { label: g.name });
    } else if (section !== 'dashboard') {
      segs.push({ label: sectionLabels[section] });
    }
    return segs;
  }, [section, selectedGroupId, groups, sectionLabels]);

  // Format remaining time
  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="vault-layout">
      <Confetti active={showConfetti} />
      <Sidebar
        section={section}
        onSectionChange={setSection}
        counts={{ all: allEntries.length, favorites: favEntries.length, trash: trashEntries.length }}
        healthScore={healthScore}
        onLock={handleLock}
        isGhostMode={activeVaultName === 'Ghost Mode'}
        vaultStatus="unlocked"
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
              {/* Breadcrumb */}
              <nav className="breadcrumb" aria-label="Breadcrumb">
                {breadcrumbs.map((cr, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="breadcrumb-sep">/</span>}
                    {cr.onClick ? (
                      <button className="breadcrumb-link" onClick={cr.onClick}>{cr.label}</button>
                    ) : (
                      <span className="breadcrumb-current">{cr.label}</span>
                    )}
                  </React.Fragment>
                ))}
              </nav>

              <span className="toolbar-spacer" />

              {/* Session timer */}
              <div className={`session-timer ${isWarning ? 'warning' : ''}`} title={`Auto-lock in ${fmtTime(remaining)}`}>
                <Clock size={13} />
                <span className="session-timer-label">{fmtTime(remaining)}</span>
              </div>

              {/* Theme toggle */}
              <motion.button
                className="btn btn-icon btn-ghost"
                onClick={toggleTheme}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
              </motion.button>

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

              {/* Advanced search box */}
              <div className="search-box search-box-advanced">
                <span className="search-box-icon"><Search size={15} /></span>
                <input
                  ref={searchInputRef}
                  id="search-input"
                  placeholder={section === 'tree' ? 'Search groups… (group:name, type:password)' : 'Search… (group:, fav:, type:)'}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  aria-label="Search entries with advanced operators"
                  title="Use operators: group:name, fav:true, type:password/crypto/google"
                />
                {search && (
                  <button className="search-box-clear" onClick={() => setSearch('')} aria-label="Clear search">
                    <X size={14} />
                  </button>
                )}
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
                className="btn btn-ghost btn-icon"
                onClick={() => {
                  if (!showAllPasswords) setConfirmAction({ type: 'showAllPasswords' });
                  else setShowAllPasswords(false);
                }}
                title={showAllPasswords ? 'Hide all passwords' : 'Show all passwords'}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.96 }}
                aria-label={showAllPasswords ? 'Hide all passwords' : 'Show all passwords'}
              >
                {showAllPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error banner */}
        {fetchError && (
          <div className="error-banner">
            <span className="error-banner-msg">{fetchError}</span>
            <button className="error-banner-retry" onClick={() => { setErrorRetry(r => ({ count: r.count + 1 })); fetchAll(); }}>
              Retry
            </button>
          </div>
        )}

        {/* Groups ribbon */}
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
              entries={filteredEntries} groups={treeDisplayGroups} allGroups={groups}
              onInfoClick={openInfoModal} onDeleteGroup={handleDeleteGroup}
              onCreateGroup={handleCreateGroup} onRenameGroup={(g) => setRenameGroup(g)}
              onOpenMerge={() => setMergeModalOpen(true)}
            />
          ) : (
            <EntryTable
              entries={filteredEntries} section={section}
              onToggleFavorite={handleToggleFavorite} onTrash={handleTrash}
              onRestore={handleRestore} onDelete={handleDelete}
              onAddClick={openAddModal} onEditClick={openEditModal}
              onInfoClick={openInfoModal} showAllPasswords={showAllPasswords}
              groups={groups} onShowToast={showToast}
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

      {/* Onboarding Wizard */}
      {showOnboarding && (
        <OnboardingWizard
          onClose={() => {
            setShowOnboarding(false);
            localStorage.setItem('svt_onboarded', 'true');
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
          }}
        />
      )}

      <ToastSystem toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};

export default VaultLayout;
