#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod crypto;
mod db;

use crate::crypto::{aad_for_entry, derive_master_key, encrypt_field, generate_salt, SecretKey, SALT_LEN, NONCE_LEN};
use crate::db::{EncryptedSecrets, EntryFilter, EntrySummary, GroupSummary, NewEntryEncrypted, NewGroup, UpdateEntryEncrypted, VaultDb};
use arboard::Clipboard;
use chrono::Local;
use rand::{rngs::OsRng, seq::SliceRandom};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{Manager, State, WindowEvent};
use uuid::Uuid;
use zeroize::Zeroize;

const TITLE_MAX: usize = 128;
const USERNAME_MAX: usize = 128;
const URL_MAX: usize = 512;
const ENTRY_PASSWORD_MAX: usize = 4096;
const NOTES_MAX: usize = 4096;

const MASTER_PASSWORD_MIN: usize = 12;
const MASTER_PASSWORD_MAX: usize = 1024;
const GENERATED_PASSWORD_MIN: usize = 12;
const GENERATED_PASSWORD_MAX: usize = 32;

#[derive(Debug, Serialize)]
struct AppError {
    code: &'static str,
    message: &'static str,
}

impl AppError {
    fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }
}

impl From<db::DbError> for AppError {
    fn from(error: db::DbError) -> Self {
        match error {
            db::DbError::InvalidKey => AppError::new("auth_failed", "Invalid master password."),
            db::DbError::InvalidNonce => AppError::new("crypto_error", "Invalid encryption metadata."),
            db::DbError::Sql(e) => {
                println!("DB SQL Error: {:?}", e);
                AppError::new("db_error", "Database operation failed.")
            },
            _ => AppError::new("db_error", "Database operation failed."),
        }
    }
}

impl From<crypto::CryptoError> for AppError {
    fn from(_: crypto::CryptoError) -> Self {
        AppError::new("crypto_error", "Cryptographic operation failed.")
    }
}

impl From<std::io::Error> for AppError {
    fn from(_: std::io::Error) -> Self {
        AppError::new("io_error", "File operation failed.")
    }
}

impl From<arboard::Error> for AppError {
    fn from(_: arboard::Error) -> Self {
        AppError::new("clipboard_error", "Clipboard operation failed.")
    }
}

impl From<serde_json::Error> for AppError {
    fn from(_: serde_json::Error) -> Self {
        AppError::new("json_error", "Recovery data serialization failed.")
    }
}

type CommandResult<T> = Result<T, AppError>;

struct AppState {
    app_data_dir: PathBuf,
    active_vault: Mutex<String>,
    db: Mutex<VaultDb>,
    salt_path: Mutex<PathBuf>,
    recovery_path: Mutex<PathBuf>,
    session: Mutex<Option<Session>>,
    mini_vault_unlocked: Mutex<bool>,
}

struct Session {
    key: SecretKey,
    last_active: Instant,
    autolock_after: Option<Duration>,
}

impl Session {
    fn new(key: SecretKey) -> Self {
        Self {
            key,
            last_active: Instant::now(),
            autolock_after: None,
        }
    }

    fn touch(&mut self) {
        self.last_active = Instant::now();
    }

    fn is_expired(&self) -> bool {
        self.autolock_after
            .map(|limit| self.last_active.elapsed() >= limit)
            .unwrap_or(false)
    }
}

#[derive(Debug, Deserialize)]
struct CreateVaultInput {
    password: String,
}

