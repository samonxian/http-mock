// 创建 mockData 文件给 MockServiceWorker 使用
import { createCommonCode, createMockDataFileByCode } from '../default/createMockDataFile';

export async function createMockDataFile(mockFiles: string[], mockType?: string, outDir?: string) {
  const code = createRecoverMockDataCode(createCommonCode(mockFiles));

  await createMockDataFileByCode(code, mockType, outDir);
}

/**
 * 创建 mock 原始格式复原代码，支持 umi 格式 mock data 复原为原始的 mock data
 */
function createRecoverMockDataCode(prevCode = '') {
  const code = `
${prevCode}
const mockDataObj = mockData.reduce((acc, data) => {
  const mData = data;
  return { ...acc, ...mData };
}, {});

const reg = /(.*)\\s(.*)/;
const lastMockData = Object.keys(mockDataObj).map((key) => {
  let method = 'get';
  let apiPath = '';
  const result = mockDataObj[key];

  if (reg.test(key)) {
    const [_, mMethod, mApiPath] = key.match(reg);
    method = mMethod.trim();
    apiPath = mApiPath.trim();
  } else {
    apiPath = key;
  }

  if (apiPath) {
    return (app) => {
      app[method.toLowerCase()](apiPath, (req, res) => {
        if (typeof result === 'function') {
          return result(req, res);
        }

        res.send(result);
      });
    }
  }
}).filter(Boolean);

export const data = lastMockData;
`;

  return code;
}
