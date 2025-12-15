import { test, expect } from '../fixtures/base';
import { buildUrl } from './urlBuilder';
import {
  loadSchema,
  LoadedConfig,
  TestConfig,
  extractFilteredValues,
  replacePathParameters,
  ApiResponse,
} from './configLoader';
import { randomUUID } from 'crypto';

interface StandaloneTestOptions {
  /**
   * Directory name for resolving schema paths
   */
  dirname: string;

  /**
   * Optional function to transform the URL before building it
   * Useful for replacing dynamic placeholders like {id}, {resource_id}, etc.
   * Can accept extracted values from dependencies or generate UUIDs as fallback
   */
  urlTransform?: (url: string, config: TestConfig, extractedValues?: Record<string, any>) => string;

  /**
   * Optional function to customize the test title
   */
  titleFormatter?: (
    method: string,
    url: string,
    description: string,
    pageId: string,
    config: TestConfig
  ) => string;

  /**
   * Optional additional tags to add to all tests
   */
  additionalTags?: string[];
}

/**
 * Generates standalone test cases from configurations
 *
 * This helper creates Playwright test cases for standalone API endpoints that don't require dependencies.
 * It handles the common pattern of:
 * 1. Building the endpoint URL
 * 2. Sending the request
 * 3. Validating response status
 * 4. Validating response schema
 *
 * @param configs - Array of test configurations
 * @param options - Options for test generation
 *
 * @example
 * ```typescript
 * generateStandaloneTests(standaloneConfigs, {
 *   dirname: __dirname,
 * });
 * ```
 *
 * @example With URL transformation
 * ```typescript
 * generateStandaloneTests(standaloneConfigs, {
 *   dirname: __dirname,
 *   urlTransform: (url) => {
 *     if (url.includes('{widget_uuid}')) {
 *       return url.replace('{widget_uuid}', randomUUID());
 *     }
 *     return url;
 *   },
 * });
 * ```
 */
export function generateStandaloneTests(
  configs: LoadedConfig[],
  options: StandaloneTestOptions
): void {
  const {
    dirname,
    urlTransform,
    titleFormatter = (method, url, description, _pageId, _config) =>
      `${method} ${url} - ${description}`,
    additionalTags = [],
  } = options;

  for (const { pageId, config } of configs) {
    const {
      url,
      method,
      params,
      payload,
      validations,
      description,
      testSuite,
      tags,
      timeout,
    } = config;

    // Merge config tags with additional tags
    const mergedTags = [...(tags || []), ...additionalTags];

    test.describe(testSuite || pageId, { tag: mergedTags }, () => {
      test(
        titleFormatter(method, url, description, pageId, config),
        async ({ sendRequest, schemaValidator }) => {
          // Set test timeout if specified in config (optional)
          if (timeout) {
            test.setTimeout(timeout);
          }

          // Arrange - Build endpoint URL
          let endPointUrl = url;

          // Apply custom URL transformation if provided
          if (urlTransform) {
            endPointUrl = urlTransform(endPointUrl, config);
          }

          endPointUrl = buildUrl(endPointUrl, params);

          // Act - Send request
          const response = await sendRequest(
            endPointUrl,
            method,
            pageId,
            payload
          );

          // Assert - Validate response status
          expect(
            response.status,
            `Response status should be ${validations.status.code}`
          ).toBe(validations.status.code);

          // Assert - Validate response data structure using JSON schema
          if (validations.schemaPath) {
            const schema = await loadSchema(validations.schemaPath, dirname);
            schemaValidator.validateAndAssert(schema!, response.data);
          }
        }
      );
    });
  }
}

interface DependentTestOptions {
  /**
   * Directory name for resolving schema paths
   */
  dirname: string;

  /**
   * All loaded configs (needed to resolve dependencies)
   */
  allConfigs: LoadedConfig[];

  /**
   * Optional function to transform the URL before building it
   * Useful for replacing dynamic placeholders like {id}, {resource_id}, etc.
   * Can accept extracted values from dependencies or generate UUIDs as fallback
   */
  urlTransform?: (url: string, config: TestConfig, extractedValues?: Record<string, any>) => string;

  /**
   * Optional function to customize the test title
   */
  titleFormatter?: (
    method: string,
    url: string,
    description: string,
    pageId: string,
    config: TestConfig
  ) => string;

  /**
   * Optional additional tags to add to all tests
   */
  additionalTags?: string[];
}

/**
 * Generates dependent test cases from configurations
 *
 * This helper creates Playwright test cases for API endpoints that require dependencies.
 * It handles:
 * 1. Executing dependencies in order
 * 2. Extracting values from dependency responses using filter expressions
 * 3. Replacing path parameters with extracted values
 * 4. Building the endpoint URL
 * 5. Sending the request
 * 6. Validating response status and schema
 *
 * @param configs - Array of dependent test configurations
 * @param options - Options for test generation
 *
 * @example
 * ```typescript
 * generateDependentTests(dependentConfigs, {
 *   dirname: __dirname,
 *   allConfigs: allConfigs,
 * });
 * ```
 */