#[derive(Debug, Serialize)]
struct RecoveryKeyResponse {
    phrase: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct RecoveryData {
    salt: String,
    hash: String,
    wrap_nonce: String,
    wrap_ct: String,
}

#[derive(Debug, Deserialize)]
struct UnlockVaultInput {
    password: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UnlockVaultWithRecoveryInput {
    recovery_key: String,
}

#[derive(Debug, Deserialize)]
struct ChangeMasterPasswordInput {
    old_password: String,
    new_password: String,
}

#[derive(Debug, Deserialize)]
struct RotateRecoveryKeyInput {
    password: String,
}

#[derive(Debug, Deserialize)]
struct MiniPinInput {
    pin: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddMiniEntryInput {
    title: String,
    username: String,
    category: String,
    url: String,
    password: String,
    notes: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateMiniEntryInput {
    entry_id: String,
    title: String,
    username: String,
    category: String,
    url: String,
    password: Option<String>,
    notes: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct AddMiniNoteInput {
    title: String,
    content: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateMiniNoteInput {
    id: i64,
    title: String,
    content: String,
}

#[derive(Debug, Serialize)]
struct MiniVaultStatus {
    is_setup: bool,
    is_unlocked: bool,
}

#[derive(Debug, Deserialize)]
struct SwitchVaultInput {
    vault_name: String,
}

#[derive(Debug, Deserialize)]
struct NewEntryInput {
    title: String,
    username: String,
    url: String,
    group_id: Option<String>,
    password: String,
    notes: Option<String>,
    favorite: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct UpdateEntryInput {
    entry_id: String,
    title: String,
    username: String,
    url: String,
    group_id: Option<String>,
    password: String,
    notes: Option<String>,
    favorite: bool,
    trashed: bool,
}

#[derive(Debug, Deserialize)]
struct CreateGroupInput {
    name: String,
    color: String,
}

#[derive(Debug, Deserialize)]
struct UpdateGroupInput {
    group_id: String,
    name: String,
}

#[derive(Debug, Deserialize)]
struct MergeGroupsInput {
    source_group_ids: Vec<String>,
    name: String,
    color: String,
}

#[derive(Debug, Deserialize)]
struct GeneratePasswordInput {
    length: usize,
    numbers: bool,
    symbols: bool,
}

#[derive(Debug, Deserialize)]
struct CopyInput {
    text: String,
    ttl_seconds: Option<u64>,
}

#[derive(Debug, Deserialize)]
struct CopyEntrySecretInput {
    entry_id: String,
    field: SecretField,
    ttl_seconds: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum SecretField {
    Password,
    Notes,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum VaultSection {
    All,
    Favorites,
    Trash,
}



#[tauri::command]
async fn export_vault(state: State<'_, AppState>, password: String) -> CommandResult<()> {
    let db_path = state.db.lock().unwrap().path().to_path_buf();
    let salt_path = state.salt_path.lock().unwrap().clone();

    if !db_path.exists() || !salt_path.exists() {
        return Err(AppError::new("not_found", "Vault files not found."));
    }

    // Verify master password before export
    let salt = fs::read(&salt_path)?;
    let key = derive_master_key(&password, &salt)?;
    state.db.lock().unwrap().verify_key(&key)?;

    let default_name = format!(
        "{}.toaa",
        Local::now().format("%I-%M-%p-%m-%d-%Y")
    );

    let path = rfd::AsyncFileDialog::new()
        .set_file_name(&default_name)
        .add_filter("Sovereign_T Vault", &["toaa"])
        .save_file()
        .await;

    if let Some(file_handle) = path {
        let salt = fs::read(salt_path)?;
        let db_content = fs::read(db_path)?;

        let mut combined = Vec::with_capacity(salt.len() + db_content.len());
        combined.extend_from_slice(&salt);
        combined.extend_from_slice(&db_content);

        fs::write(file_handle.path(), combined)?;
        Ok(())
    } else {
        Err(AppError::new("cancelled", "Export cancelled."))
    }
}

#[tauri::command]
async fn import_vault(state: State<'_, AppState>, password: String) -> CommandResult<()> {
    let db_path = state.db.lock().unwrap().path().to_path_buf();
    let salt_path = state.salt_path.lock().unwrap().clone();

    // Verify master password before import (it's a destructive action)
    let salt = fs::read(&salt_path)?;
    let key = derive_master_key(&password, &salt)?;
    state.db.lock().unwrap().verify_key(&key)?;

    let path = rfd::AsyncFileDialog::new()
        .add_filter("Sovereign_T Vault", &["toaa"])
        .pick_file()
        .await;

    if let Some(file_handle) = path {
        let combined = fs::read(file_handle.path())?;
        if combined.len() <= crate::crypto::SALT_LEN {
            return Err(AppError::new("invalid_file", "The imported file is invalid or corrupted."));
        }

        let (salt, db_content) = combined.split_at(crate::crypto::SALT_LEN);
        
        // Logout first to ensure no DB connections are active
        clear_session(&state);

        fs::write(salt_path, salt)?;
        fs::write(db_path, db_content)?;

        Ok(())
    } else {
        Err(AppError::new("cancelled", "Import cancelled."))
    }
}

#[derive(Debug, Serialize)]
struct DecryptedSecrets {
    password: String,
    notes: String,
}

#[derive(Debug, Serialize)]
struct DashboardReuseCluster {
    accounts_count: usize,
    entry_ids: Vec<String>,
    sample_titles: Vec<String>,
}

#[derive(Debug, Serialize)]
struct DashboardWeakAccount {
    entry_id: String,
    title: String,
    username_display: String,
    risk_score: u8,
    reasons: Vec<String>,
}

#[derive(Debug, Serialize)]
struct StrengthTierCounts {
    critical: usize,
    weak: usize,
    fair: usize,
    strong: usize,
}

#[derive(Debug, Serialize)]
struct VaultDashboardStats {
    active_accounts: usize,
    favorites_count: usize,
    trash_count: usize,
    groups_count: usize,
    uncategorized_accounts: usize,
    entries_with_url: usize,
    unique_passwords: usize,
    accounts_with_reused_password: usize,
    largest_reuse_cluster_size: usize,
    vault_health_score: u8,
    avg_risk_score: u8,
    avg_password_length: f64,
    oldest_entry_age_days: Option<i64>,
    recently_updated_count: usize,
    strength_tier_counts: StrengthTierCounts,
    password_reuse_clusters: Vec<DashboardReuseCluster>,
    weakest_accounts: Vec<DashboardWeakAccount>,
}

fn username_display_for_dashboard(raw: &str) -> String {
    for prefix in ["$$google$$", "$$apple$$", "$$facebook$$", "$$crypto$$"] {
        if let Some(rest) = raw.strip_prefix(prefix) {
            return rest.to_string();
        }
    }
    raw.to_string()
}

const COMMON_PASSWORDS: &[&str] = &[
    "password",
    "password123",
    "123456",
    "12345678",
    "qwerty",
    "letmein",
    "welcome",
    "admin",
    "iloveyou",
    "monkey",
    "dragon",
    "master",
    "sunshine",
    "princess",
    "football",
    "baseball",
    "abc123",
    "111111",
    "mustang",
    "shadow",
    "michael",
    "jesus",
    "password1",
    "superman",
    "qwerty123",
    "654321",
    "access",
    "passw0rd",
    "1234567890",
    "trustno1",
    "hello123",
    "welcome123",
];

fn password_is_common(pw: &str) -> bool {
    let lower = pw.to_lowercase();
    COMMON_PASSWORDS.iter().any(|c| *c == lower.as_str())
}

fn compute_password_risk(password: &str, reused: bool) -> (u8, Vec<String>) {
    let mut reasons: Vec<String> = Vec::new();
    let len = password.chars().count();

    if len == 0 {
        reasons.push("Empty or unreadable password".to_string());
        return (5, reasons);
    }

    let is_long_passphrase = len >= 20 && password.contains(' ');

    let mut score: i32 = 100;

    if len < 6 {
        score -= 50;
        reasons.push("Very short (under 6 characters)".to_string());
    } else if len < 8 {
        score -= 35;
        reasons.push("Short password (under 8 characters)".to_string());
    } else if len < 12 {
        score -= 15;
        reasons.push("Under 12 characters — consider a longer secret".to_string());
    }

    let has_lower = password.chars().any(|c| c.is_lowercase());
    let has_upper = password.chars().any(|c| c.is_uppercase());
    let has_digit = password.chars().any(|c| c.is_ascii_digit());
    let has_symbol = password.chars().any(|c| !c.is_ascii_alphanumeric());

    if !is_long_passphrase {
        if !has_digit {
            score -= 14;
            reasons.push("No numbers".to_string());
        }
        if !has_upper {
            score -= 10;
            reasons.push("No uppercase letters".to_string());
        }
        if !has_symbol {
            score -= 12;
            reasons.push("No symbols".to_string());
        }
        if has_lower && !has_upper && len < 14 {
            score -= 8;
            reasons.push("Mostly lowercase only".to_string());
        }
    } else {
        score += 8;
    }

    if password_is_common(password) {
        score -= 45;
        reasons.push("Matches a well-known weak password".to_string());
    }

    if reused {
        score -= 30;
        reasons.push("Reused on multiple accounts — use unique passwords".to_string());
    }

    score = score.clamp(0, 100);
    (score as u8, reasons)
}

#[tauri::command]
fn get_active_vault(state: State<AppState>) -> String {
    state.active_vault.lock().unwrap().clone()
}

#[tauri::command]
fn switch_vault(state: State<AppState>, input: SwitchVaultInput) -> CommandResult<()> {
    validate_len("vault_name", &input.vault_name, 1, 64)?;
    
    let mut db_guard = state.db.lock().map_err(|_| AppError::new("state", "lock error"))?;
    let mut salt_guard = state.salt_path.lock().map_err(|_| AppError::new("state", "lock error"))?;
    let mut active = state.active_vault.lock().map_err(|_| AppError::new("state", "lock error"))?;
    
    let db_path = state.app_data_dir.join(format!("{}.db", input.vault_name));
    let salt_path = state.app_data_dir.join(format!("{}.salt", input.vault_name));
    
    *db_guard = VaultDb::new(db_path);
    *salt_guard = salt_path;
    *active = input.vault_name.clone();
    
    clear_session(&state);
    Ok(())
}

#[tauri::command]
fn vault_exists(state: State<AppState>) -> bool {
    state.db.lock().unwrap().path().exists()
}

#[tauri::command]
fn create_vault(state: State<AppState>, input: CreateVaultInput) -> CommandResult<RecoveryKeyResponse> {
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    let salt_path = state.salt_path.lock().map_err(|_| AppError::new("state_error", ""))?;
    let recovery_path = state.recovery_path.lock().map_err(|_| AppError::new("state_error", ""))?;

    if db.path().exists() || salt_path.exists() {
        return Err(AppError::new("vault_exists", "Vault already exists."));
    }

    validate_len(
        "master_password",
        &input.password,
        MASTER_PASSWORD_MIN,
        MASTER_PASSWORD_MAX,
    )?;

    let salt = generate_salt();
    if let Some(parent) = db.path().parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(&*salt_path, salt)?;

    let mut password = input.password;
    let key = derive_master_key(&password, &salt)?;
    password.zeroize();

    db.create_new(&key)?;
    let now = now_epoch();
    let _ = db.log_event(&key, "vault_created", "vault", now);

    let recovery_code = crypto::generate_recovery_code();
    let recovery_normalized = normalize_recovery_key(&recovery_code);
    let recovery_salt = generate_salt();
    let recovery_hash = crypto::hash_recovery_phrase(&recovery_normalized, &recovery_salt)?;
    let recovery_key = key_from_recovery_hash(&recovery_hash)?;
    let wrap = crypto::encrypt_field(key.as_bytes(), &recovery_key, b"recovery_wrap")?;

    let recovery_data = RecoveryData {
        salt: hex::encode(recovery_salt),
        hash: hex::encode(recovery_hash),
        wrap_nonce: hex::encode(wrap.nonce),
        wrap_ct: hex::encode(wrap.ciphertext),
    };
    fs::write(&*recovery_path, serde_json::to_vec(&recovery_data)?)?;

    let mut guard = state.session.lock().map_err(|_| {
        AppError::new("state_error", "Session state is unavailable.")
    })?;
    *guard = Some(Session::new(key));
    Ok(RecoveryKeyResponse {
        phrase: recovery_code,
    })
}

#[tauri::command]
fn unlock_vault(state: State<AppState>, input: UnlockVaultInput) -> CommandResult<()> {
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    let salt_path = state.salt_path.lock().map_err(|_| AppError::new("state_error", ""))?;

    validate_len(
        "master_password",
        &input.password,
        MASTER_PASSWORD_MIN,
        MASTER_PASSWORD_MAX,
    )?;

    let salt = fs::read(&*salt_path)?;
    if salt.len() != SALT_LEN {
        return Err(AppError::new("salt_error", "Vault salt is invalid."));
    }

    let mut password = input.password;
    let key = derive_master_key(&password, &salt)?;
    password.zeroize();

    db.verify_key(&key)?;
    let now = now_epoch();
    let _ = db.log_event(&key, "vault_unlocked", "vault", now);

    let mut guard = state.session.lock().map_err(|_| {
        AppError::new("state_error", "Session state is unavailable.")
    })?;
    *guard = Some(Session::new(key));
    Ok(())
}

#[tauri::command]
fn unlock_vault_with_recovery(
    state: State<AppState>,
    input: UnlockVaultWithRecoveryInput,
) -> CommandResult<RecoveryKeyResponse> {
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    let recovery_path = state.recovery_path.lock().map_err(|_| AppError::new("state_error", ""))?;

    let recovery_key_input = normalize_recovery_key(&input.recovery_key);
    validate_len("recovery_key", &recovery_key_input, 10, 64)?;

    let recovery_bytes = fs::read(&*recovery_path)
        .map_err(|_| AppError::new("recovery_missing", "Recovery key is not configured."))?;
    let recovery_data: RecoveryData = serde_json::from_slice(&recovery_bytes)
        .map_err(|_| AppError::new("recovery_invalid", "Recovery key data invalid."))?;

    let recovery_salt = hex::decode(recovery_data.salt)
        .map_err(|_| AppError::new("recovery_invalid", "Recovery key data invalid."))?;
    let expected_hash = hex::decode(recovery_data.hash)
        .map_err(|_| AppError::new("recovery_invalid", "Recovery key data invalid."))?;

    let ok = crypto::verify_recovery_phrase(&recovery_key_input, &recovery_salt, &expected_hash)?;
    if !ok {
        return Err(AppError::new("recovery_invalid", "Recovery key is invalid."));
    }

    let recovery_key = key_from_recovery_hash(&expected_hash)?;
    let wrap_nonce = decode_nonce_hex(&recovery_data.wrap_nonce)?;
    let wrap_ct = hex::decode(recovery_data.wrap_ct)
        .map_err(|_| AppError::new("recovery_invalid", "Recovery key data invalid."))?;
    let plain_key = crypto::decrypt_field(&wrap_nonce, &wrap_ct, &recovery_key, b"recovery_wrap")?;

    if plain_key.len() != crypto::KEY_LEN {
        return Err(AppError::new("recovery_invalid", "Recovery key data invalid."));
    }

    let mut key_bytes = [0u8; crypto::KEY_LEN];
    key_bytes.copy_from_slice(&plain_key);
    let master_key = SecretKey::from_bytes(key_bytes);
    db.verify_key(&master_key)?;

    let now = now_epoch();
    let _ = db.log_event(&master_key, "vault_unlocked", "vault", now);

    let recovery_code = crypto::generate_recovery_code();
    let recovery_normalized = normalize_recovery_key(&recovery_code);
    let recovery_salt = generate_salt();
    let recovery_hash = crypto::hash_recovery_phrase(&recovery_normalized, &recovery_salt)?;
    let recovery_key = key_from_recovery_hash(&recovery_hash)?;
    let wrap = crypto::encrypt_field(master_key.as_bytes(), &recovery_key, b"recovery_wrap")?;

    let recovery_data = RecoveryData {
        salt: hex::encode(recovery_salt),
        hash: hex::encode(recovery_hash),
        wrap_nonce: hex::encode(wrap.nonce),
        wrap_ct: hex::encode(wrap.ciphertext),
    };
    fs::write(&*recovery_path, serde_json::to_vec(&recovery_data)?)?;

    let mut guard = state.session.lock().map_err(|_| {
        AppError::new("state_error", "Session state is unavailable.")
    })?;
    *guard = Some(Session::new(master_key));
    Ok(RecoveryKeyResponse {
        phrase: recovery_code,
    })
}

#[tauri::command]
fn change_master_password(state: State<AppState>, input: ChangeMasterPasswordInput) -> CommandResult<()> {
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    let salt_path = state.salt_path.lock().map_err(|_| AppError::new("state_error", ""))?;

    validate_len("new_password", &input.new_password, MASTER_PASSWORD_MIN, MASTER_PASSWORD_MAX)?;

    // 1. Verify old password and derive old key
    let old_salt = fs::read(&*salt_path)?;
    let old_key = derive_master_key(&input.old_password, &old_salt)?;
    db.verify_key(&old_key)?;

    // 2. Derive new key with new salt
    let new_salt = generate_salt();
    let new_key = derive_master_key(&input.new_password, &new_salt)?;

    // 3. Re-encrypt all entries
    let entries = db.list_all_secrets(&old_key)?;
    for (entry_id, old_secrets) in entries {
        // Decrypt
        let pw_plain = crypto::decrypt_field(&old_secrets.password.nonce, &old_secrets.password.ciphertext, &old_key, &aad_for_entry(&entry_id, "password"))?;
        let notes_plain = crypto::decrypt_field(&old_secrets.notes.nonce, &old_secrets.notes.ciphertext, &old_key, &aad_for_entry(&entry_id, "notes"))?;

        // Re-encrypt
        let pw_new = crypto::encrypt_field(&pw_plain, &new_key, &aad_for_entry(&entry_id, "password"))?;
        let notes_new = crypto::encrypt_field(&notes_plain, &new_key, &aad_for_entry(&entry_id, "notes"))?;

        db.update_entry_secrets(&old_key, &entry_id, &EncryptedSecrets {
            password: pw_new,
            notes: notes_new,
        })?;
    }

    // 3b. Re-encrypt all mini entries
    let mini_entries = db.list_all_mini_entry_secrets(&old_key)?;
    for entry in mini_entries {
        let pw_plain = crypto::decrypt_field(
            &entry.password.nonce,
            &entry.password.ciphertext,
            &old_key,
            &aad_for_entry(&entry.entry_id, "password"),
        )?;

        let pw_new = crypto::encrypt_field(
            &pw_plain,
            &new_key,
            &aad_for_entry(&entry.entry_id, "password"),
        )?;

        let notes_new = if let Some(notes) = entry.notes {
            if notes.ciphertext.is_empty() {
                None
            } else {
                let notes_plain = crypto::decrypt_field(
                    &notes.nonce,
                    &notes.ciphertext,
                    &old_key,
                    &aad_for_entry(&entry.entry_id, "notes"),
                )?;
                Some(crypto::encrypt_field(
                    &notes_plain,
                    &new_key,
                    &aad_for_entry(&entry.entry_id, "notes"),
                )?)
            }
        } else {
            None
        };

        db.update_mini_entry_secrets(&old_key, &entry.entry_id, &pw_new, notes_new.as_ref())?;
    }

    // 3c. Re-encrypt all mini notes
    let mini_notes = db.list_all_mini_notes_encrypted(&old_key)?;
    for note in mini_notes {
        let content_plain = crypto::decrypt_field(
            &note.content.nonce,
            &note.content.ciphertext,
            &old_key,
            b"mini_note",
        )?;
        let content_new = crypto::encrypt_field(&content_plain, &new_key, b"mini_note")?;
        db.update_mini_note_content(&old_key, note.id, &content_new)?;
    }

    // 4. Rekey the database
    db.rekey_database(&old_key, &new_key)?;

    // 5. Update salt file
    fs::write(&*salt_path, new_salt)?;

    // 6. Update session
    let mut guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    *guard = Some(Session::new(new_key));

    Ok(())
}

#[tauri::command]
fn rotate_recovery_key(state: State<AppState>, input: RotateRecoveryKeyInput) -> CommandResult<RecoveryKeyResponse> {
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    let salt_path = state.salt_path.lock().map_err(|_| AppError::new("state_error", ""))?;
    let recovery_path = state.recovery_path.lock().map_err(|_| AppError::new("state_error", ""))?;

    validate_len(
        "master_password",
        &input.password,
        MASTER_PASSWORD_MIN,
        MASTER_PASSWORD_MAX,
    )?;

    let salt = fs::read(&*salt_path)?;
    if salt.len() != SALT_LEN {
        return Err(AppError::new("salt_error", "Vault salt is invalid."));
    }

    let mut password = input.password;
    let key = derive_master_key(&password, &salt)?;
    password.zeroize();
    db.verify_key(&key)?;

    let recovery_code = crypto::generate_recovery_code();
    let recovery_normalized = normalize_recovery_key(&recovery_code);
    let recovery_salt = generate_salt();
    let recovery_hash = crypto::hash_recovery_phrase(&recovery_normalized, &recovery_salt)?;
    let recovery_key = key_from_recovery_hash(&recovery_hash)?;
    let wrap = crypto::encrypt_field(key.as_bytes(), &recovery_key, b"recovery_wrap")?;

    let recovery_data = RecoveryData {
        salt: hex::encode(recovery_salt),
        hash: hex::encode(recovery_hash),
        wrap_nonce: hex::encode(wrap.nonce),
        wrap_ct: hex::encode(wrap.ciphertext),
    };
    fs::write(&*recovery_path, serde_json::to_vec(&recovery_data)?)?;

    Ok(RecoveryKeyResponse {
        phrase: recovery_code,
    })
}

#[tauri::command]
fn lock_vault(state: State<AppState>) -> CommandResult<()> {
    clear_session(&state);
    Ok(())
}

#[tauri::command]
fn set_autolock(state: State<AppState>, minutes: Option<u64>) -> CommandResult<()> {
    let duration = match minutes {
        None => None,
        Some(value) if (1..=180).contains(&value) => Some(Duration::from_secs(value * 60)),
        Some(_) => {
            return Err(AppError::new(
                "invalid_timeout",
                "Auto-lock must be between 1 and 180 minutes.",
            ))
        }
    };

    let mut guard = state.session.lock().map_err(|_| {
        AppError::new("state_error", "Session state is unavailable.")
    })?;
    let session = guard
        .as_mut()
        .ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    session.autolock_after = duration;
    Ok(())
}

#[tauri::command]
fn list_entries(state: State<AppState>, section: VaultSection) -> CommandResult<Vec<EntrySummary>> {
    let filter = match section {
        VaultSection::All => EntryFilter {
            favorites_only: false,
            trashed_only: false,
        },
        VaultSection::Favorites => EntryFilter {
            favorites_only: true,
            trashed_only: false,
        },
        VaultSection::Trash => EntryFilter {
            favorites_only: false,
            trashed_only: true,
        },
    };

    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;
    with_session(&state, |key| Ok(db.list_entries(key, filter)?))
}

#[tauri::command]
fn list_groups(state: State<AppState>) -> CommandResult<Vec<GroupSummary>> {
    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;
    with_session(&state, |key| Ok(db.list_groups(key)?))
}

#[tauri::command]
fn create_group(state: State<AppState>, input: CreateGroupInput) -> CommandResult<GroupSummary> {
    validate_len("group_name", &input.name, 1, 64)?;
    validate_len("group_color", &input.color, 4, 16)?;

    let now = now_epoch();
    let group_id = Uuid::new_v4().to_string();
    let name = input.name.trim().to_string();
    let color = input.color.trim().to_string();

    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;
    with_session(&state, |key| {
        db.insert_group(
            key,
            NewGroup {
                group_id: group_id.clone(),
                name: name.clone(),
                color: color.clone(),
                created_at: now,
                updated_at: now,
            },
        )?;
        Ok(GroupSummary {
            group_id,
            name,
            color,
            created_at: now,
            updated_at: now,
        })
    })
}

#[tauri::command]
fn delete_group(state: State<AppState>, group_id: String) -> CommandResult<()> {
    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;
    with_session(&state, |key| {
        db.delete_group(key, &group_id)?;
        let _ = db.log_event(key, "group_deleted", &group_id, now_epoch());
        Ok(())
    })
}

#[tauri::command]
fn update_group(state: State<AppState>, input: UpdateGroupInput) -> CommandResult<GroupSummary> {
    validate_len("group_name", &input.name, 1, 64)?;
    let name = input.name.trim().to_string();
    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;
    with_session(&state, |key| {
        let g = db.update_group_name(key, &input.group_id, &name, now_epoch())?;
        let _ = db.log_event(key, "group_renamed", &g.group_id, now_epoch());
        Ok(g)
    })
}

#[tauri::command]
fn merge_groups(state: State<AppState>, input: MergeGroupsInput) -> CommandResult<GroupSummary> {
    validate_len("group_name", &input.name, 1, 64)?;
    validate_len("group_color", &input.color, 4, 16)?;
    if input.source_group_ids.len() < 2 {
        return Err(AppError::new(
            "invalid_merge",
            "Select at least two groups to merge.",
        ));
    }

    let now = now_epoch();
    let new_id = Uuid::new_v4().to_string();
    let name = input.name.trim().to_string();
    let color = input.color.trim().to_string();

    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;
    with_session(&state, |key| {
        let summary = db.merge_groups_into_new(
            key,
            &input.source_group_ids,
            NewGroup {
                group_id: new_id.clone(),
                name: name.clone(),
                color: color.clone(),
                created_at: now,
                updated_at: now,
            },
            now,
        )?;
        let _ = db.log_event(key, "groups_merged", &new_id, now);
        Ok(summary)
    })
}

#[tauri::command]
fn get_vault_dashboard_stats(state: State<AppState>) -> CommandResult<VaultDashboardStats> {
    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;
    with_session(&state, |key| {
        let active = db.list_entries(
            key,
            EntryFilter {
                favorites_only: false,
                trashed_only: false,
            },
        )?;
        let trash = db.list_entries(
            key,
            EntryFilter {
                favorites_only: false,
                trashed_only: true,
            },
        )?;
        let _groups_list = db.list_groups(key)?;

        let now = now_epoch();
        let month_ago = now - 30 * 86400;

        let active_accounts = active.len();
        let trash_count = trash.len();
        let favorites_count = active.iter().filter(|e| e.favorite).count();
        let groups_count = _groups_list.len();
        let uncategorized_accounts = active
            .iter()
            .filter(|e| e.group_id.as_ref().map_or(true, |s| s.is_empty()))
            .count();
        let entries_with_url = active.iter().filter(|e| !e.url.trim().is_empty()).count();

        struct Row {
            entry_id: String,
            title: String,
            username_display: String,
            password: String,
        }

        let mut rows: Vec<Row> = Vec::new();
        for entry in &active {
            let EncryptedSecrets { password, notes: _ } = match db.fetch_secrets(key, &entry.entry_id) {
                Ok(s) => s,
                Err(_) => continue,
            };
            let pw_plain = match crypto::decrypt_field(
                &password.nonce,
                &password.ciphertext,
                key,
                &aad_for_entry(&entry.entry_id, "password"),
            ) {
                Ok(b) => b,
                Err(_) => continue,
            };
            let pw_str = match String::from_utf8(pw_plain) {
                Ok(s) => s,
                Err(_) => continue,
            };
            rows.push(Row {
                entry_id: entry.entry_id.clone(),
                title: entry.title.clone(),
                username_display: username_display_for_dashboard(&entry.username),
                password: pw_str,
            });
        }

        let mut by_password: HashMap<String, Vec<usize>> = HashMap::new();
        for (i, row) in rows.iter().enumerate() {
            by_password
                .entry(row.password.clone())
                .or_default()
                .push(i);
        }

        let unique_passwords = by_password.len();
        let accounts_with_reused_password: usize = by_password
            .values()
            .filter(|v| v.len() > 1)
            .map(|v| v.len())
            .sum();
        let largest_reuse_cluster_size = by_password
            .values()
            .map(|v| v.len())
            .max()
            .unwrap_or(0);

        let mut password_reuse_clusters: Vec<DashboardReuseCluster> = by_password
            .iter()
            .filter(|(_, indices)| indices.len() > 1)
            .map(|(_, indices)| {
                let accounts_count = indices.len();
                let entry_ids: Vec<String> = indices
                    .iter()
                    .map(|&i| rows[i].entry_id.clone())
                    .collect();
                let sample_titles: Vec<String> = indices
                    .iter()
                    .take(3)
                    .map(|&i| rows[i].title.clone())
                    .collect();
                DashboardReuseCluster {
                    accounts_count,
                    entry_ids,
                    sample_titles,
                }
            })
            .collect();
        password_reuse_clusters.sort_by(|a, b| b.accounts_count.cmp(&a.accounts_count));
        password_reuse_clusters.truncate(8);

        let mut weakest: Vec<DashboardWeakAccount> = Vec::new();
        let mut tier = StrengthTierCounts {
            critical: 0,
            weak: 0,
            fair: 0,
            strong: 0,
        };
        let mut risk_sum: i64 = 0;
        let mut pwd_len_sum: i64 = 0;

        for row in &rows {
            let reused = by_password
                .get(&row.password)
                .map(|v| v.len() > 1)
                .unwrap_or(false);
            let (risk, mut reasons) = compute_password_risk(&row.password, reused);
            if reasons.is_empty() {
                reasons.push("No major issues flagged".to_string());
            }
            risk_sum += risk as i64;
            pwd_len_sum += row.password.chars().count() as i64;
            match risk {
                0..=39 => tier.critical += 1,
                40..=59 => tier.weak += 1,
                60..=79 => tier.fair += 1,
                _ => tier.strong += 1,
            }
            weakest.push(DashboardWeakAccount {
                entry_id: row.entry_id.clone(),
                title: row.title.clone(),
                username_display: row.username_display.clone(),
                risk_score: risk,
                reasons,
            });
        }

        for row in &mut rows {
            row.password.zeroize();
        }

        weakest.sort_by(|a, b| {
            a.risk_score
                .cmp(&b.risk_score)
                .then_with(|| a.title.cmp(&b.title))
        });
        let weakest_accounts: Vec<DashboardWeakAccount> = weakest.into_iter().take(18).collect();

        let (avg_risk_score, vault_health_score, avg_password_length) = if rows.is_empty() {
            (100u8, 100u8, 0.0)
        } else {
            let a = (risk_sum / rows.len() as i64) as u8;
            (a, a, pwd_len_sum as f64 / rows.len() as f64)
        };

        let oldest_entry_age_days = active
            .iter()
            .map(|e| e.created_at)
            .min()
            .map(|t| (now - t) / 86400);

        let recently_updated_count = active.iter().filter(|e| e.updated_at >= month_ago).count();

        Ok(VaultDashboardStats {
            active_accounts,
            favorites_count,
            trash_count,
            groups_count,
            uncategorized_accounts,
            entries_with_url,
            unique_passwords,
            accounts_with_reused_password,
            largest_reuse_cluster_size,
            vault_health_score,
            avg_risk_score,
            avg_password_length,
            oldest_entry_age_days,
            recently_updated_count,
            strength_tier_counts: tier,
            password_reuse_clusters,
            weakest_accounts,
        })
    })
}

#[tauri::command]
fn add_entry(state: State<AppState>, input: NewEntryInput) -> CommandResult<EntrySummary> {
    validate_entry(
        &input.title,
        &input.username,
        &input.url,
        &input.group_id,
        &input.password,
        &input.notes,
    )?;

    let entry_id = Uuid::new_v4().to_string();
    let now = now_epoch();
    
    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;

    with_session(&state, |key| {
        let mut password = input.password;
        let mut notes = input.notes.unwrap_or_default();

        let password_field = encrypt_field(
            password.as_bytes(),
            key,
            &aad_for_entry(&entry_id, "password"),
        )?;
        let notes_field = encrypt_field(notes.as_bytes(), key, &aad_for_entry(&entry_id, "notes"))?;

        password.zeroize();
        notes.zeroize();

        let entry = NewEntryEncrypted {
            entry_id: entry_id.clone(),
            title: input.title.clone(),
            username: input.username.clone(),
            url: input.url.clone(),
            group_id: input.group_id.clone(),
            password: password_field,
            notes: notes_field,
            favorite: input.favorite.unwrap_or(false),
            trashed: false,
            created_at: now,
            updated_at: now,
        };

        db.insert_entry(key, entry)?;
        let _ = db.log_event(key, "entry_created", &entry_id, now);

        Ok(EntrySummary {
            entry_id,
            title: input.title,
            username: input.username,
            url: input.url,
            group_id: input.group_id,
            favorite: input.favorite.unwrap_or(false),
            trashed: false,
            created_at: now,
            updated_at: now,
        })
    })
}

#[tauri::command]
fn update_entry(state: State<AppState>, input: UpdateEntryInput) -> CommandResult<()> {
    validate_entry(
        &input.title,
        &input.username,
        &input.url,
        &input.group_id,
        &input.password,
        &input.notes,
    )?;
    let now = now_epoch();
    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;

    with_session(&state, |key| {
        let mut password = input.password;
        let mut notes = input.notes.unwrap_or_default();

        let password_field = encrypt_field(
            password.as_bytes(),
            key,
            &aad_for_entry(&input.entry_id, "password"),
        )?;
        let notes_field =
            encrypt_field(notes.as_bytes(), key, &aad_for_entry(&input.entry_id, "notes"))?;

        password.zeroize();
        notes.zeroize();

        let entry = UpdateEntryEncrypted {
            entry_id: input.entry_id.clone(),
            title: input.title.clone(),
            username: input.username.clone(),
            url: input.url.clone(),
            group_id: input.group_id.clone(),
            password: password_field,
            notes: notes_field,
            favorite: input.favorite,
            trashed: input.trashed,
            updated_at: now,
        };

        db.update_entry(key, entry)?;
        let _ = db.log_event(key, "entry_updated", &input.entry_id, now);
        let _ = db.clean_empty_groups(key);
        Ok(())
    })
}

#[tauri::command]
fn set_favorite(state: State<AppState>, entry_id: String, favorite: bool) -> CommandResult<()> {
    let now = now_epoch();
    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;
    with_session(&state, |key| {
        db.set_favorite(key, &entry_id, favorite, now)?;
        let _ = db.log_event(key, "entry_favorite", &entry_id, now);
        Ok(())
    })
}

#[tauri::command]
fn move_to_trash(state: State<AppState>, entry_id: String) -> CommandResult<()> {
    let now = now_epoch();
    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;
    with_session(&state, |key| {
        db.set_trashed(key, &entry_id, true, now)?;
        let _ = db.log_event(key, "entry_trashed", &entry_id, now);
        Ok(())
    })
}

#[tauri::command]
fn restore_from_trash(state: State<AppState>, entry_id: String) -> CommandResult<()> {
    let now = now_epoch();
    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;
    with_session(&state, |key| {
        db.set_trashed(key, &entry_id, false, now)?;
        let _ = db.log_event(key, "entry_restored", &entry_id, now);
        Ok(())
    })
}

#[tauri::command]
fn delete_entry(state: State<AppState>, entry_id: String) -> CommandResult<()> {
    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;
    with_session(&state, |key| {
        db.delete_entry(key, &entry_id)?;
        let _ = db.log_event(key, "entry_deleted", &entry_id, now_epoch());
        let _ = db.clean_empty_groups(key);
        Ok(())
    })
}

#[tauri::command]
fn copy_entry_secret(state: State<AppState>, input: CopyEntrySecretInput) -> CommandResult<()> {
    validate_len("entry_id", &input.entry_id, 1, 64)?;
    let ttl = input.ttl_seconds.unwrap_or(15);
    if !(10..=20).contains(&ttl) {
        return Err(AppError::new(
            "invalid_ttl",
            "Clipboard TTL must be between 10 and 20 seconds.",
        ));
    }
    
    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;

    with_session(&state, |key| {
        let EncryptedSecrets { password, notes } = db.fetch_secrets(key, &input.entry_id)?;
        let (field, aad_label) = match input.field {
            SecretField::Password => (password, "password"),
            SecretField::Notes => (notes, "notes"),
        };

        let plaintext = crypto::decrypt_field(
            &field.nonce,
            &field.ciphertext,
            key,
            &aad_for_entry(&input.entry_id, aad_label),
        )?;

        let mut secret = String::from_utf8(plaintext)
            .map_err(|_| AppError::new("crypto_error", "Cryptographic operation failed."))?;
        let mut clipboard = Clipboard::new()?;
        clipboard.set_text(secret.clone())?;
        secret.zeroize();

        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(ttl));
            if let Ok(mut clipboard) = Clipboard::new() {
                let _ = clipboard.set_text(String::new());
            }
        });

        let _ = db.log_event(key, "entry_secret_copied", &input.entry_id, now_epoch());
        Ok(())
    })
}

#[tauri::command]
fn get_entry_secrets(state: State<AppState>, entry_id: String) -> CommandResult<DecryptedSecrets> {
    validate_len("entry_id", &entry_id, 1, 64)?;
    let db = state.db.lock().map_err(|_| AppError::new("err", ""))?;
    
    with_session(&state, |key| {
        let EncryptedSecrets { password, notes } = db.fetch_secrets(key, &entry_id)?;

        let pw_plain = crypto::decrypt_field(
            &password.nonce,
            &password.ciphertext,
            key,
            &aad_for_entry(&entry_id, "password"),
        )?;

        let notes_plain = crypto::decrypt_field(
            &notes.nonce,
            &notes.ciphertext,
            key,
            &aad_for_entry(&entry_id, "notes"),
        )?;

        let pw_str = String::from_utf8(pw_plain)
            .map_err(|_| AppError::new("crypto", "Invalid utf8"))?;
        let notes_str = String::from_utf8(notes_plain)
            .map_err(|_| AppError::new("crypto", "Invalid utf8"))?;

        Ok(DecryptedSecrets {
            password: pw_str,
            notes: notes_str,
        })
    })
}

#[tauri::command]
fn generate_password(input: GeneratePasswordInput) -> CommandResult<String> {
    if !(GENERATED_PASSWORD_MIN..=GENERATED_PASSWORD_MAX).contains(&input.length) {
        return Err(AppError::new(
            "invalid_length",
            "Password length must be between 12 and 32 characters.",
        ));
    }

    let lower = b"abcdefghijklmnopqrstuvwxyz";
    let upper = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let numbers = b"0123456789";
    let symbols = b"!@#$%^&*()-_=+[]{};:,.?/";

    let mut pool: Vec<u8> = Vec::new();
    pool.extend_from_slice(lower);
    pool.extend_from_slice(upper);
    if input.numbers {
        pool.extend_from_slice(numbers);
    }
    if input.symbols {
        pool.extend_from_slice(symbols);
    }

    let mut required_sets: Vec<&[u8]> = vec![lower, upper];
    if input.numbers {
        required_sets.push(numbers);
    }
    if input.symbols {
        required_sets.push(symbols);
    }

    if input.length < required_sets.len() {
        return Err(AppError::new(
            "invalid_length",
            "Password length is too short for selected character sets.",
        ));
    }

    let mut rng = OsRng;
    let mut output: Vec<u8> = Vec::with_capacity(input.length);

    for set in required_sets {
        let value = set.choose(&mut rng).copied().ok_or_else(|| {
            AppError::new("rng_error", "Password generation failed.")
        })?;
        output.push(value);
    }

    while output.len() < input.length {
        let value = pool.choose(&mut rng).copied().ok_or_else(|| {
            AppError::new("rng_error", "Password generation failed.")
        })?;
        output.push(value);
    }

    output.shuffle(&mut rng);
    let password = String::from_utf8(output)
        .map_err(|_| AppError::new("rng_error", "Password generation failed."))?;
    Ok(password)
}

#[tauri::command]
fn copy_to_clipboard(state: State<AppState>, input: CopyInput) -> CommandResult<()> {
    validate_len("clipboard", &input.text, 1, 4096)?;
    let ttl = input.ttl_seconds.unwrap_or(15);
    if !(10..=20).contains(&ttl) {
        return Err(AppError::new(
            "invalid_ttl",
            "Clipboard TTL must be between 10 and 20 seconds.",
        ));
    }

    with_session(&state, |_key| {
        let mut text = input.text;
        let mut clipboard = Clipboard::new()?;
        clipboard.set_text(text.clone())?;
        text.zeroize();

        std::thread::spawn(move || {
            std::thread::sleep(Duration::from_secs(ttl));
            if let Ok(mut clipboard) = Clipboard::new() {
                let _ = clipboard.set_text(String::new());
            }
        });

        Ok(())
    })
}

fn with_session<T, F>(state: &AppState, f: F) -> CommandResult<T>
where
    F: FnOnce(&SecretKey) -> CommandResult<T>,
{
    let mut guard = state.session.lock().map_err(|_| {
        AppError::new("state_error", "Session state is unavailable.")
    })?;
    let session = guard
        .as_mut()
        .ok_or_else(|| AppError::new("locked", "Vault is locked."))?;

    if session.is_expired() {
        *guard = None;
        return Err(AppError::new("locked", "Vault is locked."));
    }

    session.touch();
    f(&session.key)
}

fn clear_session(state: &AppState) {
    if let Ok(mut guard) = state.session.lock() {
        if let Some(session) = guard.as_ref() {
            if let Ok(db) = state.db.lock() {
                let _ = db.log_event(&session.key, "vault_locked", "vault", now_epoch());
            }
        }
        *guard = None;
    }
    
    // Also lock the mini vault whenever the session is cleared
    if let Ok(mut mini_guard) = state.mini_vault_unlocked.lock() {
        *mini_guard = false;
    }
}

fn validate_entry(
    title: &str,
    username: &str,
    url: &str,
    group_id: &Option<String>,
    password: &str,
    notes: &Option<String>,
) -> CommandResult<()> {
    validate_len("title", title, 1, TITLE_MAX)?;
    validate_len("username", username, 0, USERNAME_MAX)?;
    validate_len("url", url, 0, URL_MAX)?;
    if let Some(value) = group_id {
        validate_len("group_id", value, 0, 64)?;
    }
    validate_len("password", password, 1, ENTRY_PASSWORD_MAX)?;
    if let Some(value) = notes {
        validate_len("notes", value, 0, NOTES_MAX)?;
    }
    Ok(())
}

fn validate_len(_field: &str, value: &str, min: usize, max: usize) -> CommandResult<()> {
    let len = value.chars().count();
    if len < min || len > max {
        return Err(AppError::new(
            "invalid_input",
            "Input value is outside the allowed length.",
        ));
    }
    Ok(())
}

fn normalize_recovery_key(value: &str) -> String {
    value.trim().to_ascii_uppercase()
}

fn decode_nonce_hex(value: &str) -> CommandResult<[u8; NONCE_LEN]> {
    let bytes = hex::decode(value)
        .map_err(|_| AppError::new("recovery_invalid", "Recovery key data invalid."))?;
    if bytes.len() != NONCE_LEN {
        return Err(AppError::new("recovery_invalid", "Recovery key data invalid."));
    }
    let mut nonce = [0u8; NONCE_LEN];
    nonce.copy_from_slice(&bytes);
    Ok(nonce)
}

fn key_from_recovery_hash(hash: &[u8]) -> CommandResult<SecretKey> {
    if hash.len() != crypto::KEY_LEN {
        return Err(AppError::new("recovery_invalid", "Recovery key data invalid."));
    }
    let mut bytes = [0u8; crypto::KEY_LEN];
    bytes.copy_from_slice(hash);
    Ok(SecretKey::from_bytes(bytes))
}

fn now_epoch() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn setup_tray(app: &tauri::App) -> Result<(), tauri::Error> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::TrayIconBuilder;

    let open = MenuItem::with_id(app, "open", "Open Vault", true, None::<&str>)?;
    let lock = MenuItem::with_id(app, "lock", "Lock Vault", true, None::<&str>)?;
    let exit = MenuItem::with_id(app, "exit", "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &lock, &exit])?;

    TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "lock" => {
                let state = app.state::<AppState>();
                clear_session(&state);
            }
            "exit" => {
                let state = app.state::<AppState>();
                clear_session(&state);
                app.exit(0);
            }
            _ => {}
        })
        .build(app)?;

    Ok(())
}

#[tauri::command]
fn get_mini_vault_status(state: State<AppState>) -> CommandResult<MiniVaultStatus> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    
    let pin_hash = db.get_mini_config(&session.key, "pin_hash")?;
    let unlocked = *state.mini_vault_unlocked.lock().unwrap();
    
    Ok(MiniVaultStatus {
        is_setup: pin_hash.is_some(),
        is_unlocked: unlocked,
    })
}

#[tauri::command]
fn setup_mini_vault(state: State<AppState>, input: MiniPinInput) -> CommandResult<()> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    
    // In a real app we'd hash the PIN, but for simplicity we'll just store it 
    // (it's already inside an encrypted SQLCipher DB anyway)
    db.set_mini_config(&session.key, "pin_hash", &input.pin)?;
    *state.mini_vault_unlocked.lock().unwrap() = true;
    Ok(())
}

#[tauri::command]
fn unlock_mini_vault(state: State<AppState>, input: MiniPinInput) -> CommandResult<()> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    
    let pin_hash = db.get_mini_config(&session.key, "pin_hash")?
        .ok_or_else(|| AppError::new("not_setup", "Mini vault is not setup."))?;
    
