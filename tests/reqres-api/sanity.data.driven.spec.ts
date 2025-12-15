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

// Additional tags to add to all tests
const additionalTags = ['@sanity'];

// ============================================================================
// STANDALONE TESTS (no dependencies)
// ============================================================================
generateStandaloneTests(standaloneConfigs, {
  dirname: __dirname,
  additionalTags,
});

// ============================================================================
// DEPENDENT TESTS (require dependencies)
// ============================================================================
generateDependentTests(dependentConfigs, {
  dirname: __dirname,
  allConfigs,
  additionalTags,
});

