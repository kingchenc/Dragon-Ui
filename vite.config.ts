import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { readFileSync } from 'fs';
import { visualizer } from 'rollup-plugin-visualizer';

// Read version from package.json
const packageJson = JSON.parse(readFileSync('./package.json', 'utf8'));
const version = packageJson.version;

export default defineConfig({
  plugins: [
    react(),
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    })
  ],
  clearScreen: false,
  base: "./", // This is crucial for Electron!
  server: {
    port: 1420,
    strictPort: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: process.env.TAURI_PLATFORM == "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      external: [
        'claude-usage-tracker',
        'claude-data-loader',
        'claude-cost-calculator'
      ],
      output: {
        manualChunks: {
          'chart': ['chart.js', 'react-chartjs-2'],
          'icons': ['lucide-react'],
          'ui': ['@radix-ui/react-progress', '@radix-ui/react-slot', '@radix-ui/react-tabs'],
          'animation': ['framer-motion'],
          'vendor': ['react', 'react-dom', 'zustand']
        }
      }
    }
  },
  define: {
    __APP_VERSION__: JSON.stringify(version),
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['claude-usage-tracker']
  }
});