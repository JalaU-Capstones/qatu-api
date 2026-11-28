import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { BASE_URL, DEFAULT_HEADERS, STRICT_THRESHOLDS } from './config.js';

export const options = {
  stages: [
    { duration: '20s', target: 15 }, // ramp up
    { duration: '40s', target: 15 }, // maintain
    { duration: '15s', target: 0 }, // ramp down
  ],
  thresholds: STRICT_THRESHOLDS,
};

export default function () {
  group('Catalog & Categories Read Flow', () => {
    const categoriesRes = http.get(`${BASE_URL}/v1/categories`, {
      headers: DEFAULT_HEADERS,
      tags: { endpoint: 'list_categories' },
    });

    check(categoriesRes, {
      'GET /v1/categories status is 200': (r) => r.status === 200,
    });

    const productsRes = http.get(`${BASE_URL}/v1/products?page=1&limit=12`, {
      headers: DEFAULT_HEADERS,
      tags: { endpoint: 'list_products' },
    });

    check(productsRes, {
      'GET /v1/products status is 200': (r) => r.status === 200,
    });
  });

  sleep(1);
}
