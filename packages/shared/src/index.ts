import { z } from 'zod';

export const userProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().min(1),
  createdAt: z.string()
});

export type UserProfile = z.infer<typeof userProfileSchema>;


