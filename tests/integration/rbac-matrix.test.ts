import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { RBAC_MATRIX, PUBLIC_PREFIXES } from '../../src/lib/auth/rbac-matrix.js';

const API_ROOT = path.resolve('src/app/api');

function collectRoutes(dir: string, base = '/api'): string[] {
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      out.push(...collectRoutes(path.join(dir, e.name), `${base}/${e.name}`));
    } else if (e.name === 'route.ts') {
      const src = fs.readFileSync(path.join(dir, e.name), 'utf8');
      const methods = ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'].filter((m) =>
        new RegExp(`export\\s+async\\s+function\\s+${m}\\b`).test(src)
      );
      out.push(`${base}|${methods.join(',')}`);
    }
  }
  return out;
}

describe('RBAC matrix coverage meta-test (T04, RED first)', () => {
  it('every route.ts is in the matrix or explicitly public', () => {
    const missing: string[] = [];
    for (const entry of collectRoutes(API_ROOT)) {
      const [route, methodsStr] = entry.split('|');
      const methods = methodsStr ? methodsStr.split(',') : [];
      if (PUBLIC_PREFIXES.some((p) => route.startsWith(p))) continue;
      const listed = RBAC_MATRIX[route];
      if (!listed) {
        missing.push(`${route} [${methods.join(',')}]`);
        continue;
      }
      for (const m of methods) {
        if (!listed.methods[m]) missing.push(`${route} method ${m} not listed`);
      }
    }
    expect(missing, `unlisted routes:\n${missing.join('\n')}`).toEqual([]);
  });
});
