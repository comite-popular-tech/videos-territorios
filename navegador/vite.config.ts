import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// base relativa: a página roda em comite-popular-tech.github.io/videos-territorios/ (GitHub Pages) e em localhost
export default defineConfig({ base: './', plugins: [react()], server: { port: 5199 } });
