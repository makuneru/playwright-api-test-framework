import { APIRequestContext, request, TestInfo } from '@playwright/test';
import { randomUUID } from 'crypto';
import { getEnvironmentConfig } from '../../playwright.config';
import { step } from '../utils/decorators/step';
import { AuthWorker, AuthType } from './authenticator';

export interface ApiResponse {
  status: number;
  data: any;
  headers: any;
}

export class ApiRequest {
  private context: APIRequestContext | null = null;
  private authWorker: AuthWorker;
  private testInfo: TestInfo;
  private authType: AuthType;

  private getSessionId(): string {
    return getEnvironmentConfig().sessionId;
  }

  constructor(authWorker: AuthWorker, testInfo: TestInfo, authType: AuthType = 'API_KEY') {
    this.authWorker = authWorker;
    this.testInfo = testInfo;
    this.authType = authType;
  }

  /**
   * Initialize the API request context
   */
  private async initializeContext(): Promise<void> {
    if (!this.context) {
      this.context = await request.newContext();
    }
  }

  /**
   * Get default headers including authorization
   */
  private async getDefaultHeaders(
    pageId?: string
  ): Promise<Record<string, string>> {
    const authHeaders = await this.authWorker.getAuthHeader(this.authType);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authHeaders,
      'RequestId': randomUUID(),
      'SessionId': this.getSessionId(),
    };

    if (pageId) {
      headers['Client-PageId'] = pageId;
    }

