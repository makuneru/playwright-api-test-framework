# Playwright API Testing Framework

A data-driven API testing framework built on Playwright with support for both API_KEY and OAuth2 authentication. Supports both automated test generation and Triple (Arrange-Act-Assert) test patterns.

## Features

- 🔐 **Dual Authentication Support**: API_KEY and OAuth2 authentication with automatic token caching
- 📋 **JSON Schema Validation**: Automatic response validation using JSON Schema Draft-07
- 🎯 **Data-Driven Testing**: JSON-based test configurations with flexible dependency management
- 🔄 **Smart Dependency Management**: Automatic execution of dependent APIs with flexible value extraction
- 🌍 **Multi-Environment Support**: JSON profiles for easy environment switching (dev, default)
- 📊 **Request Tracking**: Automatic request/response logging with RequestId, SessionId, and Client-PageId headers
- 🧪 **Type-Safe TypeScript**: Full TypeScript with proper types throughout
- 🚀 **Test Generation Helpers**: Automated test generation for standalone and dependent tests
- 🎨 **Multiple Testing Patterns**: Support for both data-driven and triple AAA test patterns
- 🔍 **Flexible Value Extraction**: Support for dot-notation and JavaScript expressions to extract values from dependency responses

## Project Structure

```
playwright-api-test-framework/
├── applications/              # API service configurations
│   └── reqres-api/
│       ├── configs/           # Test configuration files (JSON)
│       │   ├── get.users.json
│       │   ├── get.user.by.id.json
│       │   └── ...
│       └── schemas/           # JSON Schema validation files
│           ├── get.users.schema.json
│           ├── get.user.by.id.schema.json
│           └── ...
├── profiles/                 # Environment profiles
│   ├── dev.json              # Development environment
│   └── default.json          # Default environment
├── src/                      # Source code
│   ├── fixtures/             # Playwright fixtures
│   │   └── base.ts           # Base fixtures (sendRequest, schemaValidator, etc.)
│   ├── helpers/              # Helper functions
│   │   ├── authenticator.ts  # Authentication (API_KEY & OAuth2)
│   │   ├── request.ts        # API request handling with custom headers
│   │   ├── configLoader.ts   # Config file loader with filter support
│   │   ├── schemaValidator.ts # JSON Schema validation
│   │   ├── testGenerator.ts  # Automated test generation helpers
│   │   ├── urlBuilder.ts     # URL building with query parameters
│   │   └── profileLoader.ts  # Environment profile loader
│   ├── utils/                # Utility functions
│   │   ├── decorators/
│   │   │   └── step.ts       # @step decorator for test reporting
│   │   └── time.ts           # Time constants
│   └── global-setup.ts       # Global test setup (session ID generation)
├── tests/                    # Test files
│   └── reqres-api/           # ReqRes API tests
│       ├── sanity.data.driven.spec.ts  # Data-driven tests using testGenerator
│       └── users.spec.ts     # triple AAA pattern tests
└── playwright.config.ts      # Playwright configuration
```

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Profile

Edit `profiles/dev.json` to set your API key and base URL:

```json
{
  "BASE_URL": "https://reqres.in",
  "API_KEY": "your-api-key-here",
  "TEST_ENV": "DEV",
  "AUTH_TYPE": "API_KEY"
}
```

### 3. Run Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:reqres

# Run with UI
npm run test:ui

