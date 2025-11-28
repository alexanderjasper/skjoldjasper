import {getServerConfig} from '@skjoldjasper/shared';

try {
    const cfg = getServerConfig();
    // eslint-disable-next-line no-console
    console.log('Env OK:', {
        databaseUrl: cfg.databaseUrl ? 'set' : 'missing',
        allowedOrigins: cfg.allowedOrigins,
        publicGameServerWs: cfg.publicGameServerWs,
        rateLimit: cfg.rateLimit
    });
    process.exit(0);
} catch (err) {
    // eslint-disable-next-line no-console
    console.error('Env check failed:', err instanceof Error ? err.message : err);
    process.exit(1);
}


