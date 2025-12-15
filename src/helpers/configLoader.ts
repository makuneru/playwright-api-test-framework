import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

/**
 * API Response structure
 */
export interface ApiResponse {
  status: number;
  data: any;
  headers: Record<string, string>;
}

/**
 * Configuration structure loaded from JSON files
 */
export interface TestConfig {
  pageId: string;
  testSuite: string;
  description: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  params?: Record<string, string | number | boolean>;
  payload?: any;
  mode?: 'standalone' | 'dependent';
  tags?: string[];
  dependencies?: string[];
  timeout?: number;
  enable?: boolean;
  filter?: Record<string, string>; // Optional filter expressions to extract values from dependency responses (e.g., { "user_id": ".data[0].id" })
  validations: {
    status: {
      code: number;
      message: string;
    };
    schemaPath: string | null;
  };
}

/**
 * Loaded configuration with metadata
 */
export interface LoadedConfig {
  pageId: string;
  config: TestConfig;
  filename: string;
}

/**
 * Load config files from a directory path
 */
export function loadConfigs(configPath: string): LoadedConfig[] {
  if (!fs.existsSync(configPath)) {
    console.warn(`Config directory not found: ${configPath}`);
    return [];
  }

  const configFiles = fs.readdirSync(configPath).filter((file) => {
    return file.endsWith('.json');
  });

  const configs = configFiles
    .map((file) => {
      const filePath = path.join(configPath, file);
      const configData = JSON.parse(
        fs.readFileSync(filePath, 'utf-8')
      ) as TestConfig;

      const pageId =
        configData.pageId ||
        file
          .replace('.json', '')
          .split('.')
          .map((part) => part.toUpperCase())
          .join('_');

      return {
        pageId,
        config: configData,
        filename: file.replace('.json', ''),
      };
    })
    .filter((loadedConfig) => {
      return loadedConfig.config.enable !== false;
    });

  return configs;
}

/**
 * Group configurations by standalone vs dependent
 */
export function groupConfigsByType(configs: LoadedConfig[]): {
  standalone: LoadedConfig[];
  dependent: LoadedConfig[];
} {
  const standalone = configs.filter(
    (c) => (c.config.mode || 'standalone') === 'standalone'
  );
  const dependent = configs.filter((c) => c.config.mode === 'dependent');

  console.log(
    `Grouped configs - Standalone: ${standalone.length}, Dependent: ${dependent.length}`
  );

  return { standalone, dependent };
}

/**
 * Dynamically load a schema from a JSON file
 */
export async function loadSchema(
  schemaPath: string | null,
  baseDir: string
): Promise<object | null> {
  if (!schemaPath) {
    return null;
  }

  const fullPath = path.join(baseDir, schemaPath);

  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `Schema file not found: ${fullPath}\n` +
        `Schema validation is required when schemaPath is specified in config.\n` +
        `Please create the schema file or set schemaPath to null if validation is not needed.`
    );
  }

  try {
    const schemaContent = fs.readFileSync(fullPath, 'utf-8');
    const schema = JSON.parse(schemaContent);
    return schema;
  } catch (error) {
    throw new Error(
      `Failed to load or parse schema from ${schemaPath}: ${error instanceof Error ? error.message : error}`
    );
  }
}

/**
 * Convenience function to get directory path from import.meta.url
 */
export function getDirname(importMetaUrl: string): string {
  const __filename = fileURLToPath(importMetaUrl);
  return path.dirname(__filename);
}

/**
 * Check if a filter string is a JavaScript expression (contains operators, function calls, etc.)
 *
 * @param filter - The filter string to check
 * @returns True if it appears to be a JavaScript expression
 */
