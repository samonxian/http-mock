// 此文件需要兼容主流浏览器
import { CreateMockApp } from './CreateMockApp';
import type { Method, MockApp, MockAppOptions, MockRequest, MockResponse, NextFunction } from './CreateMockApp';
import type { MockFunction } from './createMockMiddleware';

let unRegisterTimeout: any;

export interface StartOptions {
  url: string;
  mockSwJsMd5Hash?: string;
  scope?: string;
  mockData: MockFunction | MockFunction[];
  mockOptions: MockAppOptions;
}

/**
 * 注册并启动 MockServiceWorker 服务
 * @param options.url 注册的 service woker url
 * @param options.scope 注册的 service woker scope
 * @param options.mockSwJsMd5Hash service worker 注册文件 md5 hash，不要设置为 null
 * @param options.mockOptions CreateMockApp 的选项
 */
export async function start(options: StartOptions) {
  return new Promise((resolve) => {
    async function run() {
      const { scope, url, mockData, mockSwJsMd5Hash = '', mockOptions } = options || {};
      const scriptURL = url;
      const broadcast = typeof BroadcastChannel !== 'undefined' && new BroadcastChannel('mock.sw.js');
      const preveMockSwJsMd5Hash = window.localStorage.getItem('mockSwJsMd5Hash');

      if (preveMockSwJsMd5Hash !== mockSwJsMd5Hash && broadcast) {
        // 首次运行和 service worker 更新后运行这里
        broadcast.onmessage = async (event) => {
          if (event.data.type === 'activated') {
            await navigator.serviceWorker.ready;
            window.localStorage.setItem('mockSwJsMd5Hash', mockSwJsMd5Hash);
            clearTimeout(unRegisterTimeout);
            resolve(null);
          }
        };
      }

      const registration = await navigator.serviceWorker.register(scriptURL, { scope });

      unRegisterTimeout = setTimeout(async () => {
        // 由于用户清理浏览器缓存导致 callback 没有被调用，所以需要定时清理并重载
        // 移除当前 service worker
        // 移除相关 localStorage
        // 重载页面
        localStorage.removeItem('mockSwJsMd5Hash');
        await registration.unregister();
        window.location.reload();
      }, 1000);

      mockProccess(mockData, mockOptions);

      try {
        await navigator.serviceWorker.ready;
        mockOptions?.openLogger && console.log('[MOCK] mock server ready');

        if (preveMockSwJsMd5Hash === mockSwJsMd5Hash || !broadcast) {
          // 已注册和已激活的 service worker 运行这里
          clearTimeout(unRegisterTimeout);
          resolve(null);
        }
      } catch (err) {
        console.error('error registering MOCK:', err);
      }
    }

    run();
  });
}

function mockProccess(mockData: MockFunction | MockFunction[], mockOptions?: MockAppOptions) {
  const lastMockData = [].concat(mockData) as MockFunction[];

  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const port = event.ports[0];
    const byPassResponse = () => {
      port.postMessage({
        type: 'BYPASS_RESPONSE',
      });
    };

    if (event.data && event.data.type === 'MOCK_REQUEST') {
      const { request } = event.data.payload;
      const req: MockRequest = {
        url: request.url,
        method: request.method.toUpperCase() as Method,
        headers: request.headers,
        query: {},
        params: {},
        body: request.body,
      };
      const res: MockResponse = {
        statusCode: 200,
        headers: {},
        setHeader: (name, value) => {
          res.headers[name] = value;
          return res;
        },
        end: (body: any) => {
          port.postMessage({
            type: 'MOCK_RESPONSE',
            payload: {
              body,
              init: {
                headers: res.headers,
                status: res.statusCode,
              },
            },
          });
          return res;
        },
        send: null,
      };

      runMockApp(
        req,
        res,
        () => {
          // 没有命中的请求不拦截
          byPassResponse();
        },
        (mockApp) => {
          lastMockData.forEach((m) => {
            m(mockApp);
          });
        },
        mockOptions,
      );
    }
  });
}

/**
 * 运行 mock app
 * @param req mock Request 对象
 * @param res mock Response 对象
 * @param options 选项同 CreateMockApp
 */
export async function runMockApp(
  req: MockRequest,
  res: MockResponse,
  next?: NextFunction,
  mockFunction?: (mockApp: MockApp) => void,
  options?: MockAppOptions,
) {
  const createAppInstance = new CreateMockApp(req, res, next, options);
  const mockApp = createAppInstance.getMockApp();
  mockFunction?.(mockApp);
  await createAppInstance.run();

  return { req, res };
}

export default {
  start,
  runMockApp,
};
