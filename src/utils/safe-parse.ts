/**
 * Safe JSON Parsing Utilities
 * Prevents crashes from corrupted data in KV
 */

/**
 * Safely parse JSON with fallback
 */
export function safeJsonParse<T>(json: string, fallback?: T): T | null {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    console.error('JSON parse error:', error);
    return fallback ?? null;
  }
}

/**
 * Safely parse JSON with type guard
 */
export function parseOrThrow<T>(json: string, typeName: string): T {
  try {
    return JSON.parse(json) as T;
  } catch (error) {
    throw new Error(`Failed to parse ${typeName}: ${error}`);
  }
}

/**
 * Safely parse with validation
 */
export function parseWithValidator<T>(
  json: string,
  validator: (data: any) => data is T,
  errorMessage: string
): T {
  try {
    const data = JSON.parse(json);
    if (validator(data)) {
      return data;
    }
    throw new Error(errorMessage);
  } catch (error) {
    throw new Error(`${errorMessage}: ${error}`);
  }
}