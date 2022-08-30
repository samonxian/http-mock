// 代码参考 vite
// https://github.com/vitejs/vite/blob/1983cf43d4da92d40b1f96dff0a44def044f9130/packages/vite/src/node/config.ts#L1022

import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { build } from 'esbuild';

interface NodeModuleWithCompile extends NodeModule {
  _compile(code: string, filename: string): any;
}

/**
 * 功能同 require 函数，支持 ts 文件（后缀名必须是 `.ts` 结尾）
 * @param file 文件的路径，可省略后缀名
 * @param extensions 拓展后缀名，默认为 ['.js','.ts']
 * @returns
 */
export async function requireCjsModule(file: string, extensions = ['.js', '.ts']): Promise<any> {
  const etxname = path.extname(file);

  if (!extensions.includes(etxname)) {
    file = extensions.reduce((acc, cur) => {
      const fixFile = path.resolve(`${acc}${cur}`);

      if (fs.existsSync(fixFile)) {
        return fixFile;
      }

      return acc;
    }, file);
  }

  let isTs = false;
  file = path.resolve(file);
  const lastEtxname = path.extname(file);

  if (lastEtxname !== '.js') {
    isTs = true;
  }

  if (isTs) {
    const result = await build({
      entryPoints: [file],
      outfile: 'out.js',
      write: false,
      platform: 'node',
      bundle: true,
      format: 'cjs',
      metafile: true,
      target: 'es2015',
    });
    const { text } = result.outputFiles[0];

    return await loadFromBundledFile(file, text);
  }

  const raw = require(file);

  return raw.__esModule && 'default' in raw ? raw.default : raw;
}

const _require = createRequire(import.meta.url);
export async function loadFromBundledFile(fileName: string, bundledCode: string): Promise<any> {
  // for cjs, we can register a custom loader via `_require.extensions`
  const extension = path.extname(fileName);
  const realFileName = fs.realpathSync(fileName);
  const loaderExt = extension in _require.extensions ? extension : '.js';
  const defaultLoader = _require.extensions[loaderExt]!;
  _require.extensions[loaderExt] = (module: NodeModule, filename: string) => {
    if (filename === realFileName) {
      (module as NodeModuleWithCompile)._compile(bundledCode, filename);
    } else {
      defaultLoader(module, filename);
    }
  };
  // clear cache in case of server restart
  delete _require.cache[_require.resolve(fileName)];
  const raw = _require(fileName);
  _require.extensions[loaderExt] = defaultLoader;

  return raw.__esModule && 'default' in raw ? raw.default : raw;
}
