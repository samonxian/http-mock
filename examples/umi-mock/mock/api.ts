import type { UmiMockData } from 'vite-plugin-http-mock';

export default {
  'GET /topic': { url: '/api/v1/topic-get' },
  'GET /topic/:id': (req, res) => {
    const { id } = req.params;
    const { name } = req.query || {};
    res.send({ url: `/api/v1/topic-${id}`, name });
  },
  'POST /topic/:id': (req, res) => {
    const { id } = req.params;
    res.send({ url: `/api/v1/topic-${id}` });
  },
} as UmiMockData;
