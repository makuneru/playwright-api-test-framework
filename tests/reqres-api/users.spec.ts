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
const userConfigs = allConfigs.filter((c) => c.config.tags?.includes('@users'));

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

    // Assert - Status Code
    expect(response.status).toBe(config.validations.status.code);

    // Assert - Schema Validation (Mandatory - validates structure, types, required fields)
    if (!config.validations.schemaPath) {
      throw new Error('Schema path is required but not defined in config');
    }
    const schema = await loadSchema(config.validations.schemaPath, __dirname);
    if (!schema) {
      throw new Error(
        `Failed to load schema: ${config.validations.schemaPath}`
      );
    }
    schemaValidator.validateAndAssert(schema, response.data);

    // Assert - Business Logic: Pagination matches request parameters
    expect(response.data.page).toBe(config.params?.page || 1);
    expect(response.data.per_page).toBe(config.params?.per_page || 6);

    // Assert - Data Quality: Has actual data
    expect(response.data.total).toBeGreaterThan(0);
    expect(response.data.total_pages).toBeGreaterThan(0);
    expect(response.data.data.length).toBeGreaterThan(0);
    expect(response.data.data.length).toBeLessThanOrEqual(
      response.data.per_page
    );

    // Assert - Data Quality: Email and URL format validation for all users
    response.data.data.forEach((user: any, index: number) => {
      expect(
        user.email,
        `User at index ${index} should have valid email format`
      ).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(
        user.avatar,
        `User at index ${index} should have valid URL format`
      ).toMatch(/^https?:\/\/.+/);
      expect(
        user.id,
        `User at index ${index} should have positive ID`
      ).toBeGreaterThan(0);
      expect(
        user.first_name.length,
        `User at index ${index} should have non-empty first name`
      ).toBeGreaterThan(0);
      expect(
        user.last_name.length,
        `User at index ${index} should have non-empty last name`
      ).toBeGreaterThan(0);
    });

    // Assert - Data Quality: Support URL format
    expect(response.data.support.url).toMatch(/^https?:\/\/.+/);
    expect(response.data.support.text.length).toBeGreaterThan(0);

    // Assert - Business Rule: User IDs must be unique
    const userIds = response.data.data.map((user: any) => user.id);
    const uniqueIds = new Set(userIds);
    expect(uniqueIds.size, 'All user IDs should be unique').toBe(
      userIds.length
    );
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

    // Assert - Status Code
    expect(response.status).toBe(config.validations.status.code);

    // Assert - Schema Validation (Mandatory - validates structure, types, required fields)
    if (!config.validations.schemaPath) {
      throw new Error('Schema path is required but not defined in config');
    }
    const schema = await loadSchema(config.validations.schemaPath, __dirname);
    if (!schema) {
      throw new Error(
        `Failed to load schema: ${config.validations.schemaPath}`
      );
    }
    schemaValidator.validateAndAssert(schema, response.data);

    // Assert - Business Logic: Page 2 specific validations
    expect(response.data.page).toBe(2);
    expect(response.data.per_page).toBe(config.params?.per_page || 6);
    expect(
      response.data.total_pages,
      'Should have at least 2 pages'
    ).toBeGreaterThanOrEqual(2);

    // Assert - Data Quality: Has actual data
    expect(response.data.total).toBeGreaterThan(0);
    expect(response.data.data.length).toBeGreaterThan(0);
    expect(response.data.data.length).toBeLessThanOrEqual(
      response.data.per_page
    );

    // Assert - Data Quality: Email and URL format validation for all users
    response.data.data.forEach((user: any, index: number) => {
      expect(
        user.email,
        `User at index ${index} should have valid email format`
      ).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
      expect(
        user.avatar,
        `User at index ${index} should have valid URL format`
      ).toMatch(/^https?:\/\/.+/);
      expect(
        user.id,
        `User at index ${index} should have positive ID`
      ).toBeGreaterThan(0);
    });

    // Assert - Data Quality: Support URL format
    expect(response.data.support.url).toMatch(/^https?:\/\/.+/);

    // Assert - Business Rule: User IDs must be unique on this page
    const userIds = response.data.data.map((user: any) => user.id);
    const uniqueIds = new Set(userIds);
    expect(uniqueIds.size, 'All user IDs should be unique').toBe(
      userIds.length
    );

    // Assert - Business Rule: IDs on page 2 should be different from page 1
    const firstIdPage2 = response.data.data[0].id;
    expect(
      firstIdPage2,
      'First ID on page 2 should be greater than per_page value'
    ).toBeGreaterThan(response.data.per_page);
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
    expect(
      depResponse.data.data.length,
      'Dependency should return users'
    ).toBeGreaterThan(0);

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

    expect(userId, 'Extracted user ID should be positive').toBeGreaterThan(0);

    // Build URL with extracted ID
    let userUrl = config.url.replace('{id}', String(userId));
    userUrl = buildUrl(userUrl, config.params);

    // Act
    const response = await sendRequest(userUrl, config.method, config.pageId);

    // Assert - Status Code
    expect(response.status).toBe(config.validations.status.code);

    // Assert - Schema Validation (Mandatory - validates structure, types, required fields)
    if (!config.validations.schemaPath) {
      throw new Error('Schema path is required but not defined in config');
    }
    const schema = await loadSchema(config.validations.schemaPath, __dirname);
    if (!schema) {
      throw new Error(
        `Failed to load schema: ${config.validations.schemaPath}`
      );
    }
    schemaValidator.validateAndAssert(schema, response.data);

    // Assert - Business Logic: User ID matches requested ID
    const userData = response.data.data;
    expect(userData.id, 'Returned user ID should match requested ID').toBe(
      Number(userId)
    );

    // Assert - Data Quality: Email format validation
    expect(userData.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(userData.email.length).toBeGreaterThan(0);

    // Assert - Data Quality: Name data quality
    expect(userData.first_name.length).toBeGreaterThan(0);
    expect(
      userData.first_name.trim(),
      'First name should not have leading/trailing spaces'
    ).toBe(userData.first_name);
    expect(userData.last_name.length).toBeGreaterThan(0);
    expect(
      userData.last_name.trim(),
      'Last name should not have leading/trailing spaces'
    ).toBe(userData.last_name);

    // Assert - Data Quality: Avatar URL format
    expect(userData.avatar).toMatch(/^https?:\/\/.+/);
    expect(userData.avatar.length).toBeGreaterThan(0);

    // Assert - Business Rule: Avatar URL should contain user ID
    expect(userData.avatar, 'Avatar URL should contain user ID').toContain(
      String(userData.id)
    );

    // Assert - Data Quality: Email domain validation
    const emailDomain = userData.email.split('@')[1];
    expect(emailDomain, 'Email should have valid domain').toBeDefined();
    expect(emailDomain.length).toBeGreaterThan(0);

    // Assert - Data Quality: Full name is valid
    const fullName = `${userData.first_name} ${userData.last_name}`;
    expect(fullName.length, 'Full name should be meaningful').toBeGreaterThan(
      2
    );

    // Assert - Data Quality: Support URL format
    expect(response.data.support.url).toMatch(/^https?:\/\/.+/);
    expect(response.data.support.text.length).toBeGreaterThan(0);

    // Assert - Data Integrity: No unexpected fields in user data
    const expectedUserFields = [
      'id',
      'email',
      'first_name',
      'last_name',
      'avatar',
    ];
    const actualUserFields = Object.keys(userData);
    expectedUserFields.forEach((field) => {
      expect(actualUserFields, `User data should contain ${field}`).toContain(
        field
      );
    });
  });
});
