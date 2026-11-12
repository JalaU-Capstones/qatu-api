import { MixedCurrencyError } from '../errors/CheckoutErrors.js';

/**
 * Same business rule the storefront cart already shows (`cartStore.js`):
 * shipping is free from US$ 50, otherwise a flat US$ 4.99. No taxes yet.
 * The backend is the source of truth; the client only mirrors it.
 */
export const FREE_SHIPPING_THRESHOLD = 50;
export const FLAT_SHIPPING_RATE = 4.99;
export const DEFAULT_TAX_RATE = 0;

/** Money is handled in integer cents so sums never accumulate float error. */
const toCents = (amount) => Math.round(Number(amount) * 100);
const fromCents = (cents) => cents / 100;

/** Turns checkout lines into subtotal, shipping, tax and total in integer cents. */
export class OrderPricingService {
  /**
   * @param {Object} [options]
   * @param {number} [options.freeShippingThreshold=FREE_SHIPPING_THRESHOLD]
   * @param {number} [options.flatShippingRate=FLAT_SHIPPING_RATE]
   * @param {number} [options.taxRate=DEFAULT_TAX_RATE] Fraction, e.g. 0.13 for 13%.
   */
  constructor({
    freeShippingThreshold = FREE_SHIPPING_THRESHOLD,
    flatShippingRate = FLAT_SHIPPING_RATE,
    taxRate = DEFAULT_TAX_RATE,
  } = {}) {
    this.freeShippingThresholdCents = toCents(freeShippingThreshold);
    this.flatShippingRateCents = toCents(flatShippingRate);
    this.taxRate = taxRate;
  }

  /**
   * @param {Array<{ productId: string, unitPrice: number, quantity: number, currency: string }>} lines
   * @returns {{ currency: string, subtotal: number, shippingCost: number, tax: number, total: number }}
   * @throws {MixedCurrencyError} when the lines do not share one currency.
   * @throws {RangeError} on an empty list or an invalid quantity/price.
   */
  calculate(lines) {
    if (!Array.isArray(lines) || lines.length === 0) {
      throw new RangeError('At least one line is required to price an order');
    }

    const currencies = new Set(lines.map((line) => line.currency));
    if (currencies.size > 1) {
      throw new MixedCurrencyError();
    }
    const [currency] = currencies;

    let subtotalCents = 0;
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity < 1) {
        throw new RangeError(`Invalid quantity for product ${line.productId}`);
      }
      const unitCents = toCents(line.unitPrice);
      if (!Number.isFinite(unitCents) || unitCents < 0) {
        throw new RangeError(`Invalid price for product ${line.productId}`);
      }
      subtotalCents += unitCents * line.quantity;
    }

    const shippingCents =
      subtotalCents >= this.freeShippingThresholdCents ? 0 : this.flatShippingRateCents;
    const taxCents = Math.round(subtotalCents * this.taxRate);
    const totalCents = subtotalCents + shippingCents + taxCents;

    return {
      currency,
      subtotal: fromCents(subtotalCents),
      shippingCost: fromCents(shippingCents),
      tax: fromCents(taxCents),
      total: fromCents(totalCents),
    };
  }
}
