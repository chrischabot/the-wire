/**
 * Input validation utilities
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }

  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Email is required' };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: 'Email is too long' };
  }

  // Basic email regex - covers most valid emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Invalid email format' };
  }

  return { valid: true };
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): ValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, error: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (password.length > 128) {
    return { valid: false, error: 'Password is too long' };
  }

  // Check for at least one uppercase, one lowercase, and one number
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  if (!hasUppercase || !hasLowercase || !hasNumber) {
    return {
      valid: false,
      error: 'Password must contain uppercase, lowercase, and number',
    };
  }

  return { valid: true };
}

/**
 * Validate handle (username) format
 */
export function validateHandle(handle: string): ValidationResult {
  if (!handle || typeof handle !== 'string') {
    return { valid: false, error: 'Handle is required' };
  }

  const trimmed = handle.trim().toLowerCase();

  if (trimmed.length < 3) {
    return { valid: false, error: 'Handle must be at least 3 characters' };
  }

  if (trimmed.length > 15) {
    return { valid: false, error: 'Handle must be at most 15 characters' };
  }

  // Only allow alphanumeric and underscores
  const handleRegex = /^[a-z0-9_]+$/;
  if (!handleRegex.test(trimmed)) {
    return {
      valid: false,
      error: 'Handle can only contain letters, numbers, and underscores',
    };
  }

  // Can't start with underscore
  if (trimmed.startsWith('_')) {
    return { valid: false, error: 'Handle cannot start with underscore' };
  }

  // Reserved handles
  const reserved = [
    'admin', 'root', 'system', 'api', 'www', 'mail', 'support',
    'help', 'info', 'contact', 'about', 'home', 'settings',
    'login', 'logout', 'signup', 'register', 'thewire', 'wire',
  ];
  if (reserved.includes(trimmed)) {
    return { valid: false, error: 'This handle is reserved' };
  }

  return { valid: true };
}

/**
 * Validate note (post) content
 */
export function validateNoteContent(content: string, maxLength: number = 280): ValidationResult {
  if (!content || typeof content !== 'string') {
    return { valid: false, error: 'Content is required' };
  }

  const trimmed = content.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Content cannot be empty' };
  }

  if (trimmed.length > maxLength) {
    return { valid: false, error: `Content exceeds ${maxLength} characters` };
  }

  return { valid: true };
}

/**
 * Validate display name
 */
export function validateDisplayName(name: string): ValidationResult {
  if (!name || typeof name !== 'string') {
    return { valid: true }; // Display name is optional
  }

  const trimmed = name.trim();

  if (trimmed.length > 50) {
    return { valid: false, error: 'Display name must be at most 50 characters' };
  }

  return { valid: true };
}

/**
 * Validate bio
 */
export function validateBio(bio: string): ValidationResult {
  if (!bio || typeof bio !== 'string') {
    return { valid: true }; // Bio is optional
  }

  const trimmed = bio.trim();

  if (trimmed.length > 160) {
    return { valid: false, error: 'Bio must be at most 160 characters' };
  }

  return { valid: true };
}

/**
 * Sanitize string input (trim and remove null bytes)
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return input.trim().replace(/\0/g, '');
}

/**
 * Normalize email (lowercase and trim)
 */
export function normalizeEmail(email: string): string {
  return sanitizeString(email).toLowerCase();
}

/**
 * Normalize handle (lowercase and trim)
 */
export function normalizeHandle(handle: string): string {
  return sanitizeString(handle).toLowerCase();
}