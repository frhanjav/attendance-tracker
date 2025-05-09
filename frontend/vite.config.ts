import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command, mode }) => {
    const isProduction = mode === 'production';

    return {
        plugins: [react(), tailwindcss()],
        define: {
            'console.log': isProduction ? 'undefined' : 'console.log',
            'console.debug': isProduction ? 'undefined' : 'console.debug',
            'console.warn': 'console.warn',
            'console.error': 'console.error',
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        build: {
            sourcemap: mode !== 'production',
        },
        server: {
            port: 5173,
            host: true, // Expose to network if running in Docker for dev
        },
    };
});