# View test report
npm run test:report
```

## Authentication

### API_KEY Authentication

Set `AUTH_TYPE: "API_KEY"` in your profile and provide `API_KEY`:

```json
{
  "AUTH_TYPE": "API_KEY",
  "API_KEY": "your-api-key-here"
}
```

The API key will be sent in the `x-api-key` header.

### OAuth2 Authentication

Set `AUTH_TYPE: "OAUTH2"` in your profile and provide OAuth2 credentials:

```json
{
  "AUTH_TYPE": "OAUTH2",
  "CLIENT_ID": "your-client-id",
  "CLIENT_SECRET": "your-client-secret",
  "TENANT_TSG_ID": "your-tsg-id"
}
```

The framework will automatically:
- Request bearer tokens from the OAuth2 endpoint
- Cache tokens and refresh before expiry
- Include tokens in the `Authorization` header

## Request Tracking Headers

All requests automatically include these tracking headers:

- **RequestId**: Unique identifier for each individual request (UUID)
- **SessionId**: Fixed identifier for the entire test run session (UUID)
- **Client-PageId**: Identifies the page/feature that initiated the request (from config's `pageId`)

## Writing Tests

### Approach 1: Data-Driven Tests (Recommended)

Use the `testGenerator.ts` helper for automated test generation from JSON configs.

### Approach 2: Triple AAA Pattern Tests

Write tests manually using the Arrange-Act-Assert pattern for more control.

---

### 1. Create Test Configuration

Create a JSON config file in `applications/{service}/configs/`:

**Standalone Test Config** (`get.users.json`):
```json
{
  "pageId": "GET_USERS",
  "testSuite": "ReqRes API",
  "description": "Get list of users",
  "url": "/api/users",
  "method": "GET",
  "params": {
    "page": 1,
    "per_page": 6
  },
  "mode": "standalone",
  "tags": ["@reqres", "@get", "@users", "@standalone"],
  "validations": {
    "status": {
      "code": 200,
      "message": "OK"
    },
    "schemaPath": "../../applications/reqres-api/schemas/get.users.schema.json"
  }
}
```

**Dependent Test Config** (`get.user.by.id.json`):
```json
{
  "pageId": "GET_USER_BY_ID",
  "testSuite": "ReqRes API",
  "description": "Get user by ID",
  "url": "/api/users/{id}",
  "method": "GET",
  "mode": "dependent",
  "tags": ["@reqres", "@get", "@users", "@dependent"],
  "dependencies": ["GET_USERS"],
  "filter": {
    "id": "data.data.find(u => u.email.includes('george'))?.id || data.data[0]?.id"
  },
  "validations": {
    "status": {
      "code": 200,
      "message": "OK"
    },
    "schemaPath": "../../applications/reqres-api/schemas/get.user.by.id.schema.json"
  }
}
```

**Key Config Fields**:
- `pageId`: Unique identifier (UPPERCASE_WITH_UNDERSCORES) - used in Client-PageId header
- `mode`: `"standalone"` (no dependencies) or `"dependent"` (requires dependencies)
- `dependencies`: Array of `pageId`s to execute before this test (required for dependent mode)
- `filter`: Optional object to extract values from dependency responses (supports dot-notation and JavaScript expressions)
- `tags`: Array of tags for test filtering

### 2. Create JSON Schema

Create a schema file in `applications/{service}/schemas/`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Get Users Response",
  "description": "JSON Schema for Get Users API response - GET /api/users",
  "type": "object",
  "properties": {
    "page": { "type": "number" },
    "per_page": { "type": "number" },
    "total": { "type": "number" },
    "total_pages": { "type": "number" },
    "data": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "number" },
          "email": { "type": "string", "format": "email" },
          "first_name": { "type": "string" },
          "last_name": { "type": "string" },
          "avatar": { "type": "string", "format": "uri" }
        },
        "required": ["id", "email", "first_name", "last_name", "avatar"]
      }
    }
  },
  "required": ["page", "per_page", "total", "total_pages", "data"]
}
```

### 3. Create Test File

#### Option A: Data-Driven Tests (Using testGenerator)

Create a test file using the `testGenerator` helper (`tests/reqres-api/sanity.data.driven.spec.ts`):

```typescript
import {
  getDirname,
  loadConfigs,
  groupConfigsByType,
} from '../../src/helpers/configLoader';
import {
  generateStandaloneTests,
  generateDependentTests,
} from '../../src/helpers/testGenerator';
import * as path from 'path';

const __dirname = getDirname(import.meta.url);
const REQRES_CONFIGS_PATH = path.join(
  __dirname,
  '../../applications/reqres-api/configs'
);

// Load ALL configs
const allConfigs = loadConfigs(REQRES_CONFIGS_PATH);

// Group configs by standalone vs dependent
const { standalone: standaloneConfigs, dependent: dependentConfigs } =
  groupConfigsByType(allConfigs);

// Additional tags to add to all tests
const additionalTags = ['@sanity'];

// Generate standalone tests
generateStandaloneTests(standaloneConfigs, {
  dirname: __dirname,
  additionalTags,
});

// Generate dependent tests
generateDependentTests(dependentConfigs, {
  dirname: __dirname,
  allConfigs,
  additionalTags,
});
```

