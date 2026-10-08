const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;

export class Username {
  /**
   * @param {string} value
   */
  constructor(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('Username is required');
    }
    const trimmed = value.trim();
    if (!USERNAME_REGEX.test(trimmed)) {
      throw new Error(
        'Username must be between 3 and 30 characters and contain only alphanumeric characters and underscores.'
      );
    }
    this.value = trimmed;
  }

  getValue() {
    return this.value;
  }

  equals(other) {
    return other instanceof Username && this.value === other.value;
  }
}
