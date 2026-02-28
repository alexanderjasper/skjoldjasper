import {z} from 'zod';

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
    RATE_LIMIT_COLYSEUS_CAPACITY: z.string().optional(),
    RATE_LIMIT_COLYSEUS_REFILL_MS: z.string().optional()
});

export function getServerConfig(rawEnv?: Record<string, string | undefined>): ServerConfig {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const defaultEnv = (globalThis as any)?.process?.env as Record<string, string | undefined> | undefined;
    const envSource = rawEnv ?? defaultEnv ?? {};
    const parsed = envSchema.safeParse(envSource);
    if (!parsed.success) {
        const message = parsed.error.issues.map((i) => i.message).join('; ');
        throw new Error(`Invalid server configuration: ${message}`);
    }

    const env = parsed.data;

    const allowedOrigins = commaSeparated(env.ALLOWED_ORIGINS, ['http://localhost:5173']);

    const colyseusMessages: RateLimitConfig = {
        capacity: toInt(env.RATE_LIMIT_COLYSEUS_CAPACITY, 10),
        refillMs: toInt(env.RATE_LIMIT_COLYSEUS_REFILL_MS, 1_000)
    };

    return {
        databaseUrl: env.DATABASE_URL,
        allowedOrigins,
        sentryDsn: env.SENTRY_DSN,
        publicGameServerWs: env.PUBLIC_GAME_SERVER_WS ?? 'ws://localhost:2567',
        rateLimit: {colyseusMessages}
    };
}
