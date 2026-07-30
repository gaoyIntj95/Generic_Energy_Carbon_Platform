import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Generic_Energy_Carbon_Platform/',  // ← 加上这一行
  server: { port: 5173 },
  preview: { port: 4173 },
});
