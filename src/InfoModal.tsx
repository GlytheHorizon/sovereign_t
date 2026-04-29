import React, { useEffect, useState } from 'react';
import { X, Clock, FileText, Link, Shield } from 'lucide-react';
import { invoke, EntrySummary } from './api';

interface InfoModalProps {
  entry: EntrySummary;
  onClose: () => void;
}

const InfoModal: React.FC<InfoModalProps> = ({ entry, onClose }) => {
  const [notes, setNotes] = useState<string>('Loading notes...');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<{password: string, notes: string}>('get_entry_secrets', { entryId: entry.entry_id })
      .then(res => setNotes(res.notes || 'No notes available.'))
      .catch(() => setNotes('Failed to load notes.'))
      .finally(() => setLoading(false));
  }, [entry]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  };

  const formatDate = (ts: number) => {
    return new Date(ts * 1000).toLocaleString();
  };

  return (
    <div className="modal-overlay" onClick={onClose} onKeyDown={handleKeyDown} style={{ zIndex: 150 }}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 450 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Shield size={18} /> Account Information
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>Title</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{entry.title}</div>
          </div>
          
          {entry.url && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>
                <Link size={14} /> URL
              </div>
              <div style={{ fontSize: 14, color: 'var(--accent)' }}>
                 <a href={entry.url.startsWith('http') ? entry.url : `https://${entry.url}`} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                    {entry.url}
                 </a>
              </div>
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600, marginBottom: 4 }}>
              <FileText size={14} /> Notes
            </div>
            <div style={{ fontSize: 14, background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', color: loading ? 'var(--text-muted)' : 'var(--text-primary)' }}>
              {notes}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, background: 'var(--bg-tertiary)', padding: 12, borderRadius: 8 }}>
             <div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>
                 <Clock size={12} /> Created At
               </div>
               <div style={{ fontSize: 12 }}>{formatDate(entry.created_at)}</div>
             </div>
             <div>
               <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 2 }}>
                 <Clock size={12} /> Last Edited
               </div>
               <div style={{ fontSize: 12 }}>{formatDate(entry.updated_at)}</div>
             </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose} autoFocus>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;