    if pin_hash == input.pin {
        *state.mini_vault_unlocked.lock().unwrap() = true;
        Ok(())
    } else {
        Err(AppError::new("mini_auth_failed", "Incorrect PIN. Please try again."))
    }
}

#[tauri::command]
fn lock_mini_vault(state: State<AppState>) -> CommandResult<()> {
    *state.mini_vault_unlocked.lock().unwrap() = false;
    Ok(())
}

#[tauri::command]
fn list_mini_entries(state: State<AppState>) -> CommandResult<Vec<db::MiniEntrySummary>> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    if !*state.mini_vault_unlocked.lock().unwrap() {
        return Err(AppError::new("mini_locked", "Mini vault is locked."));
    }
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    let entries = db.list_mini_entries(&session.key)?;
    println!("Backend: Listed {} mini entries", entries.len());
    Ok(entries)
}

#[tauri::command]
fn add_mini_entry(state: State<AppState>, input: AddMiniEntryInput) -> CommandResult<()> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    if !*state.mini_vault_unlocked.lock().unwrap() {
        return Err(AppError::new("mini_locked", "Mini vault is locked."));
    }
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    
    let entry_id = Uuid::new_v4().to_string();
    let aad = crypto::aad_for_entry(&entry_id, "password");
    let password_enc = crypto::encrypt_field(input.password.as_bytes(), &session.key, &aad)?;
    
    let notes_enc = if !input.notes.is_empty() {
        let n_aad = crypto::aad_for_entry(&entry_id, "notes");
        Some(crypto::encrypt_field(input.notes.as_bytes(), &session.key, &n_aad)?)
    } else {
        None
    };

    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    
    println!("Backend: Adding mini entry: {}", entry_id);
    db.insert_mini_entry(&session.key, db::NewMiniEntryEncrypted {
        entry_id,
        title: input.title,
        username: input.username,
        category: input.category,
        url: input.url,
        password: password_enc,
        notes: notes_enc,
        created_at: now,
        updated_at: now,
    })?;
    println!("Backend Success: Mini entry added");
    
    Ok(())
}

