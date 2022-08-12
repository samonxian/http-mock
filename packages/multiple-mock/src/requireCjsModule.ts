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
 * 功能同 require 函数，支持 ts 文件，不过是异步的方式，非同步
 * @param file
 * @returns
 */
export async function requireCjsModule(file: string): Promise<any> {
  const etxname = path.extname(file);
  let isTs = false;
  file = path.resolve(file);

  if (etxname === '.ts') {
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
  return raw.__esModule ? raw.default : raw;
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
  return raw.__esModule ? raw.default : raw;
}
