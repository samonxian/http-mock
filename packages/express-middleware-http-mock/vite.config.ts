/// <reference types="vitest" />

import { defineConfig } from 'vite';
import { buildPlugin } from 'vite-plugin-build';

export default defineConfig(() => {
  return {
    plugins: [
      buildPlugin({
        fileBuild: {
          esOutputDir: false,
          emitDeclaration: true,
          ignoreInputs: [`**/*.spec.*`, '**/*.test.*', '**/*.d.ts', '**/__tests__/**'],
        },
      }),
    ],
    test: {
      watch: false,
    },
  };
});
