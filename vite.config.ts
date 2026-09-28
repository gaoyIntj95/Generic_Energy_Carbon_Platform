import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  base: command === 'serve' ? '/Generic_Energy_Carbon_Platform/' : './',
  server: { port: 5173 },
  preview: { port: 4173 },
}));
