// 目前只支持在 node happy-dom 的环境下使用
import path from 'path';
import { BatchInterceptor } from '@mswjs/interceptors';
import browserInterceptors from '@mswjs/interceptors/lib/presets/node';
import * as setupWorker from './setupWorker';
import { requireCjsModule } from './requireCjsModule';
import type { MockFunction } from './createMockMiddleware';
import type { MockAppOptions } from './CreateMockApp';

const interceptor = new BatchInterceptor({
  name: 'mock-http-interceptor',
  interceptors: browserInterceptors,
});
const serviceWorkerChannel = new MessageChannel();
// mock service work self
// 这里只是部分 mock 如果添加新的用法，则需要同步 mock
const serviceWorkerSelf = {
  isSetupServer: true,
  skipWaiting: async () => {},
  clients: {
    get: async () => {
      return serviceWorkerChannel.port1;
    },
    claim: async () => {},
  },
  addEventListener: (type: string, callback: (event?: MessageEvent | FetchEvent) => void) => {
    switch (type) {
      case 'install': {
        callback?.();
        break;
      }
      case 'activate': {
        callback?.({
          waitUntil: async () => {},
        } as unknown as MessageEvent);
        break;
      }
      case 'fetch': {
        interceptor.on('request', async (request) => {
          return new Promise((resolve) => {
            const cloneRequest = new Request(request.url.href, {
              method: request.method,
              headers: request.headers,
              // @ts-ignore
              body: ['GET', 'HEAD'].includes(request.method) ? undefined : request._body,
            });

            const event = {
              respondWith: async (responseP: Promise<Response>) => {
                const response = await responseP;
                request.respondWith({
                  status: response.status,
                  body: response.body as any,
                  headers: response.headers as any,
                });
                resolve();
              },
              request: cloneRequest,
            };
            callback?.(event as unknown as FetchEvent);
          });
        });
        break;
      }
    }
  },
};

if (typeof self !== 'undefined') {
  // mock service worker which is used by  setupWorker and serviceWorkerMockHttp
  // 这里只是部分 mock 如果添加新的用法，则需要同步 mock
  // @ts-ignore
  self.navigator.serviceWorker = {
    register: async () => {
      const mockSw = await requireCjsModule(path.resolve(__dirname, './serviceWorkerMockHttp'));
      mockSw.intercept.bind(serviceWorkerSelf)();

      return {
        unregister: async () => {},
      };
    },

    ready: async () => {},

    addEventListener: (type: string, callback: (event: MessageEvent) => void) => {
      if (type === 'message') {
        serviceWorkerChannel.port2.addEventListener(type, callback);
      }
    },
  };

  // self.FormData = self.URLSearchParams;
  // 拦截 fetch 并处理 node-fetch url 只兼容非绝对 url 路径
  const restoreFetch = self.fetch;
  self.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
    if (typeof url === 'string' && !url.startsWith('https://') && !url.startsWith('http://')) {
      url = 'http://' + path.join('localhost', url);
    } else {
      // 由于 happy-dom mock fetch 不支持 Request 对象，所以做了一些兼容处理
      // 但是实际上还是不支持 fetch 使用 Request 的用法，会缺失 body 等 init 参数的传递
      // 实际上也很少人这么用，目前 serviceWorkerHttpMock 中 BY_PASSBYPASS_RESPONSE 用到，用来传递没有命中 mock，也不影响模拟测试
      const request = url as Request;
      if (request.headers) {
        url = request.url;
        init = { headers: request.headers, ...init };
      }
    }

    return restoreFetch(url, init);
  };
}

export interface ServerStartOptions {
  mockData: MockFunction | MockFunction[];
  mockOptions: MockAppOptions;
}

export async function start(options: ServerStartOptions) {
  interceptor.apply();
  return setupWorker.start({ ...options, url: '' });
}

export function stop() {
  interceptor.dispose();
}
