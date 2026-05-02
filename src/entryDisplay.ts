/** Strip Sovereign_T social/crypto username prefixes for display and filtering. */
export function displayUsername(raw: string): string {
  const m = raw.match(/^\$\$(google|apple|facebook|crypto)\$\$(.*)$/);
  return m ? m[2] : raw;
}

export function normalizedEmailKey(raw: string): string {
  return displayUsername(raw).trim().toLowerCase();
}

/** True if the display string looks like an email (has @ with local + domain). */
export function isEmailLike(display: string): boolean {
  const s = display.trim();
  const at = s.lastIndexOf('@');
  if (at <= 0 || at >= s.length - 1) return false;
  const domain = s.slice(at + 1);
  return domain.includes('.') || domain.length > 0;
}

const DOMAIN_PRIORITY: string[] = [
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'protonmail.com',
  'proton.me',
  'aol.com',
];

function domainSortKey(domain: string): string {
  const d = domain.toLowerCase();
  const i = DOMAIN_PRIORITY.indexOf(d);
  if (i >= 0) return `0-${String(i).padStart(3, '0')}-${d}`;
  return `1-${d}`;
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function parseForSort(label: string): { kind: 'email'; domainKey: string; local: string } | { kind: 'other'; key: string } {
  const s = label.trim();
  const at = s.lastIndexOf('@');
  if (at > 0 && at < s.length - 1) {
    const local = s.slice(0, at).toLowerCase();
    const domain = s.slice(at + 1).toLowerCase();
    if (domain.length > 0) {
      return { kind: 'email', domainKey: domainSortKey(domain), local };
    }
  }
  return { kind: 'other', key: s.toLowerCase() };
}

/** Sort dropdown options: emails first (Gmail & common providers, then A–Z domains), natural order per address; then other usernames. */
export function sortEmailFilterOptions<T extends { value: string; label: string }>(options: T[]): T[] {
  return [...options].sort((a, b) => {
    const pa = parseForSort(a.label);
    const pb = parseForSort(b.label);
    if (pa.kind !== pb.kind) return pa.kind === 'email' ? -1 : 1;
    if (pa.kind === 'email' && pb.kind === 'email') {
      const dc = pa.domainKey.localeCompare(pb.domainKey);
      if (dc !== 0) return dc;
      return naturalCompare(pa.local, pb.local);
    }
    return naturalCompare((pa as { kind: 'other'; key: string }).key, (pb as { kind: 'other'; key: string }).key);
  });
}
