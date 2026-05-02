// lib/logger.ts
// Structured JSON logger for API routes.
// Outputs JSON in production (machine-parseable for Vercel/Sentry).
// Human-readable in development.
// Never logs secrets — scrubs env var values.

const IS_PROD = process.env.NODE_ENV === 'production';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  [key: string]: unknown;
}

function scrubSecrets(data: Record<string, unknown>): Record<string, unknown> {
  const SENSITIVE = /key|secret|token|password|auth|credential/i;
  const scrubbed: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (SENSITIVE.test(k)) {
      scrubbed[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      scrubbed[k] = scrubSecrets(v as Record<string, unknown>);
    } else {
      scrubbed[k] = v;
    }
  }
  return scrubbed;
}

function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(meta ? scrubSecrets(meta) : {}),
  };

  if (IS_PROD) {
    // JSON for machine parsing
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(JSON.stringify(entry));
  } else {
    // Human-readable for dev
    const prefix = { info: 'ℹ', warn: '⚠', error: '✗', debug: '◦' }[level];
    const metaStr = meta ? ` ${JSON.stringify(scrubSecrets(meta))}` : '';
    const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    fn(`${prefix} ${message}${metaStr}`);
  }
}

export const logger = {
  info: (msg: string, meta?: Record<string, unknown>) => log('info', msg, meta),
  warn: (msg: string, meta?: Record<string, unknown>) => log('warn', msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
  debug: (msg: string, meta?: Record<string, unknown>) => log('debug', msg, meta),
};
