/**
 * Safe parsing utilities to prevent crashes from malformed data
 */

/**
 * Safely parse JSON, returning null on failure instead of throwing
 */
export function safeJsonParse<T = unknown>(
  json: string | null | undefined,
): T | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

/**
 * Safely parse JSON with a default value
 */
export function safeJsonParseWithDefault<T>(
  json: string | null | undefined,
  defaultValue: T,
): T {
  const result = safeJsonParse<T>(json);
  return result !== null ? result : defaultValue;
}

/**
 * Safely decode base64, returning null on failure
 */
export function safeAtob(encoded: string | null | undefined): string | null {
  if (!encoded) return null;
  try {
    return atob(encoded);
  } catch {
    return null;
  }
}

/**
 * Safely encode to base64, returning null on failure
 */
export function safeBtoa(data: string | null | undefined): string | null {
  if (!data) return null;
  try {
    return btoa(data);
  } catch {
    return null;
  }
}

/**
 * Parse cursor string (base64 encoded JSON) safely
 */
export function safeParseCursor<T = { offset: number }>(
  cursor: string | null | undefined,
): T | null {
  const decoded = safeAtob(cursor);
  return safeJsonParse<T>(decoded);
}

/**
 * Create cursor string safely
 */
export function safeCreateCursor(
  data: { offset: number } | Record<string, unknown>,
): string {
  try {
    return btoa(JSON.stringify(data));
  } catch {
    return btoa(JSON.stringify({ offset: 0 }));
  }
}
