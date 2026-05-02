use crate::crypto::{EncryptedField, SecretKey, NONCE_LEN};
use rusqlite::{params, Connection};
use serde::Serialize;
use std::path::{Path, PathBuf};
use thiserror::Error;
use zeroize::Zeroize;

#[derive(Debug, Error)]
pub enum DbError {
    #[error("invalid key")]
    InvalidKey,
    #[error("invalid nonce")]
    InvalidNonce,
    #[error("not found")]
    NotFound,
    #[error("invalid merge: need at least two distinct groups")]
    InvalidMerge,
    #[error("database error")]
    Sql(#[from] rusqlite::Error),
    #[error("io error")]
    Io(#[from] std::io::Error),
}

#[derive(Clone)]
pub struct VaultDb {
    path: PathBuf,
}

impl VaultDb {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn create_new(&self, key: &SecretKey) -> Result<(), DbError> {
        let conn = self.open(key)?;
        self.create_schema(&conn)?;
        Ok(())
    }

    pub fn verify_key(&self, key: &SecretKey) -> Result<(), DbError> {
        let conn = self.open(key)?;
        let result: Result<String, rusqlite::Error> = conn.query_row(
            "SELECT value FROM meta WHERE key = 'schema_version' LIMIT 1",
            [],
            |row| row.get(0),
        );
        match result {
            Ok(_) => Ok(()),
            Err(_) => Err(DbError::InvalidKey),
        }
    }

    pub fn list_entries(
        &self,
        key: &SecretKey,
        filter: EntryFilter,
    ) -> Result<Vec<EntrySummary>, DbError> {
        let conn = self.open(key)?;
        let query = if filter.trashed_only {
            "SELECT entry_id, title, username, url, group_id, favorite, trashed, created_at, updated_at \
             FROM entries WHERE trashed = 1 ORDER BY updated_at DESC"
        } else if filter.favorites_only {
            "SELECT entry_id, title, username, url, group_id, favorite, trashed, created_at, updated_at \
             FROM entries WHERE favorite = 1 AND trashed = 0 ORDER BY updated_at DESC"
        } else {
            "SELECT entry_id, title, username, url, group_id, favorite, trashed, created_at, updated_at \
             FROM entries WHERE trashed = 0 ORDER BY updated_at DESC"
        };

        let mut stmt = conn.prepare(query)?;
        let mut rows = stmt.query([])?;
        let mut entries = Vec::new();

        while let Some(row) = rows.next()? {
            entries.push(EntrySummary {
                entry_id: row.get(0)?,
                title: row.get(1)?,
                username: row.get(2)?,
                url: row.get(3)?,
                group_id: row.get(4)?,
                favorite: row.get::<_, i64>(5)? != 0,
                trashed: row.get::<_, i64>(6)? != 0,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            });
        }

        Ok(entries)
    }

    pub fn insert_entry(&self, key: &SecretKey, entry: NewEntryEncrypted) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "INSERT INTO entries \
             (entry_id, title, username, url, group_id, password_nonce, password_ct, notes_nonce, notes_ct, \
              favorite, trashed, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                entry.entry_id,
                entry.title,
                entry.username,
                entry.url,
                entry.group_id,
                entry.password.nonce.to_vec(),
                entry.password.ciphertext,
                entry.notes.nonce.to_vec(),
                entry.notes.ciphertext,
                bool_to_int(entry.favorite),
                bool_to_int(entry.trashed),
                entry.created_at,
                entry.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn update_entry(
        &self,
        key: &SecretKey,
        entry: UpdateEntryEncrypted,
    ) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "UPDATE entries SET title = ?1, username = ?2, url = ?3, group_id = ?4, \
             password_nonce = ?5, password_ct = ?6, notes_nonce = ?7, notes_ct = ?8, \
             favorite = ?9, trashed = ?10, updated_at = ?11 \
             WHERE entry_id = ?12",
            params![
                entry.title,
                entry.username,
                entry.url,
                entry.group_id,
                entry.password.nonce.to_vec(),
                entry.password.ciphertext,
                entry.notes.nonce.to_vec(),
                entry.notes.ciphertext,
                bool_to_int(entry.favorite),
                bool_to_int(entry.trashed),
                entry.updated_at,
                entry.entry_id
            ],
        )?;
        Ok(())
    }

