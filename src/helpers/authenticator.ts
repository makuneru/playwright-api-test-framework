import { request } from '@playwright/test';
import { getEnvironmentConfig } from '../../playwright.config';
import { step } from '../utils/decorators/step';

export type AuthType = 'API_KEY' | 'OAUTH2';

export class AuthWorker {
  private static bearerTokens: Map<string, BearerToken> = new Map();
  private static readonly TOKEN_EXPIRY_BUFFER_SECONDS = 300; // Refresh token 5 minutes before expiry

  constructor() {}

  /**
   * Get authentication URL for OAuth2 based on environment
   */
  private getAuthUrl(env: string): string {
    // PROD/STG environments use production auth server
    if (
      env.toLowerCase().includes('prod') ||
      env.toLowerCase().includes('stg')
    ) {
      return 'https://auth.apps.paloaltonetworks.com/oauth2/access_token';
    }

    // QA/DEV environments use QA auth server
    return 'https://auth.qa.appsvc.paloaltonetworks.com/am/oauth2/access_token';
  }

  /**
   * Check if a cached token is still valid
   */
  private isTokenValid(token: BearerToken): boolean {
    if (!token.expiresAt) {
      return false;
    }
    const now = new Date();
    const bufferTime = new Date(
      now.getTime() + AuthWorker.TOKEN_EXPIRY_BUFFER_SECONDS * 1000
    );
    return token.expiresAt > bufferTime;
  }

  /**
   * Get cached token if valid, otherwise return null
   */
  private getCachedToken(): string | null {
    const config = getEnvironmentConfig();
    const environment = config.testEnv;
    const cachedToken = AuthWorker.bearerTokens.get(environment);

    if (cachedToken && this.isTokenValid(cachedToken)) {
      return cachedToken.token;
    }

    if (cachedToken) {
      AuthWorker.bearerTokens.delete(environment);
    }

    return null;
  }

  /**
   * Get API Key from environment configuration
   * Returns empty string if not set (for public APIs that don't require authentication)
   */
  @step('Get API Key')
  async getApiKey(): Promise<string> {
    const config = getEnvironmentConfig();
    const apiKey = config.apiKey || '';

    return apiKey;
  }

  /**
   * Get Bearer Token for OAuth2 authentication
   */
  @step('Get Bearer Token')
  async getBearerToken(): Promise<string> {
    // Check if we have a valid cached token
    const cachedToken = this.getCachedToken();
    if (cachedToken) {
      return cachedToken;
    }

    // Token expired or doesn't exist, get a new one
    return await this.fetchNewToken();
  }

  /**
   * Fetch a new bearer token from the OAuth endpoint
   */
  private async fetchNewToken(): Promise<string> {
    const config = getEnvironmentConfig();
    const env = config.testEnv;
    const authUrl = this.getAuthUrl(env);

    console.log(`🔐 Auth Debug - Environment: ${env}`);
    console.log(`🔐 Auth Debug - Auth URL: ${authUrl}`);
    console.log(`🔐 Auth Debug - Client ID: ${config.userClientId}`);

    const context = await request.newContext();

    const formData: Record<string, string> = {
      grant_type: 'client_credentials',
      client_id: config.userClientId ?? '',
      client_secret: config.userClientSecret ?? '',
      scope: `tsg_id:${config.tenantTsgId}`,
    };

    try {
      let response = await context.post(authUrl, {
        form: formData,
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });

      if (response.status() === 400) {
        const params = new URLSearchParams();
        params.append('grant_type', 'client_credentials');
        params.append('client_id', formData.client_id);
        params.append('client_secret', formData.client_secret);
        params.append('scope', formData.scope);

        response = await context.post(authUrl, {
          data: params.toString(),
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
      }

      if (response.status() !== 200) {
        const errorBody = await response.text();
        console.error(`❌ Auth Failed - Status: ${response.status()}`);
        console.error(`❌ Auth Failed - Error: ${errorBody}`);
        throw new Error(
          `Failed to get bearer token. Status: ${response.status()}, Body: ${errorBody}. ` +
            `Verify credentials are correct for ${env} environment (Auth URL: ${authUrl})`
        );
      }

      const responseData = await response.json();
      const bearerToken = `Bearer ${responseData.access_token}`;

      const expiresIn = responseData.expires_in || 900;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);

      this.setBearerToken(bearerToken, expiresAt);
      return bearerToken;
    } finally {
      await context.dispose();
    }
  }

  private setBearerToken(token: string, expiresAt: Date): void {
    const config = getEnvironmentConfig();
    const environment = config.testEnv;
    AuthWorker.bearerTokens.set(
      environment,
      new BearerToken(new Date(), token, expiresAt)
    );
  }

  /**
   * Get authentication header based on auth type
   * Returns empty object if API_KEY is not set (for public APIs)
   */
  @step('Get Auth Header')
  async getAuthHeader(authType: AuthType = 'API_KEY'): Promise<Record<string, string>> {
    if (authType === 'OAUTH2') {
      const bearerToken = await this.getBearerToken();
      return { Authorization: bearerToken };
    } else {
      // API_KEY authentication - only include header if API key is provided
      const apiKey = await this.getApiKey();
      if (!apiKey || apiKey.trim() === '') {
        // Return empty object for public APIs that don't require authentication
        return {};
      }
      return { 'x-api-key': apiKey };
    }
  }
}

class BearerToken {
  constructor(
    public issueTime: Date,
    public token: string,
    public expiresAt?: Date
  ) {}
}

