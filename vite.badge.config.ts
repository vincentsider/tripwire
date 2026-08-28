import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Second build: the self-contained, self-verifying badge embed served at
// /badge.js. IIFE so a site can drop it in a classic <script> tag. Does not wipe
// the main SPA build (emptyOutDir: false).
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2020',
    lib: {
      entry: fileURLToPath(new URL('./src/badge/embed.ts', import.meta.url)),
      formats: ['iife'],
      name: 'TripwireBadge',
      fileName: () => 'badge.js',
    },
  },
});
