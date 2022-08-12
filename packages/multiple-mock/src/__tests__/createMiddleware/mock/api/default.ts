import type { MockApp } from '../../../../CreateMockApp';

export default (app: MockApp) => {
  app.get('/default', (req, res) => {
    res.send({ url: '/api/v1/default-get' });
  });
};
