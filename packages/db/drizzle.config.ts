import { defineConfig } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Resolve relative to process.cwd() which is the package dir when using --dir
dotenv.config({ path: '.env' });

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? ''
  }
});


