import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command, mode }) => {
    const isProduction = mode === 'production';

    return {
        plugins: [react(), tailwindcss()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        build: {
            sourcemap: mode !== 'production',
            minify: 'terser',
            terserOptions: {
                compress: {
                    // Remove console.log and console.debug, but keep console.warn and console.error
                    pure_funcs: isProduction ? ['console.log', 'console.debug'] : [],
                    drop_console: false, // Set to true to remove ALL console statements
                    drop_debugger: isProduction,
                },
            },
        },
        server: {
            port: 5173,
            host: true, // Expose to network if running in Docker for dev
        },
    };
});
