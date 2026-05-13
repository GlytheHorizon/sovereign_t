import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  RefreshCw,
  Shield,
  ShieldAlert,
  KeyRound,
  Users,
  Trash2,
  Star,
  FolderOpen,
  Link2,
  Fingerprint,
  TrendingUp,
  Eye,
  EyeOff,
  ChevronUp,
  ChevronDown,
  Activity,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  Info,
  Zap,
  Target,
  Brain,
  Ghost,
  QrCode,
} from 'lucide-react';
import { invoke } from './api';
import ConfirmModal from './ConfirmModal';

// ── Animated counter hook ──────────────────────────────────────────────────
function useAnimatedCount(target: number, duration = 800) {
  const [count, setCount] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const start = performance.now();
    const from = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(from + (target - from) * eased));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return count;
}

// ── Risk helpers ───────────────────────────────────────────────────────────
function getRiskGrade(score: number): { label: string; color: string; cls: string } {
  if (score >= 80) return { label: 'Strong',   color: 'var(--success)', cls: 'r-3' };
  if (score >= 60) return { label: 'Fair',     color: 'var(--accent)',  cls: 'r-2' };
  if (score >= 40) return { label: 'Weak',     color: '#f59e0b',        cls: 'r-1' };
  return              { label: 'Critical', color: 'var(--danger)', cls: 'r-0' };
}

// ── Risk Legend ────────────────────────────────────────────────────────────
const RiskLegend: React.FC = () => (
  <div className="risk-legend">
    <span className="risk-legend-title">Score legend:</span>
    {([
      { range: '80–100', label: 'Strong',   color: 'var(--success)' },
      { range: '60–79',  label: 'Fair',     color: 'var(--accent)'  },
      { range: '40–59',  label: 'Weak',     color: '#f59e0b'        },
      { range: '0–39',   label: 'Critical', color: 'var(--danger)'  },
    ] as const).map(({ range, label, color }) => (
      <span key={label} className="risk-legend-item">
        <span className="risk-legend-dot" style={{ background: color }} />
        <span style={{ color }}>{label}</span>
        <span className="risk-legend-range">{range}</span>
      </span>
    ))}
  </div>
);

// ── Stat card with animated counter ───────────────────────────────────────
const StatCard: React.FC<{ icon: React.ReactNode; value: number; label: string; decimals?: number }> = ({ icon, value, label, decimals = 0 }) => {
  const animated = useAnimatedCount(value);
  return (
    <div className="dashboard-card">
      {icon}
      <div className="dashboard-card-value">{decimals > 0 ? value.toFixed(decimals) : animated}</div>
      <div className="dashboard-card-label">{label}</div>
    </div>
  );
};

export interface VaultDashboardStats {
  active_accounts: number;
  favorites_count: number;
  trash_count: number;
  groups_count: number;
  uncategorized_accounts: number;
  entries_with_url: number;
  unique_passwords: number;
  accounts_with_reused_password: number;
  largest_reuse_cluster_size: number;
  vault_health_score: number;
  avg_risk_score: number;
  avg_password_length: number;
  oldest_entry_age_days: number | null;
  recently_updated_count: number;
  strength_tier_counts: {
    critical: number;
    weak: number;
    fair: number;
    strong: number;
  };
  password_reuse_clusters: {
    accounts_count: number;
    entry_ids: string[];
    sample_titles: string[];
  }[];
  weakest_accounts: {
    entry_id: string;
    title: string;
    username_display: string;
    risk_score: number;
    reasons: string[];
  }[];
}

type RiskSortKey = 'title' | 'username' | 'risk' | 'reasons';
type RiskSortDir = 'asc' | 'desc';

const RISK_PAGE_SIZE = 5;

interface DashboardViewProps {
  onRefreshVault: () => void;
  onOpenEntry: (entryId: string) => void;
}

