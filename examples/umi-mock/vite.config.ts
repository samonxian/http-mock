import { defineConfig } from 'vite';
import httpMock from 'vite-plugin-http-mock';

const { httpMockPlugin, umiMock } = httpMock;

export default defineConfig({
  plugins: [
    httpMockPlugin({
      baseURL: '/api/v1',
      mocks: [umiMock()],
      useMockServiceWorker: true,
      useMockJsInServiceWorker: true,
    }),
  ],
  build: {
    sourcemap: true,
  },
});
