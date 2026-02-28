/**
 * nativeHttp.ts
 *
 * A thin axios-compatible adapter that routes all HTTP requests through
 * CapacitorHttp (OkHttp on Android, NSURLSession on iOS) instead of the
 * WebView's fetch/XMLHttpRequest stack.
 *
 * This bypasses the Android WebView's SSL/CORS restrictions that cause
 * ERR_NETWORK errors when the WebView origin (https://localhost) does not
 * match the server's certificate expectations.
 *
 * The interface mirrors the subset of axios used in client.ts:
 *   - nativeHttp.get(url, config?)
 *   - nativeHttp.post(url, data?, config?)
 *   - nativeHttp.put(url, data?, config?)
 *   - nativeHttp.patch(url, data?, config?)
 *   - nativeHttp.delete(url, config?)
 *   - nativeHttp.defaults.headers.common
 *   - nativeHttp.interceptors.response.use(onFulfilled, onRejected)
 *
 * Responses are shaped like axios responses: { data, status, headers }
 * Errors include { response: { data, status } } when the server replied,
 * or { message: 'Network Error', code: 'ERR_NETWORK' } when it did not.
 */

import { CapacitorHttp } from '@capacitor/core';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestConfig {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean>;
  responseType?: string;
  [key: string]: any;
}

interface NativeResponse {
  data: any;
  status: number;
  headers: Record<string, string>;
}

interface NativeError extends Error {
  isAxiosError: boolean;
  code?: string;
  response?: {
    data: any;
    status: number;
    headers?: Record<string, string>;
  };
}

type ResponseInterceptor = {
  onFulfilled?: (res: NativeResponse) => NativeResponse | Promise<NativeResponse>;
  onRejected?: (err: NativeError) => any;
};

// ─── Core request function ────────────────────────────────────────────────────

const BASE_URL = 'https://upwork.kowope.xyz';

const defaultHeaders: Record<string, string> = {
  'Content-Type': 'application/json',
};

const responseInterceptors: ResponseInterceptor[] = [];

function buildUrl(path: string): string {
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path}`;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  return { ...defaultHeaders, ...(extra || {}) };
}

function buildParams(params?: Record<string, string | number | boolean>): Record<string, string> | undefined {
  if (!params) return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    result[k] = String(v);
  }
  return result;
}

function makeError(message: string, code: string, responseData?: any, status?: number): NativeError {
  const err = new Error(message) as NativeError;
  err.isAxiosError = true;
  err.code = code;
  if (responseData !== undefined && status !== undefined) {
    err.response = { data: responseData, status };
  }
  return err;
}

async function request(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  url: string,
  data?: any,
  config?: RequestConfig
): Promise<NativeResponse> {
  const fullUrl = buildUrl(url);
  const headers = buildHeaders(config?.headers);
  const params = buildParams(config?.params);

  // Determine body: CapacitorHttp expects `data` as object for JSON,
  // or FormData for multipart. For DELETE with body, pass as data.
  let body: any = undefined;
  if (data !== undefined) {
    if (data instanceof FormData) {
      // Remove Content-Type so CapacitorHttp sets the correct multipart boundary
      delete headers['Content-Type'];
      body = data;
    } else {
      body = data;
    }
  }

  let response: any;
  try {
    response = await CapacitorHttp.request({
      method,
      url: fullUrl,
      headers,
      params,
      data: body,
    });
  } catch (err: any) {
    // Native layer threw — no response received
    const nativeErr = makeError('Network Error', 'ERR_NETWORK');
    // Run rejection interceptors
    for (const interceptor of responseInterceptors) {
      if (interceptor.onRejected) {
        return interceptor.onRejected(nativeErr);
      }
    }
    throw nativeErr;
  }

  const nativeRes: NativeResponse = {
    data: response.data,
    status: response.status,
    headers: response.headers || {},
  };

  // Non-2xx: build an error with response attached
  if (response.status < 200 || response.status >= 300) {
    const err = makeError(
      `Request failed with status code ${response.status}`,
      'ERR_BAD_RESPONSE',
      response.data,
      response.status
    );
    for (const interceptor of responseInterceptors) {
      if (interceptor.onRejected) {
        return interceptor.onRejected(err);
      }
    }
    throw err;
  }

  // Run fulfillment interceptors
  let result: NativeResponse = nativeRes;
  for (const interceptor of responseInterceptors) {
    if (interceptor.onFulfilled) {
      result = await interceptor.onFulfilled(result);
    }
  }
  return result;
}

// ─── Public API (axios-compatible) ───────────────────────────────────────────

export const nativeHttp = {
  defaults: {
    headers: {
      common: defaultHeaders,
    },
  },

  interceptors: {
    response: {
      use(
        onFulfilled?: (res: NativeResponse) => NativeResponse | Promise<NativeResponse>,
        onRejected?: (err: NativeError) => any
      ) {
        responseInterceptors.push({ onFulfilled, onRejected });
      },
    },
  },

  get: (url: string, config?: RequestConfig) =>
    request('GET', url, undefined, config),

  post: (url: string, data?: any, config?: RequestConfig) =>
    request('POST', url, data, config),

  put: (url: string, data?: any, config?: RequestConfig) =>
    request('PUT', url, data, config),

  patch: (url: string, data?: any, config?: RequestConfig) =>
    request('PATCH', url, data, config),

  delete: (url: string, config?: RequestConfig) =>
    request('DELETE', url, config?.data, config),
};
