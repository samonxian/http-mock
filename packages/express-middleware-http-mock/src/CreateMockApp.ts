import consola from 'consola';
import mockjs from 'mockjs';
import chalk from 'chalk';
import _ from 'lodash';
import { pathToRegexp } from 'path-to-regexp';
import type { ParseOptions, TokensToRegexpOptions } from 'path-to-regexp';
import type { NextFunction, Request, Response } from 'express';

export interface MockAppOptions {
  /**
   * 是否是单页面应用
   */
  isSinglePage?: boolean;
  /**
   * 是否开启日志
   * @defaults true
   */
  openLogger?: boolean;
  /**
   * 模拟路由的前缀 URL
   */
  baseURL?: string;
}
export type Method = 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH' | 'any';
export type MockApp = ReturnType<CreateMockApp['getMockApp']>;

const cache = {};
const cacheLimit = 10000;
let cacheCount = 0;

/**
 * 创建 Mock App
 *
 * @example
 * ```js
 * const createMockAppInstance = new CreateMockApp(req, res, next, { openLogger, isSinglePage });
 * const mockApp  = createMockAppInstance.getMockApp();
 * mockApp.get('path-to-router', (req, res)=>{})
 * createMockAppInstance.run();
 * ```
 */
export class CreateMockApp {
  private req: Request;
  private res: Response;
  private next: NextFunction;
  private options: MockAppOptions;
  private resultCallbackObj?: Record<string, any>;
  private logger: ReturnType<typeof createLogger>;
  private baseURL: string;
  private uniqueRouterPaths: Record<string, any> = {};

  constructor(req: Request, res: Response, next: NextFunction, options: MockAppOptions) {
    this.req = req;
    this.res = this.getRewritedRes(res);
    this.next = next;
    this.options = options || {};
    this.baseURL = options.baseURL;
    this.uniqueRouterPaths = {};
    // 每个匹配到的 mock api 都会有一个回调，可以响应内容
    // 结构为 { [method]: [callback] }
    // callback 参数为 req 和 res
    this.resultCallbackObj = undefined;
    this.logger = createLogger({ openLogger: options.openLogger });
  }

  /**
   * 重写 res.json res.jsonp res.send，如果是 plain object 则使用 mockjs 处理
   * @param res express response 对象
   * @returns res express response 对象
   */
  private getRewritedRes(res: Response) {
    function rewritelWithMockJs(method: string) {
      const tempResMethod = res[method];

      res[method] = (body: any) => {
        let lastBody = body;

        if (_.isPlainObject(body)) {
          lastBody = mockjs.mock(body);
        }

        tempResMethod(lastBody);
      };
    }
    rewritelWithMockJs('json');
    rewritelWithMockJs('jsonp');
    rewritelWithMockJs('send');

    return res;
  }

  /**
   * 获取 express mockApp
   * @returns express mockApp
   */
  public getMockApp() {
    const createMethod = (method: Method) => {
      return (apiPath: string, callback: (req: Request, res: Response) => void) => {
        this.useRouter(method, apiPath, callback);
      };
    };

    // 不支持 options 和 head
    return {
      all: createMethod('any'),
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

    if (pathCache[apiPath]) return pathCache[apiPath];

    try {
      const keys = [];
      const regexp = pathToRegexp(apiPath, keys, options);
      const result = { regexp, keys };

      if (cacheCount < cacheLimit) {
        pathCache[apiPath] = result;
        cacheCount += 1;
      }

      return result;
    } catch (err) {
      console.error(chalk.red('router parse error,check the router path'));
      throw err;
    }
  }

  /**
   * @param method GET POST DELETE PUT PATCH
   * @param apiPath mock 路由路径配置，同 express
   * @param callback mock 路由响应函数，同 express
   */
  private useRouter(method: Method, apiPath: string, callback: (req: Request, res: Response) => void) {
    if (!_.isFunction(callback)) {
      throw new TypeError('Expected the callback to be a funciton.');
    }

    let lastApiPath = apiPath;

    if (this.baseURL) {
      lastApiPath = `${this.baseURL}${apiPath}`;
    }

    const uniqueRouterPath = `${lastApiPath}-${method}`;
    if (uniqueRouterPath === this.uniqueRouterPaths[uniqueRouterPath]) {
      console.error(chalk.red(`路由 ${chalk.cyan(uniqueRouterPath)} 重复`));
      return;
    } else {
      this.uniqueRouterPaths[uniqueRouterPath] = uniqueRouterPath;
    }

    const { regexp, keys } = this.compilePath(lastApiPath, {
      end: true,
      strict: false,
      sensitive: true,
    });

    const match = regexp.exec(this.req.originalUrl);

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

  public run() {
    const { req } = this;
    const { res } = this;
    const { logger } = this;
    const loggerFormator = (statusCode?: number) => [
      statusCode || res.statusCode,
      chalk.cyan(req.method),
      chalk.grey(req.url),
    ];

    if (this.resultCallbackObj) {
      const resultCallback = this.resultCallbackObj[req.method] || this.resultCallbackObj.any;

      if (!resultCallback) {
        res.sendStatus(405);
        logger.error(...loggerFormator());
      } else {
        try {
          res.append('Cache-Control', 'no-cache');
          resultCallback(req, res);

          if ((res.statusCode >= 200 && res.statusCode < 300) || res.statusCode === 304) {
            logger.success(...loggerFormator());
          } else {
            logger.error(...loggerFormator());
          }
        } catch (err) {
          // 语法错误等
          res.status(500).send(err.stack);
          logger.error(...loggerFormator());
        }
      }
    } else {
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

function createLogger(options: { openLogger?: boolean } = {}) {
  const { openLogger } = options;

  if (openLogger) {
    const logger = consola.create({
      // @ts-ignore
      reporters: [new consola.FancyReporter()],
      defaults: {
        message: `${chalk.bgHex('#409EFF').black(' Mock ')}`,
        // @ts-ignore
        badge: true,
      },
    });

    return {
      ...logger,
    };
  }

  return {
    error: (...args: any[]) => args,
    success: (...args: any[]) => args,
  };
}
