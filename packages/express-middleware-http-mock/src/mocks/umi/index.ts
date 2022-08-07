import path from 'path';
import fs from 'fs-extra';
import type { Mock } from '../../createMockMiddleware';

export interface UmiMockOptions {
  /**
   * mock 文件夹，需要指定，可不同于 mock 配置文件
   * @defaults path.resolve('./mock')
   */
  mockFolder?: string;
}

/**
 *  支持 umi mock 格式用法
 *
 * @param options.mockFolder mock 文件夹，需要指定，可不同于 mock 配置文件
 */
export function umiMock(options?: UmiMockOptions): Mock {
  const { mockFolder } = options || {};
  let mockConfigFile = path.resolve(__dirname, './mock.config.ts');

  if (!fs.existsSync(mockConfigFile)) {
    // 发布到 npm 的文件是 js 文件
    mockConfigFile = path.resolve(__dirname, './mock.config.js');
  }

  return {
    name: 'umi-mock',
    mockConfigFile,
    mockFolder: mockFolder || path.resolve('./mock'),
  };
}
