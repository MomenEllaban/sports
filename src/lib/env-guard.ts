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
