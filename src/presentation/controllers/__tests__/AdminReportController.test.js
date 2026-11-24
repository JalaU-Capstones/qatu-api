import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminReportController } from '../AdminReportController.js';

function createResponse() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json };
}

describe('AdminReportController', () => {
  let salesUC;
  let usersUC;
  let productsUC;
  let controller;

  beforeEach(() => {
    salesUC = { execute: vi.fn() };
    usersUC = { execute: vi.fn() };
    productsUC = { execute: vi.fn() };
    controller = new AdminReportController({
      getSalesReportUseCase: salesUC,
      getUsersReportUseCase: usersUC,
      getProductsReportUseCase: productsUC,
    });
  });

  it('requires every use case in the constructor', () => {
    expect(() => new AdminReportController()).toThrow('getSalesReportUseCase is required');
    expect(() => new AdminReportController({ getSalesReportUseCase: salesUC })).toThrow(
      'getUsersReportUseCase is required'
    );
    expect(
      () =>
        new AdminReportController({
          getSalesReportUseCase: salesUC,
          getUsersReportUseCase: usersUC,
        })
    ).toThrow('getProductsReportUseCase is required');
  });

  describe('sales', () => {
    it('responds with 200 and maps the validated query', async () => {
      const result = { data: [], meta: {} };
      salesUC.execute.mockResolvedValue(result);
      const res = createResponse();

      await controller.sales(
        { validatedQuery: { from: '2026-01-01', to: '2026-01-31', group_by: 'day' } },
        res,
        vi.fn()
      );

      expect(salesUC.execute).toHaveBeenCalledWith({
        from: '2026-01-01',
        to: '2026-01-31',
        groupBy: 'day',
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(result);
    });

    it('tolerates a missing query and forwards errors', async () => {
      salesUC.execute.mockResolvedValueOnce({ data: [] });
      await controller.sales({}, createResponse(), vi.fn());
      expect(salesUC.execute).toHaveBeenCalledWith({
        from: undefined,
        to: undefined,
        groupBy: undefined,
      });

      const error = new Error('db down');
      salesUC.execute.mockRejectedValueOnce(error);
      const next = vi.fn();
      await controller.sales({}, createResponse(), next);
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('users', () => {
    it('responds with 200 and forwards errors', async () => {
      const result = { data: [], meta: {} };
      usersUC.execute.mockResolvedValueOnce(result);
      const res = createResponse();

      await controller.users({ validatedQuery: { from: 'a', to: 'b' } }, res, vi.fn());

      expect(usersUC.execute).toHaveBeenCalledWith({ from: 'a', to: 'b' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(result);

      const error = new Error('db down');
      usersUC.execute.mockRejectedValueOnce(error);
      const next = vi.fn();
      await controller.users({}, createResponse(), next);
      expect(usersUC.execute).toHaveBeenLastCalledWith({ from: undefined, to: undefined });
      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('products', () => {
    it('responds with 200 and forwards errors', async () => {
      const result = { data: [], meta: {} };
      productsUC.execute.mockResolvedValueOnce(result);
      const res = createResponse();

      await controller.products({ validatedQuery: { from: 'a', to: 'b' } }, res, vi.fn());

      expect(productsUC.execute).toHaveBeenCalledWith({ from: 'a', to: 'b' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(result);

      const error = new Error('db down');
      productsUC.execute.mockRejectedValueOnce(error);
      const next = vi.fn();
      await controller.products({}, createResponse(), next);
      expect(productsUC.execute).toHaveBeenLastCalledWith({ from: undefined, to: undefined });
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
