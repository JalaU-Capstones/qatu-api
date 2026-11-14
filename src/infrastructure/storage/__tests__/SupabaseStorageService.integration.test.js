/**
 * Integration tests for SupabaseStorageService with real Supabase CLI.
 *
 * Requires a running local Supabase stack (`npx supabase start`).
 * If the stack is not available or healthy, the entire suite is skipped.
 */
import { execSync } from 'node:child_process';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { app } from '../../../app.js';
import { sequelize } from '../../config/sequelize.js';
import { SupabaseStorageService } from '../SupabaseStorageService.js';

function isSupabaseRunning() {
  try {
    const status = execSync('npx supabase status --output json', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const parsed = JSON.parse(status);
    return Boolean(parsed.API_URL && parsed.DB_URL);
  } catch {
    return false;
  }
}

const shouldRun = process.env.TEST_SUPABASE_STORAGE === 'true' || isSupabaseRunning();

describe.skipIf(!shouldRun)('SupabaseStorageService (integration, real Supabase CLI)', () => {
  let storageService;
  let sellerAccessToken;
  const sellerId = '00000000-0000-0000-0000-000000000002';

  beforeAll(async () => {
    storageService = new SupabaseStorageService();

    const loginRes = await request(app)
      .post('/v1/auth/login')
      .send({ email: 'seller@example.qatu.pe', password: 'Seller123!' });

    expect(loginRes.status).toBe(200);

    const rawCookie = loginRes.headers['set-cookie']?.find((c) => c.startsWith('access_token='));
    expect(rawCookie).toBeDefined();

    sellerAccessToken = rawCookie.split(';')[0].replace('access_token=', '');
    expect(sellerAccessToken).toBeTruthy();
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('uploads avatar with user-scoped JWT and sets owner = userId in storage.objects', async () => {
    const sampleBuffer = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00]);
    const result = await storageService.uploadAvatar({
      userId: sellerId,
      buffer: sampleBuffer,
      mimeType: 'image/webp',
      extension: 'webp',
      originalName: 'avatar.webp',
      size: sampleBuffer.length,
      accessToken: sellerAccessToken,
    });

    expect(result.path).toContain(`/avatars/${sellerId}/`);

    const expectedObjectKey = result.path.split('/avatars/')[1];

    const [rows] = await sequelize.query(
      `SELECT bucket_id, owner, name FROM storage.objects WHERE bucket_id = 'avatars' AND name = :name LIMIT 1`,
      { replacements: { name: `${sellerId}/${expectedObjectKey.split('/').pop()}` } }
    );

    expect(rows.length).toBe(1);
    expect(rows[0].bucket_id).toBe('avatars');
    expect(rows[0].owner).toBe(sellerId);
  });

  it('uploads product image with user-scoped JWT and sets owner = sellerId in storage.objects', async () => {
    const sampleBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
    const productId = '550e8400-e29b-41d4-a716-446655440000';

    const result = await storageService.uploadProductImage({
      productId,
      buffer: sampleBuffer,
      mimeType: 'image/png',
      extension: 'png',
      originalName: 'prod.png',
      size: sampleBuffer.length,
      accessToken: sellerAccessToken,
    });

    expect(result.bucket).toBe('product-images');
    expect(result.path).toContain(`product-images/${productId}/`);

    const filename = result.path.split('/').pop();
    const objectName = `${productId}/${filename}`;

    const [rows] = await sequelize.query(
      `SELECT bucket_id, owner, name FROM storage.objects WHERE bucket_id = 'product-images' AND name = :name LIMIT 1`,
      { replacements: { name: objectName } }
    );

    expect(rows.length).toBe(1);
    expect(rows[0].bucket_id).toBe('product-images');
    expect(rows[0].owner).toBe(sellerId);
  });
});
