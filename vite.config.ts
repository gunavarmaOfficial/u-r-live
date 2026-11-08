import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(({ command }) => {
  // A local .env with NODE_ENV=development must not leak into a production build:
  // Vite would emit jsxDEV and "npm run build && npm start" would white-screen.
  if (command === 'build') {
    process.env.NODE_ENV = 'production';
  }

  return {
    plugins: [react(), tailwindcss()],
    // Single React instance in the bundle: hugeicons ships CJS entry points that
    // otherwise resolve a duplicate react.development.js copy.
    define: {
      'process.env.NODE_ENV': JSON.stringify(command === 'build' ? 'production' : 'development'),
    },
    resolve: {
      dedupe: ['react', 'react-dom', 'react/jsx-runtime', 'react-router', 'react-router-dom'],
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      target: 'es2022',
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules/react-router')) return 'router';
            if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) return 'react';
            return undefined;
          },
        },
      },
    },
    ssr: {
      // Bundle our own source only; keep React and other deps external for Node.
      noExternal: [],
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch:
        process.env.DISABLE_HMR === 'true'
          ? null
          : {
              ignored: ['**/.data/**', '**/.git/**', '**/*.json', '**/server/tests/**', '**/*.log'],
            },
    },
  };
});
