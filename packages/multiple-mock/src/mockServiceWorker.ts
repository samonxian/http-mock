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
export function intercept(this: ServiceWorkerGlobalScope, options?: { openLogger?: boolean }) {
  const { openLogger } = options || {};

  this.addEventListener('install', () => {
    openLogger && console.log('[MOCK] service worker installed');

    // 第一时间激活 service worker，需配合 clients.claim 使用
    this.skipWaiting();
  });

  this.addEventListener('activate', (event) => {
    openLogger && console.log('[MOCK] service worker activated');

    // clients.claim 使 service worker 立即生效，否则需要刷新页面
    // 等待生效
    event.waitUntil(this.clients.claim());

    const broadcast = typeof BroadcastChannel !== undefined && new BroadcastChannel('mock.sw.js');
    broadcast?.postMessage({
      type: 'activated',
    });
  });

  this.addEventListener('fetch', async (event) => {
    event.respondWith(send.bind(this)(event));
  });
}

async function send(this: ServiceWorkerGlobalScope, event: FetchEvent): Promise<Response> {
  const { request, clientId } = event;
  const accept = request.headers.get('accept') || '';
  const cloneRequest = request.clone();

  if (!((accept === '*/*' || accept === 'application/json') && !getFileNameByUrl(request.url).includes('.'))) {
    // 先过滤有文件后缀名的 url 和非 application/json 的请求
    return fetch(cloneRequest);
  }

  const client = await this.clients.get(clientId);
  let requestBody: {};
  try {
    // 请求不传 body 这里会报错
    requestBody = await cloneRequest.json();
  } catch {
    requestBody = {};
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();

    channel.port1.onmessage = (event) => {
      if (event.data.type === 'BYPASS_RESPONSE') {
        resolve(fetch(cloneRequest));
        return;
      }

      if (event.data.type === 'MOCK_RESPONSE') {
        const receivedMessage: { body?: any; init?: ResponseInit } = { ...event.data.payload };
        const mockResponse = new Response(receivedMessage.body, {
          ...receivedMessage.init,
          headers: {
            ...receivedMessage.init?.headers,
            'x-power-by': 'multiple-mock',
          },
        });
        resolve(mockResponse);
        return;
      }
    };

    client.postMessage(
      {
        type: 'MOCK_REQUEST',
        payload: {
          request: {
            url: request.url,
            method: request.method.toUpperCase(),
            body: requestBody,
            // eslint-disable-next-line node/no-unsupported-features/es-builtins
            headers: Object.fromEntries(cloneRequest.headers.entries()),
          },
        },
      },
      [channel.port2],
    );
  });
}

function getFileNameByUrl(url: string) {
  return url.substring(url.lastIndexOf('/') + 1);
}
