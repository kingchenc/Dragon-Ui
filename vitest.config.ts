import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    // Enable in-source testing (tests alongside code)
    includeSource: ['lib/**/*.cjs', 'services/**/*.cjs', 'cli/**/*.cjs'],

    // Standard test files
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],

    // Exclude patterns
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-electron/**',
      '**/Copy_Clone/**',
      '**/.{git,cache,output,temp}/**'
    ],

    // Global test timeout
    testTimeout: 10000,

    // Enable globals (describe, it, expect)
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['lib/**/*.cjs', 'services/**/*.cjs', 'cli/**/*.cjs'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/*.d.ts',
        '**/*.test.{js,cjs}',
        '**/*.spec.{js,cjs}'
      ],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60
      }
    },

    // Reporter configuration
    reporters: ['default', 'html'],

    // Watch configuration
    watch: false,

    // Environment
    environment: 'node',

    // Pool configuration for CommonJS compatibility
    pool: 'forks',

    // Retry failed tests
    retry: 1,

    // Snapshot configuration
    snapshotFormat: {
      printBasicPrototype: false
    }
  },

  // Resolve configuration
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@services': resolve(__dirname, './services'),
      '@cli': resolve(__dirname, './cli'),
      '@lib': resolve(__dirname, './lib')
    }
  },

  // Define configuration for in-source testing
  define: {
    'import.meta.vitest': 'undefined'
  }
});
