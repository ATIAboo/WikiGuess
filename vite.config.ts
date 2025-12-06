import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Defines process.env as an empty object to prevent runtime crashes in the browser
    // when accessing process.env.VAR in the code.
    // This allows code like `process.env.API_KEY || 'default'` to resolve to 'default'.
    'process.env': {}
  }
});