import type { MockApp } from 'vite-plugin-http-mock';

export default (app: MockApp) => {
  app.get('/topic', (req, res) => {
    res.send({ url: '/api/v1/topic-get' });
  });

  app.post('/topic/:id', (req, res) => {
    res.send({ url: '/api/v1/topic-post' });
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
