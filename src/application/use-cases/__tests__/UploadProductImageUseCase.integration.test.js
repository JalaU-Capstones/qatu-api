import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMigratedTestDatabase } from '../../../infrastructure/persistence/__tests__/helpers/migratedTestDatabase.js';
import { ProductRepository } from '../../../infrastructure/persistence/repositories/ProductRepository.js';
import { UploadProductImageUseCase } from '../UploadProductImageUseCase.js';

const SELLER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_SELLER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';
const PRODUCT_ID = '10000000-0000-4000-8000-000000000001';
const PUBLISHED_PRODUCT_ID = '10000000-0000-4000-8000-000000000002';

describe('UploadProductImageUseCase (integration, real PostgreSQL)', { timeout: 30_000 }, () => {
  let database;
  let sequelize;
  let productRepository;

  const runQuery = (sql, replacements = {}) =>
    sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

  const buildUseCase = (storageService) => {
    const uc = new UploadProductImageUseCase({
      productRepository,
      storageService,
    });
    const origExecute = uc.execute.bind(uc);
    uc.execute = (params = {}) => origExecute({ accessToken: 'integration-test-token', ...params });
    return uc;
  };

  const insertProduct = async ({ id, sellerId, state = 'draft' }) => {
    await sequelize.query(
      `INSERT INTO public.products (
         id, seller_id, category_id, name, slug, description, price,
         currency, stock, attributes, state, primary_image_path
       ) VALUES (
         :id, :sellerId, :categoryId, :name, :slug, :description, :price,
         :currency, :stock, :attributes::jsonb, :state, :primaryImagePath
       )`,
      {
        replacements: {
          id,
          sellerId,
          categoryId: CATEGORY_ID,
          name: `Product ${id}`,
          slug: `product-${id.slice(-6)}`,
          description: 'Integration test product',
          price: 19.99,
          currency: 'USD',
          stock: 0,
          attributes: JSON.stringify({}),
          state,
          primaryImagePath: null,
        },
      }
    );
  };

  beforeAll(async () => {
    database = await createMigratedTestDatabase('upload_image');
    ({ sequelize } = database);
    productRepository = new ProductRepository({ db: sequelize });
  }, 120_000);

  afterAll(async () => {
    await database?.close();
  });

  beforeEach(async () => {
    await sequelize.query('delete from public.product_images;');
    await sequelize.query('delete from public.products;');
    await sequelize.query('delete from public.user_roles;');
    await sequelize.query('delete from public.profiles;');
    await sequelize.query('delete from public.categories;');
    await sequelize.query('delete from auth.users;');

    await sequelize.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values
         (:sellerId, 'seller@example.com', :sellerMetadata::jsonb),
         (:otherSellerId, 'other-seller@example.com', :otherSellerMetadata::jsonb)`,
      {
        replacements: {
          sellerId: SELLER,
          otherSellerId: OTHER_SELLER,
          sellerMetadata: JSON.stringify({ username: 'upload_seller' }),
          otherSellerMetadata: JSON.stringify({ username: 'upload_other_seller' }),
        },
      }
    );

    await sequelize.query(
      `insert into public.user_roles (profile_id, role_id)
       select p.id, r.id from public.profiles p, public.roles r
       where r.name = 'seller' and p.id in (:sellerId, :otherSellerId)
       on conflict do nothing`,
      { replacements: { sellerId: SELLER, otherSellerId: OTHER_SELLER } }
    );

    await sequelize.query(
      `insert into public.categories (id, name, slug)
       values (:id, 'Electronics', 'electronics')`,
      { replacements: { id: CATEGORY_ID } }
    );

    await insertProduct({ id: PRODUCT_ID, sellerId: SELLER, state: 'draft' });
    await insertProduct({ id: PUBLISHED_PRODUCT_ID, sellerId: SELLER, state: 'published' });
  });

  it('uploads the first image and sets the primary image path', async () => {
    const storageService = {
      uploadProductImage: vi.fn().mockResolvedValue({
        bucket: 'product-images',
        path: `product-images/${PRODUCT_ID}/first.png`,
        publicUrl: 'https://example.com/first.png',
      }),
    };
    const file = {
      buffer: Buffer.from('first-image'),
      mimeType: 'image/png',
      size: 12,
      originalName: 'first.png',
    };

    const result = await buildUseCase(storageService).execute({
      productId: PRODUCT_ID,
      sellerId: SELLER,
      file,
    });

    const [row] = await runQuery(
      `SELECT primary_image_path FROM public.products WHERE id = :productId`,
      { productId: PRODUCT_ID }
    );

    expect(row.primary_image_path).toBe(`product-images/${PRODUCT_ID}/first.png`);
    expect(result.data.path).toBe(`product-images/${PRODUCT_ID}/first.png`);
    expect(result.meta.timestamp).toEqual(expect.any(String));
    expect(result.location).toBe(`/v1/products/${PRODUCT_ID}/images/${result.data.id}`);
    expect(storageService.uploadProductImage).toHaveBeenCalledWith(
      expect.objectContaining({
        productId: PRODUCT_ID,
        mimeType: 'image/png',
        originalName: 'first.png',
        size: 12,
      })
    );
  });

  it('uploads a second image without changing the primary image', async () => {
    const path1 = `product-images/${PRODUCT_ID}/one.png`;
    const path2 = `product-images/${PRODUCT_ID}/two.png`;
    await productRepository.addImage({
      productId: PRODUCT_ID,
      path: path1,
      altText: null,
      position: 0,
    });
    await productRepository.setPrimaryImageIfNull({ productId: PRODUCT_ID, path: path1 });

    const storageService = {
      uploadProductImage: vi.fn().mockResolvedValue({
        bucket: 'product-images',
        path: path2,
        publicUrl: 'https://example.com/two.png',
      }),
    };

    const result = await buildUseCase(storageService).execute({
      productId: PRODUCT_ID,
      sellerId: SELLER,
      file: {
        buffer: Buffer.from('second-image'),
        mimeType: 'image/png',
        size: 14,
        originalName: 'two.png',
      },
    });

    const [row] = await runQuery(
      `SELECT primary_image_path FROM public.products WHERE id = :productId`,
      { productId: PRODUCT_ID }
    );

    expect(result.data.path).toBe(path2);
    expect(row.primary_image_path).toBe(path1);
    expect(await productRepository.countImages(PRODUCT_ID)).toBe(2);
  });

  it('rejects the sixth image at the five-image limit', async () => {
    const storageService = { uploadProductImage: vi.fn() };
    for (let index = 0; index < 5; index += 1) {
      const path = `product-images/${PRODUCT_ID}/${index}.png`;
      await productRepository.addImage({
        productId: PRODUCT_ID,
        path,
        altText: null,
        position: index,
      });
      if (index === 0) {
        await productRepository.setPrimaryImageIfNull({ productId: PRODUCT_ID, path });
      }
    }

    await expect(
      buildUseCase(storageService).execute({
        productId: PRODUCT_ID,
        sellerId: SELLER,
        file: {
          buffer: Buffer.from('limit-hit'),
          mimeType: 'image/png',
          size: 10,
          originalName: 'limit.png',
        },
      })
    ).rejects.toMatchObject({
      code: 'IMAGE_LIMIT_REACHED',
      statusCode: 422,
    });
  });

  it('rejects uploads from another seller', async () => {
    const storageService = { uploadProductImage: vi.fn() };

    await expect(
      buildUseCase(storageService).execute({
        productId: PRODUCT_ID,
        sellerId: OTHER_SELLER,
        file: {
          buffer: Buffer.from('not-allowed'),
          mimeType: 'image/png',
          size: 12,
          originalName: 'nope.png',
        },
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });

  it('returns PRODUCT_NOT_FOUND for an unknown product UUID', async () => {
    const storageService = { uploadProductImage: vi.fn() };

    await expect(
      buildUseCase(storageService).execute({
        productId: '10000000-0000-4000-8000-000000000099',
        sellerId: SELLER,
        file: {
          buffer: Buffer.from('missing'),
          mimeType: 'image/png',
          size: 7,
          originalName: 'missing.png',
        },
      })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('allows an image upload on a published product', async () => {
    const path1 = `product-images/${PUBLISHED_PRODUCT_ID}/existing.png`;
    await productRepository.addImage({
      productId: PUBLISHED_PRODUCT_ID,
      path: path1,
      altText: null,
      position: 0,
    });
    await productRepository.setPrimaryImageIfNull({ productId: PUBLISHED_PRODUCT_ID, path: path1 });

    const storageService = {
      uploadProductImage: vi.fn().mockResolvedValue({
        bucket: 'product-images',
        path: `product-images/${PUBLISHED_PRODUCT_ID}/new.png`,
        publicUrl: 'https://example.com/new.png',
      }),
    };

    const result = await buildUseCase(storageService).execute({
      productId: PUBLISHED_PRODUCT_ID,
      sellerId: SELLER,
      file: {
        buffer: Buffer.from('published-upload'),
        mimeType: 'image/png',
        size: 18,
        originalName: 'new.png',
      },
    });

    expect(result.data.product_id).toBe(PUBLISHED_PRODUCT_ID);
    expect(result.location).toBe(`/v1/products/${PUBLISHED_PRODUCT_ID}/images/${result.data.id}`);
    expect(await productRepository.countImages(PUBLISHED_PRODUCT_ID)).toBe(2);
  });
});