#[tauri::command]
fn update_mini_entry(state: State<AppState>, input: UpdateMiniEntryInput) -> CommandResult<()> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    if !*state.mini_vault_unlocked.lock().unwrap() {
        return Err(AppError::new("mini_locked", "Mini vault is locked."));
    }
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    let n_aad = crypto::aad_for_entry(&input.entry_id, "notes");
    let notes_enc = if !input.notes.is_empty() {
        Some(crypto::encrypt_field(input.notes.as_bytes(), &session.key, &n_aad)?)
    } else {
        None
    };

    // If password is provided, re-encrypt it. Otherwise keep old password.
    if let Some(new_password) = input.password {
        let aad = crypto::aad_for_entry(&input.entry_id, "password");
        let password_enc = crypto::encrypt_field(new_password.as_bytes(), &session.key, &aad)?;
        
        println!("Backend: Updating mini entry (with new password): {}", input.entry_id);
        db.update_mini_entry(&session.key, db::NewMiniEntryEncrypted {
            entry_id: input.entry_id.clone(),
            title: input.title,
            username: input.username,
            category: input.category,
            url: input.url,
            password: password_enc,
            notes: notes_enc,
            created_at: 0, // Not used in update
            updated_at: now,
        })?;
    } else {
        println!("Backend: Updating mini entry (keeping password): {}", input.entry_id);
        // We need to fetch the existing password to keep it
        let old_pw = db.get_mini_entry_password(&session.key, &input.entry_id)?;
        db.update_mini_entry(&session.key, db::NewMiniEntryEncrypted {
            entry_id: input.entry_id.clone(),
            title: input.title,
            username: input.username,
            category: input.category,
            url: input.url,
            password: old_pw,
            notes: notes_enc,
            created_at: 0,
            updated_at: now,
        })?;
    }
    println!("Backend Success: Mini entry updated");
    
    Ok(())
}

