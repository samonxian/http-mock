/// <reference types="vitest" />

import path from 'path';
import { defineConfig } from 'vite';
import { buildPlugin } from 'vite-plugin-build';

export default defineConfig(() => {
  return {
    plugins: [
      buildPlugin({
        fileBuild: {
          emitDeclaration: true,
          ignoreInputs: [`**/*.spec.*`, '**/*.test.*', '**/*.d.ts', '**/__tests__/**'],
        },
        libBuild: {
          buildOptions: {
            emptyOutDir: false,
            sourcemap: true,
            lib: {
              entry: path.resolve(__dirname, 'src/mockServiceWorker.ts'),
              name: 'MockServiceWorker',
              formats: ['umd'],
              fileName: () => `mockServiceWorker.js`,
            },
            minify: true,
          },
        },
      }),
    ],
    test: {
      watch: false,
    },
  };
});
