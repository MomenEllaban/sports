/**
 * Theme resolution, kept free of React so the toggle, the boot script and the
 * tests all agree on one contract.
 *
 * The DOM contract is deliberate and unchanged: dark is the absence of the
 * attribute (`<html>` with no `data-theme`), light is `data-theme="light"`.
 * Anything that treats "no attribute" as a different default will flash the
 * wrong theme on first paint.
 */

export type ThemeName = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';
export const THEME_ATTRIBUTE = 'data-theme';

/** The stored value only ever matters when it is exactly "light". */
export function isLight(theme: string | null | undefined): boolean {
  return theme === 'light';
}

/**
 * The attribute on the document wins over storage: the boot script may have
 * applied a theme that storage has not caught up with yet.
 */
export function themeFromAttribute(
  root: { getAttribute(name: string): string | null } | null | undefined,
): ThemeName | null {
  const value = root?.getAttribute(THEME_ATTRIBUTE);
  if (value === 'light' || value === 'dark') return value;
  return null;
}

export function readStoredTheme(
  storage: Pick<Storage, 'getItem'> | null | undefined,
): ThemeName {
  return isLight(storage?.getItem(THEME_STORAGE_KEY)) ? 'light' : 'dark';
}

/**
 * The theme a freshly-mounted toggle should show. Falls back to dark, which is
 * the app default, so a control never renders claiming a theme the DOM has not
 * applied yet.
 */
export function initialTheme(
  root: { getAttribute(name: string): string | null } | null | undefined,
  storage: Pick<Storage, 'getItem'> | null | undefined,
): ThemeName {
  return themeFromAttribute(root) ?? readStoredTheme(storage);
}

/** Applies and persists a theme. Dark clears the attribute rather than setting
 * `data-theme="dark"`, because the stylesheet is written against that. */
export function applyTheme(
  theme: ThemeName,
  root: { getAttribute(name: string): string | null; setAttribute(name: string, value: string): void; removeAttribute(name: string): void },
  storage: Pick<Storage, 'setItem'> | null | undefined,
): void {
  if (isLight(theme)) {
    root.setAttribute(THEME_ATTRIBUTE, 'light');
  } else {
    root.removeAttribute(THEME_ATTRIBUTE);
  }
  try {
    storage?.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private browsing: the theme still applies for this page view.
  }
}

export function nextTheme(theme: ThemeName): ThemeName {
  return theme === 'dark' ? 'light' : 'dark';
}
