import { CreateMockApp } from './CreateMockApp';
import type { Method, MockApp, MockAppOptions, MockRequest, MockResponse, NextFunction } from './CreateMockApp';
import type { MockFunction } from './createMockMiddleware';

/**
 * 注册并启动 MockServiceWorker 服务
 * @param options.url 注册的 service woker url
 * @param options.mockSwJsMd5Hash mock.sw.js 文件的 md5 hash，也可以是自定义的 service worker 注册文件
 * @param options.mockOptions CreateMockApp 的选项
 * @param callback service worker 首次注册激活后或者更新激活后触发的回调
 */
export async function start(
  options: { url: string; mockSwJsMd5Hash?: string; mockData: MockFunction[]; mockOptions?: MockAppOptions },
  callback: () => void,
) {
  const { url, mockData, mockSwJsMd5Hash = '', mockOptions } = options || {};
  const scriptURL = url;
  await navigator.serviceWorker.register(scriptURL);
  mockProccess(mockData, mockOptions);

  try {
    await navigator.serviceWorker.ready;
    console.log('[MOCK] mock server ready');
    // md5 hash 判断 service woker 注册文件内容是否更新，不考虑用户单独清理 localStorage 而不清理 service worker 的情况
    const preveMockSwJsMd5Hash = window.localStorage.getItem('mockSwJsMd5Hash');
    const broadcast = typeof BroadcastChannel !== undefined && new BroadcastChannel('mock.sw.js');
    if (preveMockSwJsMd5Hash !== mockSwJsMd5Hash && broadcast) {
      // 首次运行和 service worker 更新后运行这里
      broadcast.onmessage = (event) => {
        if (event.data.type === 'activated') {
          window.localStorage.setItem('mockSwJsMd5Hash', mockSwJsMd5Hash);
          callback?.();
        }
      };
    } else {
      // 已注册和已激活的 service worker 运行这里
      callback?.();
    }
  } catch (err) {
    console.error('error registering MOCK:', err);
  }
}

function mockProccess(mockData: MockFunction[], mockOptions?: MockAppOptions) {
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const port = event.ports[0];
    const byPassResponse = () => {
      port.postMessage({
        type: 'BYPASS_RESPONSE',
      });
    };

    if (event.data && event.data.type === 'MOCK_REQUEST') {
      const { request } = event.data.payload;
      const parsedUrl = new URL(request.url);

      if (parsedUrl.hostname !== window.location.hostname) {
        // 非当前站点的域名，不做拦截处理
        byPassResponse();
        return;
      }

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
          mockData?.forEach((m) => {
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
