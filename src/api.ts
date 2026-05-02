import { invoke as tauriInvoke } from '@tauri-apps/api/core';

export interface EntrySummary {
  entry_id: string;
  title: string;
  username: string;
  url: string;
  group_id?: string | null;
  favorite: boolean;
  trashed: boolean;
  created_at: number;
  updated_at: number;
}

export interface GroupSummary {
  group_id: string;
  name: string;
  color: string;
  created_at: number;
  updated_at: number;
}

export interface DecryptedSecrets {
  password: string;
  notes: string;
}

export interface NewEntryInput {
  title: string;
  username: string;
  url: string;
  group_id?: string | null;
  password: string;
  notes?: string;
  favorite?: boolean;
}

export interface UpdateEntryInput {
  entry_id: string;
  title: string;
  username: string;
  url: string;
  group_id?: string | null;
  password: string;
  notes?: string;
  favorite: boolean;
  trashed: boolean;
}

// Detect Tauri even when the global helper is not exposed.
const isTauri = typeof window !== 'undefined' && !!(
  (window as any).__TAURI__?.core?.invoke ||
  (window as any).__TAURI_INTERNALS__ ||
  (window as any).__TAURI_IPC__
);

// Fallback Mock Data
let mockDb: EntrySummary[] = [];
let mockGroups: GroupSummary[] = [];

