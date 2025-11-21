import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
	plugins: [sveltekit()],
	envDir: resolve(__dirname),
	server: {
		host: true,
		port: 5173,
		origin: process.env.PUBLIC_ORIGIN ?? undefined,
		fs: {
			allow: [
				'/workspace',
				'/workspace/node_modules',
				'/Users/alexander/Code/skjoldjasper'
			]
		},
		hmr: {
			host: process.env.PUBLIC_HMR_HOST ?? undefined,
			protocol: process.env.PUBLIC_HMR_PROTOCOL as 'ws' | 'wss' | undefined,
			clientPort: process.env.PUBLIC_HMR_PORT ? Number(process.env.PUBLIC_HMR_PORT) : undefined
		},
		headers: {
			'Cache-Control': 'no-store'
		},
		allowedHosts: [
			'skjoldjasper.dk',
			'localhost'
		]
	}
});
