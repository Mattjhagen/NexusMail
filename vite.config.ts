
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: [
      'nexusmail.space',
      '.onrender.com', 
      'localhost'
    ]
  },
  build: {
    outDir: 'dist',
    target: 'esnext'
  }
});
