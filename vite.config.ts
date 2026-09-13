import { defineConfig } from 'vite';

export default defineConfig({
  // User site (vaibhavmannq.github.io) is served from the domain root
  base: '/',
  build: {
    target: 'es2023',
    sourcemap: true,
    // Three.js with the WebGPU renderer is ~900 KB minified (~254 KB gzip). That's expected and budgeted in .size-limit.json.
    chunkSizeWarningLimit: 1100,
  },
});
