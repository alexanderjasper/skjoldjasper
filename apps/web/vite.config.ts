import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		host: true,
		port: 5173,
		origin: process.env.PUBLIC_ORIGIN ?? undefined,
		fs: {
			allow: [
				'/workspace',
				'/workspace/node_modules'
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
			'app.spilspurt.dk',
			'localhost'
		]
	}
});
