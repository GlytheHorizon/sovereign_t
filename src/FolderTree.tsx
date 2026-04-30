import React, { useState } from 'react';
import { EntrySummary, GroupSummary } from './api';
import { Folder, FolderOpen, ChevronRight, ChevronDown, FileText, Trash2 } from 'lucide-react';

interface FolderTreeProps {
  entries: EntrySummary[];
  groups: GroupSummary[];
  onEditClick: (id: string) => void;
  onInfoClick: (id: string) => void;
  onDeleteGroup: (id: string) => void;
  onCreateGroup: (name: string, color: string) => void;
}

const FolderTree: React.FC<FolderTreeProps> = ({ entries, groups, onEditClick, onInfoClick, onDeleteGroup, onCreateGroup }) => {
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#8A2BE2');

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const uncategorized = entries.filter(e => !e.group_id);

  const renderEntry = (entry: EntrySummary) => {
    return (
      <div key={entry.entry_id} className="tree-item" onClick={() => onInfoClick(entry.entry_id)}>
        <div className="tree-item-icon">
          <FileText size={14} />
        </div>
        <div className="tree-item-content">
          <span className="tree-item-title">{entry.title}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="folder-tree-container">
      <div className="tree-toolbar" style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
        <input
          className="form-input"
          style={{ flex: 1, padding: '6px 12px', fontSize: '13px' }}
          placeholder="New Group Name"
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
        />
        <input
          type="color"
          className="color-picker"
          value={newGroupColor}
          onChange={(e) => setNewGroupColor(e.target.value)}
          style={{ width: '32px', height: '32px', padding: '0', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        />
        <button
          className="btn btn-primary"
          style={{ padding: '6px 12px', fontSize: '13px' }}
          onClick={() => {
            if (newGroupName.trim()) {
              onCreateGroup(newGroupName.trim(), newGroupColor);
              setNewGroupName('');
            }
          }}
          disabled={!newGroupName.trim()}
        >
          Create Group
        </button>
      </div>

      {groups.map(group => {
        const groupEntries = entries.filter(e => e.group_id === group.group_id);
        
        const isExpanded = expandedGroups[group.group_id] !== false; // Default expanded
        
        return (
          <div key={group.group_id} className="tree-group">
            <div className="tree-group-header" onClick={() => toggleGroup(group.group_id)}>
              <span className="tree-chevron">
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              </span>
              <span className="tree-folder-icon" style={{ color: group.color }}>
                {isExpanded ? <FolderOpen size={16} fill="currentColor" fillOpacity={0.2} /> : <Folder size={16} fill="currentColor" fillOpacity={0.2} />}
              </span>
              <span className="tree-group-name">{group.name}</span>
              <span className="tree-group-count">{groupEntries.length} items</span>
              <button 
                className="action-btn danger" 
                style={{ marginLeft: 'auto', opacity: 0.7 }}
                onClick={(e) => { e.stopPropagation(); onDeleteGroup(group.group_id); }}
                title="Delete Group"
              >
                <Trash2 size={14} />
              </button>
            </div>
            
            {isExpanded && (
              <div className="tree-group-items">
                {groupEntries.map(renderEntry)}
              </div>
            )}
          </div>
        );
      })}

      {uncategorized.length > 0 && (
        <div className="tree-group">
          <div className="tree-group-header" onClick={() => toggleGroup('uncategorized')}>
            <span className="tree-chevron">
              {expandedGroups['uncategorized'] !== false ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="tree-folder-icon" style={{ color: 'var(--text-muted)' }}>
              {expandedGroups['uncategorized'] !== false ? <FolderOpen size={16} /> : <Folder size={16} />}
            </span>
            <span className="tree-group-name">Uncategorized</span>
            <span className="tree-group-count" style={{ marginRight: 'auto' }}>{uncategorized.length} items</span>
          </div>
          
          {expandedGroups['uncategorized'] !== false && (
            <div className="tree-group-items">
              {uncategorized.map(renderEntry)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FolderTree;
