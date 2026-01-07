import {
  getDirname,
  loadConfigs,
  groupConfigsByType,
} from '../../src/helpers/configLoader';
import { TestGenerator } from '../../src/helpers/testGenerator';
import * as path from 'path';

// Get current directory in ES modules
const __dirname = getDirname(import.meta.url);

// Define config path
const REQRES_CONFIGS_PATH = path.join(
  __dirname,
  '../../applications/reqres-api/configs'
);

// Load ALL configs from reqres-api module
const allConfigs = loadConfigs(REQRES_CONFIGS_PATH);

// Group configs by standalone vs dependent
const { standalone: standaloneConfigs, dependent: dependentConfigs } =
  groupConfigsByType(allConfigs);

// Initialize Test Generator with shared configuration
const testGenerator = new TestGenerator({
  dirname: __dirname,
  additionalTags: ['@sanity'],
  enforceSchemaValidation: true, // Enforce schema validation for all tests
});

// ============================================================================
// STANDALONE TESTS (no dependencies)
// ============================================================================
testGenerator.generateStandaloneTests(standaloneConfigs);

// ============================================================================
// DEPENDENT TESTS (require dependencies)
// ============================================================================
testGenerator.generateDependentTests(dependentConfigs, allConfigs);