// Helper to simulate network delay for mock
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function invoke<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  console.log(`[API] Invoking '${cmd}' (Tauri: ${isTauri})`, args);
  if (isTauri) {
    return tauriInvoke(cmd, args);
  } else {
    // --- MOCK BROWSER IMPLEMENTATION FOR FAST DEVELOPMENT ---
    console.log(`[API Mock] Invoking '${cmd}'`, args);
    await delay(200);

    switch (cmd) {
      case 'get_active_vault':
        return 'vault_main' as any;
        
      case 'switch_vault':
        return undefined as any;

      case 'vault_exists':
        return true as any;

      case 'create_vault':
        return undefined as any;

      case 'unlock_vault':
        return undefined as any;

      case 'lock_vault':
        return undefined as any;

      case 'list_entries': {
        const { section } = args;
        let res = [...mockDb];
        if (section === 'favorites') res = res.filter((e) => e.favorite && !e.trashed);
        else if (section === 'trash') res = res.filter((e) => e.trashed);
        else res = res.filter((e) => !e.trashed);
        return res as any;
      }

      case 'get_entry_secrets': {
        return { password: 'MOCK_PASSWORD_OR_PHRASE_12345', notes: 'Mock notes...' } as any;
      }

      case 'get_vault_dashboard_stats': {
        const active = mockDb.filter((e) => !e.trashed);
        const trash = mockDb.filter((e) => e.trashed);
        const favs = active.filter((e) => e.favorite);
        const unc = active.filter((e) => !e.group_id);
        const withUrl = active.filter((e) => e.url?.trim());
        const now = Date.now() / 1000;
        return {
          active_accounts: active.length,
          favorites_count: favs.length,
          trash_count: trash.length,
          groups_count: mockGroups.length,
          uncategorized_accounts: unc.length,
          entries_with_url: withUrl.length,
          unique_passwords: Math.max(1, active.length - 1),
          accounts_with_reused_password: active.length > 2 ? 2 : 0,
          largest_reuse_cluster_size: active.length > 2 ? 2 : 0,
          vault_health_score: 78,
          avg_risk_score: 78,
          avg_password_length: 16,
          oldest_entry_age_days: 120,
          recently_updated_count: active.filter((e) => now - e.updated_at < 30 * 86400).length,
          strength_tier_counts: { critical: 0, weak: 1, fair: 2, strong: Math.max(0, active.length - 3) },
          password_reuse_clusters:
            active.length > 1
              ? [
                  {
                    accounts_count: 2,
                    entry_ids: active.slice(0, 2).map((e) => e.entry_id),
                    sample_titles: active.slice(0, 2).map((e) => e.title),
                  },
                ]
              : [],
          weakest_accounts: active.slice(0, 5).map((e) => {
            const m = e.username.match(/^\$\$(google|apple|facebook|crypto)\$\$(.*)$/);
            const ud = m ? m[2] : e.username;
            return {
              entry_id: e.entry_id,
              title: e.title,
              username_display: ud,
              risk_score: 55,
              reasons: ['Example mock insight — use the desktop app for real analysis'],
            };
          }),
        } as any;
      }

      case 'list_groups': {
        return [...mockGroups] as any;
      }

      case 'create_group': {
        const newGroup: GroupSummary = {
          group_id: `mock-group-${Date.now()}`,
          name: args.input.name,
          color: args.input.color,
          created_at: Date.now() / 1000,
          updated_at: Date.now() / 1000,
        };
        mockGroups.push(newGroup);
        return newGroup as any;
      }

      case 'update_group': {
        const input = args.input as { group_id: string; name: string };
        const idx = mockGroups.findIndex((g) => g.group_id === input.group_id);
        if (idx < 0) throw new Error('Group not found.');
        mockGroups[idx] = {
          ...mockGroups[idx],
          name: input.name.trim(),
          updated_at: Date.now() / 1000,
        };
        return mockGroups[idx] as any;
      }

      case 'merge_groups': {
        const input = args.input as { source_group_ids: string[]; name: string; color: string };
        const ids = Array.from(new Set(input.source_group_ids));
        if (ids.length < 2) throw new Error('Select at least two groups.');
        const now = Date.now() / 1000;
        const newId = `mock-group-${Date.now()}`;
        mockDb = mockDb.map((e) => {
          if (e.group_id && ids.includes(e.group_id)) {
            return { ...e, group_id: newId, updated_at: now };
          }
          return e;
        });
        mockGroups = mockGroups.filter((g) => !ids.includes(g.group_id));
        const merged: GroupSummary = {
          group_id: newId,
          name: input.name.trim(),
          color: input.color,
          created_at: now,
          updated_at: now,
        };
        mockGroups.push(merged);
        return merged as any;
      }

      case 'add_entry': {
        const newEntry: EntrySummary = {
          entry_id: `mock-${Date.now()}`,
          title: args.input.title,
          username: args.input.username,
          url: args.input.url,
          group_id: args.input.group_id || null,
          favorite: args.input.favorite || false,
          trashed: false,
          created_at: Date.now() / 1000,
          updated_at: Date.now() / 1000,
        };
        mockDb.push(newEntry);
        return newEntry as any;
      }
      
      case 'update_entry': {
         const idx = mockDb.findIndex(e => e.entry_id === args.input.entry_id);
         if (idx >= 0) {
            mockDb[idx] = { ...mockDb[idx], ...args.input, updated_at: Date.now() / 1000 };
         }
         return undefined as any;
      }

      case 'set_favorite': {
        const entry = mockDb.find((e) => e.entry_id === (args.entryId || args.entry_id));
        if (entry) entry.favorite = args.favorite;
        return undefined as any;
      }

      case 'move_to_trash': {
        const e1 = mockDb.find((e) => e.entry_id === (args.entryId || args.entry_id));
        if (e1) e1.trashed = true;
        return undefined as any;
      }

      case 'restore_from_trash': {
        const e2 = mockDb.find((e) => e.entry_id === (args.entryId || args.entry_id));
        if (e2) e2.trashed = false;
        return undefined as any;
      }

      case 'delete_entry': {
        mockDb = mockDb.filter((e) => e.entry_id !== (args.entryId || args.entry_id));
        return undefined as any;
      }

      case 'generate_password': {
        return 'Mock-Secure-Pass-123!' as any;
      }

      case 'change_master_password': {
        console.log(`[API Mock] Changing master password to: ${args.input?.new_password}`);
        return undefined as any;
      }

      case 'get_mini_vault_status': {
        return { is_setup: localStorage.getItem('mini_vault_setup') === 'true', is_unlocked: false } as any;
      }

      case 'setup_mini_vault': {
        localStorage.setItem('mini_vault_setup', 'true');
        localStorage.setItem('mini_vault_pin', args.input?.pin);
        return undefined as any;
      }

      case 'unlock_mini_vault': {
        const saved = localStorage.getItem('mini_vault_pin');
        if (saved === args.input?.pin) return undefined as any;
        throw new Error('Invalid PIN');
      }

      case 'list_mini_entries': return [] as any;
      case 'list_mini_notes': return [] as any;

      case 'copy_entry_secret':
      case 'copy_to_clipboard': {
        console.log(`[API Mock] Copied to clipboard!`);
        return undefined as any;
      }

      default:
        throw new Error(`Command '${cmd}' not mocked.`);
    }
  }
}
