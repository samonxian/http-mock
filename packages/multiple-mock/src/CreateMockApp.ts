import type { Key, ParseOptions, TokensToRegexpOptions } from 'path-to-regexp';
import { pathToRegexp } from 'path-to-regexp';
import type { Mockjs } from 'mockjs';

export interface MockRequest {
  url: string;
  originalUrl?: string;
  method: Method;
  query: Record<string, any>;
  body: Record<string, any>;
  params: Record<string, string>;
  headers: Record<string, string | number>;
}
export interface MockResponse {
  statusCode: number;
  headers: Record<string, string | number>;
  setHeader: (name: string, value: string | number) => MockResponse;
  send: (body: any) => MockResponse;
  end: (body: any) => MockResponse;
}
export type NextFunction = ((err?: any) => void) | null;
export type Method = 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH' | 'any';
export type MockApp = ReturnType<CreateMockApp['getMockApp']>;
export interface MockAppOptions {
  /**
   * 是否开启日志
   * @defaults true
   */
  openLogger?: boolean;
  /**
   * 模拟路由的前缀 URL，格式支持 `/api/v1/`、`/api/v1` 和 `api/v1`
   * @defaults `/`
   */
  baseURL?: string;
  /**
   * 可覆盖默认的 createLogger
   */
  createLogger?: typeof defaultCreateLogger;
  /**
   * 兼容 node 模块 chalk
   */
  chalk?: typeof defaultChalk;
  /**
   * 是否是单页面应用，只有后端设置才生效，一般都无需设置，默认即可
   */
  isSinglePage?: boolean;
  /**
   * 即 mockjs，传递 mockjs 对象可使用 mockjs 的 mock 功能
   */
  mockjs?: Mockjs;
}

const cache: Record<string, any> = {};
const cacheLimit = 10000;
let cacheCount = 0;

/**
 * 创建 mock app，兼容主流浏览器和 node
 * 浏览器端需要适配 req 和 res
 * node 直接使用 express 或者 http 创建后的 req 和 res 即可
 */
export class CreateMockApp {
  private req: MockRequest;
  private res: MockResponse;
  private next?: NextFunction;
  private options: MockAppOptions;
  private resultCallbackObj?: Record<string, any>;
  private logger: ReturnType<typeof defaultCreateLogger>;
  private chalk: MockAppOptions['chalk'];
  private baseURL?: string;
  private uniqueRouterPaths: Record<string, any> = {};

  constructor(
    /**
     * 浏览器的需要创建一个适配的 req 对象
     * node 直接直接使用创建 http 服务后端的 req，兼容 express 和 vite server
     */
    req: MockRequest,
    /**
     * 浏览器的需要创建一个适配的 res 对象
     * node 直接直接使用创建 http 服务后端的 res，兼容 express 和 vite server
     */
    res: MockResponse,
    /**
     * 浏览器端设置为 null，
     * node兼容 express 和 vite server
     */
    next?: NextFunction,
    options?: MockAppOptions,
  ) {
    if (typeof req.body === 'string') {
      try {
        req.body = JSON.parse(req.body);
      } catch {}
    }
    this.req = req;
    this.res = this.getRewritedRes(res);
    this.next = next;
    this.options = options || {};
    this.baseURL = pathAdapter(options.baseURL);
    this.uniqueRouterPaths = {};
    // 每个匹配到的 mock api 都会有一个回调，可以响应内容
    // 结构为 { [method]: [callback] }
    // callback 参数为 req 和 res
    this.resultCallbackObj = undefined;
    this.chalk = options.chalk || defaultChalk;
    this.logger = (options.createLogger || defaultCreateLogger)({ openLogger: options.openLogger });
  }

  /**
   * 重写 res.send res.end，如果是 plain object 则使用 mockjs 处理
   * @param res MockResponse 对象
   * @returns res MockResponse 对象
   */
  private getRewritedRes(res: MockResponse) {
    // 兼容 express 的 send 方法
    const send = res.send;
    res.send = (body) => {
      const { mockjs } = this.options;
      const mock = mockjs?.mock || ((value: any) => value);

      if (isPlainObject(body)) {
        if (send) {
          return send(mock(body));
        } else {
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify(mock(body)));
        }
      } else {
        if (send) {
          return send(body);
        } else {
          res.setHeader('Content-Type', 'text/plain');
          return res.end(body);
        }
      }
    };

