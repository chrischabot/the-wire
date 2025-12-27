export interface ApiResponse<T = unknown> {
  status: number;
  body: {
    success: boolean;
    data?: T;
    error?: string;
  };
  headers: Headers;
}

export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = process.env.API_BASE_URL || 'http://localhost:8787') {
    this.baseUrl = baseUrl;
  }

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  getToken(): string | null {
    return this.token;
  }

  private buildHeaders(customHeaders?: HeadersInit): Headers {
    const headers = new Headers(customHeaders);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    return headers;
  }

  private buildUrl(path: string, params?: Record<string, string | number | boolean>): string {
    const url = new URL(path, this.baseUrl);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }
    return url.toString();
  }

  async request<T = unknown>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      params?: Record<string, string | number | boolean>;
      headers?: HeadersInit;
      skipAuth?: boolean;
    }
  ): Promise<ApiResponse<T>> {
    const headers = this.buildHeaders(options?.headers);
    if (options?.skipAuth) {
      headers.delete('Authorization');
    }

    const url = this.buildUrl(path, options?.params);

    const response = await fetch(url, {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    let body: ApiResponse<T>['body'];
    try {
      body = await response.json();
    } catch {
      body = { success: false, error: 'Invalid JSON response' };
    }

    return {
      status: response.status,
      body,
      headers: response.headers,
    };
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, string | number | boolean>
  ): Promise<ApiResponse<T>> {
    return this.request<T>('GET', path, { params });
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('POST', path, { body });
  }

  async put<T = unknown>(path: string, body?: unknown): Promise<ApiResponse<T>> {
    return this.request<T>('PUT', path, { body });
  }

  async delete<T = unknown>(path: string): Promise<ApiResponse<T>> {
    return this.request<T>('DELETE', path);
  }

  async uploadFile(
    path: string,
    file: Blob,
    fieldName: string = 'file'
  ): Promise<ApiResponse<{ id: string; url: string; type: string; mimeType: string; size: number }>> {
    const formData = new FormData();
    formData.append(fieldName, file);

    const headers = new Headers();
    if (this.token) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }
    // Don't set Content-Type - let fetch set it with boundary

    const url = this.buildUrl(path);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    let body: ApiResponse['body'];
    try {
      body = await response.json();
    } catch {
      body = { success: false, error: 'Invalid JSON response' };
    }

    return {
      status: response.status,
      body: body as ApiResponse<{ id: string; url: string; type: string; mimeType: string; size: number }>['body'],
      headers: response.headers,
    };
  }

  // Convenience method for resetting database between test suites
  async resetDatabase(): Promise<void> {
    const response = await this.post('/debug/reset');
    if (response.status !== 200) {
      throw new Error(`Failed to reset database: ${response.body.error}`);
    }
  }
}

// Singleton instance for shared state across tests
export const api = new ApiClient();

// Helper to create a fresh client for isolation
export function createApiClient(): ApiClient {
  return new ApiClient();
}
