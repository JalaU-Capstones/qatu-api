import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_HEADERS, RESILIENCE_THRESHOLDS } from './config.js';

export const options = {
  stages: [
    { duration: '10s', target: 5 }, // low traffic
    { duration: '10s', target: 120 }, // sudden peak
    { duration: '20s', target: 120 }, // maintains the peak
    { duration: '10s', target: 5 }, // fall
    { duration: '10s', target: 0 }, // close
  ],
  thresholds: RESILIENCE_THRESHOLDS,
};

export default function () {
  const res = http.get(`${BASE_URL}/v1/products?page=1&limit=10`, {
    headers: DEFAULT_HEADERS,
    tags: { endpoint: 'spike_products' },
  });

  check(res, {
    'status is 200': (r) => r.status === 200,
  });

  sleep(0.5);
}
