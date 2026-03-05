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

// ─── FormData serialization ─────────────────────────────────────────────────

/**
 * CapacitorHttp.request requires FormData to be serialized as an array of
 * CapFormDataEntry objects (the format used by Capacitor's own fetch patch).
 *
 * Each entry has the shape:
 *   { key: string, value: string, type: 'string' | 'base64File', contentType?: string, fileName?: string }
 *
 * File/Blob entries must use type: 'base64File' with the raw base64 string
 * (NOT a data URI — just the base64 content after the comma).
 * String entries use type: 'string'.
 *
 * The request must also set dataType: 'formData' so the native layer knows
 * to reconstruct a multipart/form-data body from this array.
 *
 * Reference: https://github.com/ionic-team/capacitor/blob/main/core/native-bridge.ts#L33-L52
 */
async function serializeFormData(formData: FormData): Promise<Array<Record<string, any>>> {
  const result: Array<Record<string, any>> = [];
  const entries = Array.from((formData as any).entries ? (formData as any).entries() : []);
  for (const [key, value] of entries as [string, any][]) {
    if (value instanceof Blob || value instanceof File) {
      // Read file as binary string, then btoa() to get raw base64 (no data URI prefix)
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          // reader.result is a data URI: "data:image/jpeg;base64,/9j/4AAQ..."
          // CapacitorHttp needs only the raw base64 part after the comma
          const dataUri = reader.result as string;
          const base64Only = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
          resolve(base64Only);
        };
        reader.onerror = reject;
        reader.readAsDataURL(value);
      });
      const fileName = value instanceof File ? value.name : `photo-${Date.now()}.jpg`;
      const contentType = value.type || 'image/jpeg';
      result.push({
        key,
        value: base64,
        type: 'base64File',
        contentType,
        fileName,
      });
    } else {
      // Plain string field
      result.push({ key, value: String(value), type: 'string' });
    }
  }
  return result;
}

// ─── Core request function ────────────────────────────────────────────────────

const BASE_URL = 'https://upwork.kowope.xyz';

/**
 * CapacitorHttp on Android auto-parses JSON only when Content-Type is exactly
 * 'application/json'. When the server sends 'application/json; charset=utf-8'
 * (or any variant with parameters), the native layer may return data as a raw
 * string. This helper ensures data is always a parsed object.
 */
function parseData(data: any): any {
  if (typeof data === 'string') {
    const trimmed = data.trim();
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        return JSON.parse(trimmed);
      } catch {
        // Not valid JSON — return as-is
      }
    }
  }
  return data;
}

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

function buildParams(params?: Record<string, string | number | boolean | undefined | null>): Record<string, string> | undefined {
  if (!params) return undefined;
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) {
    // Skip undefined and null — never send them as the string 'undefined' or 'null'
    if (v === undefined || v === null) continue;
    result[k] = String(v);
  }
  return Object.keys(result).length > 0 ? result : undefined;
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

  // Determine body: CapacitorHttp does NOT accept FormData objects directly.
  // We must serialize FormData to the CapFormDataEntry array format that
  // CapacitorHttp's native layer understands for multipart/form-data uploads.
  // Reference: https://github.com/ionic-team/capacitor/blob/main/core/native-bridge.ts#L33-L52
  let body: any = undefined;
  let isFormData = false;
  if (data !== undefined) {
    if (data instanceof FormData) {
      // Serialize FormData to CapFormDataEntry array with base64File entries for files
      // Remove Content-Type — CapacitorHttp will set multipart/form-data with boundary
      delete headers['Content-Type'];
      body = await serializeFormData(data);
      isFormData = true;
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
      // dataType: 'formData' tells the native layer to reconstruct multipart/form-data
      // from the CapFormDataEntry array. Without this, the array is sent as JSON.
      ...(isFormData ? { dataType: 'formData' } : {}),
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
    data: parseData(response.data),
    status: response.status,
    headers: response.headers || {},
  };

  // Non-2xx: build an error with response attached
  if (response.status < 200 || response.status >= 300) {
    const err = makeError(
      `Request failed with status code ${response.status}`,
      'ERR_BAD_RESPONSE',
      parseData(response.data),
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
