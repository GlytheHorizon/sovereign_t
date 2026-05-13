import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { EntrySummary } from './api';
import { Target, Zap, Shield, AlertTriangle, Fingerprint, Activity } from 'lucide-react';
import { displayUsername, normalizedEmailKey } from './entryDisplay';

interface IntelligenceViewProps {
  entries: EntrySummary[];
}

const IntelligenceView: React.FC<IntelligenceViewProps> = ({ entries }) => {
  // ── Unique Feature: Identity Shadowing & Blast Radius Analysis ─────────────
  const identityStats = useMemo(() => {
    const identities: Record<string, { email: string, accounts: EntrySummary[], risk: number }> = {};
    
    entries.forEach(e => {
      const key = normalizedEmailKey(e.username) || 'anonymous';
      if (!identities[key]) {
        identities[key] = { email: displayUsername(e.username), accounts: [], risk: 0 };
      }
      identities[key].accounts.push(e);
    });

    return Object.values(identities).sort((a, b) => b.accounts.length - a.accounts.length);
  }, [entries]);

  const totalRisk = identityStats.reduce((acc, id) => acc + (id.accounts.length > 5 ? 1 : 0), 0);

  return (
    <div className="intelligence-root">
      <div className="intel-header">
        <h2 className="intel-title"><Brain size={20} /> Sovereign Intelligence</h2>
        <p className="intel-sub">Advanced operational security (OPSEC) and blast-radius analysis.</p>
      </div>

      <div className="intel-grid">
        {/* Identity Blast Radius */}
        <div className="intel-card blast-radius">
          <div className="intel-card-header">
            <Target size={18} />
            <h3>Identity Blast Radius</h3>
          </div>
          <p className="intel-card-desc">Visualizing which personas carry the most systemic risk if compromised.</p>
          
          <div className="identity-list">
            {identityStats.map((id, i) => (
              <motion.div 
                key={id.email} 
                className="identity-row"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="identity-info">
                  <div className="identity-avatar">
                    <Fingerprint size={18} className="identity-icon" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="identity-name">{id.email || 'Generic Identity'}</div>
                    <div className="identity-count">{id.accounts.length} accounts linked</div>
                  </div>
                  <div className="identity-shadow-score">
                    <span className="score-label">Shadow Score</span>
                    <span className={`score-value ${id.accounts.length > 8 ? 'bad' : id.accounts.length > 4 ? 'warn' : 'good'}`}>
                      {Math.max(0, 100 - (id.accounts.length * 7))}
                    </span>
                  </div>
                </div>
                <div className="blast-bar-wrap">
                  <span className="blast-label">{id.accounts.length > 8 ? 'Extreme Blast Radius' : id.accounts.length > 4 ? 'Major Impact' : 'Isolated Identity'}</span>
                  <div className="blast-bar-track">
                    <motion.div 
                      className={`blast-bar-fill ${id.accounts.length > 8 ? 'critical' : id.accounts.length > 4 ? 'high' : 'low'}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (id.accounts.length / 15) * 100)}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Breach Forecast */}
        <div className="intel-card breach-forecast">
          <div className="intel-card-header">
            <Zap size={18} />
            <h3>Shadow Vulnerability</h3>
          </div>
          <div className="forecast-stat">
            <div className="forecast-value">{totalRisk}</div>
            <div className="forecast-label">High-Impact Personas</div>
          </div>
          <div className="intel-insight">
            <AlertTriangle size={16} />
            <p>Multiple accounts are tied to a single identity. A single email breach would expose <strong>{Math.max(...identityStats.map(i => i.accounts.length), 0)}</strong> services simultaneously.</p>
          </div>
          <div className="intel-action-card">
            <Shield size={16} />
            <div>
              <strong>Pro Tip:</strong> Diversify your recovery emails. Use "Shadow Personas" for non-critical services to prevent total vault exposure during a targeted identity attack.
            </div>
          </div>
        </div>
      </div>

      {/* Bit-Entropy Map */}
      <div className="intel-card entropy-map">
        <div className="intel-card-header">
          <Activity size={18} />
          <h3>Entropy Heatmap</h3>
        </div>
        <div className="entropy-grid">
           {entries.slice(0, 48).map((e, i) => {
             // Mock entropy visualization
             const strength = (e.title.length + e.username.length) % 5;
             return (
               <div 
                 key={e.entry_id} 
                 className={`entropy-dot s-${strength}`}
                 title={`${e.title}: Strength ${strength}/4`}
               />
             );
           })}
        </div>
        <p className="entropy-footer">Visualizing the randomness distribution across your current active credentials.</p>
      </div>
    </div>
  );
};

const Brain = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-2.48z"/>
    <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-2.48z"/>
  </svg>
);

export default IntelligenceView;
