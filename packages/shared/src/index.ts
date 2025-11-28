import {z} from 'zod';

export const userProfileSchema = z.object({
    id: z.uuid(),
    email: z.email(),
    displayName: z.string().min(1),
    createdAt: z.string()
});

// noinspection JSUnusedGlobalSymbols -- public API type for consumers of @skjoldjasper/shared
export type UserProfile = z.infer<typeof userProfileSchema>;

export * from './config.js';
export * from './http.js';
export * from './rateLimit.js';
export * from './events.js';

