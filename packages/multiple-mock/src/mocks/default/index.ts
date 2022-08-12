import path from 'path';
import fs from 'fs-extra';
import { getMockFiles } from '../../createMockMiddleware';
import type { Mock } from '../../createMockMiddleware';
import type { MockRequest, MockResponse } from '../../CreateMockApp';
import { createMockDataFile } from './createMockDataFile';

export interface DefaultMockOptions {
  /**
   * mock 文件夹，需要指定，可不同于 mock 配置文件
   * @defaults path.resolve('./mock')
   */
  mockFolder?: string;
}

export type UmiMockData = Record<
  string,
  string | Record<string, any> | ((req: MockRequest, res: MockResponse) => void)
>;

export function defaultMock(options?: DefaultMockOptions): Mock {
  const { mockFolder = path.resolve('./mock') } = options || {};
  const mockFiles = getMockFiles(mockFolder);
  let mockConfigFile = path.resolve(__dirname, './mock.config.ts');

  if (!fs.existsSync(mockConfigFile)) {
    // 发布到 npm 的文件是 js 文件
    mockConfigFile = path.resolve(__dirname, './mock.config.js');
  }

  return {
    name: 'default-mock',
    mockConfigFile,
    mockFolder,
    mockFiles,
    createMockDataFile,
  };
}

export { createCommonCode, createMockDataFileByCode } from './createMockDataFile';
