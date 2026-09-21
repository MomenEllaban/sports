import crypto from 'node:crypto';

/**
 * Encrypted storage for sensitive settings (F0 §1.1).
 * AES-256-GCM with a random IV per value; envelope: `enc:v1:<iv>:<tag>:<ct>`.
 * Key comes from `SETTINGS_ENCRYPTION_KEY` (32 bytes, base64 or hex or raw).
 * - Production without the key: THROW (fail closed, never store plaintext).
 * - Dev/test without the key: plaintext passthrough with `plain:` prefix so
 *   the gap is visible and migratable once the key exists.
 */

const PREFIX = 'enc:v1:';
const DEV_PREFIX = 'plain:';

function loadKey(): Buffer | null {
  const raw = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!raw) return null;
  const s = raw.trim();
  try {
    if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, 'hex');
    const b = Buffer.from(s, 'base64');
    if (b.length === 32) return b;
    const utf = Buffer.from(s, 'utf8');
    if (utf.length === 32) return utf;
  } catch {
    return null;
  }
  return null;
}

export function isEncryptionConfigured(): boolean {
  return loadKey() !== null;
}

export function encryptSecret(plaintext: string): string {
  const key = loadKey();
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SETTINGS_ENCRYPTION_KEY is required in production');
    }
    return `${DEV_PREFIX}${plaintext}`;
  }
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

export function decryptSecret(stored: string): string {
  if (stored.startsWith(DEV_PREFIX)) return stored.slice(DEV_PREFIX.length);
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const key = loadKey();
  if (!key) throw new Error('SETTINGS_ENCRYPTION_KEY is required to decrypt settings');
  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Malformed encrypted setting');
  const [ivB64, tagB64, ctB64] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return decipher.update(Buffer.from(ctB64, 'base64'), undefined, 'utf8') + decipher.final('utf8');
}

export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 4) return '••••';
  return `••••${value.slice(-4)}`;
}
