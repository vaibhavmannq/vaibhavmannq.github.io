import { defineConfig } from 'vite';

export default defineConfig({
  // User site (vaibhavmannq.github.io) is served from the domain root
  base: '/',
  build: {
    target: 'es2023',
    // Sourcemaps are for local debugging only — shipping them added 5.3 MB to every production
    // deploy with nothing to catch it (I3, final review). `npm run dev` already gives full
    // source-mapped debugging without a production build.
    sourcemap: false,
    // Three.js with the WebGPU renderer is ~900 KB minified (~254 KB gzip). That's expected and budgeted in .size-limit.json.
    chunkSizeWarningLimit: 1100,
  },
});
