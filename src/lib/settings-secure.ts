/**
 * Encrypted storage for sensitive settings (F0 §1.1).
 * AES-256-GCM via WebCrypto (no node: imports — safe to bundle anywhere;
 * actual use stays server-side). Envelope: `enc:v1:<iv>:<ct>`.
 * Key comes from `SETTINGS_ENCRYPTION_KEY` (32 bytes, base64 or hex or raw).
 * - Production without the key: THROW (fail closed, never store plaintext).
 * - Dev/test without the key: plaintext passthrough with `plain:` prefix so
 *   the gap is visible and migratable once the key exists.
 */

const PREFIX = 'enc:v1:';
const DEV_PREFIX = 'plain:';
const subtle: SubtleCrypto | undefined = (globalThis as { crypto?: Crypto }).crypto?.subtle;

function loadKeyBytes(): Uint8Array | null {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) return null;
  const s = raw.trim();
  try {
    if (/^[0-9a-fA-F]{64}$/.test(s)) {
      const b = new Uint8Array(32);
      for (let i = 0; i < 32; i++) b[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
      return b;
    }
    const b64 = Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
    if (b64.length === 32) return b64;
    const utf = new TextEncoder().encode(s);
    if (utf.length === 32) return utf;
  } catch {
    return null;
  }
  return null;
}

async function importKey(bytes: Uint8Array): Promise<CryptoKey> {
  if (!subtle) throw new Error('WebCrypto unavailable');
  return subtle.importKey('raw', bytes.slice().buffer as ArrayBuffer, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

const b64 = (b: Uint8Array): string => btoa(String.fromCharCode(...b));
const unb64 = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function isEncryptionConfigured(): boolean {
  return loadKeyBytes() !== null;
}

export async function encryptSecret(plaintext: string): Promise<string> {
  const bytes = loadKeyBytes();
  if (!bytes) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SETTINGS_ENCRYPTION_KEY is required in production');
    }
    return `${DEV_PREFIX}${plaintext}`;
  }
  const key = await importKey(bytes);
  const iv = (globalThis as { crypto: Crypto }).crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle!.encrypt({ name: 'AES-GCM', iv: iv.slice().buffer as ArrayBuffer }, key, new TextEncoder().encode(plaintext)));
  return `${PREFIX}${b64(iv)}:${b64(ct)}`;
}

export async function decryptSecret(stored: string): Promise<string> {
  if (stored.startsWith(DEV_PREFIX)) return stored.slice(DEV_PREFIX.length);
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const bytes = loadKeyBytes();
  if (!bytes) throw new Error('SETTINGS_ENCRYPTION_KEY is required to decrypt settings');
  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 2) throw new Error('Malformed encrypted setting');
  const key = await importKey(bytes);
  const pt = await subtle!.decrypt({ name: 'AES-GCM', iv: unb64(parts[0]).slice().buffer as ArrayBuffer }, key, unb64(parts[1]).slice().buffer as ArrayBuffer);
  return new TextDecoder().decode(pt);
}

export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}
