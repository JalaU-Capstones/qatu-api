/* global fetch, AbortSignal */
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { sequelize } from '../../../infrastructure/config/sequelize.js';

const API = 'http://localhost:3000';
const SELLER_EMAIL = 'seller@example.qatu.pe';
const SELLER_PASSWORD = 'Seller123!';
const E2E_SLUG_PREFIX = 'e2e-test-';

describe('Seller Product Flow (E2E, live API)', { timeout: 30_000 }, () => {
  let servicesAvailable = false;
  let servicesError = null;
  let agent;
  let csrfToken = null;
  let categoryId = null;
  let productId = null;

  beforeAll(async () => {
    try {
      const health = await fetch(`${API}/health`, { signal: AbortSignal.timeout(2000) });
      const supabase = await fetch('http://127.0.0.1:54321/rest/v1/', {
        signal: AbortSignal.timeout(2000),
      });
      if (!health.ok) throw new Error(`API /health not OK (status ${health.status})`);
      // Kong returns 200 or 401 depending on anon requirements — either
      // means Supabase is up.
      if (supabase.status === 0) throw new Error('Supabase unreachable');
      servicesAvailable = true;
    } catch (error) {
      servicesError = error;
      return;
    }

    // Setup: login as seller
    agent = request.agent(API);
    const login = await agent
      .post('/v1/auth/login')
      .send({ email: SELLER_EMAIL, password: SELLER_PASSWORD });
    if (login.status !== 200) {
      servicesError = new Error(`Login failed: ${login.status} ${JSON.stringify(login.body)}`);
      return;
    }

    // Extract CSRF from Set-Cookie header
    const setCookie = login.headers['set-cookie'] || [];
    const csrfCookie = setCookie.find((c) => c.startsWith('csrf_token='));
    if (!csrfCookie) {
      servicesError = new Error('csrf_token cookie missing after login');
      return;
    }
    csrfToken = csrfCookie.split(';')[0].split('=')[1];

    // Get a category
    const categories = await agent.get('/v1/categories');
    if (!categories.body?.data?.length) {
      servicesError = new Error('No categories available (seed missing?)');
      return;
    }
    categoryId = categories.body.data[0].id;
  });

  beforeEach((context) => {
    if (!servicesAvailable || servicesError) {
      context.skip();
    }
  });

  afterAll(async () => {
    if (!servicesAvailable) return;

    // Cleanup: remove any E2E test products created by this run.
    // product_images cascades via the FK from migration 008.
    try {
      await sequelize.query(`DELETE FROM public.products WHERE slug LIKE :prefix`, {
        replacements: { prefix: `${E2E_SLUG_PREFIX}%` },
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('[SellerProductFlow cleanup] failed:', error.message);
    }
  });

  it('creates a draft product, uploads 2 images, lists them via GET /images, publishes, and reads the public product', async () => {
    // ── Step 1: Create draft ─────────────────────────────────────────────
    const createRes = await agent
      .post('/v1/products')
      .set('X-CSRF-Token', csrfToken)
      .send({
        name: 'E2E Test Product',
        slug: `${E2E_SLUG_PREFIX}${Date.now()}`,
        description: 'Created by SellerProductFlow.integration.test',
        price: 42.99,
        currency: 'USD',
        stock: 5,
        category_id: categoryId,
        attributes: { source: 'e2e-test' },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.data.state).toBe('draft');
    expect(createRes.body.data.primary_image_path).toBeNull();
    productId = createRes.body.data.id;
    const slug = createRes.body.data.slug;

    // ── Step 2: Upload 2 images ──────────────────────────────────────────
    // Use a tiny PNG buffer (1x1 transparent PNG, ~68 bytes) so the test
    // doesn't depend on /home/Botina/Pictures/images/.
    const tinyPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64'
    );

    for (let i = 0; i < 2; i += 1) {
      const uploadRes = await agent
        .post(`/v1/products/${productId}/images`)
        .set('X-CSRF-Token', csrfToken)
        .attach('image', tinyPng, { filename: `e2e-${i}.png`, contentType: 'image/png' });
      expect(uploadRes.status).toBe(201);
      expect(uploadRes.body.data.position).toBe(i);
    }

    // ── Step 3: GET /images (the new endpoint) ───────────────────────────
    const listRes = await agent.get(`/v1/products/${productId}/images`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.data).toHaveLength(2);
    expect(listRes.body.data[0].position).toBe(0);
    expect(listRes.body.data[1].position).toBe(1);
    // path is resolved to a full URL by ProductImageDTO
    expect(listRes.body.data[0].path).toMatch(/^https?:\/\/.+\/product-images\//);

    // ── Step 4: Publish ──────────────────────────────────────────────────
    const publishRes = await agent
      .patch(`/v1/products/${productId}/publish`)
      .set('X-CSRF-Token', csrfToken);

    expect(publishRes.status).toBe(200);
    expect(publishRes.body.data.state).toBe('published');
    expect(publishRes.body.data.published_at).not.toBeNull();
    expect(publishRes.body.data.primary_image_path).toMatch(/^https?:\/\/.+\/product-images\//);
    expect(publishRes.body.data.images).toHaveLength(2);
    expect(publishRes.body.data.images[0].path).toMatch(/^https?:\/\/.+\/product-images\//);
    expect(publishRes.body.data.seller).not.toBeNull();
    expect(publishRes.body.data.seller.id).toBe(publishRes.body.data.seller_id);
    expect(publishRes.body.data.category).not.toBeNull();
    expect(publishRes.body.data.category.id).toBe(categoryId);

    // ── Step 5: Public GET /products/:id (no auth) ───────────────────────
    const publicRes = await request(API).get(`/v1/products/${productId}`);
    expect(publicRes.status).toBe(200);
    expect(publicRes.body.data.slug).toBe(slug);
    expect(publicRes.body.data.state).toBe('published');
    expect(publicRes.body.data.images).toHaveLength(2);
    expect(publicRes.body.data.seller.id).toBe(publicRes.body.data.seller_id);
  }, 60_000);

  it('returns 404 for a product that does not exist (GET /images)', async () => {
    const res = await agent.get('/v1/products/00000000-0000-4000-8000-000000000000/images');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('returns 400 for an invalid UUID (GET /images)', async () => {
    const res = await agent.get('/v1/products/not-a-uuid/images');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('seeded seller listing includes the newly created product after creation', async () => {
    // This test intentionally runs AFTER the create test. If the first
    // test was skipped (services down), it also skips via the same guard.
    if (!servicesAvailable || !productId) return;
    const list = await agent.get('/v1/seller/products?limit=100');
    expect(list.status).toBe(200);
    const found = list.body.data.find((p) => p.id === productId);
    expect(found).toBeDefined();
  });
});
