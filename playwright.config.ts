import { Minute, Second } from './src/utils/time';
import { PlaywrightTestConfig, Project } from '@playwright/test';
import * as dotenv from 'dotenv';
import {
  loadProfile,
  getAllTenants,
  isMultiTenantProfile,
  ProfileConfig,
} from './src/helpers/profileLoader';

dotenv.config();

// Helper function to create environment config from a profile
const createEnvConfigFromProfile = (profile: ProfileConfig) => {
  return {
    baseURL:
      process.env.BASE_URL ||
      profile.BASE_URL ||
      'https://reqres.in',
    apiKey:
      process.env.API_KEY ||
      profile.API_KEY ||
      '',
    userClientId:
      process.env.USER_CLIENT_ID ||
      process.env.CLIENT_ID ||
      profile.USER_CLIENT_ID ||
      profile.CLIENT_ID,
    userClientSecret:
      process.env.USER_CLIENT_SECRET ||
      process.env.CLIENT_SECRET ||
      profile.USER_CLIENT_SECRET ||
      profile.CLIENT_SECRET,
    tenantId: process.env.TENANT_ID || profile.TENANT_ID || '',
    tenantTsgId:
      process.env.TENANT_TSG_ID ||
      process.env.TSG_ID ||
      profile.TENANT_TSG_ID ||
      profile.TSG_ID ||
      '',
    serviceName: process.env.SERVICE_NAME || profile.SERVICE_NAME || '',
    testEnv: process.env.TEST_ENV || profile.TEST_ENV || 'DEV',
    authType: (process.env.AUTH_TYPE || profile.AUTH_TYPE || 'API_KEY') as 'API_KEY' | 'OAUTH2',
  };
};

// Environment configuration with priority: .env > JSON profile > defaults
export const getEnvironmentConfig = () => {
  const isCI = !!process.env.CI;
  const profileName = process.env.PROFILE || 'dev';

  // Check if tenant-specific env vars are set (from project.env)
  if (
    process.env.BASE_URL &&
    (process.env.API_KEY || (process.env.CLIENT_ID && process.env.CLIENT_SECRET))
  ) {
    return {
      isCI,
      baseURL: process.env.BASE_URL,
      apiKey: process.env.API_KEY || '',
      userClientId: process.env.CLIENT_ID,
      userClientSecret: process.env.CLIENT_SECRET,
      tenantId: process.env.TENANT_ID || '',
      tenantTsgId: process.env.TENANT_TSG_ID || process.env.TSG_ID || '',
      serviceName: process.env.SERVICE_NAME || '',
      testEnv: process.env.TEST_ENV || 'DEV',
      authType: (process.env.AUTH_TYPE || 'API_KEY') as 'API_KEY' | 'OAUTH2',
      sessionId: process.env.PLAYWRIGHT_SESSION_ID || 'unknown-session',
    };
  }

  // Fallback to profile loading (single tenant mode)
  const tenantIndex = process.env.TENANT_INDEX
    ? parseInt(process.env.TENANT_INDEX, 10)
    : 0;
  const tenantId = process.env.TENANT_ID;
  const profile = loadProfile(profileName, tenantIndex, tenantId);
  const envConfig = createEnvConfigFromProfile(profile);

  return {
    isCI,
    ...envConfig,
    sessionId: process.env.PLAYWRIGHT_SESSION_ID || 'unknown-session',
  };
};

// Export a getter function that evaluates config dynamically
export const getEnvConfig = () => getEnvironmentConfig();

// For backward compatibility, export ENV_CONFIG (but it will use default profile)
export const ENV_CONFIG = getEnvironmentConfig();

