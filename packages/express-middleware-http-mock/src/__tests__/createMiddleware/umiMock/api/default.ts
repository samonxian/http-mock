import type { UmiMockData } from '../../../../mocks/default';

export default {
  '/default': { url: '/api/v1/topic-default' },
  'GET /topic': { url: '/api/v1/topic-get' },
  'POST /topic/:id': (req, res) => {
    const { id } = req.params;
    res.send({ url: `/api/v1/topic-${id}` });
  },
} as UmiMockData;
