/**
 * Environment guard — single source of truth for destructive-action protection.
 * APP_ENV: development | staging | production (default: development).
 */
export type AppEnv = 'development' | 'staging' | 'production';

export function getAppEnv(): AppEnv {
  const v = (process.env.APP_ENV || 'development').toLowerCase();
  if (v === 'production' || v === 'staging' || v === 'development') return v;
  return 'development';
}

/** Throws unless APP_ENV is development. Destructive scripts MUST call this first. */
export function assertNotProduction(action: string): void {
  const env = getAppEnv();
  if (env === 'production') {
    throw new Error(`REFUSED: "${action}" is blocked while APP_ENV=production.`);
  }
}

/** Throws unless APP_ENV is exactly development (for seed:reset and test setup). */
export function assertDevelopment(action: string): void {
  if (getAppEnv() !== 'development') {
    throw new Error(`REFUSED: "${action}" requires APP_ENV=development (current: ${getAppEnv()}).`);
  }
}

/**
 * Fail-closed secret accessor (security): the env var is required outside
 * development; the insecure fallback is ONLY ever used while APP_ENV=development
 * so a missing secret can never silently protect production data.
 */
export function requiredSecret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  if (getAppEnv() !== 'development') {
    throw new Error(`REFUSED: ${name} must be set while APP_ENV=${getAppEnv()}.`);
  }
  return devFallback;
}
