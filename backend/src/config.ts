/**
 * Small env helper. Keeps configuration in one place without pulling in a
 * configuration framework for a handful of values.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value === '' ? fallback : value;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export const config = {
  get port(): number {
    return int('PORT', 3000);
  },
  get webOrigin(): string {
    return optional('WEB_ORIGIN', 'http://localhost:5173');
  },
  get cookieSecure(): boolean {
    return optional('COOKIE_SECURE', 'false') === 'true';
  },
  get sessionTtlHours(): number {
    return int('SESSION_TTL_HOURS', 168);
  },
  get passwordResetTtlMinutes(): number {
    return int('PASSWORD_RESET_TTL_MINUTES', 60);
  },
  get passwordResetUrlBase(): string {
    return optional('PASSWORD_RESET_URL_BASE', 'http://localhost:5173/reset-password');
  },
  get emailTransport(): 'console' | 'smtp' {
    return optional('EMAIL_TRANSPORT', 'console') === 'smtp' ? 'smtp' : 'console';
  },
  get emailFrom(): string {
    return optional('EMAIL_FROM', 'Step360D CRM <no-reply@step360d.local>');
  },
  get databaseUrl(): string {
    return required('DATABASE_URL');
  },
};
