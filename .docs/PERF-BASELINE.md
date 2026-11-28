# Performance Baseline

Baseline established: 2026-11-28 13:39:34 UTC
Test environment: Local development stack
k6 script: performance/load.js
Configuration: 10 virtual users, 30s duration

## Thresholds

- p95 response time: < 500ms
- Error rate: < 1%

## Results

| Metric            | Value                 |
| ----------------- | --------------------- |
| Total Requests    | 600                   |
| Throughput        | 19.75 req/s           |
| p95 Response Time | 11.496722449999995 ms |
| Error Rate        | 0.00 %                |
