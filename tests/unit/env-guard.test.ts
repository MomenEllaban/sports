import { describe, it, expect } from 'vitest';
import { getAppEnv, assertNotProduction, assertDevelopment } from '../../src/lib/env-guard.js';

describe('env-guard (unit, no DB)', () => {
  it('defaults to development', () => {
    delete process.env.APP_ENV;
    expect(getAppEnv()).toBe('development');
  });

  it('assertNotProduction passes in development, throws in production', () => {
    process.env.APP_ENV = 'development';
    expect(() => assertNotProduction('x')).not.toThrow();
    process.env.APP_ENV = 'production';
    expect(() => assertNotProduction('x')).toThrow(/REFUSED/);
    process.env.APP_ENV = 'development';
  });

  it('assertDevelopment requires development', () => {
    process.env.APP_ENV = 'staging';
    expect(() => assertDevelopment('x')).toThrow(/REFUSED/);
    process.env.APP_ENV = 'development';
    expect(() => assertDevelopment('x')).not.toThrow();
  });
});