#### Option B: Triple AAA Pattern Tests

Create a test file with triple AAA pattern (`tests/reqres-api/users.spec.ts`):

```typescript
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

const __dirname = getDirname(import.meta.url);
const REQRES_CONFIGS_PATH = path.join(
  __dirname,
  '../../applications/reqres-api/configs'
);

const allConfigs = loadConfigs(REQRES_CONFIGS_PATH);
const userConfigs = allConfigs.filter((c) =>
  c.config.tags?.includes('@users')
);

const additionalTags = ['@regression', '@users'];

test.describe('Users API Tests', { tag: additionalTags }, () => {
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
```

## Filter Expressions

The `filter` field in dependent test configs supports two formats for extracting values from dependency responses:

### Dot-Notation (Simple Path)
```json
{
  "filter": {
    "id": ".data[0].id"
  }
}
```

### JavaScript Expressions (Advanced)
```json
{
  "filter": {
    "id": "data.data.find(u => u.email.includes('george'))?.id || data.data[0]?.id"
  }
}
```

JavaScript expressions have access to the full response object and can use:
- Array methods: `find()`, `filter()`, `map()`, etc.
- Optional chaining: `?.`
- Logical operators: `||`, `&&`
- Conditional logic for complex extraction scenarios

## Environment Variables

You can override profile settings using environment variables:

```bash
BASE_URL=https://api.example.com
API_KEY=your-api-key
AUTH_TYPE=API_KEY
PROFILE=dev
```

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests by Tags
```bash
# Run sanity tests
npm test -- --grep "@sanity"

# Run regression tests
npm test -- --grep "@regression"

# Run user-related tests
npm test -- --grep "@users"

# Run standalone tests only
npm test -- --grep "@standalone"

# Run dependent tests only
npm test -- --grep "@dependent"
```

### Run Specific Test File
```bash
npm test -- tests/reqres-api/users.spec.ts
npm test -- tests/reqres-api/sanity.data.driven.spec.ts
```

### Run with UI Mode
```bash
npm run test:ui
```

### View Test Report
```bash
npm run test:report
```

## Profiles

Profiles are JSON files in the `profiles/` directory. Each profile can contain:

- `BASE_URL`: API base URL
- `API_KEY`: API key for API_KEY authentication
- `CLIENT_ID`: OAuth2 client ID
- `CLIENT_SECRET`: OAuth2 client secret
- `TENANT_TSG_ID`: Tenant TSG ID for OAuth2
- `TEST_ENV`: Environment name (DEV, QA, PROD)
- `AUTH_TYPE`: Authentication type (API_KEY or OAUTH2)

**Example Profile** (`profiles/dev.json`):
```json
{
  "BASE_URL": "https://reqres.in",
  "API_KEY": "reqres_14cb9c4db13c4e05bc24a82f1d3d1fea",
  "TEST_ENV": "DEV",
  "AUTH_TYPE": "API_KEY"
}
```

## Scripts

- `npm test` - Run all tests
- `npm run test:ui` - Run tests with Playwright UI
- `npm run test:report` - View test report
- `npm run type-check` - TypeScript type checking

## Test Generation Helpers

The framework provides helper functions in `src/helpers/testGenerator.ts`:

- **`generateStandaloneTests()`**: Generates tests for standalone endpoints (no dependencies)
- **`generateDependentTests()`**: Generates tests for dependent endpoints (with dependencies and filter support)

These helpers automatically:
- Build URLs with query parameters
- Handle path parameter replacement (`{id}`, `{resource_id}`, etc.)
- Execute dependencies in order
- Extract values using filter expressions
- Validate response status codes
- Validate response schemas
- Apply additional tags to all generated tests

## Best Practices

1. **Use Data-Driven Tests**: Prefer `testGenerator.ts` for consistent test patterns
2. **Use Manual Tests**: Use AAA pattern when you need custom logic or complex assertions
3. **Filter Expressions**: Use JavaScript expressions for complex value extraction
4. **Schema Validation**: Always include JSON schemas for response validation
5. **Tags**: Use descriptive tags for test organization and filtering
6. **PageId Naming**: Use UPPERCASE_WITH_UNDERSCORES format (e.g., `GET_USERS`, `CREATE_USER`)
7. **Dependencies**: Keep dependency chains simple and avoid circular dependencies

## License

ISC
