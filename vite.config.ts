import { defineConfig } from 'vite';

export default defineConfig({
  // User site (vaibhavmannq.github.io) is served from the domain root
  base: '/',
  build: {
    target: 'es2023',
    sourcemap: true,
  },
});
