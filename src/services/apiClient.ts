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
  private refreshToken: string | null = null;
  private refreshPromise: Promise<string | null> | null = null;
  private refreshFailed = false;

  constructor() {
    // Restore access token from session storage if present (refresh token is strictly NOT stored in Web Storage)
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
    if (!envUrl) return '/api/v1';
    const trimmed = envUrl.replace(/\/+$/, '');
    if (!trimmed.endsWith('/api/v1')) {
      return `${trimmed}/api/v1`;
    }
    return trimmed;
  }

  public getAccessToken(): string | null {
    return this.accessToken;
  }

  public getRefreshToken(): string | null {
    return this.refreshToken;
  }

  public setAccessToken(token: string | null, refreshToken?: string | null): void {
    this.accessToken = token;
    if (refreshToken !== undefined) {
      this.refreshToken = refreshToken;
    }
    if (token) {
      this.refreshFailed = false; // Reset failure latch on successful login or token renewal
    }
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
    this.accessToken = null;
    this.refreshToken = null;
    this.refreshPromise = null;
    this.refreshFailed = true; // Permanent latch: do not repeatedly attempt refresh after session termination
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        window.sessionStorage.removeItem('aashvo_at');
      } catch {
        // Storage restricted
      }
    }
  }

  /**
   * Performs a single-flight token rotation.
   * If a refresh request is already in flight, all concurrent callers await the same promise.
   */
  private async performTokenRefresh(baseUrl: string): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshRes = await fetch(`${baseUrl}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            refreshToken: this.refreshToken || undefined,
          }),
        });

        if (refreshRes.ok) {
          const refreshData = await refreshRes.json();
          const newToken = refreshData.accessToken as string;
          const newRefreshToken = refreshData.refreshToken as string | undefined;
          this.setAccessToken(newToken, newRefreshToken);
          return newToken;
        } else {
          this.clearSession();
          return null;
        }
      } catch {
        this.clearSession();
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  public async request<T = unknown>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const baseUrl = this.getBaseUrl();
    let cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (cleanPath.startsWith('/api/v1/')) {
      cleanPath = cleanPath.substring('/api/v1'.length);
    }
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

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        headers,
        credentials: options.credentials || 'include',
      });
    } catch (fetchErr: unknown) {
      const errMsg = fetchErr instanceof Error ? fetchErr.message : 'Network error';
      throw new ApiError({
        statusCode: 503,
        error: {
          code: 'BACKEND_CONNECTIVITY_ERROR',
          message: 'Unable to connect to Aashvo services. If the server was sleeping, please allow a few seconds for it to wake up and try again.',
          details: errMsg,
        },
      });
    }

    // 401 Token Refresh Interceptor (except for auth routes themselves)
    // Only attempt refresh if the client previously possessed a session!
    const hasPriorSession = Boolean(this.accessToken || this.refreshToken);
    if (
      response.status === 401 &&
      hasPriorSession &&
      !this.refreshFailed &&
      !cleanPath.includes('/auth/login') &&
      !cleanPath.includes('/auth/refresh') &&
      !cleanPath.includes('/auth/register')
    ) {
      const newToken = await this.performTokenRefresh(baseUrl);
      if (newToken) {
        // Retry original request with new token
        headers.set('Authorization', `Bearer ${newToken}`);
        const retryRes = await fetch(url, {
          ...options,
          headers,
          credentials: options.credentials || 'include',
        });
        return this.handleResponse<T>(retryRes);
      } else {
        throw new ApiError({
          statusCode: 401,
          error: { code: 'UNAUTHORIZED', message: 'Session expired. Please sign in again.' },
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

  public put<T>(path: string, data?: unknown, options?: RequestInit): Promise<T> {
    return this.request<T>(path, {
      ...options,
      method: 'PUT',
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

