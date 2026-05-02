import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'lucide-react';
import { invoke } from './api';
import ConfirmModal from './ConfirmModal';

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
    <div className="dashboard-root">
      <div className="dashboard-header">
        <div>
          <h2 className="dashboard-title">
            <Activity size={20} style={{ opacity: 0.9 }} />
            Vault intelligence
          </h2>
          <p className="dashboard-sub">Password hygiene, reuse, and exposure at a glance.</p>
        </div>
        <button type="button" className="btn btn-ghost dashboard-refresh" onClick={() => { void load(); onRefreshVault(); }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      <div className="dashboard-top-band">
        <div className="dashboard-hero">
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
              <span className="dashboard-health-cap">health</span>
            </div>
          </div>
          <div className="dashboard-hero-copy">
            <p className="dashboard-hero-lead">
              Avg strength <strong>{stats.avg_risk_score}</strong>/100 · Unique passwords <strong>{stats.unique_passwords}</strong>{' '}
              · Accounts <strong>{stats.active_accounts}</strong>
            </p>
            {stats.accounts_with_reused_password > 0 && (
              <p className="dashboard-warn">
                <ShieldAlert size={14} />
                <span>
                  <strong>{stats.accounts_with_reused_password}</strong> accounts share a password with another entry — use
                  unique passwords per site.
                </span>
              </p>
            )}
          </div>
        </div>

        <div className="dashboard-cards">
        <div className="dashboard-card">
          <Users size={18} className="dashboard-card-icon" />
          <div className="dashboard-card-value">{stats.active_accounts}</div>
          <div className="dashboard-card-label">Active accounts</div>
        </div>
        <div className="dashboard-card">
          <Star size={18} className="dashboard-card-icon" />
          <div className="dashboard-card-value">{stats.favorites_count}</div>
          <div className="dashboard-card-label">Favorites</div>
        </div>
        <div className="dashboard-card">
          <Trash2 size={18} className="dashboard-card-icon" />
          <div className="dashboard-card-value">{stats.trash_count}</div>
          <div className="dashboard-card-label">In trash</div>
        </div>
        <div className="dashboard-card">
          <FolderOpen size={18} className="dashboard-card-icon" />
          <div className="dashboard-card-value">{stats.groups_count}</div>
          <div className="dashboard-card-label">Groups</div>
        </div>
        <div className="dashboard-card">
          <Fingerprint size={18} className="dashboard-card-icon" />
          <div className="dashboard-card-value">{stats.uncategorized_accounts}</div>
          <div className="dashboard-card-label">Uncategorized</div>
        </div>
        <div className="dashboard-card">
          <Link2 size={18} className="dashboard-card-icon" />
          <div className="dashboard-card-value">{stats.entries_with_url}</div>
          <div className="dashboard-card-label">With URL</div>
        </div>
        <div className="dashboard-card">
          <KeyRound size={18} className="dashboard-card-icon" />
          <div className="dashboard-card-value">{stats.avg_password_length.toFixed(1)}</div>
          <div className="dashboard-card-label">Avg password length</div>
        </div>
        <div className="dashboard-card">
          <TrendingUp size={18} className="dashboard-card-icon" />
          <div className="dashboard-card-value">{stats.recently_updated_count}</div>
          <div className="dashboard-card-label">Updated (30d)</div>
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

      <div className="dashboard-risk-section">
        <div className="dashboard-risk-head">
          <div>
            <h3 className="dashboard-section-title">Highest-risk accounts</h3>
            <p className="dashboard-section-hint">Lower score = more issues. Click a row for details. {RISK_PAGE_SIZE} rows per page.</p>
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
                      <span className={`dashboard-risk-pill r-${Math.floor(row.risk_score / 25)}`}>{row.risk_score}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{row.reasons[0] || '—'}</td>
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
