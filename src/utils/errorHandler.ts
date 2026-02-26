/**
 * Error Handler Utilities
 * Provides consistent error handling and user-friendly error messages
 */

export interface ErrorResponse {
  message: string;
  code?: string;
  details?: any;
}

/**
 * Parse API error response
 */
export function parseApiError(error: any): ErrorResponse {
  // Network error
  if (!error.response) {
    if (error.message === 'Network Error' || !navigator.onLine) {
      return {
        message: 'No internet connection. Please check your network and try again.',
        code: 'NETWORK_ERROR',
      };
    }
    return {
      message: 'Unable to connect to server. Please try again later.',
      code: 'CONNECTION_ERROR',
    };
  }

  // HTTP error response
  const status = error.response.status;
  const data = error.response.data;

  switch (status) {
    case 400:
      return {
        message: data?.message || 'Invalid request. Please check your input and try again.',
        code: 'BAD_REQUEST',
        details: data,
      };

    case 401:
      return {
        message: 'Your session has expired. Please login again.',
        code: 'UNAUTHORIZED',
      };

    case 403:
      return {
        message: 'You do not have permission to perform this action.',
        code: 'FORBIDDEN',
      };

    case 404:
      return {
        message: 'The requested resource was not found.',
        code: 'NOT_FOUND',
      };

    case 409:
      return {
        message: data?.message || 'This operation conflicts with existing data.',
        code: 'CONFLICT',
        details: data,
      };

    case 422:
      return {
        message: data?.message || 'Validation failed. Please check your input.',
        code: 'VALIDATION_ERROR',
        details: data,
      };

    case 429:
      return {
        message: 'Too many requests. Please wait a moment and try again.',
        code: 'RATE_LIMIT',
      };

    case 500:
      return {
        message: 'Server error. Please try again later.',
        code: 'SERVER_ERROR',
      };

    case 503:
      return {
        message: 'Service temporarily unavailable. Please try again later.',
        code: 'SERVICE_UNAVAILABLE',
      };

    default:
      return {
        message: data?.message || 'An unexpected error occurred. Please try again.',
        code: 'UNKNOWN_ERROR',
        details: data,
      };
  }
}

/**
 * Get user-friendly error message for specific operations
 */
export function getOperationErrorMessage(operation: string, error: any): string {
  const parsedError = parseApiError(error);

  // Operation-specific messages
  const operationMessages: Record<string, Record<string, string>> = {
    login: {
      UNAUTHORIZED: 'Invalid email or password. Please try again.',
      NETWORK_ERROR: 'Cannot connect to login server. Please check your internet connection.',
    },
    building_create: {
      VALIDATION_ERROR: 'Please fill in all required fields correctly.',
      NETWORK_ERROR: 'Building saved offline. Will sync when connection is restored.',
    },
    customer_search: {
      NOT_FOUND: 'No customers found matching your search.',
      NETWORK_ERROR: 'Cannot search customers while offline.',
    },
    photo_upload: {
      VALIDATION_ERROR: 'Photo file is invalid or too large. Please try a different photo.',
      NETWORK_ERROR: 'Cannot upload photos while offline. Photo will be uploaded when online.',
    },
    session_start: {
      CONFLICT: 'You already have an active session. Please end it before starting a new one.',
      VALIDATION_ERROR: 'Invalid lot code or location data.',
    },
    session_end: {
      NOT_FOUND: 'Session not found. It may have already been ended.',
      VALIDATION_ERROR: 'Cannot end session. Please try again.',
    },
  };

  // Get operation-specific message if available
  if (operationMessages[operation] && operationMessages[operation][parsedError.code || '']) {
    return operationMessages[operation][parsedError.code || ''];
  }

  // Fall back to generic error message
  return parsedError.message;
}

/**
 * Retry failed operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    onRetry?: (attempt: number, error: any) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, onRetry } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Don't retry on certain errors
      const parsedError = parseApiError(error);
      const nonRetryableCodes = ['UNAUTHORIZED', 'FORBIDDEN', 'VALIDATION_ERROR', 'BAD_REQUEST'];
      if (nonRetryableCodes.includes(parsedError.code || '')) {
        throw error;
      }

      // Don't retry if this was the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);

      // Notify about retry
      if (onRetry) {
        onRetry(attempt + 1, error);
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  const parsedError = parseApiError(error);
  const retryableCodes = ['NETWORK_ERROR', 'CONNECTION_ERROR', 'SERVER_ERROR', 'SERVICE_UNAVAILABLE', 'RATE_LIMIT'];
  return retryableCodes.includes(parsedError.code || '');
}

/**
 * Log error for debugging
 */
export function logError(context: string, error: any, additionalInfo?: any) {
  const parsedError = parseApiError(error);
  console.error(`[${context}]`, {
    message: parsedError.message,
    code: parsedError.code,
    details: parsedError.details,
    originalError: error,
    additionalInfo,
    timestamp: new Date().toISOString(),
  });
}
