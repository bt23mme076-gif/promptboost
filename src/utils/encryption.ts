/**
 * AES-GCM encryption for the API key using the Web Crypto API.
 *
 * The key is derived (PBKDF2) from a random per-install secret that is generated
 * once and stored in chrome.storage.local. This keeps the key out of plaintext
 * storage while remaining STABLE across browser updates — deriving from a
 * volatile source like navigator.userAgent would silently break decryption every
 * time Chrome updated its version string. This is obfuscation-at-rest, not a
 * substitute for server-side secret management.
 */

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;
const ITERATIONS = 100_000;
const HASH = "SHA-256";
const IV_LENGTH = 12;
const SALT_LENGTH = 16;
const SECRET_LENGTH = 32;

const SALT_STORAGE_KEY = "promptboost_enc_salt";
const SECRET_STORAGE_KEY = "promptboost_enc_secret";

/** Read a stored byte array, or create + persist a fresh random one. */
function getOrCreateBytes(storageKey: string, length: number): Promise<Uint8Array> {
  return new Promise((resolve) => {
    chrome.storage.local.get(storageKey, (result) => {
      const stored = result[storageKey] as number[] | undefined;
      if (stored && stored.length) {
        resolve(Uint8Array.from(stored));
      } else {
        const bytes = crypto.getRandomValues(new Uint8Array(length));
        chrome.storage.local.set({ [storageKey]: Array.from(bytes) }, () => resolve(bytes));
      }
    });
  });
}

/** Copy into a fresh ArrayBuffer-backed view (satisfies BufferSource typing). */
function toBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

async function deriveKey(salt: Uint8Array, secret: Uint8Array): Promise<CryptoKey> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    toBuffer(secret),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: toBuffer(salt), iterations: ITERATIONS, hash: HASH },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

async function getKey(): Promise<CryptoKey> {
  const [salt, secret] = await Promise.all([
    getOrCreateBytes(SALT_STORAGE_KEY, SALT_LENGTH),
    getOrCreateBytes(SECRET_STORAGE_KEY, SECRET_LENGTH),
  ]);
  return deriveKey(salt, secret);
}

export async function encryptApiKey(plaintext: string): Promise<string> {
  if (!plaintext) return "";
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv: toBuffer(iv) },
    key,
    new TextEncoder().encode(plaintext)
  );

  // Pack: [iv (12 bytes)][ciphertext] → base64
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptApiKey(ciphertext: string): Promise<string> {
  if (!ciphertext) return "";
  try {
    const key = await getKey();
    const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0));
    const iv = combined.slice(0, IV_LENGTH);
    const data = combined.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv: toBuffer(iv) },
      key,
      toBuffer(data)
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    // Wrong key / corrupted blob — caller treats "" as "not configured".
    return "";
  }
}
