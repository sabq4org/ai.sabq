import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

// CSRF Protection
function getCsrfTokenFromCookie(): string | null {
  const match = document.cookie.match(/csrf-token=([^;]+)/);
  return match ? match[1] : null;
}

let csrfToken: string | null = null;
let csrfInitPromise: Promise<void> | null = null;
let csrfRetryCount = 0;
const MAX_CSRF_RETRIES = 3;

export async function initializeCsrf(): Promise<void> {
  // If already initializing, return the existing promise
  if (csrfInitPromise) {
    return csrfInitPromise;
  }
  
  csrfInitPromise = (async () => {
    while (csrfRetryCount < MAX_CSRF_RETRIES) {
      try {
        const res = await fetch("/api/csrf-token", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          csrfToken = data.csrfToken;
          csrfRetryCount = 0; // Reset on success
          return;
        }
      } catch (e) {
        console.error("Failed to fetch CSRF token, attempt", csrfRetryCount + 1, e);
      }
      csrfRetryCount++;
      if (csrfRetryCount < MAX_CSRF_RETRIES) {
        // Wait before retry (exponential backoff: 500ms, 1s, 2s)
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, csrfRetryCount - 1)));
      }
    }
    // Final attempt - try to get from cookie
    csrfToken = getCsrfTokenFromCookie();
  })();
  
  await csrfInitPromise;
  csrfInitPromise = null;
}

// Force refresh CSRF token (used after 403 errors)
async function refreshCsrfToken(): Promise<string | null> {
  csrfToken = null;
  csrfRetryCount = 0;
  csrfInitPromise = null;
  await initializeCsrf();
  return csrfToken;
}

export function getCsrfToken(): string | null {
  return csrfToken || getCsrfTokenFromCookie();
}

