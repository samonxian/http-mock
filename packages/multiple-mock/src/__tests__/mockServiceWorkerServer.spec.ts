// import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import mockjs from 'mockjs';
import axios from 'axios';
import type { MockApp } from '../';
import { start, stop } from '../';

// const baseURL = '/api/v1';

beforeAll(async () => {
  await start({
    mockOptions: {
      mockjs,
    },
    mockData: (mockApp: MockApp) => {
      mockApp.post('/api/v1/test', (req, res) => {
        res.send({
          data: {
            name: req.body.name,
            'list|10': ['name'],
          },
        });
      });

      mockApp.get('/api/v1/test', (req, res) => {
        res.send({
          data: {
            name: req.headers.name,
            'list|5': ['name'],
          },
        });
      });

      mockApp.get('http://www.test.com/api/v1/test', (req, res) => {
        res.send({
          data: {
            name: req.headers.name,
            'list|2': ['name'],
          },
        });
      });
    },
  });
});

describe('mockServiceWorkerServer', async () => {
  // console.log(channel);

  it('should work with fetch`.', async () => {
    const response = await fetch('/api/v1/test', {
      method: 'POST',
      body: JSON.stringify({ name: 2 }),
    });
    const result = await response.json();
    expect(result).toEqual({
      data: {
        name: 2,
        list: ['name', 'name', 'name', 'name', 'name', 'name', 'name', 'name', 'name', 'name'],
      },
    });

    const response2 = await fetch('/api/v1/test', {
      method: 'GET',
      headers: { name: '2' },
    });
    const result2 = await response2.json();
    expect(result2).toEqual({
      data: {
        name: '2',
        list: ['name', 'name', 'name', 'name', 'name'],
      },
    });

    const response3 = await fetch('http://www.test.com/api/v1/test', {
      method: 'GET',
      headers: { name: '2' },
    });
    const result3 = await response3.json();
    expect(result3).toEqual({
      data: {
        name: '2',
        list: ['name', 'name'],
      },
    });
  });

  it('should work with axios`.', async () => {
    const response = await axios.post('/api/v1/test', {
      name: 2,
    });
    const result = response.data;
    expect(result).toEqual({
      data: {
        name: 2,
        list: ['name', 'name', 'name', 'name', 'name', 'name', 'name', 'name', 'name', 'name'],
      },
    });

    const response2 = await axios.get('/api/v1/test', {
      headers: { name: '2' },
    });
    const result2 = response2.data;
    expect(result2).toEqual({
      data: {
        name: '2',
        list: ['name', 'name', 'name', 'name', 'name'],
      },
    });

    const response3 = await axios.get('http://www.test.com/api/v1/test', {
      headers: { name: '2' },
    });
    const result3 = response3.data;
    expect(result3).toEqual({
      data: {
        name: '2',
        list: ['name', 'name'],
      },
    });
  });
});

afterAll(() => {
  stop();
});
