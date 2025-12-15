import { getEnvironmentConfig } from '../../playwright.config';

/**
 * Base URL for the API
 */
export const BASE_URL = getEnvironmentConfig().baseURL;

/**
 * Build full URL for an endpoint with optional query parameters
 * 
 * @param endpoint - The API endpoint path
 * @param queryParams - Optional query parameters (supports string, number, boolean values)
 * @returns Complete URL with query string
 * 
 * @example
 * ```typescript
 * buildUrl('/api/users', { page: 1, per_page: 10 })
 * // Returns: 'https://reqres.in/api/users?page=1&per_page=10'
 * ```
 */
export function buildUrl(
  endpoint: string,
  queryParams?: Record<string, string | number | boolean>
): string {
  const url = `${BASE_URL}${endpoint}`;
  
  if (queryParams && Object.keys(queryParams).length > 0) {
    // Convert all values to strings for URLSearchParams
    const stringParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(queryParams)) {
      stringParams[key] = String(value);
    }
    const params = new URLSearchParams(stringParams);
    return `${url}?${params.toString()}`;
  }
  
  return url;
}

