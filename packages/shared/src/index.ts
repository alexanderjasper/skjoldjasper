import {z} from 'zod';

export const userProfileSchema = z.object({
    id: z.uuid(),
    email: z.email(),
    displayName: z.string().min(1),
    createdAt: z.string()
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export * from './config';
export * from './http';
export * from './rateLimit';
export * from './events';