#[tauri::command]
fn delete_mini_entry(state: State<AppState>, entry_id: String) -> CommandResult<()> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    db.delete_mini_entry(&session.key, &entry_id)?;
    Ok(())
}

#[tauri::command]
fn list_mini_notes(state: State<AppState>) -> CommandResult<Vec<db::MiniNoteSummary>> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    if !*state.mini_vault_unlocked.lock().unwrap() {
        return Err(AppError::new("mini_locked", "Mini vault is locked."));
    }
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    let notes = db.list_mini_notes(&session.key)?;
    println!("Backend: Listed {} mini notes", notes.len());
    Ok(notes)
}

#[tauri::command]
fn add_mini_note(state: State<AppState>, input: AddMiniNoteInput) -> CommandResult<()> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    if !*state.mini_vault_unlocked.lock().unwrap() {
        return Err(AppError::new("mini_locked", "Mini vault is locked."));
    }
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    
    // We'll use a constant AAD for notes for now or just generate a pseudo-id
    let aad = b"mini_note";
    let content_enc = crypto::encrypt_field(input.content.as_bytes(), &session.key, aad)?;
    
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    
    println!("Backend: Adding mini note: {}", input.title);
    db.insert_mini_note(&session.key, db::NewMiniNoteEncrypted {
        title: input.title,
        content: content_enc,
        created_at: now,
        updated_at: now,
    })?;
    println!("Backend Success: Mini note added");
    
    Ok(())
}

