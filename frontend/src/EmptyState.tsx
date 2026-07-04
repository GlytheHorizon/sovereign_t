import React from 'react';
import {
  Shield, Star, Trash2, Search, FolderOpen, Inbox, Lock, KeyRound, Smartphone,
} from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  illustration?: string;
}

const ILLUSTRATIONS: Record<string, React.ReactNode> = {
  vault:     <Shield size={48} />,
  search:    <Search size={48} />,
  trash:     <Inbox size={48} />,
  favorites: <Star size={48} />,
  dashboard: <Lock size={48} />,
  folder:    <FolderOpen size={48} />,
  mini:      <Smartphone size={48} />,
  all:       <Shield size={48} />,
};

const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action, illustration }) => {
  const displayIcon = icon || (illustration ? ILLUSTRATIONS[illustration] : <Shield size={48} />);

  return (
    <div className="empty-state">
      <div className="empty-state-graphic">
        <div className="empty-state-icon-wrap">{displayIcon}</div>
        <svg className="empty-state-ring" viewBox="0 0 120 120" fill="none">
          <circle cx="60" cy="60" r="54" stroke="currentColor" strokeWidth="1" strokeDasharray="4 4" opacity="0.15" />
          <circle cx="60" cy="60" r="44" stroke="currentColor" strokeWidth="0.5" opacity="0.08" />
        </svg>
      </div>
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {action && (
        <button className="btn btn-add" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
