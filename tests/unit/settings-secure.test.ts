import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, maskSecret, isEncryptionConfigured } from '../../src/lib/settings-secure.js';

describe('settings-secure (F0)', () => {
  it('round-trips with a configured key', async () => {
    process.env.SETTINGS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    expect(isEncryptionConfigured()).toBe(true);
    const enc = await encryptSecret('super-secret-key');
    expect(enc.startsWith('enc:v1:')).toBe(true);
    expect(await decryptSecret(enc)).toBe('super-secret-key');
    delete process.env.SETTINGS_ENCRYPTION_KEY;
  });

  it('dev passthrough is marked plain: and recoverable', async () => {
    delete process.env.SETTINGS_ENCRYPTION_KEY;
    const stored = await encryptSecret('abc');
    expect(stored.startsWith('plain:')).toBe(true);
    expect(await decryptSecret(stored)).toBe('abc');
    expect(await decryptSecret('legacy-plaintext')).toBe('legacy-plaintext');
  });

  it('masks secrets (last 4 visible)', () => {
    expect(maskSecret('')).toBe('');
    expect(maskSecret('1234567890')).toBe('••••7890');
  });
});
