/**
 * Response helper utilities for consistent API responses
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Create a successful JSON response
 */
export function success<T>(data: T, status = 200): Response {
  const body: ApiResponse<T> = {
    success: true,
    data,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error JSON response
 */
export function error(message: string, status = 400): Response {
  const body: ApiResponse = {
    success: false,
    error: message,
  };
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create a 404 Not Found response
 */
export function notFound(message = 'Not found'): Response {
  return error(message, 404);
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorized(message = 'Unauthorized'): Response {
  return error(message, 401);
}

/**
 * Create a 403 Forbidden response
 */
export function forbidden(message = 'Forbidden'): Response {
  return error(message, 403);
}

/**
 * Create a 500 Internal Server Error response
 */
export function serverError(message = 'Internal server error'): Response {
  return error(message, 500);
}

/**
 * Create a redirect response
 */
export function redirect(url: string, status: 301 | 302 | 307 | 308 = 302): Response {
  return new Response(null, {
    status,
    headers: {
      Location: url,
    },
  });
}

/**
 * Create an HTML response
 */
export function html(content: string, status = 200): Response {
  return new Response(content, {
    status,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}