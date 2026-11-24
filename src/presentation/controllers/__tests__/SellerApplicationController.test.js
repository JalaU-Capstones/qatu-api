import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SellerApplicationController } from '../SellerApplicationController.js';

const PROFILE_ID = '11111111-1111-4111-8111-111111111111';

function createMockResponse() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
}

describe('SellerApplicationController', () => {
  let applyAsSellerUseCase;
  let getMySellerApplicationUseCase;
  let controller;

  beforeEach(() => {
    applyAsSellerUseCase = { execute: vi.fn() };
    getMySellerApplicationUseCase = { execute: vi.fn() };
    controller = new SellerApplicationController({
      applyAsSellerUseCase,
      getMySellerApplicationUseCase,
    });
  });

  it('requires both use cases in the constructor', () => {
    expect(() => new SellerApplicationController()).toThrow('applyAsSellerUseCase is required');
    expect(() => new SellerApplicationController({ applyAsSellerUseCase })).toThrow(
      'getMySellerApplicationUseCase is required'
    );
  });

  describe('apply', () => {
    it('creates a DTO and responds with 201', async () => {
      const result = { data: { id: 'app-1' }, meta: {} };
      applyAsSellerUseCase.execute.mockResolvedValue(result);

      const req = {
        user: { id: PROFILE_ID },
        body: {
          business_name: 'Mi Tienda',
          business_description: 'Productos artesanales',
        },
      };
      const res = createMockResponse();
      const next = vi.fn();

      await controller.apply(req, res, next);

      expect(applyAsSellerUseCase.execute).toHaveBeenCalledOnce();
      expect(applyAsSellerUseCase.execute.mock.calls[0][0]).toMatchObject({
        profileId: PROFILE_ID,
        businessName: 'Mi Tienda',
        businessDescription: 'Productos artesanales',
        contactPhone: null,
        contactEmail: null,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(result);
      expect(next).not.toHaveBeenCalled();
    });

    it('combines country code and phone number for the existing application record', async () => {
      applyAsSellerUseCase.execute.mockResolvedValue({ data: { id: 'application-1' } });
      const res = createMockResponse();
      const next = vi.fn();

      await controller.apply(
        {
          user: { id: 'buyer-1' },
          validatedBody: {
            business_name: 'Tienda Andina',
            business_description: 'Artesanías elaboradas por productores locales.',
            country_code: '+591',
            phone_number: '71234567',
            contact_email: 'contacto@tienda.pe',
          },
        },
        res,
        next
      );

      expect(applyAsSellerUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ contactPhone: '+59171234567' })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(next).not.toHaveBeenCalled();
    });

    it('prefers validated body and keeps explicit contact details', async () => {
      applyAsSellerUseCase.execute.mockResolvedValue({ data: {}, meta: {} });

      const req = {
        user: { id: PROFILE_ID },
        body: { business_name: 'Raw' },
        validatedBody: {
          business_name: 'Validated',
          business_description: 'Desc',
          contact_phone: '+591 77777777',
          contact_email: 'ana@example.com',
        },
      };

      await controller.apply(req, createMockResponse(), vi.fn());

      expect(applyAsSellerUseCase.execute.mock.calls[0][0]).toMatchObject({
        businessName: 'Validated',
        contactPhone: '+591 77777777',
        contactEmail: 'ana@example.com',
      });
    });

    it('forwards an UNAUTHORIZED error when the user is missing', async () => {
      const res = createMockResponse();
      const next = vi.fn();

      await controller.apply({ user: {} }, res, next);

      expect(next).toHaveBeenCalledOnce();
      const err = next.mock.calls[0][0];
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.statusCode).toBe(401);
      expect(applyAsSellerUseCase.execute).not.toHaveBeenCalled();
    });

    it('forwards use case errors to next', async () => {
      const error = new Error('conflict');
      applyAsSellerUseCase.execute.mockRejectedValue(error);
      const next = vi.fn();

      await controller.apply(
        { user: { id: PROFILE_ID }, body: { business_name: 'Mi Tienda' } },
        createMockResponse(),
        next
      );

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getMe', () => {
    it('responds with 200 and the current application', async () => {
      const result = { data: { id: 'app-1' }, meta: {} };
      getMySellerApplicationUseCase.execute.mockResolvedValue(result);
      const res = createMockResponse();

      await controller.getMe({ user: { id: PROFILE_ID } }, res, vi.fn());

      expect(getMySellerApplicationUseCase.execute).toHaveBeenCalledWith({
        profileId: PROFILE_ID,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(result);
    });

    it('forwards an UNAUTHORIZED error when the user is missing', async () => {
      const next = vi.fn();

      await controller.getMe({}, createMockResponse(), next);

      const err = next.mock.calls[0][0];
      expect(err.code).toBe('UNAUTHORIZED');
      expect(err.statusCode).toBe(401);
      expect(getMySellerApplicationUseCase.execute).not.toHaveBeenCalled();
    });

    it('forwards use case errors to next', async () => {
      const error = new Error('not found');
      getMySellerApplicationUseCase.execute.mockRejectedValue(error);
      const next = vi.fn();

      await controller.getMe({ user: { id: PROFILE_ID } }, createMockResponse(), next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
