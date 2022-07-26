import path from 'path';
import type { MockApp, MockRequest, MockResponse } from '../../CreateMockApp';
import type { MockConfigOptions } from '../../createMockMiddleware';

/**
 * 兼容获取 mock 文件夹中所有的 js 文件
 */
export default async (app: MockApp, options?: MockConfigOptions) => {
  const { mockFolder, getMockFiles, requireCjsModule } = options || {};
  const mockFiles = getMockFiles(mockFolder); // 文件删除、新增，这里都会获取最新的文件列表
  const requireMockFilesP = mockFiles.map((file) => {
    return requireCjsModule(path.resolve(file));
  });
  const mockDataList = await Promise.all(requireMockFilesP);
  const mockData = mockDataList.reduce((acc, data) => {
    const mData = data;
    return { ...acc, ...mData };
  }, {});

  const reg = /(.*)\s(.*)/;
  Object.keys(mockData).forEach((key) => {
    let method = 'get';
    let apiPath = '';
    const result = mockData[key];

    if (reg.test(key)) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const [noop, mMethod, mApiPath] = key.match(reg);
      method = mMethod.trim();
      apiPath = mApiPath.trim();
    } else {
      apiPath = key;
    }

    if (apiPath) {
      app[method.toLowerCase()](apiPath, (req: MockRequest, res: MockResponse) => {
        if (typeof result === 'function') {
          return result(req, res);
        }

        res.send(result);
      });
    }
  });
};
