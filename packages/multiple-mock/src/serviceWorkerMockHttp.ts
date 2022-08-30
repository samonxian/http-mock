// 此文件为 service work 注册后 importScript 文件

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

    const broadcast = typeof BroadcastChannel !== 'undefined' && new BroadcastChannel('mock.sw.js');
    if (broadcast) {
      broadcast.postMessage({
        type: 'activated',
      });
    }

    // clients.claim 使 service worker 立即生效，否则需要刷新页面
    // 等待生效
    event.waitUntil(this.clients.claim());
  });

  this.addEventListener('fetch', async (event) => {
    if (
      !event.clientId &&
      // @ts-ignore
      !this.isSetupServer // 通过 setupServer 进来的不做处理
    ) {
      return;
    }
    event.respondWith(send.bind(this)(event));
  });
}

async function send(this: ServiceWorkerGlobalScope, event: FetchEvent): Promise<Response> {
  const { request, clientId } = event;
  const accept = request.headers.get('accept') || '';
  const cloneRequest = request.clone();
  const insertedHeaders = {
    'x-power-by': xPowerBy,
  };

  const client = await this.clients.get(clientId);
  const requestBody = await bodyParser(cloneRequest);
  if (
    // @ts-ignore
    !this.isSetupServer && // 通过 setupServer 进来的不做处理
    accept &&
    !((accept.includes('*/*') || accept.includes('application/json')) && !getFileNameByUrl(request.url).includes('.'))
  ) {
    // 先过滤有文件后缀名的 url 和非 application/json 的请求
    return fetch(cloneRequest, {
      headers: insertedHeaders,
    });
  }

  if (!client) {
    return fetch(cloneRequest, {
      headers: insertedHeaders,
    });
  }

  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const byPassResponse = () => {
      resolve(
        fetch(cloneRequest, {
          headers: insertedHeaders,
        }),
      );
    };

    channel.port1.onmessage = (event) => {
      if (event.data.type === 'BYPASS_RESPONSE') {
        // @ts-ignore
        if (this.isSetupServer) {
          // 通过 setupServer (即 node 端) 进来的，找不到，直接返回404
          resolve(new Response('404 not found', { status: 404 }));
        } else {
          // 没匹配到的 mock，通过浏览器进来的，恢复请求
          byPassResponse();
        }
        return;
      }

      if (event.data.type === 'MOCK_RESPONSE') {
        const receivedMessage: { body?: any; init?: ResponseInit } = { ...event.data.payload };
        const mockResponse = new Response(receivedMessage.body, {
          ...receivedMessage.init,
          headers: {
            ...receivedMessage.init?.headers,
            ...insertedHeaders,
          },
        });
        resolve(mockResponse);
        return;
      }
    };

    const reqeustHeaders = {};
    for (const key of cloneRequest.headers.keys()) {
      reqeustHeaders[key] = cloneRequest.headers.get(key);
    }

    client.postMessage(
      {
        type: 'MOCK_REQUEST',
        payload: {
          request: {
            url: request.url,
            method: request.method.toUpperCase(),
            body: requestBody,
            headers: reqeustHeaders,
          },
        },
      },
      [channel.port2],
    );
  });
}

export async function bodyParser(request: Request) {
  // request 必须 clone 否则解析后会影响之前的 request
  return new Promise((resolve) => {
    const thenCallback = (result: any) => {
      resolve(result || undefined);
    };

    const parse = async () => {
      await request
        .clone()
        .json()
        .then(thenCallback)
        .catch(() => {});

      await request
        .clone()
        .formData?.()
        .then((formData) => {
          const fbody = {};
          for (const key of formData.keys()) {
            fbody[key] = formData.get(key);
          }
          return fbody;
        })
        .then(thenCallback)
        .catch(() => {});

      await request
        .clone()
        .blob()
        .then((b) => {
          return new Promise((resolve) => {
            const fr = new FileReader();
            fr.onload = (e) => {
              try {
                resolve(JSON.parse(e.target.result as string));
              } catch {
                resolve(e.target.result);
              }
            };
            fr.readAsText(b);
          });
        })
        .then(thenCallback)
        .catch(() => {});

      await request
        .clone()
        .text()
        .then(thenCallback)
        .catch(() => {});
    };

    parse();
  });
}

export const xPowerBy = 'multiple-mock';

function getFileNameByUrl(url: string) {
  return url.substring(url.lastIndexOf('/') + 1);
}
