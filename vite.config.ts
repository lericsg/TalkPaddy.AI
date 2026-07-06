import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  // Read firebase config dynamically if exists to avoid hardcoding secrets in Git or requiring manual .env configuration
  let firebaseEnv: Record<string, string> = {};
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      firebaseEnv = {
        'import.meta.env.VITE_FIREBASE_PROJECT_ID': JSON.stringify(config.projectId),
        'import.meta.env.VITE_FIREBASE_APP_ID': JSON.stringify(config.appId),
        'import.meta.env.VITE_FIREBASE_API_KEY': JSON.stringify(config.apiKey),
        'import.meta.env.VITE_FIREBASE_AUTH_DOMAIN': JSON.stringify(config.authDomain),
        'import.meta.env.VITE_FIREBASE_STORAGE_BUCKET': JSON.stringify(config.storageBucket),
        'import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID': JSON.stringify(config.messagingSenderId),
        'import.meta.env.VITE_FIREBASE_DATABASE_ID': JSON.stringify(config.firestoreDatabaseId || config.databaseId || ""),
      };
    }
  } catch (error) {
    console.warn('Could not read firebase-applet-config.json:', error);
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    define: {
      ...firebaseEnv,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
