import { QueryTypes } from 'sequelize';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMigratedTestDatabase } from '../../../infrastructure/persistence/__tests__/helpers/migratedTestDatabase.js';
import { ProductRepository } from '../../../infrastructure/persistence/repositories/ProductRepository.js';
import { DeleteProductImageUseCase } from '../DeleteProductImageUseCase.js';

const SELLER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const OTHER_SELLER = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const CATEGORY_ID = '11111111-1111-4111-8111-111111111111';

const PRODUCT_DRAFT = '10000000-0000-4000-8000-000000000001';
const PRODUCT_PUBLISHED = '10000000-0000-4000-8000-000000000002';
const PRODUCT_UNPUBLISHED = '10000000-0000-4000-8000-000000000003';
const PRODUCT_ARCHIVED = '10000000-0000-4000-8000-000000000004';
const PRODUCT_OTHER_SELLER = '10000000-0000-4000-8000-000000000005';
const PRODUCT_SOFT_DELETED = '10000000-0000-4000-8000-000000000006';

const ACCESS_TOKEN = 'mock-access-token';

describe('DeleteProductImageUseCase (integration, real PostgreSQL)', { timeout: 30_000 }, () => {
  let database;
  let sequelize;
  let productRepository;

  const runQuery = (sql, replacements = {}) =>
    sequelize.query(sql, { replacements, type: QueryTypes.SELECT });

  const buildUseCase = (storageService) => {
    const defaultStorage = {
      deleteProductImage: vi.fn().mockResolvedValue({ deleted: true }),
    };
    return new DeleteProductImageUseCase({
      productRepository,
      storageService: storageService || defaultStorage,
    });
  };

  const insertProduct = async ({
    id,
    sellerId,
    name,
    state = 'draft',
    primaryImagePath = null,
    deletedAt = null,
  }) => {
    await sequelize.query(
      `INSERT INTO public.products (
         id, seller_id, category_id, name, slug, description, price,
         currency, stock, attributes, state, primary_image_path, deleted_at
       ) VALUES (
         :id, :sellerId, :categoryId, :name, :slug, 'Integration test product', 19.99,
         'USD', 10, '{}'::jsonb, :state, :primaryImagePath, :deletedAt
       )`,
      {
        replacements: {
          id,
          sellerId,
          categoryId: CATEGORY_ID,
          name,
          slug: `slug-${id.slice(-6)}`,
          state,
          primaryImagePath,
          deletedAt,
        },
      }
    );
  };

  const getProductRow = async (productId) => {
    const [row] = await runQuery(
      `SELECT id, primary_image_path, state, deleted_at FROM public.products WHERE id = :productId`,
      { productId }
    );
    return row;
  };

  const getImageRow = async (imageId) => {
    const [row] = await runQuery(
      `SELECT id, product_id, path, position FROM public.product_images WHERE id = :imageId`,
      { imageId }
    );
    return row;
  };

  beforeAll(async () => {
    database = await createMigratedTestDatabase('delete_image');
    ({ sequelize } = database);
    productRepository = new ProductRepository({ db: sequelize });
  }, 120_000);

  afterAll(async () => {
    await database?.close();
  }, 60_000);

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
          sellerMetadata: JSON.stringify({ username: 'delete_img_seller' }),
          otherSellerMetadata: JSON.stringify({ username: 'delete_img_other' }),
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

    await insertProduct({
      id: PRODUCT_DRAFT,
      sellerId: SELLER,
      name: 'Draft Product',
      state: 'draft',
    });
    await insertProduct({
      id: PRODUCT_PUBLISHED,
      sellerId: SELLER,
      name: 'Published Product',
      state: 'published',
    });
    await insertProduct({
      id: PRODUCT_UNPUBLISHED,
      sellerId: SELLER,
      name: 'Unpublished Product',
      state: 'unpublished',
    });
    await insertProduct({
      id: PRODUCT_ARCHIVED,
      sellerId: SELLER,
      name: 'Archived Product',
      state: 'archived',
    });
    await insertProduct({
      id: PRODUCT_OTHER_SELLER,
      sellerId: OTHER_SELLER,
      name: 'Other Seller Product',
      state: 'published',
    });
    await insertProduct({
      id: PRODUCT_SOFT_DELETED,
      sellerId: SELLER,
      name: 'Soft Deleted Product',
      state: 'published',
      deletedAt: new Date(),
    });
  });

  it('1. happy path draft 2 images: deletes image 2, image 1 remains, primary unchanged', async () => {
    const path1 = `product-images/${PRODUCT_DRAFT}/img1.webp`;
    const path2 = `product-images/${PRODUCT_DRAFT}/img2.webp`;
    const img1 = await productRepository.addImage({
      productId: PRODUCT_DRAFT,
      path: path1,
      position: 0,
    });
    const img2 = await productRepository.addImage({
      productId: PRODUCT_DRAFT,
      path: path2,
      position: 1,
    });
    await productRepository.setPrimaryImageIfNull({ productId: PRODUCT_DRAFT, path: path1 });

    const result = await buildUseCase().execute({
      productId: PRODUCT_DRAFT,
      imageId: img2.id,
      sellerId: SELLER,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({ meta: { timestamp: expect.any(String) } });
    expect(await getImageRow(img2.id)).toBeUndefined();
    expect(await getImageRow(img1.id)).toBeDefined();

    const productRow = await getProductRow(PRODUCT_DRAFT);
    expect(productRow.primary_image_path).toBe(path1);
  });

  it('2. happy path draft delete PRIMARY: deletes image 1, recomputes primary to image 2', async () => {
    const path1 = `product-images/${PRODUCT_DRAFT}/img1.webp`;
    const path2 = `product-images/${PRODUCT_DRAFT}/img2.webp`;
    const img1 = await productRepository.addImage({
      productId: PRODUCT_DRAFT,
      path: path1,
      position: 0,
    });
    const img2 = await productRepository.addImage({
      productId: PRODUCT_DRAFT,
      path: path2,
      position: 1,
    });
    await productRepository.setPrimaryImageIfNull({ productId: PRODUCT_DRAFT, path: path1 });

    await buildUseCase().execute({
      productId: PRODUCT_DRAFT,
      imageId: img1.id,
      sellerId: SELLER,
      accessToken: ACCESS_TOKEN,
    });

    expect(await getImageRow(img1.id)).toBeUndefined();
    expect(await getImageRow(img2.id)).toBeDefined();

    const productRow = await getProductRow(PRODUCT_DRAFT);
    expect(productRow.primary_image_path).toBe(path2);
  });

  it('3. happy path draft delete LAST (only) image: deletes image, sets primary_image_path to NULL', async () => {
    const path1 = `product-images/${PRODUCT_DRAFT}/only.webp`;
    const img1 = await productRepository.addImage({
      productId: PRODUCT_DRAFT,
      path: path1,
      position: 0,
    });
    await productRepository.setPrimaryImageIfNull({ productId: PRODUCT_DRAFT, path: path1 });

    await buildUseCase().execute({
      productId: PRODUCT_DRAFT,
      imageId: img1.id,
      sellerId: SELLER,
      accessToken: ACCESS_TOKEN,
    });

    expect(await getImageRow(img1.id)).toBeUndefined();
    const productRow = await getProductRow(PRODUCT_DRAFT);
    expect(productRow.primary_image_path).toBeNull();
  });

  it('4. published product with 2 images: deleting non-primary succeeds and primary unchanged', async () => {
    const path1 = `product-images/${PRODUCT_PUBLISHED}/pub1.webp`;
    const path2 = `product-images/${PRODUCT_PUBLISHED}/pub2.webp`;
    const img1 = await productRepository.addImage({
      productId: PRODUCT_PUBLISHED,
      path: path1,
      position: 0,
    });
    const img2 = await productRepository.addImage({
      productId: PRODUCT_PUBLISHED,
      path: path2,
      position: 1,
    });
    await productRepository.setPrimaryImageIfNull({ productId: PRODUCT_PUBLISHED, path: path1 });

    await buildUseCase().execute({
      productId: PRODUCT_PUBLISHED,
      imageId: img2.id,
      sellerId: SELLER,
      accessToken: ACCESS_TOKEN,
    });

    expect(await getImageRow(img2.id)).toBeUndefined();
    expect(await getImageRow(img1.id)).toBeDefined();
    const productRow = await getProductRow(PRODUCT_PUBLISHED);
    expect(productRow.primary_image_path).toBe(path1);
  });

  it('5. published product with 2 images: deleting primary succeeds and promotes remaining image', async () => {
    const path1 = `product-images/${PRODUCT_PUBLISHED}/pub1.webp`;
    const path2 = `product-images/${PRODUCT_PUBLISHED}/pub2.webp`;
    const img1 = await productRepository.addImage({
      productId: PRODUCT_PUBLISHED,
      path: path1,
      position: 0,
    });
    const img2 = await productRepository.addImage({
      productId: PRODUCT_PUBLISHED,
      path: path2,
      position: 1,
    });
    await productRepository.setPrimaryImageIfNull({ productId: PRODUCT_PUBLISHED, path: path1 });

    await buildUseCase().execute({
      productId: PRODUCT_PUBLISHED,
      imageId: img1.id,
      sellerId: SELLER,
      accessToken: ACCESS_TOKEN,
    });

    expect(await getImageRow(img1.id)).toBeUndefined();
    expect(await getImageRow(img2.id)).toBeDefined();
    const productRow = await getProductRow(PRODUCT_PUBLISHED);
    expect(productRow.primary_image_path).toBe(path2);
  });

  it('6. published product with 1 image (last): fails with 409 INVALID_STATE_TRANSITION and DB unchanged', async () => {
    const path1 = `product-images/${PRODUCT_PUBLISHED}/last.webp`;
    const img1 = await productRepository.addImage({
      productId: PRODUCT_PUBLISHED,
      path: path1,
      position: 0,
    });
    await productRepository.setPrimaryImageIfNull({ productId: PRODUCT_PUBLISHED, path: path1 });

    await expect(
      buildUseCase().execute({
        productId: PRODUCT_PUBLISHED,
        imageId: img1.id,
        sellerId: SELLER,
        accessToken: ACCESS_TOKEN,
      })
    ).rejects.toMatchObject({
      code: 'INVALID_STATE_TRANSITION',
      statusCode: 409,
      message: 'Cannot delete the last image of a published product. Unpublish it first.',
    });

    expect(await getImageRow(img1.id)).toBeDefined();
    const productRow = await getProductRow(PRODUCT_PUBLISHED);
    expect(productRow.primary_image_path).toBe(path1);
  });

  it('7. unpublished product: deleting last image succeeds and sets primary_image_path to NULL', async () => {
    const path1 = `product-images/${PRODUCT_UNPUBLISHED}/unpub.webp`;
    const img1 = await productRepository.addImage({
      productId: PRODUCT_UNPUBLISHED,
      path: path1,
      position: 0,
    });
    await productRepository.setPrimaryImageIfNull({ productId: PRODUCT_UNPUBLISHED, path: path1 });

    await buildUseCase().execute({
      productId: PRODUCT_UNPUBLISHED,
      imageId: img1.id,
      sellerId: SELLER,
      accessToken: ACCESS_TOKEN,
    });

    expect(await getImageRow(img1.id)).toBeUndefined();
    const productRow = await getProductRow(PRODUCT_UNPUBLISHED);
    expect(productRow.primary_image_path).toBeNull();
  });

  it('8. archived product: deleting last image succeeds', async () => {
    const path1 = `product-images/${PRODUCT_ARCHIVED}/arch.webp`;
    const img1 = await productRepository.addImage({
      productId: PRODUCT_ARCHIVED,
      path: path1,
      position: 0,
    });
    await productRepository.setPrimaryImageIfNull({ productId: PRODUCT_ARCHIVED, path: path1 });

    await buildUseCase().execute({
      productId: PRODUCT_ARCHIVED,
      imageId: img1.id,
      sellerId: SELLER,
      accessToken: ACCESS_TOKEN,
    });

    expect(await getImageRow(img1.id)).toBeUndefined();
  });

  it('9. wrong seller: fails with 403 FORBIDDEN and leaves DB unchanged', async () => {
    const path1 = `product-images/${PRODUCT_OTHER_SELLER}/other.webp`;
    const img1 = await productRepository.addImage({
      productId: PRODUCT_OTHER_SELLER,
      path: path1,
      position: 0,
    });

    await expect(
      buildUseCase().execute({
        productId: PRODUCT_OTHER_SELLER,
        imageId: img1.id,
        sellerId: SELLER,
        accessToken: ACCESS_TOKEN,
      })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
      message: 'You do not own this product',
    });

    expect(await getImageRow(img1.id)).toBeDefined();
  });

  it('10. image of another product: returns 404 PRODUCT_NOT_FOUND without deleting image', async () => {
    const path1 = `product-images/${PRODUCT_DRAFT}/draft.webp`;
    const img1 = await productRepository.addImage({
      productId: PRODUCT_DRAFT,
      path: path1,
      position: 0,
    });

    // Request with PRODUCT_PUBLISHED in URL but img1 belonging to PRODUCT_DRAFT
    await expect(
      buildUseCase().execute({
        productId: PRODUCT_PUBLISHED,
        imageId: img1.id,
        sellerId: SELLER,
        accessToken: ACCESS_TOKEN,
      })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product image not found',
    });

    expect(await getImageRow(img1.id)).toBeDefined();
  });

  it('11. unknown image UUID: returns 404 PRODUCT_NOT_FOUND', async () => {
    await expect(
      buildUseCase().execute({
        productId: PRODUCT_DRAFT,
        imageId: '99999999-9999-4999-8999-999999999999',
        sellerId: SELLER,
        accessToken: ACCESS_TOKEN,
      })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product image not found',
    });
  });

  it('12. soft-deleted product: returns 404 PRODUCT_NOT_FOUND', async () => {
    const path1 = `product-images/${PRODUCT_SOFT_DELETED}/soft.webp`;
    const img1 = await productRepository.addImage({
      productId: PRODUCT_SOFT_DELETED,
      path: path1,
      position: 0,
    });

    await expect(
      buildUseCase().execute({
        productId: PRODUCT_SOFT_DELETED,
        imageId: img1.id,
        sellerId: SELLER,
        accessToken: ACCESS_TOKEN,
      })
    ).rejects.toMatchObject({
      code: 'PRODUCT_NOT_FOUND',
      statusCode: 404,
      message: 'Product not found',
    });

    expect(await getImageRow(img1.id)).toBeDefined();
  });

  it('13. after delete: listImages does not include deleted row', async () => {
    const path1 = `product-images/${PRODUCT_DRAFT}/a.webp`;
    const path2 = `product-images/${PRODUCT_DRAFT}/b.webp`;
    const img1 = await productRepository.addImage({
      productId: PRODUCT_DRAFT,
      path: path1,
      position: 0,
    });
    const img2 = await productRepository.addImage({
      productId: PRODUCT_DRAFT,
      path: path2,
      position: 1,
    });

    await buildUseCase().execute({
      productId: PRODUCT_DRAFT,
      imageId: img1.id,
      sellerId: SELLER,
      accessToken: ACCESS_TOKEN,
    });

    const images = await productRepository.listImages(PRODUCT_DRAFT);
    expect(images.map((i) => i.id)).toEqual([img2.id]);
  });

  it('14. storage failure tolerated: returns 200-equivalent and DB row is deleted', async () => {
    const path1 = `product-images/${PRODUCT_DRAFT}/storage-fail.webp`;
    const img1 = await productRepository.addImage({
      productId: PRODUCT_DRAFT,
      path: path1,
      position: 0,
    });

    const failingStorageService = {
      deleteProductImage: vi.fn().mockResolvedValue({
        deleted: false,
        error: new Error('network'),
      }),
    };

    const result = await buildUseCase(failingStorageService).execute({
      productId: PRODUCT_DRAFT,
      imageId: img1.id,
      sellerId: SELLER,
      accessToken: ACCESS_TOKEN,
    });

    expect(result).toEqual({ meta: { timestamp: expect.any(String) } });
    expect(await getImageRow(img1.id)).toBeUndefined();
    expect(failingStorageService.deleteProductImage).toHaveBeenCalledWith(ACCESS_TOKEN, path1);
  });
});
