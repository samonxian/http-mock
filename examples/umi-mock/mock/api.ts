import type { UmiMockData } from 'vite-plugin-http-mock';

export default {
  'GET /topic': { url: '/api/v1/topic-get' },
  'GET /topic/:id': (req, res) => {
    const { id } = req.params;
    const { name } = req.query || {};
    res.send({ url: `/api/v1/topic-${id}`, name });
  },
  'GET http://www.test.com/api/v1/topic/:id': (req, res) => {
    const { id } = req.params;
    const { name } = req.query || {};
    res.send({ url: `http://www.test.com/api/v1/topic-${id}`, name });
  },
  'POST /topic/:id': (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    res.send({ url: `/api/v1/topic-${id}`, 'list|10': [{ name }] });
  },
} as UmiMockData;
