/**
 * Client-side validation mirroring backend rules
 */

const Validation = {
  // Email validation
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length <= 255;
  },

  // Password validation (min 8 chars)
  isValidPassword(password) {
    if (!password || typeof password !== 'string') return false;
    return password.length >= 8 && password.length <= 128;
  },

  // Strong password (has uppercase, lowercase, number)
  isStrongPassword(password) {
    if (!this.isValidPassword(password)) return false;
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    return hasUpper && hasLower && hasNumber;
  },

  // Handle validation (3-15 chars, alphanumeric + underscore)
  isValidHandle(handle) {
    if (!handle || typeof handle !== 'string') return false;
    const handleRegex = /^[a-zA-Z0-9_]{3,15}$/;
    return handleRegex.test(handle);
  },

  // Display name validation (1-50 chars)
  isValidDisplayName(name) {
    if (!name || typeof name !== 'string') return false;
    return name.length >= 1 && name.length <= 50;
  },

  // Bio validation (max 160 chars)
  isValidBio(bio) {
    if (bio === null || bio === undefined) return true; // Optional
    if (typeof bio !== 'string') return false;
    return bio.length <= 160;
  },

  // Note/post content validation (max 280 chars)
  isValidNoteContent(content) {
    if (!content || typeof content !== 'string') return false;
    const trimmed = content.trim();
    return trimmed.length >= 1 && trimmed.length <= 280;
  },

  // URL validation
  isValidUrl(url) {
    if (!url) return true; // Optional
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },

  // Get validation error message
  getErrorMessage(field, value) {
    switch (field) {
      case 'email':
        if (!value) return 'Email is required';
        if (!this.isValidEmail(value)) return 'Please enter a valid email address';
        break;
      case 'password':
        if (!value) return 'Password is required';
        if (value.length < 8) return 'Password must be at least 8 characters';
        if (value.length > 128) return 'Password must be less than 128 characters';
        if (!this.isStrongPassword(value)) return 'Password must contain uppercase, lowercase, and a number';
        break;
      case 'handle':
        if (!value) return 'Handle is required';
        if (!this.isValidHandle(value)) return 'Handle must be 3-15 characters (letters, numbers, underscores)';
        break;
      case 'content':
        if (!value || !value.trim()) return 'Content is required';
        if (value.length > 280) return 'Content must be 280 characters or less';
        break;
      default:
        return null;
    }
    return null;
  },

  // Validate a form and return errors
  validateForm(fields) {
    const errors = {};
    for (const [field, value] of Object.entries(fields)) {
      const error = this.getErrorMessage(field, value);
      if (error) errors[field] = error;
    }
    return Object.keys(errors).length > 0 ? errors : null;
  }
};

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Validation };
}
