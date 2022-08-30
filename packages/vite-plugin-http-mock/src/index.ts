import path from 'path';
import fs from 'fs-extra';
import md5 from 'md5';
import * as multipleMock from 'multiple-mock';
import { createMockMiddleware, defaultMock } from 'multiple-mock';
import type { Mock, MockMiddlewareOptions } from 'multiple-mock';
import type { Connect, Plugin, ResolvedConfig } from 'vite';

export interface Options extends MockMiddlewareOptions {
  /**
   * 是否开启 node mock 服务
   * @defaults true
   */
  openMockService?: boolean;
  /**
   * 是否在 Service Worker 中使用 mock 功能，只有生产环境才有效
   * @defaults false
   */
  useMockServiceWorker?: boolean;
  /**
   * 是否在 service worker 中使用 mockjs，设置为 true 后 MockServiceWorker 中 HTTP 响应的 Json 数据支持 mockjs 语法
   * @defaults false
   */
  useMockJsInServiceWorker?: boolean;
  /**
   * 入口文件，兼容 .ts 和 js 格式为 'src/main'
   * @defaults 'src/main'
   */
  entry?: string;
}

const mockSwJsFileName = 'mock.sw.js';

export function httpMockPlugin(options: Options = {}): Plugin {
  const {
    entry = 'src/main',
    openMockService = true,
    useMockServiceWorker,
    useMockJsInServiceWorker,
    openLogger = true,
    baseURL,
    mocks = [defaultMock()],
    ...restOptions
  } = options;
  const lastMockConfigs = [].concat(mocks).filter(Boolean) as Mock[];
  const lastEntry = entry.split('.')[0];
  const entrySuffixKey = '$main$';
  let resolvedConfig: ResolvedConfig;
  let mockSwJsPath: string;
  let isBuild = false;

  return {
    name: 'vite:http-mock',
    enforce: 'pre',

    configResolved(config) {
      resolvedConfig = config;
      isBuild = config.command === 'build';

      if (isBuild) {
        // 重写 emptyOutDir 逻辑，保证 service worker 相关文件不被删除，同时还支持 emptyOutDir 的功能
        if (resolvedConfig.build.emptyOutDir === true || resolvedConfig.build.emptyOutDir == null) {
          fs.removeSync(path.resolve(resolvedConfig.build.outDir || 'dist'));
        }

        resolvedConfig.build.emptyOutDir = false;
      }
    },

    transformIndexHtml(html) {
      if (isBuild && useMockServiceWorker && useMockJsInServiceWorker) {
        return {
          html,
          tags: [
            {
              tag: 'script',
              attrs: {
                src: 'https://unpkg.com/mockjs@1.1.0/dist/mock-min.js',
              },
              injectTo: 'head',
            },
          ],
        };
      }

      return html;
    },

    configureServer(server) {
      if (openMockService) {
        server.middlewares.use(
          createMockMiddleware({ baseURL, openLogger, mocks, ...restOptions }) as unknown as Connect.NextHandleFunction,
        );
      }
    },

    resolveId(id, importer) {
      if (isBuild && useMockServiceWorker) {
        if (id.includes(lastEntry) && importer.includes('.html')) {
          return `${id}${entrySuffixKey}`;
        }
      }
    },

    load(id) {
      if (isBuild && useMockServiceWorker) {
        // 这里的逻辑主要是保证 service worker 首次激活或者更新激活才运行主程序代码
        // 这样才可以保证 service worker 代理到所有的主程序的 HTTP 请求
        if (id.includes(entrySuffixKey)) {
          const taretOutdir = resolvedConfig.build.outDir;
          const mockDataImportCode = lastMockConfigs
            .map((m) => {
              const mockDataFileName = `mockData.${m.name}.js`;
              return `import $mock${m.name.replace(/-/g, '')} from '${path.resolve(taretOutdir, mockDataFileName)}';`;
            })
            .join('\n');
          const mockDataCode = lastMockConfigs.map((m) => `...$mock${m.name.replace(/-/g, '')}`).join(',');
          const mockSwJsMd5Hash = getMd5HashByFilePath(mockSwJsPath);

          return `
import { start } from 'multiple-mock/es/setupWorker';

${mockDataImportCode}
start(
  {
    url: '${resolvedConfig.base}mock.sw.js',
    mockData: [${mockDataCode}],
    mockSwJsMd5Hash: '${mockSwJsMd5Hash}',
    scope: '${resolvedConfig.base}',
    mockOptions: {
      interceptedHost: window.location.host,
      openLogger: '${openLogger}',
      baseURL: '${baseURL}',
      mockjs: window.Mock
    }
  }
).then(() => {
  // service worker 启动成功的回调
  import('${id.replace(entrySuffixKey, '')}');
});
          `;
        } else if (id.includes(path.resolve(lastEntry).replace(/\\/g, '/'))) {
          return readEntryFile(id);
        }
      }
    },

    async buildStart() {
      if (isBuild && useMockServiceWorker) {
        // 这里的逻辑主要是生成相关的 service worker 文件到构建目录
        const taretOutdir = path.resolve(resolvedConfig.build.outDir);
        mockSwJsPath = path.join(taretOutdir, mockSwJsFileName);
        fs.ensureDirSync(taretOutdir);

        // 生成 mockService.js 文件
        const origialFolderPath = require.resolve('multiple-mock').replace('/lib/index.js', '');
        fs.copyFileSync(path.join(origialFolderPath, 'dist', mockSwJsFileName), mockSwJsPath);
        fs.copyFileSync(
          path.join(origialFolderPath, `dist/${mockSwJsFileName}.map`),
          path.join(taretOutdir, `${mockSwJsFileName}.map`),
        );

        // 生成 mockData.[format].js 文件
        const mockDataPs = lastMockConfigs.map((mock) => {
          return mock.createMockDataFile?.(mock.mockFiles, mock.name, taretOutdir);
        });
        await Promise.all(mockDataPs);
      }
    },

    buildEnd() {
      // 删除临时文件
      lastMockConfigs.forEach((m) => {
        const taretOutdir = resolvedConfig.build.outDir;
        const mockDataFileName = `mockData.${m.name}.js`;
        fs.removeSync(path.resolve(taretOutdir, mockDataFileName));
      });
    },
  };
}

function readEntryFile(entryPath: string) {
  let filePath = entryPath;

  if (fs.existsSync(`${entryPath}.ts`)) {
    filePath = `${entryPath}.ts`;
  }

  if (fs.existsSync(`${entryPath}.js`)) {
    filePath = `${entryPath}.js`;
  }

  return fs.readFileSync(filePath, { encoding: 'utf-8' });
}

export function getMd5HashByFilePath(filePath: string) {
  const content = fs.readFileSync(filePath, { encoding: 'utf-8' });
  return md5(content);
}

export * from 'multiple-mock';

// 必须这样再导出一次，否则转换为 js 文件后 vite 配置文件读取不了
// 因为 vite 配置文件做了兼容运行 ts 文件，只支持 default 导出的使用
export default {
  httpMockPlugin,
  ...multipleMock,
};
