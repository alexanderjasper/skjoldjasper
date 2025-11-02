import { z } from 'zod';

export type RateLimitConfig = {
  capacity: number;
  refillMs: number;
};

export type ServerConfig = {
  databaseUrl: string;
  allowedOrigins: string[];
  sentryDsn?: string;
  publicGameServerWs: string;
  rateLimit: {
    eventsApi: RateLimitConfig;
    colyseusMessages: RateLimitConfig;
  };
};

const commaSeparated = (value: string | undefined, fallback: string[]): string[] => {
  if (!value || value.trim() === '') return fallback;
  return value.split(',').map((s) => s.trim()).filter(Boolean);
};

const toInt = (value: string | undefined, fallback: number): number => {
  if (!value) return fallback;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  ALLOWED_ORIGINS: z.string().optional(),
  SENTRY_DSN: z.string().optional(),
  PUBLIC_GAME_SERVER_WS: z.string().optional(),
  RATE_LIMIT_EVENTS_CAPACITY: z.string().optional(),
  RATE_LIMIT_EVENTS_REFILL_MS: z.string().optional(),
  RATE_LIMIT_COLYSEUS_CAPACITY: z.string().optional(),
  RATE_LIMIT_COLYSEUS_REFILL_MS: z.string().optional()
});

export function getServerConfig(rawEnv: Record<string, string | undefined> = process.env): ServerConfig {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join('; ');
    throw new Error(`Invalid server configuration: ${message}`);
  }

  const env = parsed.data;

  const allowedOrigins = commaSeparated(env.ALLOWED_ORIGINS, ['http://localhost:5173']);

  const eventsApi: RateLimitConfig = {
    capacity: toInt(env.RATE_LIMIT_EVENTS_CAPACITY, 60),
    refillMs: toInt(env.RATE_LIMIT_EVENTS_REFILL_MS, 60_000)
  };

  const colyseusMessages: RateLimitConfig = {
    capacity: toInt(env.RATE_LIMIT_COLYSEUS_CAPACITY, 10),
    refillMs: toInt(env.RATE_LIMIT_COLYSEUS_REFILL_MS, 1_000)
  };

  return {
    databaseUrl: env.DATABASE_URL,
    allowedOrigins,
    sentryDsn: env.SENTRY_DSN,
    publicGameServerWs: env.PUBLIC_GAME_SERVER_WS ?? 'ws://localhost:2567',
    rateLimit: { eventsApi, colyseusMessages }
  };
}

import { z } from 'zod';

export type RateLimitSettings = {
  capacity: number;
  refillMs: number;
};

export type ServerConfig = {
  databaseUrl: string;
  allowedOrigins: string[];
  publicGameServerWs: string;
  sentryDsn?: string;
  rateLimits: {
    eventApi: RateLimitSettings;
    wsMessage: RateLimitSettings;
  };
};

const rateLimitSchema = z.object({
  capacity: z.coerce.number().int().positive(),
  refillMs: z.coerce.number().int().positive()
});

const configSchema = z.object({
  DATABASE_URL: z.string().url(),
  ALLOWED_ORIGINS: z
    .string()
    .transform((s) => s.split(',').map((v) => v.trim()).filter(Boolean))
    .pipe(z.array(z.string()).nonempty())
    .catch(['http://localhost:5173']),
  PUBLIC_GAME_SERVER_WS: z.string().catch('ws://localhost:2567'),
  SENTRY_DSN: z.string().optional().or(z.literal('')).transform((v) => (v ? v : undefined)).optional(),
  EVENT_API_RATE_CAPACITY: z.string().optional(),
  EVENT_API_RATE_REFILL_MS: z.string().optional(),
  WS_MSG_RATE_CAPACITY: z.string().optional(),
  WS_MSG_RATE_REFILL_MS: z.string().optional()
});

export function parseServerConfig(env: Record<string, string | undefined>): ServerConfig {
  const parsed = configSchema.parse(env);

  const eventApi: RateLimitSettings = rateLimitSchema.parse({
    capacity: parsed.EVENT_API_RATE_CAPACITY ?? 60,
    refillMs: parsed.EVENT_API_RATE_REFILL_MS ?? 60_000
  });
  const wsMessage: RateLimitSettings = rateLimitSchema.parse({
    capacity: parsed.WS_MSG_RATE_CAPACITY ?? 10,
    refillMs: parsed.WS_MSG_RATE_REFILL_MS ?? 1_000
  });

  return {
    databaseUrl: parsed.DATABASE_URL,
    allowedOrigins: parsed.ALLOWED_ORIGINS,
    publicGameServerWs: parsed.PUBLIC_GAME_SERVER_WS,
    sentryDsn: parsed.SENTRY_DSN,
    rateLimits: { eventApi, wsMessage }
  };
}


