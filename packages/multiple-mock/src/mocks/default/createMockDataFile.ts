// 在 vite 构建中创建 mockData 文件给 MockServiceWorker 使用
import path from 'path';
import fs from 'fs-extra';
import { build, normalizePath } from 'vite';

/**
 * vite 构建生成的文件目录，如果 vite 配置了 base，则需要加上 base 的路径，
 * 最终会生成文件到 vite 构建目录
 * @param mockFiles 所有 mock 目录的 mock 类型文件
 * @param mockType mock 的格式类型，一般是 mocks[].name 的值
 * @param outDir vite 构建生成的文件目录，如果 vite 配置了 base，则需要加上 base 的路径
 */
export async function createMockDataFile(mockFiles: string[], mockType?: string, outDir?: string) {
  let code = createCommonCode(mockFiles);
  code = `${code}\nexport default mockData;`;

  await createMockDataFileByCode(code, mockType, outDir);
}

/**
 * 构建代码生成文件到 vite 构建目录
 * @param code 生成的代码，支持 es 和 typescript
 * @param outDir vite 构建生成的文件目录，如果 vite 配置了 base，则需要加上 base 的路径
 */
export async function createMockDataFileByCode(code: string, mockType = 'default', outDir?: string) {
  const tempFilePath = path.resolve('node_modules', `.temp/mockDataFile.${mockType}.ts`);
  fs.ensureFileSync(tempFilePath);
  fs.writeFileSync(tempFilePath, code, { encoding: 'utf-8' });
  await build({
    mode: 'production',
    configFile: false,
    logLevel: 'error',
    build: {
      outDir: outDir || 'dist',
      emptyOutDir: false,
      lib: {
        formats: ['es'],
        entry: tempFilePath,
        name: 'noop',
        fileName: () => `mockData.${mockType}.js`,
      },
      minify: false,
    },
  });
}

/**
 * 创建共同格式的代码，所有的 mock 文件会生成一个统一 import 进来的数组
 * @param mockFiles
 * @returns code
 */
export function createCommonCode(mockFiles: string[]) {
  const imports = [];
  const importCode = mockFiles.reduce((acc, file, index) => {
    const importName = `name_${index}`;
    const extname = path.extname(file);
    imports.push(importName);
    acc += `import ${importName} from '${normalizePath(file).replace(extname, '')}';\n`;
    return acc;
  }, '');
  const mockDataCode =
    imports.reduce((acc, importName) => {
      acc += `${importName},`;
      return acc;
    }, 'const mockData = [') + '];';

  const code = `${importCode}\n${mockDataCode}`;

  return code;
}