function isJavaScriptExpression(filter: string): boolean {
  // Remove leading dot if present (for backward compatibility)
  const trimmed = filter.startsWith('.') ? filter.substring(1) : filter;
  
  // Check for JavaScript expression patterns
  const expressionPatterns = [
    /\(/,                    // Function calls or parentheses
    /=>/,                    // Arrow functions
    /\.(map|filter|find|reduce|some|every|forEach|sort|slice|includes|indexOf|split|join|replace|match|test)\(/, // Array/Object methods
    /Math\./,                // Math functions
    /\.\.\./,                // Spread operator
    /===|!==|>=|<=|>|<|&&|\|\||!/, // Comparison/logical operators
    /\?\?|\?\./,             // Nullish coalescing, optional chaining
  ];

  return expressionPatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Safely evaluate a JavaScript expression with data available in context
 *
 * @param expression - JavaScript expression string
 * @param data - The data object to make available as 'data' variable
 * @returns The evaluated result
 */
function evaluateJavaScriptExpression(expression: string, data: any): any {
  // Remove leading dot if present (for backward compatibility)
  const trimmed = expression.startsWith('.') ? expression.substring(1) : expression;
  
  try {
    // Create a safe evaluation context with data available
    // Using Function constructor to create an isolated scope
    const func = new Function('data', `return ${trimmed}`);
    return func(data);
  } catch (error) {
    throw new Error(
      `Failed to evaluate JavaScript expression "${expression}": ${error instanceof Error ? error.message : error}`
    );
  }
}

/**
 * Extract a value from a response object using either:
 * 1. Dot-notation path (e.g., ".data[0].id")
 * 2. JavaScript expression (e.g., "Math.max(...data.map(person => person.age))")
 *
 * Supports paths like:
 * - `.id` - extracts root id property
 * - `.data[0].id` - extracts id from first element of data array
 * - `.data.data[0].id` - extracts id from nested structure
 *
 * Supports JavaScript expressions like:
 * - `data.filter(person => person.age === Math.max(...data.map(p => p.age)))[0]?.name`
 * - `Math.max(...data.map(person => person.age))`
 * - `data.find(item => item.status === 'active')?.id`
 *
 * @param responseData - The response data object (will be available as 'data' in expressions)
 * @param pathOrExpression - Dot-notation path or JavaScript expression
 * @returns The extracted value or undefined if path doesn't exist
 *
 * @example
 * ```typescript
 * // Dot-notation example
 * const responseData = { header: {...}, data: [{ id: "123" }] };
 * const id = extractValueFromResponse(responseData, ".data[0].id"); // "123"
 *
 * // JavaScript expression example
 * const people = { data: [{ name: "Chris", age: 23 }, { name: "Emily", age: 19 }] };
 * const maxAge = extractValueFromResponse(people, "Math.max(...data.map(p => p.age))"); // 23
 * const oldestName = extractValueFromResponse(people, "data.find(p => p.age === Math.max(...data.map(p => p.age)))?.name"); // "Chris"
 * ```
 */
export function extractValueFromResponse(
  responseData: any,
  pathOrExpression: string
): any {
  if (!pathOrExpression) {
    throw new Error(`Filter path/expression cannot be empty`);
  }

  // Check if it's a JavaScript expression
  if (isJavaScriptExpression(pathOrExpression)) {
    return evaluateJavaScriptExpression(pathOrExpression, responseData);
  }

  // Otherwise, treat as dot-notation path
  if (!pathOrExpression.startsWith('.')) {
    throw new Error(
      `Filter path must start with '.' for dot-notation (e.g., '.data[0].id') or be a JavaScript expression`
    );
  }

  // Remove leading dot
  const cleanPath = pathOrExpression.substring(1);
  if (!cleanPath) {
    return responseData;
  }

  // Split by dots and handle array indices
  const parts = cleanPath.split(/\.(?![^\[]*\])/);
  let current = responseData;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }

    // Check if part contains array index (e.g., "data[0]")
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, property, index] = arrayMatch;
      current = current[property];
      if (Array.isArray(current)) {
        current = current[parseInt(index, 10)];
      } else {
        return undefined;
      }
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Extract values from dependency responses using filter expressions
 *
 * Supports both dot-notation paths and JavaScript expressions:
 * - Dot-notation: `{ "user_id": ".data[0].id" }`
 * - JavaScript: `{ "max_age": "Math.max(...data.map(person => person.age))" }`
 *
 * @param dependencyResponse - The API response from a dependency
 * @param filter - Filter expressions mapping variable names to paths/expressions
 * @returns Object mapping variable names to extracted values
 *
 * @example
 * ```typescript
 * // Dot-notation example
 * const response: ApiResponse = { 
 *   status: 200, 
 *   data: { header: {...}, data: [{ id: "123" }] }, 
 *   headers: {} 
 * };
 * const values = extractFilteredValues(response, { "user_id": ".data[0].id" });
 * // { user_id: "123" }
 *
 * // JavaScript expression example
 * const userListResponse: ApiResponse = {
 *   status: 200,
 *   data: {
 *     data: [
 *       { id: 1, name: "John", age: 30 },
 *       { id: 2, name: "Jane", age: 25 }
 *     ]
 *   },
 *   headers: {}
 * };
 * 
 * // Extract ID of user with maximum age
 * const maxAgeId = extractFilteredValues(userListResponse, {
 *   user_id: "data.data.find(p => p.age === Math.max(...data.data.map(u => u.age)))?.id"
 * });
 * // { user_id: 1 }
 * ```
 */
export function extractFilteredValues(
  dependencyResponse: ApiResponse,
  filter: Record<string, string> | undefined
): Record<string, any> {
  const extractedValues: Record<string, any> = {};

  if (!filter || Object.keys(filter).length === 0) {
    return extractedValues;
  }

  for (const [variableName, pathOrExpression] of Object.entries(filter)) {
    try {
      const value = extractValueFromResponse(
        dependencyResponse.data,
        pathOrExpression
      );
      if (value !== undefined && value !== null) {
        extractedValues[variableName] = value;
      }
    } catch (error) {
      throw new Error(
        `Failed to extract value for '${variableName}' using filter '${pathOrExpression}': ${error instanceof Error ? error.message : error}`
      );
    }
  }

  return extractedValues;
}

/**
 * Replace path parameters in a URL with values from extractedValues or generate UUIDs
 *
 * This function:
 * 1. Finds all path parameters in the format {parameter_name}
 * 2. Replaces them with values from extractedValues if available
 * 3. Generates random UUIDs for any remaining placeholders
 *
 * @param url - URL string that may contain path parameters like {user_id}, {elementId}, etc.
 * @param extractedValues - Object mapping parameter names to values
 * @returns URL with all path parameters replaced
 *
 * @example
 * ```typescript
 * const url = "/api/users/{user_id}/element/{elementId}";
 * const values = { user_id: "123" };
 * const result = replacePathParameters(url, values);
 * // "/api/users/123/element/{uuid-generated}"
 * ```
 */
export function replacePathParameters(
  url: string,
  extractedValues: Record<string, any>
): string {
  // Find all path parameters in the format {parameter_name}
  const pathParamRegex = /\{([^}]+)\}/g;
  let result = url;
  const matches = Array.from(url.matchAll(pathParamRegex));

  // Use a Set to track unique placeholders to avoid duplicate replacements
  const processedPlaceholders = new Set<string>();

  for (const match of matches) {
    const placeholder = match[0]; // e.g., "{user_id}"
    const paramName = match[1]; // e.g., "user_id"

    // Skip if we've already processed this placeholder
    if (processedPlaceholders.has(placeholder)) {
      continue;
    }
    processedPlaceholders.add(placeholder);

    // Determine replacement value
    let replacementValue: string;
    if (extractedValues[paramName] !== undefined) {
      replacementValue = String(extractedValues[paramName]);
    } else {
      // If not found, generate a random UUID for the placeholder
      replacementValue = randomUUID();
    }

    // Replace all occurrences of this placeholder (using global regex)
    const placeholderRegex = new RegExp(
      placeholder.replace(/[{}]/g, '\\$&'),
      'g'
    );
    result = result.replace(placeholderRegex, replacementValue);
  }

  return result;
}

