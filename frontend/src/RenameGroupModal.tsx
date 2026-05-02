import React, { useState, useEffect } from 'react';
import { X, Pencil } from 'lucide-react';
import { GroupSummary } from './api';

interface RenameGroupModalProps {
  group: GroupSummary;
  onClose: () => void;
  onSave: (name: string) => void;
}

const RenameGroupModal: React.FC<RenameGroupModalProps> = ({ group, onClose, onSave }) => {
  const [name, setName] = useState(group.name);

  useEffect(() => {
    setName(group.name);
  }, [group.group_id, group.name]);

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 200 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 400 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Pencil size={18} />
            Rename group
          </h2>
          <button className="modal-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">
          <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
            Group name
          </label>
          <input
            className="form-input"
            style={{ width: '100%', boxSizing: 'border-box' }}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim()) onSave(name.trim());
            }}
            autoFocus
          />
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!name.trim() || name.trim() === group.name}
            onClick={() => onSave(name.trim())}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default RenameGroupModal;
