import { defineConfig } from 'vite';
import plugin from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [plugin()],
    server: {
        port: 2566,

        proxy: {
            '/api': {
                target: 'https://localhost:7000',
                changeOrigin: true,
                secure: false, // accepts the local development certificate
            },


        }
    }
})
