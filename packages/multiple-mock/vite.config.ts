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
          buildOptions: [
            {
              sourcemap: true,
              lib: {
                entry: path.resolve(__dirname, 'src/serviceWorkerMockHttp.ts'),
                name: 'MockHttp',
                formats: ['umd'],
                fileName: () => `serviceWorkerMockHttp.js`,
              },
            },
            {
              sourcemap: true,
              lib: {
                entry: path.resolve(__dirname, 'src/mock.sw.ts'),
                name: 'noop',
                formats: ['umd'],
                fileName: () => `mock.sw.js`,
              },
            },
          ],
        },
      }),
    ],
    test: {
      watch: false,
      environment: 'happy-dom',
    },
  };
});
