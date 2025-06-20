// Frontend configuration for separate deployment
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  
  // Production build configuration
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu'],
          utils: ['axios', 'date-fns', 'clsx']
        }
      }
    }
  },

  // Path resolution for imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../client/src'),
      '@/components': path.resolve(__dirname, '../client/src/components'),
      '@/lib': path.resolve(__dirname, '../client/src/lib'),
      '@/hooks': path.resolve(__dirname, '../client/src/hooks'),
      '@/pages': path.resolve(__dirname, '../client/src/pages'),
    }
  },

  // Environment variable configuration
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || 'https://api.beyondask.com'),
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0')
  }
});