// Build projects dynamically based on profile configuration
const buildProjects = (): Project[] => {
  const profileName = process.env.PROFILE || 'dev';
  const isMultiTenant = isMultiTenantProfile(profileName);

  // If CI env vars are set directly, create project
  const hasDirectEnvVars =
    process.env.BASE_URL &&
    (process.env.API_KEY || (process.env.CLIENT_ID && process.env.CLIENT_SECRET));

  if (hasDirectEnvVars) {
    const projectName = process.env.TENANT_ID || 'api-tests';
    return [
      {
        name: projectName,
        use: {
          baseURL: process.env.BASE_URL,
        },
        testDir: 'tests',
        testMatch: ['**/*.spec.ts'],
      },
    ];
  }

  const tenants = getAllTenants(profileName);

  // If no tenants found, create fallback project
  if (tenants.length === 0) {
    return [
      {
        name: 'api-tests',
        use: {
          baseURL: ENV_CONFIG.baseURL,
        },
        testDir: 'tests',
        testMatch: ['**/*.spec.ts'],
      },
    ];
  }

  // Single profile format - use 'api-tests' as project name
  if (!isMultiTenant) {
    return [
      {
        name: 'api-tests',
        use: {
          baseURL: ENV_CONFIG.baseURL,
        },
        testDir: 'tests',
        testMatch: ['**/*.spec.ts'],
      },
    ];
  }

  // Multi-tenant format - create one project per tenant
  return tenants.map((tenant, index) => {
    const tenantConfig = createEnvConfigFromProfile(tenant);
    const projectName = tenant.TENANT_ID || `tenant-${index}`;

    return {
      name: projectName,
      use: {
        baseURL: tenantConfig.baseURL,
      },
      testDir: 'tests',
      testMatch: ['**/*.spec.ts'],
      env: {
        BASE_URL: tenantConfig.baseURL || '',
        API_KEY: tenantConfig.apiKey || '',
        CLIENT_ID: tenantConfig.userClientId || '',
        CLIENT_SECRET: tenantConfig.userClientSecret || '',
        TENANT_ID: tenantConfig.tenantId || '',
        TENANT_TSG_ID: tenantConfig.tenantTsgId || '',
        TSG_ID: tenantConfig.tenantTsgId || '',
        SERVICE_NAME: tenantConfig.serviceName || '',
        TEST_ENV: tenantConfig.testEnv || 'DEV',
        AUTH_TYPE: tenantConfig.authType || 'API_KEY',
        TENANT_INDEX: index.toString(),
        PROFILE: process.env.PROFILE || 'dev',
      },
    };
  });
};

const config: PlaywrightTestConfig = {
  globalSetup: './src/global-setup.ts',
  testDir: './tests',
  timeout: 5 * Minute,
  retries: ENV_CONFIG.isCI ? 2 : 0,
  workers: ENV_CONFIG.isCI ? 10 : 5,
  globalTimeout: 60 * Minute,
  forbidOnly: !!ENV_CONFIG.isCI,
  expect: {
    timeout: 30 * Second,
  },
  repeatEach: ENV_CONFIG.isCI ? 1 : 0,
  fullyParallel: true,
  maxFailures: 20,
  reporter: ENV_CONFIG.isCI
    ? [
        ['list'],
        ['html', { outputFolder: 'playwright/report', open: 'never' }],
        ['junit', { outputFile: 'playwright/report/results.xml' }],
        ['json', { outputFile: 'playwright/report/results.json' }],
        ['blob', { outputDir: 'playwright/blob-report' }],
      ]
    : [
        ['list'],
        ['html', { outputFolder: 'playwright/report', open: 'never' }],
        ['junit', { outputFile: 'playwright/report/results.xml' }],
        ['json', { outputFile: 'playwright/report/results.json' }],
      ],
  use: {
    baseURL: ENV_CONFIG.baseURL,
    ignoreHTTPSErrors: true,
    trace: {
      mode: 'retain-on-failure',
      snapshots: true,
      screenshots: true,
      sources: true,
    },
    screenshot: { mode: 'on', fullPage: true },
    video: ENV_CONFIG.isCI ? 'retain-on-failure' : 'on',
  },
  projects: buildProjects(),
  outputDir: 'playwright/output',
  testMatch: ['**/*.spec.ts'],
};

export default config;

