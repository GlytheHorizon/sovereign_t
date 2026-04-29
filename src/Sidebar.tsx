import React from 'react';
import { Folder, Star, Trash2, Lock, Shield } from 'lucide-react';

export type Section = 'all' | 'favorites' | 'trash';

interface SidebarProps {
  section: Section;
  onSectionChange: (s: Section) => void;
  counts: { all: number; favorites: number; trash: number };
  onLock: () => void;
}

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'all', label: 'All Items', icon: <Folder size={18} /> },
  { id: 'favorites', label: 'Favorites', icon: <Star size={18} /> },
  { id: 'trash', label: 'Trash', icon: <Trash2 size={18} /> },
];

const Sidebar: React.FC<SidebarProps> = ({ section, onSectionChange, counts, onLock }) => {
  return (
    <aside className="sidebar">
      {/* Brand */}
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Shield size={20} color="white" />
          </div>
          <div>
            <div className="sidebar-brand-text">Sovereigni-T</div>
            <div className="sidebar-brand-sub">Password Vault</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            className={`sidebar-link ${section === item.id ? 'active' : ''}`}
            onClick={() => onSectionChange(item.id)}
          >
            <span className="sidebar-link-icon">{item.icon}</span>
            {item.label}
            <span className="sidebar-link-count">{counts[item.id]}</span>
          </button>
        ))}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <button id="lock-vault-btn" className="sidebar-footer-btn" onClick={onLock}>
          <span className="sidebar-link-icon"><Lock size={18} /></span>
          Lock Vault
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