    return headers;
  }

  /**
   * Extract endpoint path from full URL (removes base URL)
   */
  private extractEndpoint(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  }

  /**
   * Attach request data to test info for debugging
   */
  private async attachRequestData(
    method: string,
    url: string,
    headers: Record<string, string>,
    payload?: any
  ): Promise<void> {
    const requestData = {
      method,
      url,
      headers: { ...headers, Authorization: '[REDACTED]', 'x-api-key': '[REDACTED]' },
      ...(payload && { payload }),
      timestamp: new Date().toISOString(),
    };

    const endpoint = this.extractEndpoint(url);
    await this.testInfo.attach(`${method} Request - ${endpoint}`, {
      body: JSON.stringify(requestData, null, 2),
      contentType: 'application/json',
    });
  }

  /**
   * Attach response data to test info for debugging
   */
  private async attachResponseData(
    method: string,
    url: string,
    status: number,
    data: any,
    headers: Record<string, string>
  ): Promise<void> {
    const responseData = {
      method,
      url,
      status,
      data,
      headers,
      timestamp: new Date().toISOString(),
    };

    const endpoint = this.extractEndpoint(url);
    await this.testInfo.attach(`${method} Response - ${status} - ${endpoint}`, {
      body: JSON.stringify(responseData, null, 2),
      contentType: 'application/json',
    });
  }

  /**
   * Make a GET request with automatic authorization
   */
  @step('API GET Request to: {0}')
  async get(
    url: string,
    pageId?: string,
    additionalHeaders?: Record<string, string>
  ): Promise<ApiResponse> {
    await this.initializeContext();

    const headers = {
      ...(await this.getDefaultHeaders(pageId)),
      ...additionalHeaders,
    };

    await this.attachRequestData('GET', url, headers);

    console.log('API Request URL:', url);

    const response = await this.context!.get(url, {
      headers,
    });

    const responseData = await response.json().catch(() => null);
    const status = response.status();
    const responseHeaders = response.headers();

    await this.attachResponseData(
      'GET',
      url,
      status,
      responseData,
      responseHeaders
    );

    console.log('Response Status:', status);

    return {
      status,
      data: responseData,
      headers: responseHeaders,
    };
  }

  /**
   * Make a POST request with automatic authorization
   */
  @step('API POST Request to: {0}')
  async post(
    url: string,
    pageId?: string,
    payload?: any,
    additionalHeaders?: Record<string, string>
  ): Promise<ApiResponse> {
    await this.initializeContext();

    const headers = {
      ...(await this.getDefaultHeaders(pageId)),
      ...additionalHeaders,
    };

    await this.attachRequestData('POST', url, headers, payload);

    console.log('API Request URL:', url);
    console.log('Request Payload:', JSON.stringify(payload, null, 2));

    const response = await this.context!.post(url, {
      headers,
      data: payload,
    });

    const responseData = await response.json().catch(() => null);
    const status = response.status();
    const responseHeaders = response.headers();

    await this.attachResponseData(
      'POST',
      url,
      status,
      responseData,
      responseHeaders
    );

    console.log('Response Status:', status);

    return {
      status,
      data: responseData,
      headers: responseHeaders,
    };
  }

  /**
   * Make a PUT request with automatic authorization
   */
  @step('API PUT Request to: {0}')
  async put(
    url: string,
    pageId?: string,
    payload?: any,
    additionalHeaders?: Record<string, string>
  ): Promise<ApiResponse> {
    await this.initializeContext();

    const headers = {
      ...(await this.getDefaultHeaders(pageId)),
      ...additionalHeaders,
    };

    await this.attachRequestData('PUT', url, headers, payload);

    console.log('API Request URL:', url);
    console.log('Request Payload:', JSON.stringify(payload, null, 2));

    const response = await this.context!.put(url, {
      headers,
      data: payload,
    });

    const responseData = await response.json().catch(() => null);
    const status = response.status();
    const responseHeaders = response.headers();

    await this.attachResponseData(
      'PUT',
      url,
      status,
      responseData,
      responseHeaders
    );

    console.log('Response Status:', status);

    return {
      status,
      data: responseData,
      headers: responseHeaders,
    };
  }

  /**
   * Make a DELETE request with automatic authorization
   */
  @step('API DELETE Request to: {0}')
  async delete(
    url: string,
    pageId?: string,
    additionalHeaders?: Record<string, string>
  ): Promise<ApiResponse> {
    await this.initializeContext();

    const headers = {
      ...(await this.getDefaultHeaders(pageId)),
      ...additionalHeaders,
    };

    await this.attachRequestData('DELETE', url, headers);

    console.log('API Request URL:', url);

    const response = await this.context!.delete(url, {
      headers,
    });

    const responseData = await response.json().catch(() => null);
    const status = response.status();
    const responseHeaders = response.headers();

    await this.attachResponseData(
      'DELETE',
      url,
      status,
      responseData,
      responseHeaders
    );

    console.log('Response Status:', status);

    return {
      status,
      data: responseData,
      headers: responseHeaders,
    };
  }

  /**
   * Make a generic request with automatic method selection
   */
  @step('API {1} Request to: {0}')
  async request(
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    pageId?: string,
    payload?: any,
    additionalHeaders?: Record<string, string>
  ): Promise<ApiResponse> {
    switch (method.toUpperCase()) {
      case 'POST':
        return this.post(url, pageId, payload, additionalHeaders);
      case 'PUT':
        return this.put(url, pageId, payload, additionalHeaders);
      case 'DELETE':
        return this.delete(url, pageId, additionalHeaders);
      case 'GET':
      default:
        return this.get(url, pageId, additionalHeaders);
    }
  }

  /**
   * Dispose the API request context
   */
  async dispose(): Promise<void> {
    if (this.context) {
      await this.context.dispose();
      this.context = null;
    }
  }
}

/**
 * Factory function to create ApiRequest with AuthWorker and TestInfo
 */
export function createApiRequest(
  authWorker: AuthWorker,
  testInfo: TestInfo,
  authType: AuthType = 'API_KEY'
): ApiRequest {
  return new ApiRequest(authWorker, testInfo, authType);
}

/**
 * Request function type returned by createRequest factory
 */
export type RequestFunction = (
  url: string,
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE',
  pageId?: string,
  payload?: any,
  additionalHeaders?: Record<string, string>
) => Promise<ApiResponse>;

/**
 * Factory function that creates a pre-configured request helper
 */
export function createRequest(apiRequest: ApiRequest): RequestFunction {
  return async (
    url: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    pageId?: string,
    payload?: any,
    additionalHeaders?: Record<string, string>
  ): Promise<ApiResponse> => {
    return apiRequest.request(url, method, pageId, payload, additionalHeaders);
  };
}

