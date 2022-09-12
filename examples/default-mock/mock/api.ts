import type { MockApp } from 'vite-plugin-http-mock';

export default (app: MockApp) => {
  app.get('/topic/:id', (req, res) => {
    res.send({
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
    });
  });

  app.delete('/topic/:id', (req, res) => {
    res.send({
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
    });
  });

  app.post('/topic/:id', (req, res) => {
    res.send({
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
    });
  });

  app.patch('/topic/:id', (req, res) => {
    res.send({
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
    });
  });

  app.put('/topic/:id', (req, res) => {
    res.send({
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
    });
  });
};
