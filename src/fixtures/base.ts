import { test as base, TestInfo } from '@playwright/test';
import { AuthWorker, AuthType } from '../helpers/authenticator';
import { ApiRequest, createApiRequest, createRequest, RequestFunction } from '../helpers/request';
import { SchemaValidator } from '../helpers/schemaValidator';

export interface ApiFixtures {
  authWorker: AuthWorker;
  apiRequest: ApiRequest;
  sendRequest: RequestFunction;
  schemaValidator: SchemaValidator;
}

export const test = base.extend<ApiFixtures>({
  authWorker: async ({}, use) => {
    await use(new AuthWorker());
  },
  apiRequest: async ({ authWorker }, use, testInfo: TestInfo) => {
    // Default to API_KEY authentication, can be overridden via environment
    const authType: AuthType = (process.env.AUTH_TYPE as AuthType) || 'API_KEY';
    const apiRequest = createApiRequest(authWorker, testInfo, authType);
    await use(apiRequest);
    await apiRequest.dispose();
  },
  sendRequest: async ({ apiRequest }, use) => {
    await use(createRequest(apiRequest));
  },
  schemaValidator: async ({}, use) => {
    await use(new SchemaValidator());
  },
});

export { expect } from '@playwright/test';