function handleSessionExpiration() {
  // Store current URL for redirect after login
  const currentPath = window.location.pathname + window.location.search;
  if (currentPath !== '/login') {
    localStorage.setItem('redirectAfterLogin', currentPath);
  }
  
  // Show toast message
  toast({
    title: "انتهت صلاحية جلستك",
    description: "يرجى تسجيل الدخول مرة أخرى",
    variant: "destructive",
  });
  
  // Redirect to login after 2 seconds
  setTimeout(() => {
    window.location.href = '/login';
  }, 2000);
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Handle 401 Unauthorized - session expired
    if (res.status === 401) {
      handleSessionExpiration();
    }
    
    // Handle 429 Too Many Requests - rate limited
    if (res.status === 429) {
      throw new Error("RATE_LIMITED");
    }
    
    // Handle 502/503/504 Gateway errors - server temporarily unavailable
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error("الخادم غير متاح مؤقتاً، يرجى المحاولة مرة أخرى");
    }
    
    // Handle 403 Forbidden - show user-friendly message
    if (res.status === 403) {
      try {
        const data = JSON.parse(text);
        if (data.message) {
          toast({
            title: "تنبيه",
            description: data.message,
            variant: "destructive",
          });
          throw new Error(data.message);
        }
      } catch (e) {
        // If parsing fails or no message, use default
        if (e instanceof Error && e.message !== text) {
          throw e; // Re-throw if it's our custom error
        }
      }
    }
    
    // Handle 409 Conflict - parse JSON and extract Arabic message
    if (res.status === 409) {
      try {
        const data = JSON.parse(text);
        if (data.message) {
          throw new Error(data.message);
        }
      } catch (e) {
        // If parsing fails, check if it's our custom error
        if (e instanceof Error && e.message !== text) {
          throw e; // Re-throw if it's our custom error
        }
      }
    }
    
    // For other errors, try to parse JSON message
    try {
      const data = JSON.parse(text);
      if (data.message) {
        throw new Error(data.message);
      }
    } catch (e) {
      // If parsing fails, check if it's our custom error
      if (e instanceof Error && e.message !== text) {
        throw e;
      }
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest<T = any>(
  url: string,
  options?: {
    method?: string;
    body?: string | FormData;
    headers?: Record<string, string>;
    isFormData?: boolean;
    onUploadProgress?: (progress: { loaded: number; total: number }) => void;
    _csrfRetry?: boolean; // Internal flag for CSRF retry
  }
): Promise<T> {
  // Use XMLHttpRequest for FormData with progress tracking
  if (options?.isFormData && options.body instanceof FormData) {
    // Ensure CSRF token is available before FormData upload
    if (!getCsrfToken()) {
      await initializeCsrf();
    }
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && options.onUploadProgress) {
          options.onUploadProgress({ loaded: e.loaded, total: e.total });
        }
      });

      xhr.addEventListener('load', async () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const contentType = xhr.getResponseHeader("content-type");
            if (contentType && contentType.includes("application/json")) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              resolve(xhr.response);
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error}`));
          }
        } else {
          // Handle 401 Unauthorized - session expired
          if (xhr.status === 401) {
            handleSessionExpiration();
          }
          
          // Handle 403 Forbidden - check for CSRF error and handle gracefully
          if (xhr.status === 403) {
            try {
              const data = JSON.parse(xhr.responseText);
              // Check if it's a CSRF error - refresh token silently and show retry message
              if (data.message && (
                data.message.includes('رمز الحماية') || 
                data.message.includes('الجلسة غير متوفرة')
              )) {
                // Refresh CSRF token for next request
                refreshCsrfToken();
                toast({
                  title: "يرجى المحاولة مرة أخرى",
                  description: "تم تحديث رمز الحماية",
                  variant: "default",
                });
                reject(new Error(data.message));
                return;
              }
              if (data.message) {
                toast({
                  title: "تنبيه",
                  description: data.message,
                  variant: "destructive",
                });
                reject(new Error(data.message));
                return;
              }
            } catch (e) {
              // If parsing fails, continue to default error
            }
          }
          
          // Handle 409 Conflict - parse JSON and extract Arabic message
          if (xhr.status === 409) {
            try {
              const data = JSON.parse(xhr.responseText);
              if (data.message) {
                reject(new Error(data.message));
                return;
              }
            } catch (e) {
              // If parsing fails, continue to default error
            }
          }
          
          // For other errors, try to parse JSON message
          try {
            const data = JSON.parse(xhr.responseText);
            if (data.message) {
              reject(new Error(data.message));
              return;
            }
          } catch (e) {
            // If parsing fails, continue to default error
          }
          
          reject(new Error(`${xhr.status}: ${xhr.responseText || xhr.statusText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error'));
      });

      xhr.open(options?.method || 'POST', url);
      xhr.withCredentials = true;
      
      // Add CSRF token for state-changing requests
      const token = getCsrfToken();
      if (token) {
        xhr.setRequestHeader("x-csrf-token", token);
      }
      
      // Don't set Content-Type for FormData - browser will set it with boundary
      if (options?.headers) {
        Object.entries(options.headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });
      }

      xhr.send(options.body);
    });
  }

  // Standard fetch for non-FormData requests with CSRF auto-retry
  const method = options?.method || "GET";
  const isStateChangingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method.toUpperCase());
  
  // Helper to make the actual request
  async function makeRequest(retryAttempt = 0): Promise<T> {
    const currentCsrfToken = getCsrfToken();
    
    const headers: Record<string, string> = {
      ...(options?.body && typeof options.body === 'string' ? { "Content-Type": "application/json" } : {}),
      ...(options?.headers || {}),
    };
    
    if (isStateChangingMethod && currentCsrfToken) {
      headers["x-csrf-token"] = currentCsrfToken;
    }
    
    const res = await fetch(url, {
      method,
      headers,
      body: typeof options?.body === 'string' ? options.body : undefined,
      credentials: "include",
    });

    // Check for CSRF-related 403 error and retry once
    if (res.status === 403 && retryAttempt === 0 && isStateChangingMethod) {
      const text = await res.clone().text();
      try {
        const data = JSON.parse(text);
        // Check if it's a CSRF error (contains Arabic CSRF messages)
        if (data.message && (
          data.message.includes('رمز الحماية') || 
          data.message.includes('الجلسة غير متوفرة')
        )) {
          // Refresh CSRF token and retry
          await refreshCsrfToken();
          return makeRequest(1);
        }
      } catch {
        // Not a JSON error, continue with normal error handling
      }
    }

    await throwIfResNotOk(res);
    
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await res.json();
    }
    
    return res as T;
  }
  
  return makeRequest();
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL from queryKey, handling objects as query params
    let url = '';
    const params: Record<string, string> = {};
    
    for (const part of queryKey) {
      if (typeof part === 'string') {
        url += (url && !url.endsWith('/') ? '/' : '') + part;
      } else if (typeof part === 'object' && part !== null) {
        // Convert object to query params, filtering out undefined values
        Object.entries(part).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params[key] = String(value);
          }
        });
      }
    }
    
    // Append query params if any
    const queryString = new URLSearchParams(params).toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
    
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await res.json();
    }
    // Non-JSON successful response (e.g. 204 No Content or plain text)
    const text = await res.text();
    try {
      return JSON.parse(text) as T;
    } catch {
      return text as unknown as T;
    }
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "returnNull" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 300000,
      gcTime: 600000,
      retry: (failureCount, error) => {
        // Retry on rate limiting (429) up to 3 times with increasing backoff
        if (error instanceof Error && error.message === "RATE_LIMITED") {
          return failureCount < 3;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(2000 * (attemptIndex + 1), 10000),
    },
    mutations: {
      retry: false,
    },
  },
});

if (typeof window !== 'undefined' && (window as any).__HOMEPAGE_DATA__) {
  queryClient.setQueryData(["/api/homepage-lite"], (window as any).__HOMEPAGE_DATA__);
  delete (window as any).__HOMEPAGE_DATA__;
}
