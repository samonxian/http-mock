import path from 'path';
import { describe, expect, it } from 'vitest';
import httpMocks from 'node-mocks-http';
import type { Request } from 'express';
import { createMockMiddleware, defaultMock, umiMock } from '../../';
import type { Mock } from '../../';

const res = httpMocks.createResponse();
const runMockMiddleware = async (req: Request) => {
  const mocks: Mock = {
    name: 'test-mock',
    mockConfigFile: path.resolve(__dirname, './mock/mock.config.ts'),
    mockFolder: path.resolve(__dirname, './mock'),
  };
  const baseURL = '/api/v1';
  await createMockMiddleware(
    {
      mocks,
      baseURL,
      openLogger: false,
    },
    true,
  )(req, res, () => {});
};

describe('createMockMiddleware', async () => {
  it('should work with `get` method`.', async () => {
    const req = httpMocks.createRequest({
      method: 'GET',
      url: 'http://localhost:8080/api/v1/topic',
    });
    await runMockMiddleware(req);

    const data = res._getData();
    expect(data).toEqual({ url: '/api/v1/topic-get' });
  });

  it('should work with `post` method`.', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: 'http://localhost:8080/api/v1/topic/42',
    });
    await runMockMiddleware(req);

    const data = res._getData();
    expect(data).toEqual({ url: '/api/v1/topic-post' });
  });

  it('should work with `put` method`.', async () => {
    const req = httpMocks.createRequest({
      method: 'PUT',
      url: 'http://localhost:8080/api/v1/topic/42',
    });
    await runMockMiddleware(req);

    const data = res._getData();
    expect(data).toEqual({ url: '/api/v1/topic-put' });
  });

  it('should work with `patch` method`.', async () => {
    const req = httpMocks.createRequest({
      method: 'PATCH',
      url: 'http://localhost:8080/api/v1/topic/42',
    });
    await runMockMiddleware(req);

    const data = res._getData();
    expect(data).toEqual({ url: '/api/v1/topic-patch' });
  });

  it('should work with `delete` method`.', async () => {
    const req = httpMocks.createRequest({
      method: 'DELETE',
      url: 'http://localhost:8080/api/v1/topic/42',
    });
    await runMockMiddleware(req);

    const data = res._getData();
    expect(data).toEqual({ url: '/api/v1/topic-delete' });
  });

  it('should work with the default mock`.', async () => {
    const req = httpMocks.createRequest({
      method: 'GET',
      url: 'http://localhost:8080/api/v1/default',
    });
    await createMockMiddleware(
      {
        openLogger: false,
        baseURL: '/api/v1',
        mocks: [defaultMock({ mockFolder: path.resolve(__dirname, './mock') })],
      },
      true,
    )(req, res, () => {});

    const data = res._getData();
    expect(data).toEqual({ url: '/api/v1/default-get' });
  });

  it('should work with the default mock part two`.', async () => {
    const req = httpMocks.createRequest({
      method: 'DELETE',
      url: 'http://localhost:8080/api/v1/topic/43',
    });
    await createMockMiddleware(
      {
        openLogger: false,
        baseURL: '/api/v1',
        mocks: [defaultMock({ mockFolder: path.resolve(__dirname, './mock') })],
      },
      true,
    )(req, res, () => {});

    const data = res._getData();
    expect(data).toEqual({ url: '/api/v1/topic-delete' });
  });

  it('should work with the umi mock`.', async () => {
    const req = httpMocks.createRequest({
      method: 'GET',
      url: 'http://localhost:8080/api/v1/default',
    });
    await createMockMiddleware(
      {
        openLogger: false,
        baseURL: '/api/v1',
        mocks: [umiMock({ mockFolder: path.resolve(__dirname, './umiMock') })],
      },
      true,
    )(req, res, () => {});

    const data = res._getData();
    expect(data).toEqual({ url: '/api/v1/topic-default' });
  });

  it('should work with the umi mock part two`.', async () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: 'http://localhost:8080/api/v1/topic/43',
    });
    await createMockMiddleware(
      {
        openLogger: false,
        baseURL: '/api/v1',
        mocks: [umiMock({ mockFolder: path.resolve(__dirname, './umiMock') })],
      },
      true,
    )(req, res, () => {});

    const data = res._getData();
    expect(data).toEqual({ url: '/api/v1/topic-43' });
  });
});