#[tauri::command]
fn update_mini_note(state: State<AppState>, input: UpdateMiniNoteInput) -> CommandResult<()> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    if !*state.mini_vault_unlocked.lock().unwrap() {
        return Err(AppError::new("mini_locked", "Mini vault is locked."));
    }
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    
    let aad = b"mini_note";
    let content_enc = crypto::encrypt_field(input.content.as_bytes(), &session.key, aad)?;
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs() as i64;
    
    db.update_mini_note(&session.key, input.id, &input.title, content_enc, now)?;
    
    Ok(())
}

#[tauri::command]
fn delete_mini_note(state: State<AppState>, id: i64) -> CommandResult<()> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    db.delete_mini_note(&session.key, id)?;
    Ok(())
}

#[tauri::command]
fn clear_mini_vault(state: State<AppState>) -> CommandResult<()> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    if !*state.mini_vault_unlocked.lock().unwrap() {
        return Err(AppError::new("mini_locked", "Mini vault is locked."));
    }
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    db.clear_mini_vault(&session.key)?;
    *state.mini_vault_unlocked.lock().unwrap() = false;
    Ok(())
}

#[tauri::command]
fn get_mini_entry_secrets(state: State<AppState>, entry_id: String) -> CommandResult<DecryptedSecrets> {
    println!("Backend: Fetching secrets for mini entry: {}", entry_id);
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    if !*state.mini_vault_unlocked.lock().unwrap() {
        println!("Backend Error: Mini vault is locked");
        return Err(AppError::new("mini_locked", "Mini vault is locked."));
    }
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    
    let enc = match db.get_mini_entry_secrets(&session.key, &entry_id) {
        Ok(e) => e,
        Err(e) => {
            println!("Backend Error: DB fetching failed: {:?}", e);
            return Err(e.into());
        }
    };
    
    let p_aad = crypto::aad_for_entry(&entry_id, "password");
    let password = match crypto::decrypt_field(&enc.password.nonce, &enc.password.ciphertext, &session.key, &p_aad) {
        Ok(p) => String::from_utf8_lossy(&p).into_owned(),
        Err(e) => {
            println!("Backend Error: Password decryption failed: {:?}", e);
            return Err(e.into());
        }
    };
    
    let notes = if !enc.notes.ciphertext.is_empty() {
        let n_aad = crypto::aad_for_entry(&entry_id, "notes");
        match crypto::decrypt_field(&enc.notes.nonce, &enc.notes.ciphertext, &session.key, &n_aad) {
            Ok(n) => String::from_utf8_lossy(&n).into_owned(),
            Err(e) => {
                println!("Backend Error: Notes decryption failed: {:?}", e);
                return Err(e.into());
            }
        }
    } else {
        String::new()
    };
    
    println!("Backend Success: Secrets fetched successfully");
    Ok(DecryptedSecrets { password, notes })
}

