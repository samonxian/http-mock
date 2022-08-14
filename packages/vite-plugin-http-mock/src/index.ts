import path from 'path';
import fs from 'fs-extra';
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
                src: 'http://mockjs.com/dist/mock-min.js',
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

          return `
import { start } from 'multiple-mock/es/mockServiceWorkerServer';

${mockDataImportCode}
start(
  {
    url: '${resolvedConfig.base}mock.sw.js',
    mockData: [${mockDataCode}],
    mockOptions: {
      openLogger: '${openLogger}',
      baseURL: '${baseURL}',
      mockjs: window.Mock
    }
  },
  () => {
    // service worker 启动成功的回调
    import('${id.replace(entrySuffixKey, '')}');
  }
);
          `;
        } else if (id.includes(path.resolve(lastEntry).replace(/\\/g, '/'))) {
          return readEntryFile(id);
        }
      }
    },

    async buildStart() {
      if (isBuild && useMockServiceWorker) {
        // 这里的逻辑主要是生成相关的 service worker 文件到构建目录
        const taretOutdir = resolvedConfig.build.outDir;
        const mockServicePath = path.join(taretOutdir, 'mockServiceWorker.js');
        mockSwJsPath = path.join(taretOutdir, 'mock.sw.js');
        fs.ensureDirSync(taretOutdir);

        // 生成 mockService.js 文件
        const origialFolderPath = require.resolve('multiple-mock').replace('/lib/index.js', '');
        fs.copyFileSync(path.join(origialFolderPath, 'dist/mockServiceWorker.js'), mockServicePath);
        fs.copyFileSync(
          path.join(origialFolderPath, 'dist/mockServiceWorker.js.map'),
          path.join(taretOutdir, 'mockServiceWorker.js.map'),
        );

        // 生成 mockData.[format].js 文件
        const mockDataPs = lastMockConfigs.map((mock) => {
          return mock.createMockDataFile?.(mock.mockFiles, mock.name, taretOutdir);
        });
        await Promise.all(mockDataPs);

        // 生成 mock.sw.js
        fs.writeFileSync(
          mockSwJsPath,
          `
this.importScripts('./mockServiceWorker.js');
this.MockServiceWorker.intercept.bind(this)({
  openLogger: ${openLogger},
})
          `,
          { encoding: 'utf-8' },
        );
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

export * from 'multiple-mock';
