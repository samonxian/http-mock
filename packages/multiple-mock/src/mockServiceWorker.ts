import type { Mockjs } from 'mockjs';
import { CreateMockApp } from './CreateMockApp';
import type { MockFunction } from './createMockMiddleware';
import type { Method, MockApp, MockAppOptions, MockRequest, MockResponse } from './CreateMockApp';

/**
 * 在 Service Worker fetch 事件中运行 mock app
 * @param event fetch 事件
 * @param mockFunction mock 路由执行函数
 * @param options 选项同 CreateMockApp
 */
export async function runMockApp(
  event: FetchEvent,
  mockFunction?: (mockApp: MockApp) => void,
  options?: MockAppOptions,
) {
  const headers = {};
  const req: MockRequest = {
    url: event.request.url,
    method: event.request.method.toUpperCase() as Method,
    headers: {},
    query: {},
    params: {},
    body: {},
  };
  const res: MockResponse = {
    statusCode: 200,
    setHeader: (name, value) => {
      headers[name] = value;
      return res;
    },
    end: (body: any) => {
      event.respondWith(
        Promise.resolve(
          new Response(body, {
            headers,
            status: res.statusCode,
          }),
        ),
      );
      return res;
    },
    send: null,
  };

  const createAppInstance = new CreateMockApp(req, res, null, options);
  const mockApp = createAppInstance.getMockApp();
  mockFunction?.(mockApp);
  await createAppInstance.run();
}

/**
 * 启动 MockServiceWorker 拦截服务
 * @param this 需要使用 bind(this: ServiceWorkerGlobalScope)
 * @param options.openLogger 是否开启请求日志，同 CreateMockApp
 * @param options.baseURL 代理请求的前缀 URL，同 CreateMockApp
 * @param options.mockjs 可传递 mockjs，支持 mockjs 的语法
 * @param options.mockData mock 数据，即 Mock 函数数组，数据格式为：
 * @example
 * ```js
 * intercept.bind(this)({
 *   openLogger: true,
 *   baseURL: '/api/v1',
 *   mockjs: mockjs,
 *   mockData: [
 *     (mockApp) => {
 *        mockApp.get('/path/to', (req, res) => {
 *          res.send({ data: {}, msg: 'ok' })
 *        })
 *     }
 *   ]
 * })
 * ```
 */
export function intercept(
  this: ServiceWorkerGlobalScope,
  options?: { openLogger?: boolean; baseURL?: string; mockjs?: Mockjs; mockData?: MockFunction[] },
) {
  const { mockjs, mockData = [], openLogger, baseURL } = options || {};

  this.addEventListener('install', () => {
    console.log('[MOCK] service worker installed');

    // 第一时间激活 service worker，需配合 clients.claim 使用
    this.skipWaiting();
  });

  this.addEventListener('activate', (event) => {
    console.log('[MOCK] service worker activated');

    // clients.claim 使 service worker 立即生效，否则需要刷新页面
    // 等待生鲜
    event.waitUntil(self.clients.claim());
  });

  this.addEventListener('fetch', (event) => {
    runMockApp(
      event,
      (mockApp) => {
        mockData?.forEach((mockFunction) => {
          mockFunction(mockApp);
        });
      },
      { openLogger, baseURL, mockjs },
    );
  });
}
