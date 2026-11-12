export class Password {
  static REQUIREMENTS_MESSAGE =
    'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character.';

  /**
   * @param {string} value
   */
  constructor(value) {
    if (!value || typeof value !== 'string') {
      throw new Error(Password.REQUIREMENTS_MESSAGE);
    }

    if (!Password.isValid(value)) {
      throw new Error(Password.REQUIREMENTS_MESSAGE);
    }

    this.value = value;
  }

  static isValid(value) {
    if (typeof value !== 'string' || value.length < 8) {
      return false;
    }
    const hasUpperCase = /[A-Z]/.test(value);
    const hasLowerCase = /[a-z]/.test(value);
    const hasNumber = /[0-9]/.test(value);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(value);

    return hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
  }

  getValue() {
    return this.value;
  }
}
