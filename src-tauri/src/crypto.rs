use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use argon2::{Algorithm, Argon2, Params, Version};
use rand::{rngs::OsRng, seq::SliceRandom, RngCore};
use thiserror::Error;
use zeroize::{Zeroize, ZeroizeOnDrop};

pub const SALT_LEN: usize = 16;
pub const NONCE_LEN: usize = 12;
pub const KEY_LEN: usize = 32;

const RECOVERY_CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

#[derive(Debug, Error)]
pub enum CryptoError {
    #[error("invalid salt length")]
    InvalidSaltLength,
    #[error("invalid argon2 params")]
    InvalidParams,
    #[error("key derivation failed")]
    KdfFailed,
    #[error("encryption failed")]
    EncryptFailed,
    #[error("decryption failed")]
    DecryptFailed,
}

#[derive(Zeroize, ZeroizeOnDrop)]
pub struct SecretKey([u8; KEY_LEN]);

impl SecretKey {
    pub fn as_bytes(&self) -> &[u8; KEY_LEN] {
        &self.0
    }

    pub fn from_bytes(bytes: [u8; KEY_LEN]) -> Self {
        Self(bytes)
    }
}

pub struct EncryptedField {
    pub nonce: [u8; NONCE_LEN],
    pub ciphertext: Vec<u8>,
}

pub fn generate_salt() -> [u8; SALT_LEN] {
    let mut salt = [0u8; SALT_LEN];
    OsRng.fill_bytes(&mut salt);
    salt
}

pub fn derive_master_key(password: &str, salt: &[u8]) -> Result<SecretKey, CryptoError> {
    if salt.len() != SALT_LEN {
        return Err(CryptoError::InvalidSaltLength);
    }

    let params = argon2_params()?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut key = [0u8; KEY_LEN];
    argon2
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|_| CryptoError::KdfFailed)?;
    Ok(SecretKey(key))
}

pub fn encrypt_field(
    plaintext: &[u8],
    key: &SecretKey,
    aad: &[u8],
) -> Result<EncryptedField, CryptoError> {
    let cipher =
        Aes256Gcm::new_from_slice(key.as_bytes()).map_err(|_| CryptoError::EncryptFailed)?;
    let mut nonce = [0u8; NONCE_LEN];
    OsRng.fill_bytes(&mut nonce);

    let payload = Payload { msg: plaintext, aad };
    let ciphertext = cipher
        .encrypt(Nonce::from_slice(&nonce), payload)
        .map_err(|_| CryptoError::EncryptFailed)?;

    Ok(EncryptedField { nonce, ciphertext })
}

pub fn decrypt_field(
    nonce: &[u8; NONCE_LEN],
    ciphertext: &[u8],
    key: &SecretKey,
    aad: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    let cipher =
        Aes256Gcm::new_from_slice(key.as_bytes()).map_err(|_| CryptoError::DecryptFailed)?;
    let payload = Payload { msg: ciphertext, aad };
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce), payload)
        .map_err(|_| CryptoError::DecryptFailed)?;
    Ok(plaintext)
}

pub fn generate_recovery_code() -> String {
    let mut rng = OsRng;
    let mut parts: Vec<String> = Vec::with_capacity(5);
    for _ in 0..5 {
        let mut part = [0u8; 5];
        for slot in part.iter_mut() {
            *slot = *RECOVERY_CHARSET
                .choose(&mut rng)
                .unwrap_or(&b'X');
        }
        parts.push(String::from_utf8_lossy(&part).to_string());
    }
    parts.join("-")
}

pub fn hash_recovery_phrase(phrase: &str, salt: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if salt.len() != SALT_LEN {
        return Err(CryptoError::InvalidSaltLength);
    }

    let params = argon2_params()?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut hash = vec![0u8; KEY_LEN];
    argon2
        .hash_password_into(phrase.as_bytes(), salt, &mut hash)
        .map_err(|_| CryptoError::KdfFailed)?;
    Ok(hash)
}

pub fn verify_recovery_phrase(phrase: &str, salt: &[u8], expected: &[u8]) -> Result<bool, CryptoError> {
    let hash = hash_recovery_phrase(phrase, salt)?;
    Ok(hash.as_slice() == expected)
}

pub fn aad_for_entry(entry_id: &str, field: &str) -> Vec<u8> {
    format!("entry:{}|field:{}", entry_id, field).into_bytes()
}

pub fn hash_mini_pin(pin: &str, salt: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let params = argon2_params()?;
    let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);
    let mut hash = vec![0u8; KEY_LEN];
    argon2
        .hash_password_into(pin.as_bytes(), salt, &mut hash)
        .map_err(|_| CryptoError::KdfFailed)?;
    Ok(hash)
}

fn argon2_params() -> Result<Params, CryptoError> {
    let memory_kib = 64 * 1024;
    let iterations = 3;
    let parallelism = adaptive_parallelism();
    Params::new(memory_kib, iterations, parallelism, Some(KEY_LEN))
        .map_err(|_| CryptoError::InvalidParams)
}

fn adaptive_parallelism() -> u32 {
    let available = std::thread::available_parallelism()
        .map(|value| value.get())
        .unwrap_or(1);
    available.clamp(1, 4) as u32
}
