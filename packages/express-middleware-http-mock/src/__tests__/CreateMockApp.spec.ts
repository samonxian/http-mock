import { describe, expect, it } from 'vitest';
import httpMocks from 'node-mocks-http';
import mockjs from 'mockjs';
import type { RequestMethod } from 'node-mocks-http';
import type { Request, Response } from 'express';
import { CreateMockApp } from '../';

const baseURL = '/api/v1';

describe('CreateMockApp', () => {
  commonTest('GET');
  commonTest('POST');
  commonTest('PUT');
  commonTest('PATCH');
  commonTest('DELETE');

  it('should warn when the router is repeated`.', () => {
    const req = httpMocks.createRequest({
      method: 'GET',
      url: '/api/v1/test/43',
    });

    const restoreConsoleError = console.error;
    console.error = (value: string) => {
      expect(value).include('/api/v1/test/:id-GET');
    };
    const res = httpMocks.createResponse();
    const createMockAppInstance = new CreateMockApp(req, res, () => {}, {
      openLogger: false,
      isSinglePage: true,
      baseURL,
    });
    const mockApp = createMockAppInstance.getMockApp();
    mockApp.get('/test/:id', () => {});
    mockApp.post('/test/:id', () => {});
    mockApp.get('/test/:id', () => {});
    createMockAppInstance.run();
    console.log = restoreConsoleError;
  });
});

function commonTest(method: RequestMethod) {
  it(`should work with ${method} method`, () => {
    const req = httpMocks.createRequest({
      method,
      url: '/api/v1/test/43?name=test',
    });

    const res = httpMocks.createResponse();

    const createMockAppInstance = new CreateMockApp(req, res, () => {}, {
      openLogger: false,
      isSinglePage: true,
      baseURL,
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
    createMockAppInstance.run();

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

  it('should response with the `Method Not Allowed`.', () => {
    const req = httpMocks.createRequest({
      method: method === 'GET' ? 'POST' : 'GET',
      url: '/api/v1/test/43',
    });

    const res = httpMocks.createResponse();

    const createMockAppInstance = new CreateMockApp(req, res, () => {}, {
      openLogger: false,
      isSinglePage: true,
      baseURL,
    });
    const mockApp = createMockAppInstance.getMockApp();
    mockApp[method.toLowerCase()]('/test/:id', (req: Request, res: Response) => {
      res.send({});
    });
    createMockAppInstance.run();

    const data = res._getData();
    expect(data).toEqual('Method Not Allowed');
  });
}