    pub fn set_favorite(
        &self,
        key: &SecretKey,
        entry_id: &str,
        favorite: bool,
        updated_at: i64,
    ) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "UPDATE entries SET favorite = ?1, updated_at = ?2 WHERE entry_id = ?3",
            params![bool_to_int(favorite), updated_at, entry_id],
        )?;
        Ok(())
    }

    pub fn set_trashed(
        &self,
        key: &SecretKey,
        entry_id: &str,
        trashed: bool,
        updated_at: i64,
    ) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "UPDATE entries SET trashed = ?1, updated_at = ?2 WHERE entry_id = ?3",
            params![bool_to_int(trashed), updated_at, entry_id],
        )?;
        Ok(())
    }

    pub fn delete_entry(&self, key: &SecretKey, entry_id: &str) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute("DELETE FROM entries WHERE entry_id = ?1", params![entry_id])?;
        Ok(())
    }

    pub fn list_groups(&self, key: &SecretKey) -> Result<Vec<GroupSummary>, DbError> {
        let conn = self.open(key)?;
        let mut stmt = conn.prepare(
            "SELECT group_id, name, color, created_at, updated_at FROM groups ORDER BY name COLLATE NOCASE",
        )?;
        let mut rows = stmt.query([])?;
        let mut groups = Vec::new();

        while let Some(row) = rows.next()? {
            groups.push(GroupSummary {
                group_id: row.get(0)?,
                name: row.get(1)?,
                color: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            });
        }

        Ok(groups)
    }

    pub fn insert_group(&self, key: &SecretKey, group: NewGroup) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "INSERT INTO groups (group_id, name, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                group.group_id,
                group.name,
                group.color,
                group.created_at,
                group.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn delete_group(&self, key: &SecretKey, group_id: &str) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "UPDATE entries SET group_id = NULL WHERE group_id = ?1",
            params![group_id],
        )?;
        conn.execute(
            "DELETE FROM groups WHERE group_id = ?1",
            params![group_id],
        )?;
        Ok(())
    }

    pub fn update_group_name(
        &self,
        key: &SecretKey,
        group_id: &str,
        name: &str,
        now: i64,
    ) -> Result<GroupSummary, DbError> {
        let conn = self.open(key)?;
        let changed = conn.execute(
            "UPDATE groups SET name = ?1, updated_at = ?2 WHERE group_id = ?3",
            params![name, now, group_id],
        )?;
        if changed == 0 {
            return Err(DbError::NotFound);
        }
        conn.query_row(
            "SELECT group_id, name, color, created_at, updated_at FROM groups WHERE group_id = ?1",
            params![group_id],
            |row| {
                Ok(GroupSummary {
                    group_id: row.get(0)?,
                    name: row.get(1)?,
                    color: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            },
        )
        .map_err(Into::into)
    }

    /// Moves all entries from `source_group_ids` into a new group, then deletes the source group rows.
    pub fn merge_groups_into_new(
        &self,
        key: &SecretKey,
        source_group_ids: &[String],
        new_group: NewGroup,
        entry_updated_at: i64,
    ) -> Result<GroupSummary, DbError> {
        if source_group_ids.len() < 2 {
            return Err(DbError::InvalidMerge);
        }
        let mut ids: Vec<&String> = source_group_ids.iter().collect();
        ids.sort_by(|a, b| a.cmp(b));
        ids.dedup();
        if ids.len() < 2 {
            return Err(DbError::InvalidMerge);
        }

        let mut conn = self.open(key)?;
        let tx = conn.transaction()?;
        tx.execute(
            "INSERT INTO groups (group_id, name, color, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                new_group.group_id,
                new_group.name,
                new_group.color,
                new_group.created_at,
                new_group.updated_at
            ],
        )?;
        for sid in &ids {
            tx.execute(
                "UPDATE entries SET group_id = ?1, updated_at = ?2 WHERE group_id = ?3",
                params![new_group.group_id, entry_updated_at, *sid],
            )?;
            tx.execute("DELETE FROM groups WHERE group_id = ?1", params![*sid])?;
        }
        tx.commit()?;
        Ok(GroupSummary {
            group_id: new_group.group_id,
            name: new_group.name,
            color: new_group.color,
            created_at: new_group.created_at,
            updated_at: new_group.updated_at,
        })
    }

    pub fn clean_empty_groups(&self, key: &SecretKey) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "DELETE FROM groups WHERE group_id NOT IN (SELECT group_id FROM entries WHERE group_id IS NOT NULL)",
            [],
        )?;
        Ok(())
    }

    pub fn log_event(
        &self,
        key: &SecretKey,
        event: &str,
        details: &str,
        created_at: i64,
    ) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "INSERT INTO audit_log (event, details, created_at) VALUES (?1, ?2, ?3)",
            params![event, details, created_at],
        )?;
        Ok(())
    }

    pub fn fetch_secrets(
        &self,
        key: &SecretKey,
        entry_id: &str,
    ) -> Result<EncryptedSecrets, DbError> {
        let conn = self.open(key)?;
        let (pw_nonce, pw_ct, notes_nonce, notes_ct) = conn.query_row(
            "SELECT password_nonce, password_ct, notes_nonce, notes_ct FROM entries WHERE entry_id = ?1",
            params![entry_id],
            |row| {
                Ok((
                    row.get::<_, Vec<u8>>(0)?,
                    row.get::<_, Vec<u8>>(1)?,
                    row.get::<_, Vec<u8>>(2)?,
                    row.get::<_, Vec<u8>>(3)?,
                ))
            },
        )?;

        Ok(EncryptedSecrets {
            password: EncryptedField {
                nonce: nonce_from_vec(pw_nonce)?,
                ciphertext: pw_ct,
            },
            notes: EncryptedField {
                nonce: nonce_from_vec(notes_nonce)?,
                ciphertext: notes_ct,
            },
        })
    }

    pub fn rekey_database(&self, old_key: &SecretKey, new_key: &SecretKey) -> Result<(), DbError> {
        let conn = self.open(old_key)?;
        let mut key_hex = hex::encode(new_key.as_bytes());
        let mut pragma_rekey = format!("x'{}'", key_hex);
        conn.pragma_update(None, "rekey", &pragma_rekey)?;
        pragma_rekey.zeroize();
        key_hex.zeroize();
        Ok(())
    }

    pub fn list_all_secrets(&self, key: &SecretKey) -> Result<Vec<(String, EncryptedSecrets)>, DbError> {
        let conn = self.open(key)?;
        let mut stmt = conn.prepare("SELECT entry_id, password_nonce, password_ct, notes_nonce, notes_ct FROM entries")?;
        let mut rows = stmt.query([])?;
        let mut results = Vec::new();

        while let Some(row) = rows.next()? {
            let id: String = row.get(0)?;
            results.push((id, EncryptedSecrets {
                password: EncryptedField {
                    nonce: nonce_from_vec(row.get(1)?)?,
                    ciphertext: row.get(2)?,
                },
                notes: EncryptedField {
                    nonce: nonce_from_vec(row.get(3)?)?,
                    ciphertext: row.get(4)?,
                },
            }));
        }
        Ok(results)
    }

    pub fn update_entry_secrets(&self, key: &SecretKey, entry_id: &str, secrets: &EncryptedSecrets) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "UPDATE entries SET password_nonce = ?1, password_ct = ?2, notes_nonce = ?3, notes_ct = ?4 WHERE entry_id = ?5",
            params![
                secrets.password.nonce.to_vec(),
                secrets.password.ciphertext,
                secrets.notes.nonce.to_vec(),
                secrets.notes.ciphertext,
                entry_id
            ],
        )?;
        Ok(())
    }

    fn open(&self, key: &SecretKey) -> Result<Connection, DbError> {
        let conn = Connection::open(&self.path)?;
        apply_pragmas(&conn, key)?;
        self.migrate_schema(&conn)?;
        Ok(conn)
    }

    fn create_schema(&self, conn: &Connection) -> Result<(), DbError> {
        conn.execute_batch(
            "PRAGMA secure_delete = ON;
             CREATE TABLE IF NOT EXISTS meta (
                 key TEXT PRIMARY KEY,
                 value TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS entries (
                 entry_id TEXT PRIMARY KEY,
                 title TEXT NOT NULL,
                 username TEXT NOT NULL,
                 url TEXT NOT NULL,
                 group_id TEXT,
                 password_nonce BLOB NOT NULL,
                 password_ct BLOB NOT NULL,
                 notes_nonce BLOB NOT NULL,
                 notes_ct BLOB NOT NULL,
                 favorite INTEGER NOT NULL DEFAULT 0,
                 trashed INTEGER NOT NULL DEFAULT 0,
                 created_at INTEGER NOT NULL,
                 updated_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS groups (
                 group_id TEXT PRIMARY KEY,
                 name TEXT NOT NULL,
                 color TEXT NOT NULL,
                 created_at INTEGER NOT NULL,
                 updated_at INTEGER NOT NULL
             );
             CREATE INDEX IF NOT EXISTS idx_entries_updated_at ON entries(updated_at);
             CREATE INDEX IF NOT EXISTS idx_entries_favorite ON entries(favorite);
             CREATE INDEX IF NOT EXISTS idx_entries_trashed ON entries(trashed);
             CREATE INDEX IF NOT EXISTS idx_entries_group_id ON entries(group_id);
             CREATE TABLE IF NOT EXISTS audit_log (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 event TEXT NOT NULL,
                 details TEXT NOT NULL,
                 created_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS mini_entries (
                 entry_id TEXT PRIMARY KEY,
                 title TEXT NOT NULL,
                 username TEXT NOT NULL,
                 category TEXT NOT NULL DEFAULT '',
                 url TEXT NOT NULL DEFAULT '',
                 password_nonce BLOB NOT NULL,
                 password_ct BLOB NOT NULL,
                 notes_nonce BLOB,
                 notes_ct BLOB,
                 created_at INTEGER NOT NULL,
                 updated_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS mini_notes (
                 id INTEGER PRIMARY KEY AUTOINCREMENT,
                 title TEXT NOT NULL,
                 content_nonce BLOB NOT NULL,
                 content_ct BLOB NOT NULL,
                 created_at INTEGER NOT NULL,
                 updated_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS mini_vault_config (
                 key TEXT PRIMARY KEY,
                 value TEXT NOT NULL
             );
            ",
        )?;
        conn.execute(
            "INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version', '5')",
            [],
        )?;
        Ok(())
    }

    fn migrate_schema(&self, conn: &Connection) -> Result<(), DbError> {
        // Robust table creation - ensure these always exist first
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS mini_entries (
                entry_id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                username TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT '',
                url TEXT NOT NULL DEFAULT '',
                password_nonce BLOB NOT NULL,
                password_ct BLOB NOT NULL,
                notes_nonce BLOB,
                notes_ct BLOB,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS mini_notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                content_nonce BLOB NOT NULL,
                content_ct BLOB NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS mini_vault_config (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            "
        )?;

        let meta_exists: bool = conn
            .query_row(
                "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'",
                [],
                |_| Ok(1),
            )
            .is_ok();

        if !meta_exists {
            return Ok(());
        }

        let version: i64 = conn
            .query_row(
                "SELECT value FROM meta WHERE key = 'schema_version' LIMIT 1",
                [],
                |row| row.get::<_, String>(0),
            )
            .ok()
            .and_then(|value| value.parse::<i64>().ok())
            .unwrap_or(1);

        if version < 2 {
            let _ = conn.execute_batch(
                "ALTER TABLE entries ADD COLUMN group_id TEXT;
                 CREATE TABLE IF NOT EXISTS groups (
                     group_id TEXT PRIMARY KEY,
                     name TEXT NOT NULL,
                     color TEXT NOT NULL,
                     created_at INTEGER NOT NULL,
                     updated_at INTEGER NOT NULL
                 );
                 CREATE INDEX IF NOT EXISTS idx_entries_group_id ON entries(group_id);
                 UPDATE meta SET value = '2' WHERE key = 'schema_version';",
            );
        }

        // Version-independent robust column check
        let mini_entries_cols = [
            ("category", "TEXT NOT NULL DEFAULT ''"),
            ("url", "TEXT NOT NULL DEFAULT ''"),
            ("notes_nonce", "BLOB"),
            ("notes_ct", "BLOB"),
        ];

        for (name, def) in mini_entries_cols {
            let has_col: bool = conn.query_row(
                &format!("SELECT count(*) FROM pragma_table_info('mini_entries') WHERE name='{}'", name),
                [],
                |row| row.get(0),
            ).unwrap_or(0) > 0;

            if !has_col {
                let _ = conn.execute(&format!("ALTER TABLE mini_entries ADD COLUMN {} {}", name, def), []);
            }
        }

        if version < 5 {
            conn.execute("UPDATE meta SET value = '5' WHERE key = 'schema_version'", [])?;
        }

        Ok(())
    }

    pub fn get_mini_config(&self, key: &SecretKey, config_key: &str) -> Result<Option<String>, DbError> {
        let conn = self.open(key)?;
        let result: Result<String, rusqlite::Error> = conn.query_row(
            "SELECT value FROM mini_vault_config WHERE key = ?1 LIMIT 1",
            params![config_key],
            |row| row.get(0),
        );
        match result {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(DbError::Sql(e)),
        }
    }

    pub fn set_mini_config(&self, key: &SecretKey, config_key: &str, value: &str) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "INSERT OR REPLACE INTO mini_vault_config (key, value) VALUES (?1, ?2)",
            params![config_key, value],
        )?;
        Ok(())
    }

    pub fn list_mini_entries(&self, key: &SecretKey) -> Result<Vec<MiniEntrySummary>, DbError> {
        let conn = self.open(key)?;
        let mut stmt = conn.prepare("SELECT entry_id, title, username, category, url, created_at, updated_at FROM mini_entries ORDER BY updated_at DESC")?;
        let mut rows = stmt.query([])?;
        let mut entries = Vec::new();
        while let Some(row) = rows.next()? {
            entries.push(MiniEntrySummary {
                entry_id: row.get(0)?,
                title: row.get(1)?,
                username: row.get(2)?,
                category: row.get(3)?,
                url: row.get(4)?,
                created_at: row.get(5)?,
                updated_at: row.get(6)?,
            });
        }
        Ok(entries)
    }

    pub fn insert_mini_entry(&self, key: &SecretKey, entry: NewMiniEntryEncrypted) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "INSERT INTO mini_entries (entry_id, title, username, category, url, password_nonce, password_ct, notes_nonce, notes_ct, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                entry.entry_id,
                entry.title,
                entry.username,
                entry.category,
                entry.url,
                entry.password.nonce.to_vec(),
                entry.password.ciphertext,
                entry.notes.as_ref().map(|n| n.nonce.to_vec()),
                entry.notes.as_ref().map(|n| n.ciphertext.clone()),
                entry.created_at,
                entry.updated_at,
            ],
        )?;
        Ok(())
    }

    pub fn update_mini_entry(&self, key: &SecretKey, entry: NewMiniEntryEncrypted) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "UPDATE mini_entries SET title = ?1, username = ?2, category = ?3, url = ?4, password_nonce = ?5, password_ct = ?6, notes_nonce = ?7, notes_ct = ?8, updated_at = ?9 WHERE entry_id = ?10",
            params![
                entry.title,
                entry.username,
                entry.category,
                entry.url,
                entry.password.nonce.to_vec(),
                entry.password.ciphertext,
                entry.notes.as_ref().map(|n| n.nonce.to_vec()),
                entry.notes.as_ref().map(|n| n.ciphertext.clone()),
                entry.updated_at,
                entry.entry_id,
            ],
        )?;
        Ok(())
    }

    pub fn update_mini_note(&self, key: &SecretKey, id: i64, title: &str, content: EncryptedField, updated_at: i64) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "UPDATE mini_notes SET title = ?1, content_nonce = ?2, content_ct = ?3, updated_at = ?4 WHERE id = ?5",
            params![
                title,
                content.nonce.to_vec(),
                content.ciphertext,
                updated_at,
                id,
            ],
        )?;
        Ok(())
    }

    pub fn delete_mini_entry(&self, key: &SecretKey, id: &str) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute("DELETE FROM mini_entries WHERE entry_id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_mini_notes(&self, key: &SecretKey) -> Result<Vec<MiniNoteSummary>, DbError> {
        let conn = self.open(key)?;
        let mut stmt = conn.prepare("SELECT id, title, created_at, updated_at FROM mini_notes ORDER BY created_at DESC")?;
        let rows = stmt.query_map([], |row| {
            Ok(MiniNoteSummary {
                id: row.get(0)?,
                title: row.get(1)?,
                created_at: row.get(2)?,
                updated_at: row.get(3)?,
            })
        })?;
        let mut notes = Vec::new();
        for note in rows {
            notes.push(note?);
        }
        Ok(notes)
    }

    pub fn insert_mini_note(&self, key: &SecretKey, note: NewMiniNoteEncrypted) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute(
            "INSERT INTO mini_notes (title, content_nonce, content_ct, created_at, updated_at) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                note.title,
                note.content.nonce.to_vec(),
                note.content.ciphertext,
                note.created_at,
                note.updated_at
            ],
        )?;
        Ok(())
    }

    pub fn delete_mini_note(&self, key: &SecretKey, id: i64) -> Result<(), DbError> {
        let conn = self.open(key)?;
        conn.execute("DELETE FROM mini_notes WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn get_mini_entry_secrets(&self, key: &SecretKey, id: &str) -> Result<EncryptedSecrets, DbError> {
        let conn = self.open(key)?;
        conn.query_row(
            "SELECT password_nonce, password_ct, notes_nonce, notes_ct FROM mini_entries WHERE entry_id = ?1",
            params![id],
            |row| {
                let p_nonce: Vec<u8> = row.get(0)?;
                let p_ct: Vec<u8> = row.get(1)?;
                let n_nonce: Option<Vec<u8>> = row.get(2)?;
                let n_ct: Option<Vec<u8>> = row.get(3)?;
                
                let p_nonce_arr = nonce_from_vec(p_nonce).map_err(|_| rusqlite::Error::InvalidQuery)?;
                let n_nonce_arr = n_nonce.and_then(|v| nonce_from_vec(v).ok()).unwrap_or([0u8; NONCE_LEN]);

                Ok(EncryptedSecrets {
                    password: EncryptedField {
                        nonce: p_nonce_arr,
                        ciphertext: p_ct,
                    },
                    notes: EncryptedField {
                        nonce: n_nonce_arr,
                        ciphertext: n_ct.unwrap_or_default(),
                    },
                })
            },
        ).map_err(DbError::Sql)
    }

    pub fn get_mini_entry_password(&self, key: &SecretKey, id: &str) -> Result<EncryptedField, DbError> {
        let conn = self.open(key)?;
        conn.query_row(
            "SELECT password_nonce, password_ct FROM mini_entries WHERE entry_id = ?1",
            params![id],
            |row| {
                let nonce_vec: Vec<u8> = row.get(0)?;
                let nonce = nonce_from_vec(nonce_vec).map_err(|_| rusqlite::Error::InvalidQuery)?;
                Ok(EncryptedField {
                    nonce,
                    ciphertext: row.get(1)?,
                })
            },
        ).map_err(DbError::Sql)
    }

    pub fn get_mini_note_content(&self, key: &SecretKey, id: i64) -> Result<EncryptedField, DbError> {
        let conn = self.open(key)?;
        conn.query_row(
            "SELECT content_nonce, content_ct FROM mini_notes WHERE id = ?1",
            params![id],
            |row| {
                let nonce_vec: Vec<u8> = row.get(0)?;
                let nonce = nonce_from_vec(nonce_vec).map_err(|_| rusqlite::Error::InvalidQuery)?;
                Ok(EncryptedField {
                    nonce,
                    ciphertext: row.get(1)?,
                })
            },
        ).map_err(DbError::Sql)
    }
}

