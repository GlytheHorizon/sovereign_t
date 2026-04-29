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

// Ensure Tauri invoke exists to differentiate between real and fallback environment
const tauriInvokeFn = (window as any).__TAURI__?.core?.invoke || (window as any).__TAURI__?.invoke;
const isTauri = typeof tauriInvokeFn === 'function';

// Fallback Mock Data
let mockDb: EntrySummary[] = [];
let mockGroups: GroupSummary[] = [];

// Helper to simulate network delay for mock
const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export async function invoke<T>(cmd: string, args: Record<string, any> = {}): Promise<T> {
  if (isTauri) {
    return tauriInvokeFn(cmd, args);
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
        const entry = mockDb.find((e) => e.entry_id === args.entry_id);
        if (entry) entry.favorite = args.favorite;
        return undefined as any;
      }

      case 'move_to_trash': {
        const e1 = mockDb.find((e) => e.entry_id === args.entry_id);
        if (e1) e1.trashed = true;
        return undefined as any;
      }

      case 'restore_from_trash': {
        const e2 = mockDb.find((e) => e.entry_id === args.entry_id);
        if (e2) e2.trashed = false;
        return undefined as any;
      }

      case 'delete_entry': {
        mockDb = mockDb.filter((e) => e.entry_id !== args.entry_id);
        return undefined as any;
      }

      case 'generate_password': {
        return 'Mock-Secure-Pass-123!' as any;
      }

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
