import { expect, test } from '../../src/fixtures/base';
import { buildUrl } from '../../src/helpers/urlBuilder';
import {
  getDirname,
  loadConfigs,
  loadSchema,
  extractFilteredValues,
  ApiResponse,
} from '../../src/helpers/configLoader';
import * as path from 'path';

// Get current directory in ES modules
const __dirname = getDirname(import.meta.url);

// Define config path
const REQRES_CONFIGS_PATH = path.join(
  __dirname,
  '../../applications/reqres-api/configs'
);

// Load user configs
const allConfigs = loadConfigs(REQRES_CONFIGS_PATH);
const userConfigs = allConfigs.filter((c) =>
  c.config.tags?.includes('@users')
);

// Additional tags
const additionalTags = ['@regression', '@users'];

test.describe('Users API Tests', { tag: additionalTags }, () => {
  // ============================================================================
  // GET /api/users - Get list of users
  // ============================================================================
  test('GET /api/users - Get list of users', async ({
    sendRequest,
    schemaValidator,
  }) => {
    const config = userConfigs.find((c) => c.pageId === 'GET_USERS')?.config;
    if (!config) {
      throw new Error('GET_USERS config not found');
    }

    // Arrange
    const url = buildUrl(config.url, config.params);

    // Act
    const response = await sendRequest(url, config.method, config.pageId);

    // Assert
    expect(response.status).toBe(config.validations.status.code);

    if (config.validations.schemaPath) {
      const schema = await loadSchema(config.validations.schemaPath, __dirname);
      if (schema) {
        schemaValidator.validateAndAssert(schema, response.data);
      }
    }
  });

  // ============================================================================
  // GET /api/users?page=2 - Get list of users page 2
  // ============================================================================
  test('GET /api/users?page=2 - Get list of users page 2', async ({
    sendRequest,
    schemaValidator,
  }) => {
    const config = userConfigs.find(
      (c) => c.pageId === 'GET_USERS_PAGE2'
    )?.config;
    if (!config) {
      throw new Error('GET_USERS_PAGE2 config not found');
    }

    // Arrange
    const url = buildUrl(config.url, config.params);

    // Act
    const response = await sendRequest(url, config.method, config.pageId);

    // Assert
    expect(response.status).toBe(config.validations.status.code);

    if (config.validations.schemaPath) {
      const schema = await loadSchema(config.validations.schemaPath, __dirname);
      if (schema) {
        schemaValidator.validateAndAssert(schema, response.data);
      }
    }
  });

  // ============================================================================
  // GET /api/users/{id} - Get user by ID
  // ============================================================================
  test('GET /api/users/{id} - Get user by ID', async ({
    sendRequest,
    schemaValidator,
  }) => {
    const config = userConfigs.find(
      (c) => c.pageId === 'GET_USER_BY_ID'
    )?.config;
    if (!config) {
      throw new Error('GET_USER_BY_ID config not found');
    }

    // Arrange - Execute dependency to get user ID
    const dependencyConfig = allConfigs.find(
      (c) => c.pageId === 'GET_USERS'
    )?.config;
    if (!dependencyConfig) {
      throw new Error('GET_USERS dependency config not found');
    }

    const depUrl = buildUrl(dependencyConfig.url, dependencyConfig.params);
    const depResponse: ApiResponse = await sendRequest(
      depUrl,
      dependencyConfig.method,
      dependencyConfig.pageId
    );

    expect(depResponse.status).toBe(dependencyConfig.validations.status.code);

    // Extract ID using filter
    let userId: string | number | undefined;
    if (config.filter) {
      const extractedValues = extractFilteredValues(depResponse, config.filter);
      userId = extractedValues.id;
    } else {
      // Fallback extraction
      userId = depResponse.data?.data?.[0]?.id;
    }

    if (!userId) {
      throw new Error('Failed to extract user ID from dependency response');
    }

    // Build URL with extracted ID
    let userUrl = config.url.replace('{id}', String(userId));
    userUrl = buildUrl(userUrl, config.params);

    // Act
    const response = await sendRequest(userUrl, config.method, config.pageId);

    // Assert
    expect(response.status).toBe(config.validations.status.code);

    if (config.validations.schemaPath) {
      const schema = await loadSchema(config.validations.schemaPath, __dirname);
      if (schema) {
        schemaValidator.validateAndAssert(schema, response.data);
      }
    }
  });
});

