import { defineConfig } from 'vite';
import httpMock from 'vite-plugin-http-mock';

const { httpMockPlugin } = httpMock;

export default defineConfig({
  plugins: [httpMockPlugin({ baseURL: '/api/v1' })],
});
