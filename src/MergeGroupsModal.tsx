import React, { useEffect, useState } from 'react';
import { X, GitMerge } from 'lucide-react';
import { GroupSummary } from './api';

interface MergeGroupsModalProps {
  groups: GroupSummary[];
  onClose: () => void;
  onMerge: (sourceGroupIds: string[], name: string, color: string) => void;
}

const MergeGroupsModal: React.FC<MergeGroupsModalProps> = ({ groups, onClose, onMerge }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [color, setColor] = useState('#8A2BE2');

  useEffect(() => {
    const first = Array.from(selected)[0];
    if (first) {
      const g = groups.find((x) => x.group_id === first);
      if (g) setColor(g.color);
    }
  }, [selected, groups]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canMerge = selected.size >= 2 && name.trim().length > 0;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 200 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 420, maxHeight: '90vh' }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <GitMerge size={18} />
            Merge groups
          </h2>
          <button className="modal-close" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.5, margin: 0 }}>
            Select two or more groups. All accounts in them will be moved into one new group.
          </p>
          <div
            style={{
              maxHeight: 200,
              overflowY: 'auto',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              padding: 8,
            }}
          >
            {groups.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>No groups yet.</p>
            ) : (
              groups.map((g) => (
                <label
                  key={g.group_id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '6px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(g.group_id)}
                    onChange={() => toggle(g.group_id)}
                  />
                  <span className="group-color-dot" style={{ background: g.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>{g.name}</span>
                </label>
              ))
            )}
          </div>
          <div>
            <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              New group name
            </label>
            <input
              className="form-input"
              style={{ width: '100%', boxSizing: 'border-box' }}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name for merged group"
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <label style={{ fontSize: 12, color: 'var(--text-muted)' }}>Color</label>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              style={{ width: 40, height: 32, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer' }}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            type="button"
            disabled={!canMerge}
            onClick={() => onMerge(Array.from(selected), name.trim(), color)}
          >
            Merge
          </button>
        </div>
      </div>
    </div>
  );
};

export default MergeGroupsModal;
