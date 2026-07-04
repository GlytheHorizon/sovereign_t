import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder, Star, Trash2, Lock, Shield, Network,
  LayoutDashboard, Settings, Zap, Brain, Ghost, QrCode,
  ChevronLeft, ChevronRight, History, Unlock,
} from 'lucide-react';

export type Section = 'dashboard' | 'all' | 'favorites' | 'tree' | 'trash' | 'settings' | 'mini_vault' | 'intelligence' | 'decoy';

interface SidebarProps {
  section: Section;
  onSectionChange: (s: Section) => void;
  counts: { all: number; favorites: number; trash: number };
  healthScore?: number;
  onLock: () => void;
  isGhostMode?: boolean;
  recentActivity?: { action: string; time: string }[];
  vaultStatus?: 'locked' | 'unlocked' | 'synced';
}

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard',  label: 'Dashboard',   icon: <LayoutDashboard size={17} /> },
  { id: 'all',        label: 'All Items',    icon: <Folder size={17} /> },
  { id: 'tree',       label: 'Folder Tree',  icon: <Network size={17} /> },
  { id: 'favorites',  label: 'Favorites',    icon: <Star size={17} /> },
  { id: 'intelligence', label: 'Sovereign Intel', icon: <Brain size={17} /> },
  { id: 'decoy',        label: 'Decoy Protocol', icon: <Ghost size={17} /> },
  { id: 'trash',      label: 'Trash',        icon: <Trash2 size={17} /> },
  { id: 'mini_vault', label: 'Mini Vault',   icon: <Shield size={17} /> },
];

const RECENT_MAX = 5;

const Sidebar: React.FC<SidebarProps> = React.memo(({ section, onSectionChange, counts, healthScore, onLock, isGhostMode, recentActivity, vaultStatus }) => {
  const recentItems = useMemo(() => (recentActivity || []).slice(0, RECENT_MAX), [recentActivity]);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Collapse toggle */}
      <button
        className="sidebar-collapse-btn"
        onClick={() => setCollapsed(v => !v)}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Brand */}
      <div className="sidebar-header" data-tauri-drag-region>
        <div className="sidebar-brand">
          <div className="sidebar-logo-wrap">
            <motion.div
              className="sidebar-logo-pulse"
              animate={{ scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            <img src="/stv2.png" alt="Sovereign_T" className="sidebar-logo-img" />
          </div>
          {!collapsed && (
            <div>
              <div className="sidebar-brand-text">Sovereign_T</div>
              <div className="sidebar-brand-sub">Cyber Vault · Local‑First</div>
            </div>
          )}
        </div>

        <div className="sidebar-vault-status">
          <motion.span
            className="vault-status-dot"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          {!collapsed && <span className="vault-status-label">Encrypted</span>}
          <Zap size={10} className="vault-status-zap" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Main navigation">
        {NAV_ITEMS.filter(item => {
          if (isGhostMode && item.id === 'decoy') return false;
          return true;
        }).map((item) => {
          const isActive = section === item.id;
          const count = counts[item.id as 'all' | 'favorites' | 'trash'];
          return (
            <motion.button
              key={item.id}
              id={`nav-${item.id}`}
              className={`sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => onSectionChange(item.id)}
              whileHover={{ x: collapsed ? 0 : 3 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              {isActive && (
                <motion.div
                  className="sidebar-active-pill"
                  layoutId="active-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <span className="sidebar-link-icon">{item.icon}</span>
              {!collapsed && <span className="sidebar-link-label">{item.label}</span>}
              <AnimatePresence>
                {!collapsed && count !== undefined && count > 0 && (
                  <motion.span
                    className="sidebar-link-count"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </nav>

      {/* Recent activity */}
      {!collapsed && recentItems.length > 0 && (
        <div className="recent-activity">
          <div className="recent-activity-title"><History size={10} /> Recent Activity</div>
          <div className="recent-activity-list">
            {recentItems.map((r, i) => (
              <div key={i} className="recent-activity-item">
                <Zap size={10} /> {r.action}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status badge */}
      {!collapsed && vaultStatus && (
        <div className={`sidebar-status-badge ${vaultStatus}`}>
          <Unlock size={10} />
          <span>{vaultStatus === 'unlocked' ? 'Vault Open' : vaultStatus === 'locked' ? 'Locked' : 'Synced'}</span>
        </div>
      )}

      {/* Section divider */}
      <div className="sidebar-divider" />

      {/* Footer */}
      <div className="sidebar-footer">
        {!collapsed && healthScore !== undefined && (
          <div className="sidebar-health-widget">
            <div className="sidebar-health-info">
              <span className="sidebar-health-label">Security Health</span>
              <span className={`sidebar-health-pct ${healthScore < 50 ? 'bad' : healthScore < 80 ? 'warn' : 'good'}`}>
                {healthScore}%
              </span>
            </div>
            <div className="sidebar-health-track">
              <motion.div
                className="sidebar-health-fill"
                initial={{ width: 0 }}
                animate={{ width: `${healthScore}%` }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
                style={{
                  background: healthScore < 50 ? 'var(--danger)' : healthScore < 80 ? '#f59e0b' : 'var(--success)'
                }}
              />
            </div>
          </div>
        )}
        <motion.button
          id="settings-btn"
          className={`sidebar-footer-btn ${section === 'settings' ? 'active' : ''}`}
          onClick={() => onSectionChange('settings')}
          whileHover={{ x: collapsed ? 0 : 3 }}
          whileTap={{ scale: 0.97 }}
          aria-label="Settings"
        >
          <span className="sidebar-link-icon"><Settings size={17} /></span>
          {!collapsed && 'Settings'}
        </motion.button>

        <motion.button
          id="lock-vault-btn"
          className="sidebar-footer-btn lock"
          onClick={onLock}
          whileHover={{ x: collapsed ? 0 : 3 }}
          whileTap={{ scale: 0.97 }}
          aria-label="Lock vault"
        >
          <span className="sidebar-link-icon"><Lock size={17} /></span>
          {!collapsed && 'Lock Vault'}
        </motion.button>

        {!collapsed && (
          <div className="sidebar-security-badge">
            <Shield size={10} />
            <span>AES-256 · Argon2 · Local-Only</span>
          </div>
        )}
      </div>
    </aside>
  );
});

export default Sidebar;
