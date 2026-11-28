import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_HEADERS, RESILIENCE_THRESHOLDS } from './config.js';

export const options = {
  stages: [
    { duration: '15s', target: 20 }, // base load
    { duration: '20s', target: 50 }, // medium-high load
    { duration: '20s', target: 100 }, // high load
    { duration: '20s', target: 150 }, // extreme load
    { duration: '15s', target: 0 }, // recuperation
  ],
  thresholds: RESILIENCE_THRESHOLDS,
};

export default function () {
  const res = http.get(`${BASE_URL}/v1/products?page=1&limit=20`, {
    headers: DEFAULT_HEADERS,
    tags: { endpoint: 'stress_products' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(0.5);
}
