/**
 * Environment guard — single source of truth for environment and destructive
 * action protection. A Vercel production build must never silently behave like
 * development merely because APP_ENV was forgotten.
 */
export type AppEnv = 'development' | 'staging' | 'production';

export function getAppEnv(): AppEnv {
  const nodeEnv = (process.env.NODE_ENV || '').toLowerCase();
  const raw = (process.env.APP_ENV || '').toLowerCase();

  if (raw && raw !== 'development' && raw !== 'staging' && raw !== 'production') {
    throw new Error(`REFUSED: APP_ENV has an invalid value: ${raw}`);
  }

  // NODE_ENV=production is authoritative for a production deployment. An
  // explicit non-production APP_ENV is rejected rather than downgraded.
  if (nodeEnv === 'production' && raw && raw !== 'production') {
    throw new Error(`REFUSED: NODE_ENV=production requires APP_ENV=production (received ${raw}).`);
  }
  if (nodeEnv === 'production') return 'production';
  return (raw || 'development') as AppEnv;
}

/** Throws unless the resolved app environment is not production. */
export function assertNotProduction(action: string): void {
  const env = getAppEnv();
  if (env === 'production') {
    throw new Error(`REFUSED: "${action}" is blocked in production.`);
  }
}

/** Throws unless the resolved app environment is exactly development. */
export function assertDevelopment(action: string): void {
  const env = getAppEnv();
  if (env !== 'development') {
    throw new Error(`REFUSED: "${action}" requires APP_ENV=development (current: ${env}).`);
  }
}

/**
 * Fail-closed secret accessor. The development fallback is only available in a
 * real development/test process; production and staging must provide a secret.
 */
export function requiredSecret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  const env = getAppEnv();
  if (env !== 'development') {
    throw new Error(`REFUSED: ${name} must be set while APP_ENV=${env}.`);
  }
  return devFallback;
}
