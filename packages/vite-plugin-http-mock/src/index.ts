import { createMockMiddleware } from 'express-middleware-http-mock';
import type { MockMiddlewareOptions } from 'express-middleware-http-mock';
import type { Connect, Plugin } from 'vite';

export interface Options extends MockMiddlewareOptions {
  useMock?: boolean;
}

export function httpMockPlugin(options: Options = {}): Plugin {
  const { useMock = true, ...restOptions } = options;

  return {
    name: 'vite:http-mock',
    enforce: 'pre',

    configureServer(server) {
      if (useMock) {
        server.middlewares.use(createMockMiddleware(restOptions) as unknown as Connect.NextHandleFunction);
      }
    },
  };
}

export * from 'express-middleware-http-mock';
