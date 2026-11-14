/**
 * AASHVO Unified REST API Client
 *
 * Provides a strongly-typed HTTP interface to the independent NestJS backend (/api/v1).
 * Features:
 * - Automatic Authorization: Bearer <access_jwt> header injection.
 * - Automatic credentials: 'include' for RFC 6265bis __Host- HTTP-only refresh cookies.
 * - Automatic 401 interception & session family refresh retry.
 * - Correlation tracing with X-Request-ID generation.
 * - Canonical error envelope unwrapping.
 */

export interface ApiErrorPayload {
  statusCode: number;
  error: {
    code: string;
    message: string;
    requestId?: string;
    timestamp?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly requestId?: string;
  readonly details?: unknown;

  constructor(payload: ApiErrorPayload) {
    super(payload.error?.message || `HTTP ${payload.statusCode} Error`);
    this.name = 'ApiError';
    this.statusCode = payload.statusCode;
    this.code = payload.error?.code || 'UNKNOWN_ERROR';
    this.requestId = payload.error?.requestId;
    this.details = payload.error?.details;
  }
}

class ApiClient {
  private accessToken: string | null = null;
  private isRefreshing = false;
  private refreshSubscribers: Array<(token: string | null) => void> = [];

  constructor() {
    // Restore access token from session storage if present
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        this.accessToken = window.sessionStorage.getItem('aashvo_at');
      } catch {
        // Storage restricted in private sandbox
      }
    }
  }

  public getBaseUrl(): string {
    const envUrl = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : undefined;
    return envUrl || '/api/v1';
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public setAccessToken(token: string | null): void {
    this.accessToken = token;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        if (token) {
          window.sessionStorage.setItem('aashvo_at', token);
        } else {
          window.sessionStorage.removeItem('aashvo_at');
        }
      } catch {
        // Storage restricted
      }
    }
  }

  public clearSession(): void {
    this.setAccessToken(null);
  }

  private onRefreshed(token: string | null): void {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  private subscribeTokenRefresh(cb: (token: string | null) => void): void {
    this.refreshSubscribers.push(cb);
  }

  public async request<T = unknown>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const baseUrl = this.getBaseUrl();
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    const url = path.startsWith('http') ? path : `${baseUrl}${cleanPath}`;

    const headers = new Headers(options.headers || {});
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json');
    }
    if (!headers.has('X-Request-ID')) {
      headers.set('X-Request-ID', `req_${Math.random().toString(36).substring(2, 12)}`);
    }

    if (this.accessToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.accessToken}`);
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: options.credentials || 'include',
    });

    // 401 Token Refresh Interceptor (except for auth routes themselves)
    if (
      response.status === 401 &&
      !cleanPath.includes('/auth/login') &&
      !cleanPath.includes('/auth/refresh') &&
      !cleanPath.includes('/auth/register')
    ) {
      if (!this.isRefreshing) {
        this.isRefreshing = true;
        try {
          const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newToken = refreshData.accessToken;
            this.setAccessToken(newToken);
            this.isRefreshing = false;
            this.onRefreshed(newToken);

            // Retry original request with new token
            headers.set('Authorization', `Bearer ${newToken}`);
            const retryRes = await fetch(url, {
              ...options,
              headers,
              credentials: 'include',
            });
            return this.handleResponse<T>(retryRes);
          } else {
            this.clearSession();
            this.isRefreshing = false;
            this.onRefreshed(null);
          }
        } catch {
          this.clearSession();
          this.isRefreshing = false;
          this.onRefreshed(null);
        }
      } else {
        // Wait for ongoing refresh to complete
        return new Promise<T>((resolve, reject) => {
          this.subscribeTokenRefresh(async (token) => {
            if (token) {
              headers.set('Authorization', `Bearer ${token}`);
              try {
                const retryRes = await fetch(url, {
                  ...options,
                  headers,
                  credentials: 'include',
                });
                resolve(await this.handleResponse<T>(retryRes));
              } catch (err) {
                reject(err);
              }
            } else {
              reject(new ApiError({
                statusCode: 401,
                error: { code: 'UNAUTHORIZED', message: 'Session expired' },
              }));
            }
          });
        });
      }
    }

    return this.handleResponse<T>(response);
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    let body: unknown;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      try {
        body = await response.json();
      } catch {
        body = null;
      }
    } else {
      body = await response.text();
    }

    if (!response.ok) {
      const errorPayload = typeof body === 'object' && body !== null && 'error' in body
        ? (body as ApiErrorPayload)
        : {
            statusCode: response.status,
            error: {
              code: 'HTTP_ERROR',
              message: typeof body === 'string' ? body : response.statusText,
            },
          };
      throw new ApiError(errorPayload as ApiErrorPayload);
    }

    return body as T;
  }

  public get<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  public post<T>(path: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  }

  public patch<T>(path: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PATCH',
      body: data instanceof FormData ? data : JSON.stringify(data),
    });
  }

  public delete<T>(path: string, options?: RequestInit): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();

