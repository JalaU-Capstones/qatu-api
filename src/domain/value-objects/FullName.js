export class FullName {
  /**
   * @param {string} value
   */
  constructor(value) {
    if (!value || typeof value !== 'string') {
      throw new Error('Full name is required');
    }
    const trimmed = value.trim();
    if (trimmed.length < 2 || trimmed.length > 100) {
      throw new Error('Full name must be between 2 and 100 characters long.');
    }
    this.value = trimmed;
  }

  getValue() {
    return this.value;
  }
}
