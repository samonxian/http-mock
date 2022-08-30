import { intercept } from './serviceWorkerMockHttp';

intercept.bind(self)({
  openLogger: true,
});
