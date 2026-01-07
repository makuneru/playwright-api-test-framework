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

/**
 * Options for configuring the TestGenerator class
 */
export interface TestGeneratorOptions {
  /**
   * Directory name for resolving schema paths
   */
  dirname: string;

  /**
   * Optional function to transform the URL before building it
   * Useful for replacing dynamic placeholders like {id}, {resource_id}, etc.
   * Can accept extracted values from dependencies or generate UUIDs as fallback
   */
  urlTransform?: (
    url: string,
    config: TestConfig,
    extractedValues?: Record<string, any>
  ) => string;

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

  /**
   * Whether to enforce schema validation (default: true)
   */
  enforceSchemaValidation?: boolean;
}


/**
 * Test Generator Class
 * 
 * Provides a class-based approach for generating data-driven API tests from JSON configurations.
 * Supports both standalone tests and dependent tests (tests that require data from other API calls).
 * 
 * @example Basic Usage
 * ```typescript
 * const generator = new TestGenerator({
 *   dirname: __dirname,
 *   additionalTags: ['@regression'],
 * });
 * 
 * // Generate standalone tests
 * generator.generateStandaloneTests(standaloneConfigs);
 * 
 * // Generate dependent tests
 * generator.generateDependentTests(dependentConfigs, allConfigs);
 * ```
 * 
 * @example With Custom Options
 * ```typescript
 * const generator = new TestGenerator({
 *   dirname: __dirname,
 *   additionalTags: ['@smoke'],
 *   urlTransform: (url, config, extractedValues) => {
 *     if (url.includes('{uuid}')) {
 *       return url.replace('{uuid}', randomUUID());
 *     }
 *     return url;
 *   },
 *   titleFormatter: (method, url, description) => {
 *     return `[${method}] ${description}`;
 *   },
 *   enforceSchemaValidation: true,
 * });
 * ```
 */
export class TestGenerator {
  private readonly dirname: string;
  private readonly urlTransform?: (
    url: string,
    config: TestConfig,
    extractedValues?: Record<string, any>
  ) => string;
  private readonly titleFormatter: (
    method: string,
    url: string,
    description: string,
    pageId: string,
    config: TestConfig
  ) => string;
  private readonly additionalTags: string[];
  private readonly enforceSchemaValidation: boolean;

  /**
   * Creates a new TestGenerator instance
   *
   * @param options - Configuration options for the test generator
   */
  constructor(options: TestGeneratorOptions) {
    this.dirname = options.dirname;
    this.urlTransform = options.urlTransform;
    this.titleFormatter = options.titleFormatter || this.defaultTitleFormatter;
    this.additionalTags = options.additionalTags || [];
    this.enforceSchemaValidation = options.enforceSchemaValidation !== false; // Default true
  }

  /**
   * Default title formatter
   * @private
   */
  private defaultTitleFormatter(
    method: string,
    url: string,
    description: string,
    _pageId: string,
    _config: TestConfig
  ): string {
    return `${method} ${url} - ${description}`;
  }

  /**
   * Validates and loads JSON schema for response validation
   * @private
   */
  private async validateSchema(
    schemaPath: string | null | undefined,
    schemaValidator: any,
    responseData: any
  ): Promise<void> {
    if (!schemaPath) {
      if (this.enforceSchemaValidation) {
        throw new Error(
          'Schema validation is enforced but schemaPath is not defined in config'
        );
      }
      return;
    }

    const schema = await loadSchema(schemaPath, this.dirname);
    if (!schema) {
      throw new Error(`Failed to load schema: ${schemaPath}`);
    }

    schemaValidator.validateAndAssert(schema, responseData);
  }

  /**
   * Generates standalone test cases from configurations
   *
   * This method creates Playwright test cases for standalone API endpoints that don't require dependencies.
   * It handles the common pattern of:
   * 1. Building the endpoint URL
   * 2. Sending the request
   * 3. Validating response status
   * 4. Validating response schema
   *
   * @param configs - Array of test configurations
   *
   * @example
   * ```typescript
   * const generator = new TestGenerator({ dirname: __dirname });
   * generator.generateStandaloneTests(standaloneConfigs);
   * ```
   */
  public generateStandaloneTests(configs: LoadedConfig[]): void {
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
      const mergedTags = [...(tags || []), ...this.additionalTags];

      test.describe(testSuite || pageId, { tag: mergedTags }, () => {
        test(
          this.titleFormatter(method, url, description, pageId, config),
          async ({ sendRequest, schemaValidator }) => {
            // Set test timeout if specified in config
            if (timeout) {
              test.setTimeout(timeout);
            }

            // Arrange - Build endpoint URL
            let endPointUrl = url;

            // Apply custom URL transformation if provided
            if (this.urlTransform) {
              endPointUrl = this.urlTransform(endPointUrl, config);
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

            // Assert - Validate response schema
            await this.validateSchema(
              validations.schemaPath,
              schemaValidator,
              response.data
            );
          }
        );
      });
    }
  }

  /**
   * Generates dependent test cases from configurations
   *
   * This method creates Playwright test cases for API endpoints that require dependencies.
   * It handles:
   * 1. Executing dependencies in order
   * 2. Extracting values from dependency responses using filter expressions
   * 3. Replacing path parameters with extracted values
   * 4. Building the endpoint URL
   * 5. Sending the request
   * 6. Validating response status and schema
   *
   * @param configs - Array of dependent test configurations
   * @param allConfigs - All available configs (needed to resolve dependencies)
   *
   * @example
   * ```typescript
   * const generator = new TestGenerator({ dirname: __dirname });
   * generator.generateDependentTests(dependentConfigs, allConfigs);
   * ```
   */
  public generateDependentTests(
    configs: LoadedConfig[],
    allConfigs: LoadedConfig[]
  ): void {
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
      const mergedTags = [...(tags || []), ...this.additionalTags];

      test.describe(testSuite || pageId, { tag: mergedTags }, () => {
        test(
          this.titleFormatter(method, url, description, pageId, config),
          async ({ sendRequest, schemaValidator }) => {
            // Set test timeout if specified in config
            if (timeout) {
              test.setTimeout(timeout);
            }

            let endPointUrl = url;
            const extractedValues: Record<string, any> = {};

            // ARRANGE - Execute dependencies from config
            if (dependencies && dependencies.length > 0) {
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

                // Extract values from dependency response
                if (filter) {
                  const filteredValues = extractFilteredValues(
                    depResponse,
                    filter
                  );
                  Object.assign(extractedValues, filteredValues);
                } else {
                  // Fallback extraction logic
                  this.extractDefaultValues(depResponse, extractedValues);
                }
              }

              // Replace path parameters with extracted values
              endPointUrl = replacePathParameters(endPointUrl, extractedValues);
            }

            // Apply custom URL transformation if provided
            if (this.urlTransform) {
              endPointUrl = this.urlTransform(
                endPointUrl,
                config,
                extractedValues
              );
            }

            // Replace any remaining path parameters
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

            // Assert - Validate response schema
            await this.validateSchema(
              validations.schemaPath,
              schemaValidator,
              response.data
            );
          }
        );
      });
    }
  }

  /**
   * Default extraction logic for dependency responses
   * @private
   */
  private extractDefaultValues(
    depResponse: ApiResponse,
    extractedValues: Record<string, any>
  ): void {
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
