import type { MockApp } from 'vite-plugin-http-mock';

export default (app: MockApp) => {
  app.get('/topic', (req, res) => {
    res.send({ url: '/api/v1/topic-get' });
  });

  app.get('/topic/:id', (req, res) => {
    const { id } = req.params;
    const { name } = req.query || {};
    res.send({ url: `/api/v1/topic-${id}`, name });
  });

  app.post('/topic/:id', (req, res) => {
    const { id } = req.params;
    res.send({ url: `/api/v1/topic-${id}`, 'list|10': [{ name: 'samon' }] });
  });

  app.patch('/topic/:id', (req, res) => {
    res.send({ url: '/api/v1/topic-patch' });
  });

  app.put('/topic/:id', (req, res) => {
    res.send({ url: '/api/v1/topic-put' });
  });

  app.delete('/topic/:id', (req, res) => {
    res.send({ url: '/api/v1/topic-delete' });
  });
};
