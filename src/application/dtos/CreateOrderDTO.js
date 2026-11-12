const MAX_NOTES_LENGTH = 500;
export const PAYMENT_METHODS = ['simulated', 'cash_on_delivery'];
export const PHONE_PATTERN = /^[0-9+()\-\s]{6,20}$/;

const validationError = (message) => {
  const err = new Error(message);
  err.statusCode = 400;
  err.code = 'VALIDATION_ERROR';
  return err;
};

const requireText = (value, field) => {
  if (typeof value !== 'string' || value.trim() === '') {
    throw validationError(`shipping_address.${field} is invalid`);
  }
  return value.trim();
};

const optionalText = (value) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null;

// The buyer id always comes from the session, never from the body.
export class CreateOrderRequestDTO {
  constructor({ buyerId, shippingAddress, paymentMethod = 'simulated', notes } = {}) {
    if (!buyerId || typeof buyerId !== 'string' || buyerId.trim() === '') {
      throw validationError('buyerId is missing');
    }
    if (!shippingAddress || typeof shippingAddress !== 'object') {
      throw validationError('shipping_address is invalid');
    }
    if (!PAYMENT_METHODS.includes(paymentMethod)) {
      throw validationError('payment_method is invalid');
    }

    const phone = requireText(shippingAddress.phone, 'phone');
    if (!PHONE_PATTERN.test(phone)) {
      throw validationError('shipping_address.phone is invalid');
    }

    this.buyerId = buyerId.trim();
    this.paymentMethod = paymentMethod;
    this.shippingAddress = {
      full_name: requireText(shippingAddress.full_name, 'full_name'),
      phone,
      street: requireText(shippingAddress.street, 'street'),
      city: requireText(shippingAddress.city, 'city'),
      state: optionalText(shippingAddress.state),
      postal_code: optionalText(shippingAddress.postal_code),
      country: requireText(shippingAddress.country, 'country').toUpperCase(),
    };

    const trimmedNotes = optionalText(notes);
    if (trimmedNotes && trimmedNotes.length > MAX_NOTES_LENGTH) {
      throw validationError(`notes must be at most ${MAX_NOTES_LENGTH} characters`);
    }
    this.notes = trimmedNotes;

    Object.freeze(this.shippingAddress);
    Object.freeze(this);
  }
}
