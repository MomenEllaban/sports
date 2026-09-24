import { describe, it, expect, afterEach } from 'vitest';
import { getAppEnv, assertNotProduction, assertDevelopment, requiredSecret } from '../../src/lib/env-guard.js';

const env = process.env as unknown as Record<string, string | undefined>;
const originalAppEnv = env.APP_ENV;
const originalNodeEnv = env.NODE_ENV;

describe('env-guard (unit, no DB)', () => {
  afterEach(() => {
    if (originalAppEnv === undefined) delete env.APP_ENV;
    else env.APP_ENV = originalAppEnv;
    if (originalNodeEnv === undefined) delete env.NODE_ENV;
    else env.NODE_ENV = originalNodeEnv;
    delete process.env.TEST_ENV_GUARD_SECRET;
  });

  it('defaults to development only outside a production Node runtime', () => {
    env.NODE_ENV = 'test';
    delete env.APP_ENV;
    expect(getAppEnv()).toBe('development');
  });

  it('fails closed when NODE_ENV=production and APP_ENV is missing', () => {
    env.NODE_ENV = 'production';
    delete env.APP_ENV;
    expect(getAppEnv()).toBe('production');
    expect(() => requiredSecret('TEST_ENV_GUARD_SECRET', 'unsafe-dev-fallback')).toThrow(/REFUSED/);
    expect(() => assertNotProduction('x')).toThrow(/REFUSED/);
  });

  it('rejects an explicit development APP_ENV in production', () => {
    env.NODE_ENV = 'production';
    env.APP_ENV = 'development';
    expect(() => getAppEnv()).toThrow(/REFUSED/);
  });

  it('assertNotProduction passes in development, throws in production', () => {
    env.NODE_ENV = 'test';
    env.APP_ENV = 'development';
    expect(() => assertNotProduction('x')).not.toThrow();
    env.APP_ENV = 'production';
    expect(() => assertNotProduction('x')).toThrow(/REFUSED/);
  });

  it('assertDevelopment requires development', () => {
    env.NODE_ENV = 'test';
    env.APP_ENV = 'staging';
    expect(() => assertDevelopment('x')).toThrow(/REFUSED/);
    env.APP_ENV = 'development';
    expect(() => assertDevelopment('x')).not.toThrow();
  });

  it('allows the fallback secret only in development', () => {
    env.NODE_ENV = 'test';
    env.APP_ENV = 'development';
    expect(requiredSecret('TEST_ENV_GUARD_SECRET', 'dev-only')).toBe('dev-only');
  });
});
