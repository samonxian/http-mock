import type { UmiMockData } from 'vite-plugin-http-mock';

export default {
  'GET /topic/:id': { url: '/api/v1/topic/:id', method: 'GET', otherFieldName: '' },
  'DELETE /topic/:id': (req, res) => {
    res.send({
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
    });
  },
  'POST /topic/:id': (req, res) => {
    res.send({
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
    });
  },
  'PATCH /topic/:id': (req, res) => {
    res.send({
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
    });
  },
  'PUT /topic/:id': (req, res) => {
    res.send({
      url: req.url,
      method: req.method,
      body: req.body,
      params: req.params,
    });
  },
} as UmiMockData;
