import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  root: 'web',
  base: '/goblin-tavern/',
  publicDir: 'public',
  plugins: [svelte()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
  },
  server: {
    port: 5173,
    strictPort: false,
  },
})
