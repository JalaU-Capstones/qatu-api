import { Router } from 'express';
import { CreateProductUseCase } from '../../application/use-cases/CreateProductUseCase.js';
import { DeleteProductImageUseCase } from '../../application/use-cases/DeleteProductImageUseCase.js';
import { DeleteProductUseCase } from '../../application/use-cases/DeleteProductUseCase.js';
import { GetProductDetailUseCase } from '../../application/use-cases/GetProductDetailUseCase.js';
import { ListProductImagesUseCase } from '../../application/use-cases/ListProductImagesUseCase.js';
import { ListProductsUseCase } from '../../application/use-cases/ListProductsUseCase.js';
import { PublishProductUseCase } from '../../application/use-cases/PublishProductUseCase.js';
import { UnpublishProductUseCase } from '../../application/use-cases/UnpublishProductUseCase.js';
import { UpdateProductUseCase } from '../../application/use-cases/UpdateProductUseCase.js';
import { UploadProductImageUseCase } from '../../application/use-cases/UploadProductImageUseCase.js';
import { ProductRepository } from '../../infrastructure/persistence/repositories/ProductRepository.js';
import { SupabaseStorageService } from '../../infrastructure/storage/SupabaseStorageService.js';
import { ProductController } from '../controllers/ProductController.js';
import { authMiddleware } from '../middleware/authMiddleware.js';
import { multipartProductImageMiddleware } from '../middleware/multipartProductImageMiddleware.js';
import { optionalAuthMiddleware } from '../middleware/optionalAuthMiddleware.js';
import { requireSellerRole } from '../middleware/requireSellerRole.js';
import { validateRequest } from '../middleware/validateRequest.js';
import { createProductSchema } from '../validators/createProductSchema.js';
import { listProductsSchema } from '../validators/listProductsSchema.js';
import { updateProductSchema } from '../validators/updateProductSchema.js';

export function createProductRouter({
  productRepository = new ProductRepository(),
  listProductsUseCase,
  getProductByIdUseCase,
  createProductUseCase,
  publishProductUseCase,
  unpublishProductUseCase,
  updateProductUseCase,
  deleteProductUseCase,
  deleteProductImageUseCase,
  uploadProductImageUseCase,
  listProductImagesUseCase,
  storageService = new SupabaseStorageService(),
  productController,
} = {}) {
  const router = Router();

  const listUC =
    listProductsUseCase ||
    new ListProductsUseCase({
      productRepository,
    });

  const getByIdUC =
    getProductByIdUseCase ||
    new GetProductDetailUseCase({
      productRepository,
    });

  const createUC =
    createProductUseCase ||
    new CreateProductUseCase({
      productRepository,
    });

  const publishUC =
    publishProductUseCase ||
    new PublishProductUseCase({
      productRepository,
    });

  const unpublishUC =
    unpublishProductUseCase ||
    new UnpublishProductUseCase({
      productRepository,
    });

  const updateUC =
    updateProductUseCase ||
    new UpdateProductUseCase({
      productRepository,
    });

  const deleteUC =
    deleteProductUseCase ||
    new DeleteProductUseCase({
      productRepository,
    });

  const deleteImageUC =
    deleteProductImageUseCase ||
    new DeleteProductImageUseCase({
      productRepository,
      storageService,
    });

  const productImageUC =
    uploadProductImageUseCase ||
    new UploadProductImageUseCase({
      productRepository,
      storageService,
    });

  const listImagesUC =
    listProductImagesUseCase ||
    new ListProductImagesUseCase({
      productRepository,
    });

  const controller =
    productController ||
    new ProductController({
      listProductsUseCase: listUC,
      getProductByIdUseCase: getByIdUC,
      createProductUseCase: createUC,
      publishProductUseCase: publishUC,
      unpublishProductUseCase: unpublishUC,
      updateProductUseCase: updateUC,
      deleteProductUseCase: deleteUC,
      deleteProductImageUseCase: deleteImageUC,
      uploadProductImageUseCase: productImageUC,
      listProductImagesUseCase: listImagesUC,
    });

  router.post(
    '/',
    authMiddleware,
    requireSellerRole(),
    validateRequest(createProductSchema, { source: 'body' }),
    (req, res, next) => controller.create(req, res, next)
  );

  router.get('/', validateRequest(listProductsSchema, { source: 'query' }), (req, res, next) =>
    controller.list(req, res, next)
  );

  router.get('/:id', optionalAuthMiddleware, (req, res, next) =>
    controller.getById(req, res, next)
  );

  router.patch('/:id/publish', authMiddleware, requireSellerRole(), (req, res, next) =>
    controller.publish(req, res, next)
  );

  router.patch('/:id/unpublish', authMiddleware, requireSellerRole(), (req, res, next) =>
    controller.unpublish(req, res, next)
  );

  router.patch(
    '/:id',
    authMiddleware,
    requireSellerRole(),
    validateRequest(updateProductSchema, { source: 'body' }),
    (req, res, next) => controller.update(req, res, next)
  );

  router.delete('/:id', authMiddleware, requireSellerRole(), (req, res, next) =>
    controller.remove(req, res, next)
  );

  router.post(
    '/:id/images',
    authMiddleware,
    requireSellerRole(),
    multipartProductImageMiddleware,
    (req, res, next) => controller.uploadImage(req, res, next)
  );

  router.get('/:id/images', (req, res, next) => controller.listImages(req, res, next));

  router.delete('/:id/images/:imageId', authMiddleware, requireSellerRole(), (req, res, next) =>
    controller.deleteImage(req, res, next)
  );

  return router;
}

export const productRouter = createProductRouter();