export function generateDependentTests(
  configs: LoadedConfig[],
  options: DependentTestOptions
): void {
  const {
    dirname,
    allConfigs,
    urlTransform,
    titleFormatter = (method, url, description, _pageId, _config) =>
      `${method} ${url} - ${description}`,
    additionalTags = [],
  } = options;

  for (const { pageId, config } of configs) {
    const {
      url,
      method,
      params,
      payload,
      validations,
      description,
      testSuite,
      tags,
      timeout,
      filter,
      dependencies,
    } = config;

    // Merge config tags with additional tags
    const mergedTags = [...(tags || []), ...additionalTags];

    test.describe(testSuite || pageId, { tag: mergedTags }, () => {
      test(
        titleFormatter(method, url, description, pageId, config),
        async ({ sendRequest, schemaValidator }) => {
          // Set test timeout if specified in config (optional)
          if (timeout) {
            test.setTimeout(timeout);
          }

          let endPointUrl = url;
          const extractedValues: Record<string, any> = {};

          // ARRANGE - Execute dependencies from config
          if (dependencies && dependencies.length > 0) {
            // Execute each dependency in order
            for (const dependencyPageId of dependencies) {
              const dependencyConfigItem = allConfigs.find(
                (c) => c.pageId === dependencyPageId
              );

              if (!dependencyConfigItem) {
                throw new Error(
                  `Dependency '${dependencyPageId}' not found in configs`
                );
              }

              const depConfig = dependencyConfigItem.config;

              // Build dependency URL
              let depUrl = depConfig.url;

              // Replace path parameters generically (use extracted values or generate UUIDs)
              depUrl = replacePathParameters(depUrl, extractedValues);

              const depFullUrl = buildUrl(depUrl, depConfig.params);

              // Execute dependency request
              const depResponse: ApiResponse = await sendRequest(
                depFullUrl,
                depConfig.method,
                dependencyPageId,
                depConfig.payload
              );

              // Verify dependency execution was successful
              expect(depResponse.status).toBe(
                depConfig.validations.status.code
              );

              // Extract values from dependency response using filter expressions
              if (filter) {
                const filteredValues = extractFilteredValues(
                  depResponse,
                  filter
                );
                Object.assign(extractedValues, filteredValues);
              } else {
                // Fallback to default extraction logic if no filter specified
                if (depResponse.data?.data?.id) {
                  // Single item response (e.g., GET /users/{id})
                  extractedValues.id = depResponse.data.data.id;
                } else if (
                  depResponse.data?.data &&
                  Array.isArray(depResponse.data.data) &&
                  depResponse.data.data.length > 0
                ) {
                  // List response (e.g., GET /users)
                  extractedValues.id = depResponse.data.data[0].id;
                } else if (depResponse.data?.id) {
                  extractedValues.id = depResponse.data.id;
                }
              }
            }

            // Replace path parameters with extracted values
            endPointUrl = replacePathParameters(endPointUrl, extractedValues);
          }

          // Apply custom URL transformation if provided (pass extracted values if available)
          if (urlTransform) {
            endPointUrl = urlTransform(endPointUrl, config, extractedValues);
          }

          // Replace any remaining path parameters (for dynamic placeholders not in extractedValues)
          // This handles cases where urlTransform or the original URL has placeholders
          endPointUrl = replacePathParameters(endPointUrl, extractedValues);

          endPointUrl = buildUrl(endPointUrl, params);

          // ACT - Send request
          const response = await sendRequest(
            endPointUrl,
            method,
            pageId,
            payload
          );

          // ASSERT - Validate response status
          expect(
            response.status,
            `Response status should be ${validations.status.code}`
          ).toBe(validations.status.code);

          // Assert - Validate response data structure using JSON schema
          if (validations.schemaPath) {
            const schema = await loadSchema(validations.schemaPath, dirname);
            schemaValidator.validateAndAssert(schema!, response.data);
          }
        }
      );
    });
  }
}

/**
 * Default URL transformer that handles generic placeholder replacements
 *
 * Replaces any placeholders in the format {placeholder_name} with:
 * 1. Extracted values from dependencies (if provided and available)
 * 2. Random UUIDs as fallback (if extracted values not available)
 *
 * This provides flexibility for handling dynamic IDs and other path parameters.
 * Ideal for standalone endpoints that might receive IDs from list endpoints,
 * but can fall back to UUID generation if no extracted values are provided.
 *
 * @param url - The URL to transform
 * @param config - The test config (optional, not used but required for signature compatibility)
 * @param extractedValues - Optional extracted values from dependency responses (e.g., { id: 1, resource_id: 5 })
 * @returns The transformed URL with placeholders replaced by extracted values or UUIDs
 *
 * @example
 * ```typescript
 * // Without extracted values - generates UUIDs
 * defaultUrlTransform('/api/users/{id}') 
 * // '/api/users/{uuid-generated}'
 *
 * // With extracted values - uses provided values
 * defaultUrlTransform('/api/users/{id}', undefined, { id: 1 })
 * // '/api/users/1'
 *
 * // Mixed - uses extracted value for 'id', generates UUID for 'other_id'
 * defaultUrlTransform('/api/users/{id}/items/{other_id}', undefined, { id: 1 })
 * // '/api/users/1/items/{uuid-generated}'
 * ```
 */
export function defaultUrlTransform(
  url: string,
  _config?: TestConfig,
  extractedValues?: Record<string, any>
): string {
  let transformed = url;

  // Find all placeholders in the format {placeholder_name}
  const placeholderRegex = /\{([^}]+)\}/g;
  const matches = Array.from(url.matchAll(placeholderRegex));

  // Replace each placeholder with extracted value or random UUID
  for (const match of matches) {
    const placeholder = match[0]; // e.g., "{id}", "{resource_id}"
    const paramName = match[1]; // e.g., "id", "resource_id"

    // Use extracted value if available, otherwise generate UUID
    let replacementValue: string;
    if (extractedValues && extractedValues[paramName] !== undefined) {
      replacementValue = String(extractedValues[paramName]);
    } else {
      replacementValue = randomUUID();
    }

    transformed = transformed.replace(placeholder, replacementValue);
  }

  return transformed;
}

