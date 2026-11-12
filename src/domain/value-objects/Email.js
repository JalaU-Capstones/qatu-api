const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  /**
   * @param {string} value
   */
  constructor(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('Email is required');
    }
    const trimmed = value.trim();
    if (!EMAIL_REGEX.test(trimmed)) {
      throw new Error('Invalid email format');
    }
    this.value = trimmed.toLowerCase();
  }

  getValue() {
    return this.value;
  }

  equals(other) {
    return other instanceof Email && this.value === other.value;
  }
}
