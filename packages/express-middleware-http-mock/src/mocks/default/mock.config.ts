import path from 'path';
import type { MockApp } from '../../CreateMockApp';
import type { MockConfigOptions } from '../../createMockMiddleware';

/**
 * 兼容获取 mock 文件夹中所有的 js 文件
 */
export default async (app: MockApp, options?: MockConfigOptions) => {
  const { mockFolder, getMockFiles, requireCjsModule } = options;
  const mockFiles = getMockFiles(mockFolder);
  const requireMockFilesP = mockFiles.map(async (file) => {
    return await requireCjsModule(path.resolve(file));
  });
  const mockFunctions = await Promise.all(requireMockFilesP);

  mockFunctions.forEach((mockFn) => {
    mockFn(app);
  });
};
