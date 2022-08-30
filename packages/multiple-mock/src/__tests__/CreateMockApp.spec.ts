import { describe, expect, it } from 'vitest';
import httpMocks from 'node-mocks-http';
import mockjs from 'mockjs';
import type { RequestMethod } from 'node-mocks-http';
import type { Request, Response } from 'express';
import type { MockRequest, MockResponse } from '../';
import { CreateMockApp } from '../';

const baseURL = '/api/v1';

describe('CreateMockApp', () => {
  commonTest('GET');
  commonTest('POST');
  commonTest('PUT');
  commonTest('PATCH');
  commonTest('DELETE');

  it('should warn when the router is repeated`.', async () => {
    const req = httpMocks.createRequest({
      method: 'GET',
      url: 'http://localhost:8080/api/v1/test/43',
    });

    const restoreConsoleError = console.error;
    console.error = (value: string) => {
      expect(value).include('/api/v1/test/:id-GET');
    };
    const res = httpMocks.createResponse();
    const createMockAppInstance = new CreateMockApp(req as MockRequest, res as unknown as MockResponse, () => {}, {
      openLogger: false,
      isSinglePage: true,
      baseURL,
      interceptedHost: 'localhost:8080',
    });
    const mockApp = createMockAppInstance.getMockApp();
    mockApp.get('/test/:id', () => {});
    mockApp.post('/test/:id', () => {});
    mockApp.get('/test/:id', () => {});
    await createMockAppInstance.run();
    console.log = restoreConsoleError;
  });

  it('should run next function when interceptedHost is not equaled.`.', async () => {
    const req = httpMocks.createRequest({
      method: 'GET',
      url: 'http://localhost:8080/api/v1/test/43',
    });

    const res = httpMocks.createResponse();
    const createMockAppInstance = new CreateMockApp(req as MockRequest, res as unknown as MockResponse, () => {}, {
      openLogger: false,
      isSinglePage: true,
      baseURL,
      interceptedHost: 'test',
    });
    const mockApp = createMockAppInstance.getMockApp();
    mockApp.get('/test/:id', () => {
      throw new Error('error');
    });
    await createMockAppInstance.run();
  });
});

function commonTest(method: RequestMethod) {
  it(`should work with ${method} method`, async () => {
    const req = httpMocks.createRequest({
      method,
      url: 'http://localhost:8080/api/v1/test/43?name=test',
    });

    const res = httpMocks.createResponse();

    const createMockAppInstance = new CreateMockApp(req as MockRequest, res as unknown as MockResponse, () => {}, {
      openLogger: false,
      isSinglePage: true,
      baseURL,
      mockjs,
      interceptedHost: 'localhost:8080',
    });
    const mockApp = createMockAppInstance.getMockApp();
    mockApp[method.toLowerCase()]('/test/:id', (req: Request, res: Response) => {
      const { id } = req.params;
      const { name } = req.query;

      res.send({
        data: {
          id,
          name,
          'list|3': ['mock'],
        },
        msg: 'success',
      });
    });
    mockApp[method.toLowerCase()]('http://www.test.com/api/v1/test/:id', (req: Request, res: Response) => {
      res.send({
        msg: 'success',
      });
    });
    await createMockAppInstance.run();

    const data = res._getData();
    expect(data).toEqual(
      mockjs.mock({
        data: {
          id: '43',
          name: 'test',
          'list|3': ['mock'],
        },
        msg: 'success',
      }),
    );
  });

  it('should response with the `Method Not Allowed`.', async () => {
    const req = httpMocks.createRequest({
      method: method === 'GET' ? 'POST' : 'GET',
      url: 'http://localhost:8080/api/v1/test/43',
    });

    const res = httpMocks.createResponse();

    const createMockAppInstance = new CreateMockApp(req as MockRequest, res as unknown as MockResponse, () => {}, {
      openLogger: false,
      isSinglePage: true,
      baseURL,
      interceptedHost: 'localhost:8080',
    });
    const mockApp = createMockAppInstance.getMockApp();
    mockApp[method.toLowerCase()]('/test/:id', (req: MockRequest, res: MockResponse) => {
      res.send({});
    });
    await createMockAppInstance.run();

    const data = res._getData();
    expect(data).toEqual('Method Not Allowed');
  });
}