function SortRiskTh({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  k: RiskSortKey;
  sortKey: RiskSortKey;
  sortDir: RiskSortDir;
  onSort: (k: RiskSortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th>
      <button type="button" className="th-sort-btn" onClick={() => onSort(k)}>
        {label}
        {active ? (sortDir === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />) : null}
      </button>
    </th>
  );
}

const DashboardView: React.FC<DashboardViewProps> = ({ onRefreshVault, onOpenEntry }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [stats, setStats] = useState<VaultDashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealedPw, setRevealedPw] = useState<string | null>(null);
  const [confirmReveal, setConfirmReveal] = useState<string | null>(null);
  const [riskSortKey, setRiskSortKey] = useState<RiskSortKey>('risk');
  const [riskSortDir, setRiskSortDir] = useState<RiskSortDir>('asc');
  const [riskSearch, setRiskSearch] = useState('');
  const [riskPage, setRiskPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await invoke<VaultDashboardStats>('get_vault_dashboard_stats');
      setStats(data);
    } catch (e: any) {
      setError(typeof e === 'string' ? e : e?.message || 'Failed to load dashboard');
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const topCluster = stats?.password_reuse_clusters[0];

  const handleRiskSort = (k: RiskSortKey) => {
    if (riskSortKey === k) setRiskSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setRiskSortKey(k);
      setRiskSortDir(k === 'risk' ? 'asc' : 'asc');
    }
  };

  const sortedRiskRows = useMemo(() => {
    if (!stats) return [];
    const rows = [...stats.weakest_accounts];
    const dir = riskSortDir === 'asc' ? 1 : -1;
    rows.sort((a, b) => {
      let c = 0;
      if (riskSortKey === 'title') c = a.title.localeCompare(b.title);
      else if (riskSortKey === 'username') c = a.username_display.localeCompare(b.username_display);
      else if (riskSortKey === 'risk') c = a.risk_score - b.risk_score;
      else c = (a.reasons[0] || '').localeCompare(b.reasons[0] || '');
      return c * dir;
    });
    return rows;
  }, [stats, riskSortKey, riskSortDir]);

  const filteredRiskRows = useMemo(() => {
    const q = riskSearch.trim().toLowerCase();
    if (!q) return sortedRiskRows;
    return sortedRiskRows.filter(
      (row) =>
        row.title.toLowerCase().includes(q) ||
        row.username_display.toLowerCase().includes(q) ||
        row.reasons.some((r) => r.toLowerCase().includes(q)),
    );
  }, [sortedRiskRows, riskSearch]);

  useEffect(() => {
    setRiskPage(1);
  }, [riskSearch]);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(filteredRiskRows.length / RISK_PAGE_SIZE));
    setRiskPage((p) => Math.min(p, tp));
  }, [filteredRiskRows.length]);

  const riskTotalPages = Math.max(1, Math.ceil(filteredRiskRows.length / RISK_PAGE_SIZE));
  const riskPageClamped = Math.min(riskPage, riskTotalPages);
  const riskPageRows = filteredRiskRows.slice(
    (riskPageClamped - 1) * RISK_PAGE_SIZE,
    riskPageClamped * RISK_PAGE_SIZE,
  );

  const healthColor =
    (stats?.vault_health_score ?? 0) >= 75 ? 'var(--success)' : (stats?.vault_health_score ?? 0) >= 50 ? 'var(--accent)' : 'var(--danger)';

  if (loading && !stats) {
    return (
      <div className="dashboard-root">
        <div className="dashboard-loading">Loading vault intelligence…</div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="dashboard-root">
        <p className="dashboard-error">{error}</p>
        <button type="button" className="btn btn-primary" onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="dashboard-view">
      <div className="dashboard-header-row">
        <h2 className="dashboard-title"><Activity size={20} /> Vault Intelligence</h2>
        <button 
          type="button" 
          className="btn btn-ghost dashboard-refresh" 
          onClick={async () => { 
            setIsRefreshing(true);
            await load(); 
            onRefreshVault(); 
            setTimeout(() => setIsRefreshing(false), 600);
          }}
          disabled={isRefreshing}
        >
          <RefreshCw size={16} className={isRefreshing ? 'refresh-spin' : ''} /> Refresh
        </button>
      </div>

      <div className="dashboard-top-band">
        <div className="dashboard-hero">
          <div className="dashboard-hero-main">
            <div className="hero-stat-badge left">
              <span className="badge-val">{stats.avg_risk_score}</span>
              <span className="badge-label">Avg Strength</span>
            </div>

            <div className="dashboard-health-ring" style={{ '--health-color': healthColor } as React.CSSProperties}>
              <svg viewBox="0 0 100 100" className="dashboard-health-svg">
                <circle className="dashboard-health-bg" cx="50" cy="50" r="42" />
                <circle
                  className="dashboard-health-fg"
                  cx="50"
                  cy="50"
                  r="42"
                  strokeDasharray={`${(stats.vault_health_score / 100) * 264} 264`}
                />
              </svg>
              <div className="dashboard-health-label">
                <span className="dashboard-health-value">{stats.vault_health_score}</span>
                <span className="dashboard-health-cap">HEALTH</span>
              </div>
            </div>

            <div className="hero-stat-badge right">
              <span className="badge-val">{stats.unique_passwords}</span>
              <span className="badge-label">Unique Keys</span>
            </div>
          </div>

          {stats.accounts_with_reused_password > 0 && (
            <div className="dashboard-hero-warning-banner">
              <ShieldAlert size={18} />
              <div className="warning-text">
                <strong>{stats.accounts_with_reused_password} security violations detected.</strong>
                <span>Shared passwords identified across services. High credential stuffing risk.</span>
              </div>
            </div>
          )}
        </div>

        <div className="dashboard-cards">
          <StatCard icon={<Users size={18} />} value={stats.active_accounts} label="Active accounts" />
          <StatCard icon={<Star size={18} />} value={stats.favorites_count} label="Favorites" />
          <StatCard icon={<Trash2 size={18} />} value={stats.trash_count} label="In trash" />
          <StatCard icon={<FolderOpen size={18} />} value={stats.groups_count} label="Groups" />
          <StatCard icon={<Fingerprint size={18} />} value={stats.uncategorized_accounts} label="Uncategorized" />
          <StatCard icon={<Link2 size={18} />} value={stats.entries_with_url} label="With URL" />
          <StatCard icon={<KeyRound size={18} />} value={stats.avg_password_length} label="Avg pw length" decimals={1} />
          <StatCard icon={<TrendingUp size={18} />} value={stats.recently_updated_count} label="Updated (30d)" />
        </div>
      </div>

      <div className="dashboard-scoring-guide">
        <h3 className="dashboard-section-title"><Shield size={16} /> Scoring Deduction Map</h3>
        <div className="deduction-grid">
          <div className="deduction-category">
            <div className="category-label">Length Requirements</div>
            <div className="deduction-list">
              <div className="deduction-row"><span className="val bad">-50</span> <span className="desc">Critical Shortness (&lt;6 chars)</span></div>
              <div className="deduction-row"><span className="val bad">-35</span> <span className="desc">Short Password (&lt;8 chars)</span></div>
              <div className="deduction-row"><span className="val warn">-15</span> <span className="desc">Sub-optimal (&lt;12 chars)</span></div>
            </div>
          </div>
          <div className="deduction-category">
            <div className="category-label">Complexity Rules</div>
            <div className="deduction-list">
              <div className="deduction-row"><span className="val warn">-14</span> <span className="desc">No Numbers</span></div>
              <div className="deduction-row"><span className="val warn">-12</span> <span className="desc">No Symbols</span></div>
              <div className="deduction-row"><span className="val warn">-10</span> <span className="desc">No Uppercase</span></div>
            </div>
          </div>
          <div className="deduction-category">
            <div className="category-label">Systemic Risk</div>
            <div className="deduction-list">
              <div className="deduction-row"><span className="val danger">-45</span> <span className="desc">Common Password</span></div>
              <div className="deduction-row"><span className="val danger">-30</span> <span className="desc">Reuse Violation</span></div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-mid-grid">
      <div className="dashboard-tiers">
        <h3 className="dashboard-section-title">Strength distribution</h3>
        <div className="dashboard-tier-bars">
          {(
            [
              ['Critical (0–39)', stats.strength_tier_counts.critical, 'var(--danger)'],
              ['Weak (40–59)', stats.strength_tier_counts.weak, '#f59e0b'],
              ['Fair (60–79)', stats.strength_tier_counts.fair, 'var(--accent)'],
              ['Strong (80–100)', stats.strength_tier_counts.strong, 'var(--success)'],
            ] as const
          ).map(([label, count, color]) => (
            <div key={label} className="dashboard-tier-row">
              <span className="dashboard-tier-label">{label}</span>
              <div className="dashboard-tier-track">
                <div
                  className="dashboard-tier-fill"
                  style={{
                    width: `${stats.active_accounts ? (count / stats.active_accounts) * 100 : 0}%`,
                    background: color,
                  }}
                />
              </div>
              <span className="dashboard-tier-count">{count}</span>
            </div>
          ))}
        </div>
        {stats.oldest_entry_age_days != null && (
          <p className="dashboard-meta">Oldest saved entry: ~{stats.oldest_entry_age_days} days in vault.</p>
        )}
      </div>

      {topCluster && topCluster.accounts_count > 1 ? (
        <div className="dashboard-reuse-panel">
          <h3 className="dashboard-section-title">
            <Shield size={18} /> Most reused password
          </h3>
          <p className="dashboard-reuse-desc">
            This secret is used on <strong>{topCluster.accounts_count}</strong> accounts — for example:{' '}
            {topCluster.sample_titles.slice(0, 3).join(', ')}
            {topCluster.sample_titles.length > 3 ? '…' : ''}. Reusing passwords increases breach impact.
          </p>
          <div className="dashboard-reuse-secret-row">
            <code className="dashboard-masked">{revealedPw ?? '••••••••••••••••'}</code>
            {revealedPw ? (
              <button type="button" className="btn btn-ghost" onClick={() => setRevealedPw(null)}>
                <EyeOff size={16} /> Hide
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmReveal(topCluster.entry_ids[0] || null)}
              >
                <Eye size={16} /> Show password
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="dashboard-reuse-panel dashboard-reuse-panel--empty">
          <p className="dashboard-reuse-placeholder">No duplicate-password clusters detected (or only one account per secret).</p>
        </div>
      )}
      </div>

      {/* ── Security Insights ── */}
      <div className="security-insights-panel">
        <h3 className="dashboard-section-title"><Zap size={16} /> Security Insights</h3>
        <div className="security-insights-grid">
          <div className={`insight-card ${stats.accounts_with_reused_password > 0 ? 'warn' : 'good'}`}>
            {stats.accounts_with_reused_password > 0
              ? <AlertTriangle size={18} />
              : <CheckCircle2 size={18} />}
            <div>
              <div className="insight-title">{stats.accounts_with_reused_password > 0 ? `${stats.accounts_with_reused_password} reused passwords` : 'No password reuse'}</div>
              <div className="insight-sub">{stats.accounts_with_reused_password > 0 ? 'Use unique passwords per site' : 'All passwords are unique'}</div>
            </div>
          </div>
          <div className={`insight-card ${stats.strength_tier_counts.critical > 0 ? 'danger' : stats.strength_tier_counts.weak > 0 ? 'warn' : 'good'}`}>
            {stats.strength_tier_counts.critical > 0 ? <AlertTriangle size={18} /> : <Shield size={18} />}
            <div>
              <div className="insight-title">
                {stats.strength_tier_counts.critical > 0 ? `${stats.strength_tier_counts.critical} critical` : stats.strength_tier_counts.weak > 0 ? `${stats.strength_tier_counts.weak} weak` : 'Good password strength'}
              </div>
              <div className="insight-sub">{stats.strength_tier_counts.strong} strong · {stats.strength_tier_counts.fair} fair</div>
            </div>
          </div>
          <div className={`insight-card ${(stats.avg_password_length < 12) ? 'warn' : 'good'}`}>
            <Info size={18} />
            <div>
              <div className="insight-title">Avg length {stats.avg_password_length.toFixed(1)} chars</div>
              <div className="insight-sub">{stats.avg_password_length < 12 ? 'Aim for 16+ characters' : 'Length is solid'}</div>
            </div>
          </div>
          <div className={`insight-card ${stats.uncategorized_accounts > 5 ? 'warn' : 'good'}`}>
            <FolderOpen size={18} />
            <div>
              <div className="insight-title">{stats.uncategorized_accounts} uncategorized</div>
              <div className="insight-sub">{stats.uncategorized_accounts > 5 ? 'Organize into groups' : 'Well organized'}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-risk-section">
        <div className="dashboard-risk-head">
          <div>
            <h3 className="dashboard-section-title">Highest-risk accounts</h3>
            <p className="dashboard-section-hint">Lower score = more issues. Click a row for details.</p>
          </div>
          <div className="dashboard-risk-search">
            <span className="dashboard-risk-search-icon">
              <Search size={14} />
            </span>
            <input
              type="search"
              className="dashboard-risk-search-input"
              placeholder="Search title, email, reason…"
              value={riskSearch}
              onChange={(e) => setRiskSearch(e.target.value)}
              aria-label="Filter risk table"
            />
          </div>
        </div>
        <div className="dashboard-table-wrap">
          <table className="entry-table dashboard-risk-table">
            <thead>
              <tr>
                <SortRiskTh label="Title" k="title" sortKey={riskSortKey} sortDir={riskSortDir} onSort={handleRiskSort} />
                <SortRiskTh
                  label="Email / user"
                  k="username"
                  sortKey={riskSortKey}
                  sortDir={riskSortDir}
                  onSort={handleRiskSort}
                />
                <SortRiskTh label="Risk" k="risk" sortKey={riskSortKey} sortDir={riskSortDir} onSort={handleRiskSort} />
                <SortRiskTh
                  label="Top reason"
                  k="reasons"
                  sortKey={riskSortKey}
                  sortDir={riskSortDir}
                  onSort={handleRiskSort}
                />
              </tr>
            </thead>
            <tbody>
              {sortedRiskRows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--text-muted)', padding: 12 }}>
                    No accounts to analyze yet.
                  </td>
                </tr>
              ) : filteredRiskRows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ color: 'var(--text-muted)', padding: 12 }}>
                    No rows match your search.
                  </td>
                </tr>
              ) : (
                riskPageRows.map((row) => (
                  <tr
                    key={row.entry_id}
                    className="dashboard-risk-row"
                    onClick={() => onOpenEntry(row.entry_id)}
                    title="View account"
                  >
                    <td>{row.title}</td>
                    <td>{row.username_display || '—'}</td>
                    <td>
                      {(() => { const g = getRiskGrade(row.risk_score); return (
                        <span className={`dashboard-risk-pill ${g.cls}`} style={{ color: g.color, borderColor: g.color }}>
                          {row.risk_score} <span className="risk-pill-label">{g.label}</span>
                        </span>
                      ); })()}
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      <div className="risk-reasons-preview">
                        <div className="risk-math-breakdown">
                           <span className="math-base">100</span>
                           {row.reasons.map((r, i) => {
                             let penalty = 0;
                             if (r.includes("Very short")) penalty = 50;
                             else if (r.includes("Short password")) penalty = 35;
                             else if (r.includes("Under 12 characters")) penalty = 15;
                             else if (r.includes("No numbers")) penalty = 14;
                             else if (r.includes("No uppercase")) penalty = 10;
                             else if (r.includes("No symbols")) penalty = 12;
                             else if (r.includes("Mostly lowercase")) penalty = 8;
                             else if (r.includes("well-known weak")) penalty = 45;
                             else if (r.includes("Reused")) penalty = 30;
                             return <span key={i} className="math-penalty" title={r}>-{penalty}</span>;
                           })}
                           <span className="math-equals">=</span>
                           <span className="math-result">{row.risk_score}</span>
                        </div>
                      </div>
                      <div className="risk-reasons-detail">
                        {row.reasons.map((r, i) => (
                          <div key={i} className="risk-reason-item">
                            <AlertTriangle size={10} /> {r}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filteredRiskRows.length > 0 && riskTotalPages > 1 && (
          <div className="dashboard-risk-pager">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={riskPageClamped <= 1}
              onClick={() => setRiskPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <span className="dashboard-risk-page-label">
              Page {riskPageClamped} of {riskTotalPages} · {filteredRiskRows.length} match
              {riskSearch.trim() ? ' (filtered)' : ''}
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={riskPageClamped >= riskTotalPages}
              onClick={() => setRiskPage((p) => Math.min(riskTotalPages, p + 1))}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>

      {confirmReveal && (
        <ConfirmModal
          title="Reveal reused password"
          message="Anyone who can see your screen could read this password. Only continue in a private place."
          confirmText="Show password"
          danger
          onConfirm={async () => {
            const id = confirmReveal;
            setConfirmReveal(null);
            if (!id) return;
            try {
              const s = await invoke<{ password: string }>('get_entry_secrets', { entryId: id });
              setRevealedPw(s.password);
            } catch {
              setRevealedPw('(could not load)');
            }
          }}
          onCancel={() => setConfirmReveal(null)}
        />
      )}
    </div>
  );
};

export default DashboardView;
