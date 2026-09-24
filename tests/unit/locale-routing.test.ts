import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { routing } from '../../src/i18n/routing.js';

describe('Arabic-first locale routing', () => {
  it('keeps Arabic explicit and first in the routing config', () => {
    expect(routing.defaultLocale).toBe('ar');
    expect(routing.locales[0]).toBe('ar');
    expect(routing.localePrefix).toBe('always');
  });

  it('has an explicit root redirect to Arabic', () => {
    const middleware = readFileSync(join(process.cwd(), 'src', 'middleware.ts'), 'utf8');
    expect(middleware).toContain("arabicUrl.pathname = '/ar'");
    const root = readFileSync(join(process.cwd(), 'src', 'app', 'page.tsx'), 'utf8');
    expect(root).toContain("redirect('/ar')");
  });
});