#[derive(Debug, Serialize)]
pub struct EntrySummary {
    pub entry_id: String,
    pub title: String,
    pub username: String,
    pub url: String,
    pub group_id: Option<String>,
    pub favorite: bool,
    pub trashed: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize)]
pub struct GroupSummary {
    pub group_id: String,
    pub name: String,
    pub color: String,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct NewEntryEncrypted {
    pub entry_id: String,
    pub title: String,
    pub username: String,
    pub url: String,
    pub group_id: Option<String>,
    pub password: EncryptedField,
    pub notes: EncryptedField,
    pub favorite: bool,
    pub trashed: bool,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct UpdateEntryEncrypted {
    pub entry_id: String,
    pub title: String,
    pub username: String,
    pub url: String,
    pub group_id: Option<String>,
    pub password: EncryptedField,
    pub notes: EncryptedField,
    pub favorite: bool,
    pub trashed: bool,
    pub updated_at: i64,
}

pub struct NewGroup {
    pub group_id: String,
    pub name: String,
    pub color: String,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct NewMiniEntryEncrypted {
    pub entry_id: String,
    pub title: String,
    pub username: String,
    pub category: String,
    pub url: String,
    pub password: EncryptedField,
    pub notes: Option<EncryptedField>,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct NewMiniNoteEncrypted {
    pub title: String,
    pub content: EncryptedField,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize)]
pub struct MiniEntrySummary {
    pub entry_id: String,
    pub title: String,
    pub username: String,
    pub category: String,
    pub url: String,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Serialize)]
pub struct MiniNoteSummary {
    pub id: i64,
    pub title: String,
    pub created_at: i64,
    pub updated_at: i64,
}

pub struct EntryFilter {
    pub favorites_only: bool,
    pub trashed_only: bool,
}

pub struct EncryptedSecrets {
    pub password: EncryptedField,
    pub notes: EncryptedField,
}

fn apply_pragmas(conn: &Connection, key: &SecretKey) -> Result<(), DbError> {
    let mut key_hex = hex::encode(key.as_bytes());
    let mut pragma_key = format!("x'{}'", key_hex);
    conn.pragma_update(None, "cipher_page_size", &4096)?;
    conn.pragma_update(None, "kdf_iter", &256000)?;
    conn.pragma_update(None, "key", &pragma_key)?;
    conn.pragma_update(None, "foreign_keys", &1)?;
    pragma_key.zeroize();
    key_hex.zeroize();
    Ok(())
}

fn bool_to_int(value: bool) -> i64 {
    if value {
        1
    } else {
        0
    }
}

fn nonce_from_vec(value: Vec<u8>) -> Result<[u8; NONCE_LEN], DbError> {
    if value.len() != NONCE_LEN {
        return Err(DbError::InvalidNonce);
    }
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&value);
    Ok(nonce)
}
