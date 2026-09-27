import { describe, expect, it } from 'vitest';
import {
  applyTheme,
  initialTheme,
  isLight,
  nextTheme,
  readStoredTheme,
  themeFromAttribute,
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
} from '../../src/lib/theme.js';

/** Minimal stand-in for the two DOM objects the helpers touch. */
function fakeRoot(initial: string | null = null) {
  const attributes = new Map<string, string>();
  if (initial !== null) attributes.set(THEME_ATTRIBUTE, initial);
  return {
    attrs: attributes,
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
    removeAttribute: (name: string) => void attributes.delete(name),
  };
}

function fakeStorage(initial: string | null = null) {
  const values = new Map<string, string>();
  if (initial !== null) values.set(THEME_STORAGE_KEY, initial);
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
  };
}

describe('theme resolution', () => {
  it('treats only the exact string "light" as light mode', () => {
    expect(isLight('light')).toBe(true);
    expect(isLight('dark')).toBe(false);
    expect(isLight('Light')).toBe(false);
    expect(isLight(null)).toBe(false);
  });

  it('reads the document attribute as the authority', () => {
    expect(themeFromAttribute(fakeRoot('light'))).toBe('light');
    expect(themeFromAttribute(fakeRoot(null))).toBeNull();
    expect(themeFromAttribute(null)).toBeNull();
  });

  it('prefers the attribute over storage so a boot script wins', () => {
    // The anti-FOUC script in the locale layout applies the attribute before
    // paint; storage can still hold the previous value.
    expect(initialTheme(fakeRoot('light'), fakeStorage('dark'))).toBe('light');
    expect(initialTheme(fakeRoot(null), fakeStorage('light'))).toBe('light');
  });

  it('defaults to dark when nothing has been chosen', () => {
    expect(initialTheme(fakeRoot(null), fakeStorage(null))).toBe('dark');
    expect(readStoredTheme(null)).toBe('dark');
  });

  it('sets the attribute for light and clears it for dark', () => {
    // Dark is the absence of the attribute: the stylesheet is written against it.
    const root = fakeRoot();
    const storage = fakeStorage();

    applyTheme('light', root, storage);
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('light');

    applyTheme('dark', root, storage);
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBeNull();
    expect(storage.getItem(THEME_STORAGE_KEY)).toBe('dark');
  });

  it('survives storage that throws', () => {
    const root = fakeRoot();
    const hostile = {
      getItem: () => null,
      setItem: () => {
        throw new Error('denied');
      },
    };
    // The theme must still apply for this page view.
    expect(() => applyTheme('light', root, hostile)).not.toThrow();
    expect(root.getAttribute(THEME_ATTRIBUTE)).toBe('light');
  });

  it('toggles between the two themes', () => {
    expect(nextTheme('dark')).toBe('light');
    expect(nextTheme('light')).toBe('dark');
  });
});