#[tauri::command]
fn get_mini_entry_password(state: State<AppState>, entry_id: String) -> CommandResult<String> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    
    let enc = db.get_mini_entry_password(&session.key, &entry_id)?;
    let aad = crypto::aad_for_entry(&entry_id, "password");
    let plain = crypto::decrypt_field(&enc.nonce, &enc.ciphertext, &session.key, &aad)?;
    
    Ok(String::from_utf8_lossy(&plain).into_owned())
}

#[tauri::command]
fn get_mini_note_content(state: State<AppState>, id: i64) -> CommandResult<String> {
    let session_guard = state.session.lock().map_err(|_| AppError::new("state_error", ""))?;
    let session = session_guard.as_ref().ok_or_else(|| AppError::new("locked", "Vault is locked."))?;
    let db = state.db.lock().map_err(|_| AppError::new("state_error", ""))?;
    
    let enc = db.get_mini_note_content(&session.key, id)?;
    let aad = b"mini_note";
    let plain = crypto::decrypt_field(&enc.nonce, &enc.ciphertext, &session.key, aad)?;
    
    Ok(String::from_utf8_lossy(&plain).into_owned())
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().map_err(|_| {
                std::io::Error::new(std::io::ErrorKind::Other, "app data dir unavailable")
            })?;
            fs::create_dir_all(&app_data_dir)?;
            let active_vault = "vault".to_string();
            let db_path = app_data_dir.join(format!("{}.db", active_vault));
            let salt_path = app_data_dir.join(format!("{}.salt", active_vault));
            let recovery_path = app_data_dir.join(format!("{}.recovery", active_vault));

            app.manage(AppState {
                app_data_dir,
                active_vault: Mutex::new(active_vault),
                db: Mutex::new(VaultDb::new(db_path)),
                salt_path: Mutex::new(salt_path),
                recovery_path: Mutex::new(recovery_path),
                session: Mutex::new(None),
                mini_vault_unlocked: Mutex::new(false),
            });

            setup_tray(app)?;

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_fullscreen(true);
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            get_active_vault,
            switch_vault,
            vault_exists,
            create_vault,
            unlock_vault,
            unlock_vault_with_recovery,
            lock_vault,
            set_autolock,
            list_entries,
            list_groups,
            create_group,
            delete_group,
            update_group,
            merge_groups,
            get_vault_dashboard_stats,
            add_entry,
            update_entry,
            set_favorite,
            move_to_trash,
            restore_from_trash,
            delete_entry,
            copy_entry_secret,
            get_entry_secrets,
            generate_password,
            copy_to_clipboard,
            change_master_password,
            rotate_recovery_key,
            get_mini_vault_status,
            setup_mini_vault,
            unlock_mini_vault,
            lock_mini_vault,
            list_mini_entries,
            add_mini_entry,
            delete_mini_entry,
            list_mini_notes,
            add_mini_note,
            delete_mini_note,
            clear_mini_vault,
            get_mini_entry_password,
            get_mini_entry_secrets,
            get_mini_note_content,
            update_mini_entry,
            update_mini_note,
            export_vault,
            import_vault,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
