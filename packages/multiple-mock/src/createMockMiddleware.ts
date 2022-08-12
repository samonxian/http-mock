import path from 'path';
import fs from 'fs-extra';
import consola from 'consola';
import chalk from 'chalk';
import multer from 'multer';
import bodyParser from 'body-parser';
import fg from 'fast-glob';
import { compose as composeMiddlewares } from 'compose-middleware';
import type { Handler, NextFunction, Request, Response } from 'express';
import mockjs from 'mockjs';
import { CreateMockApp } from './CreateMockApp';
import type { MockApp, MockRequest, MockResponse } from './CreateMockApp';
import { defaultMock } from './mocks/default';
import type { createMockDataFile } from './mocks/default/createMockDataFile';
import { requireCjsModule } from './requireCjsModule';

export type Mock = {
  /**
   * 插件名，需要唯一
   */
  name: string;
  /**
   * mock 配置文件 ，文件需要导出这样的格式：(mockApp, { mockConfigFile, mockFolder }) => {}
   */
  mockConfigFile?: string;
  /**
   * mock 文件夹，需要指定，可不同于 mock 配置文件
   */
  mockFolder?: string;
  /**
   * 所有 mock 目录的 mock 类型文件数组
   */
  mockFiles?: string[];
  /**
   * 创建 mock 数据文件，结合给 MockServiceWorker 使用
   */
  createMockDataFile?: typeof createMockDataFile;
};
export interface MockMiddlewareOptions {
  /**
   * 是否开启日志
   * @defaults true
   */
  openLogger?: boolean;
  /**
   * 是否使用 bodyParser 解析请求 body，如果 express 程序已经使用了此中间件，那么可以设置为 false
   * @defaults true
   */
  useBodyParser?: boolean;
  /**
   * 是否模拟上传文件，模拟后，上传文件也会等待上传完成才会返回结果
   * @defaults true
   */
  mockUploadFile?: boolean;
  /**
   * 模拟路由的前缀 URL
   */
  baseURL?: string;
  /**
   * 可配置多种 mock 方式，支持新的 mock 配置和 mock 文件夹，可以拓展支持新的 mock 配置模式
   */
  mocks?: Mock | Mock[];
}
export interface MockConfigOptions extends Mock {
  requireCjsModule: typeof requireCjsModule;
}
export type MockConfig = (mockApp: MockApp, options: MockConfigOptions) => void | Promise<void>;
export type MockFunction = (app: MockApp, options?: MockConfigOptions) => void;

/**
 * 创建 express mock middleware，也兼容 vite server middleware
 * @param opt.plugins 插件支持新的 mock 配置和 mock 文件夹，可以拓展支持新的 mock 配置模式，
 * 默认插件为 defaultPlugin，配置插件会覆盖默认插件
 * @param opt.openLogger 是否开启日志，默认 true
 * @param returnMockMiddlewareDirectly 直接返回 mockMiddleware，目前只用于测试
 */
export function createMockMiddleware(opt?: MockMiddlewareOptions, returnMockMiddlewareDirectly?: boolean) {
  const defaultOptions = {
    // 是否输出日志，默认 true
    openLogger: true,
    mocks: [defaultMock()],
    mockUploadFile: true,
    useBodyParser: true,
  };
  const options = { ...defaultOptions, ...opt };
  const { openLogger, baseURL } = options;
  const mocks = getMocks(options.mocks);

  /**
   * mock middleware
   */
  async function mockMiddleware(req: MockRequest, res: MockResponse, next: NextFunction) {
    clearMockRequireCache(mocks);
    let mockConfig: MockConfig;
    const createMockAppInstance = new CreateMockApp(req, res, next, {
      createLogger,
      mockjs,
      chalk,
      openLogger,
      isSinglePage: true,
      baseURL,
    });
    const mockApp = createMockAppInstance.getMockApp();

    try {
      const mocksP = mocks.map(async (m) => {
        mockConfig = await requireCjsModule(m.mockConfigFile);
        await mockConfig(mockApp, { ...m, requireCjsModule });
      });
      await Promise.all(mocksP);
      await createMockAppInstance.run();
    } catch (err) {
      consola.log(chalk.red(err.stack));
      next();
      return;
    }
  }

  if (returnMockMiddlewareDirectly) {
    return mockMiddleware as Handler;
  }

  return async (req: Request, res: Response, next: NextFunction) => {
    const bodyParsers = options.useBodyParser
      ? [bodyParser.json(), bodyParser.raw(), bodyParser.text(), bodyParser.urlencoded({ extended: true })]
      : [];

    // 多个 middleware 一起处理
    composeMiddlewares(
      [
        ...bodyParsers,
        options.mockUploadFile && uploadBodyParser(),
        // mock 需要放在 body 解析之后
        mockMiddleware as Handler,
      ].filter(Boolean),
    )(req, res, next);
  };
}

function getMocks(mocks: Mock | Mock[]) {
  if (!Array.isArray(mocks)) {
    mocks = [mocks];
  }

  const mockObj = mocks.reduce((acc: Record<string, Mock>, m) => {
    const mockConfigFile = path.resolve(m.mockConfigFile);
    const mockFolder = path.resolve(m.mockFolder);

    if (acc[mockFolder]) {
      throw new Error(chalk.red(`The ${chalk.cyan(m.name)} mock folder is occupied.`));
    }

    acc[mockFolder] = { ...m, mockConfigFile, mockFolder };

    return acc;
  }, {});

  return Object.values(mockObj);
}

function uploadBodyParser() {
  const uploadDest = path.resolve('node_modules/.temp/uploads');

  fs.ensureDirSync(uploadDest);
  if (fs.existsSync(uploadDest)) {
    // 清空上传的文件
    fs.emptyDirSync(uploadDest);
  }

  // 会创建 ./node_modules/.temp/uploads 文件夹
  const uploadBodyParser = multer({ dest: uploadDest });
  return uploadBodyParser.any();
}

/**
 * 清理 mock 配置和对应 mock 文件夹下的所有 require 缓存
 */
function clearMockRequireCache(mocks: Mock[]) {
  mocks.forEach((m) => {
    // 删除 mock 配置文件 js require 缓存
    delete require.cache[m.mockConfigFile];
    // 删除 mock 文件夹下所有 js require 缓存，可动态加载 mock 文件夹下的所有 js 文件
    Object.keys(require.cache).forEach((file) => {
      if (file.includes(m.mockFolder)) {
        delete require.cache[file];
      }
    });
  });
}

export function getMockFiles(mockFolder: string) {
  const relativeMockFolder = path.relative(process.cwd(), mockFolder);
  const mockFiles = fg.sync(`${relativeMockFolder}/**/*.{js,ts}`);

  return mockFiles.map((file) => path.resolve(file));
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
      error: logger.error,
      success: logger.success,
    };
  }

  return {
    error: (...args: any[]) => args,
    success: (...args: any[]) => args,
  };
}