    return res;
  }

  /**
   * 获取 express mockApp
   * @param beforeCallback 可在路由命中后，执行其他逻辑之前，做一些适配
   * @returns express mockApp
   */
  public getMockApp(beforeCallback?: Function) {
    const createMethod = (method: Method) => {
      return (apiPath: string, callback: (req: MockRequest, res: MockResponse) => void | Promise<void>) => {
        this.useRouter(method, apiPath, async (...args) => {
          await beforeCallback?.(...args);
          await callback?.(...args);
        });
      };
    };

    // 不支持 options 和 head
    return {
      get: createMethod('GET'),
      delete: createMethod('DELETE'),
      post: createMethod('POST'),
      put: createMethod('PUT'),
      patch: createMethod('PATCH'),
    };
  }

  private compilePath(apiPath: string, options: ParseOptions & TokensToRegexpOptions) {
    const cacheKey = `${options.end}${options.strict}${options.sensitive}`;
    const pathCache = cache[cacheKey] || (cache[cacheKey] = {});

    if (pathCache[apiPath]) {
      return pathCache[apiPath];
    }

    try {
      const keys: Key[] = [];
      const regexp = pathToRegexp(apiPath, keys, options);
      const result = { regexp, keys };

      if (cacheCount < cacheLimit) {
        pathCache[apiPath] = result;
        cacheCount += 1;
      }

      return result;
    } catch (err) {
      console.error(this.chalk.red('[MOCK] router parse error,check the router path'));
      throw err;
    }
  }

  /**
   * @param method GET POST DELETE PUT PATCH
   * @param apiPath mock 路由路径配置，格式支持 `path/to`、`/path/to/` 和 `path/to`
   * @param callback mock 路由响应函数
   */
  private useRouter(
    method: Method,
    apiPath: string,
    callback: (req: MockRequest, res: MockResponse) => void | Promise<void>,
  ) {
    if (typeof callback !== 'function') {
      throw new TypeError('Expected the callback to be a funciton.');
    }

    let lastApiPath = pathAdapter(apiPath);

    if (this.baseURL) {
      lastApiPath = `${this.baseURL}${pathAdapter(apiPath)}`;
    }

    const uniqueRouterPath = `${lastApiPath}-${method}`;
    if (uniqueRouterPath === this.uniqueRouterPaths[uniqueRouterPath]) {
      console.error(this.chalk.red(`路由 ${this.chalk.cyan(uniqueRouterPath)} 重复`));
      return;
    } else {
      this.uniqueRouterPaths[uniqueRouterPath] = uniqueRouterPath;
    }

    const { regexp, keys } = this.compilePath(lastApiPath, {
      end: true,
      strict: false,
      sensitive: true,
    });
    const { headers = {} } = this.req;
    // node 中 originalUrl 才是全部的 url
    const parsedUrl = new URL(this.req.url, headers.host ? `http://${this.req.headers.host}` : undefined);
    this.req.query = getSearchParams(parsedUrl);
    const match = regexp.exec(parsedUrl.pathname);

    if (!match) {
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [noop, ...values] = match;

    this.req.params = keys.reduce(
      (memo: Record<string, any>, key: Record<string, any>, index: number) => ({ ...memo, [key.name]: values[index] }),
      {},
    );

    this.resultCallbackObj = {
      ...this.resultCallbackObj,
      [method]: callback,
    };
  }

  public async run() {
    const { logger, chalk, req, res } = this;
    const loggerFormator = (statusCode?: number) => [
      chalk.yellow(statusCode || res.statusCode),
      chalk.cyan(req.method),
      chalk.grey(req.url),
    ];

    if (this.resultCallbackObj) {
      const resultCallback = this.resultCallbackObj[req.method];

      if (!resultCallback) {
        res.statusCode = 405;
        res.setHeader('Content-Type', 'text/plain');
        res.end('Method Not Allowed');
        logger.error(...loggerFormator());
      } else {
        try {
          res.setHeader('Cache-Control', 'no-cache');
          await resultCallback(req, res);

          if ((res.statusCode >= 200 && res.statusCode < 300) || res.statusCode === 304) {
            logger.success(...loggerFormator());
          } else {
            logger.error(...loggerFormator());
          }
        } catch (err: any) {
          console.error(this.chalk.red(err));
          // 语法错误等
          res.statusCode = 500;

          res.end(err.stack);
          logger.error(...loggerFormator());
        }
      }
    } else {
      if (this.next) {
        this.next();
        // 如果不是单页面应用，才需要输出 404，
        // 单页面应用找不到的路径都重写到 index.html 了
        if (!this.options.isSinglePage) {
          // 非单页面应用，匹配到 baseURL 才输出 404 日志，否则其他的非 mock 请求在这里全部 404
          if (this.baseURL && this.baseURL !== '/') {
            if (req.url.includes(this.baseURL)) {
              logger.error(...loggerFormator(404));
            }
          }
        }
      }
    }
  }
}

export function defaultCreateLogger(options: { openLogger?: boolean } = {}) {
  const { openLogger } = options;

  return {
    error: (...args: any[]) => {
      openLogger && console.log('[MOCK]', ...args);
    },
    success: (...args: any[]) => {
      openLogger && console.log('[MOCK]', ...args);
    },
  };
}

type Value = string | number;
const defaultChalk = {
  cyan: (value: Value) => value,
  grey: (value: Value) => value,
  yellow: (value: Value) => value,
  red: (value: Value) => value,
};

/**
 * @param obj 检测的目标
 * @returns true or false
 */
export function isPlainObject(obj?: any): boolean {
  if (typeof obj !== 'object' || obj === null) return false;

  let proto = obj;
  // eslint-disable-next-line eqeqeq
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }

  return Object.getPrototypeOf(obj) === proto;
}

export function getSearchParams(parsedUrl: URL) {
  const { searchParams } = parsedUrl;
  const params: Record<string, string | undefined> = {};

  for (const s of searchParams) {
    const [key, value] = s;
    params[key] = value;
  }
  return params;
}

/**
 * pathname适配
 * 例如 test 或者 test/ 或者 /test/ 会适配为 /test
 *@param pathname
 * @return 返回处理后的 pathname
 */
export function pathAdapter(pathname: string) {
  if (!pathname || pathname === '/') {
    return pathname;
  }
  if (typeof pathname !== 'string') {
    throw new TypeError('Expected the pathanme to be a string.');
  }
  const reStr = pathname
    .split('/')
    .filter((p) => p)
    .join('/');
  return `/${reStr}`;
}
