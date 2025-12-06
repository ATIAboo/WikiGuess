
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Defines process.env as an empty object to prevent runtime crashes in the browser
    // when accessing process.env.API_KEY or other env vars in the code.
    'process.env': {}
  }
});
