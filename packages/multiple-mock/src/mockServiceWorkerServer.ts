/**
 * 注册并启动 MockServiceWorker 服务
 * @param options.url 注册的 service woker url，可选，默认为 `${options.baseURL}/mock.sw.js`
 * @param options.baseURL service woker url 前缀，默认为 `/`，与 url 无关
 * @param options.mockSwJSMd5Hash mock.sw.js 文件的 md5 hash，可选
 * @param callback service worker 首次注册激活后或者更新激活后触发的回调
 */
export async function start(
  options: { url?: string; baseURL?: string; mockSwJSMd5Hash?: string },
  callback: () => void,
) {
  const { baseURL = '/', mockSwJSMd5Hash = '', url } = options || {};
  const preveMockSwJSMd5Hash = window.localStorage.getItem('mockSwJSMd5Hash');
  const scriptURL = url ? `${url}?hash=${mockSwJSMd5Hash}` : `${baseURL}mock.sw.js?hash=${mockSwJSMd5Hash}`;
  const broadcast = new BroadcastChannel('mock.sw.js');
  await navigator.serviceWorker.register(scriptURL);

  try {
    await navigator.serviceWorker.ready;
    console.log('[MOCK] mock server ready');

    // md5 hash 判断 service woker 注册文件内容是否更新，不考虑用户单独清理 localStorage 而不清理 service worker 的情况
    if (preveMockSwJSMd5Hash !== mockSwJSMd5Hash) {
      // 首次运行和 service worker 更新后运行这里
      broadcast.onmessage = (event) => {
        if (event.data.type === 'activated') {
          window.localStorage.setItem('mockSwJSMd5Hash', mockSwJSMd5Hash);
          callback?.();
        }
      };
    } else {
      // 已注册和已激活的 service worker 运行这里
      callback?.();
    }
  } catch (err) {
    console.error('error registering MOCK:', err);
  }
}
