// Isolate unit and route tests from host .env so image URL resolution is
// deterministic. Integration tests (vitest.config.integration.js) do NOT
// load this file — they run against the real stack and may test both
// PUBLIC_APP_URL modes (Phase 1 fallback + Phase 2 proxy, ADR-019).
process.env.PUBLIC_APP_URL = '';
process.env.SUPABASE_STORAGE_PUBLIC_URL =
  process.env.SUPABASE_STORAGE_PUBLIC_URL || 'http://localhost:54321/storage/v1/object/public';
