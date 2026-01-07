# GitHub Actions CI/CD Setup

This directory contains GitHub Actions workflows for running Playwright API tests in CI/CD pipelines.

## Workflow: `test.yml`

The test workflow runs Playwright API tests using Docker containers and supports environment-specific configurations.

### Features

- ✅ Runs tests in Playwright Docker container (`mcr.microsoft.com/playwright:v1.57.0-noble`)
- ✅ Supports GitHub Environment variables for API_KEY
- ✅ Environment-specific configurations (production/development)
- ✅ Automatic test result reporting and artifact uploads
- ✅ JUnit XML and JSON test result exports

### Setup Instructions

#### 1. Configure GitHub Environment Variables

Go to your repository → **Settings** → **Environments** → Create environments:

**For `development` environment:**
- **Secrets:**
  - `API_KEY`: Your API key (required)

- **Variables (optional):**
  - `BASE_URL`: API base URL (default: `https://reqres.in`)
  - `AUTH_TYPE`: Authentication type (default: `API_KEY`)
  - `TEST_ENV`: Test environment name (default: `CI`)
  - `PROFILE`: Profile name to use (default: `default`)

**For `production` environment:**
- Same configuration as development, but with production values

#### 2. Environment Variable Priority

The workflow uses the following priority order:
1. GitHub Environment Variables (`vars.*`)
2. GitHub Secrets (`secrets.*`)
3. Default values in the workflow

#### 3. Workflow Triggers

The workflow runs automatically on:
- Push to `master` or `develop` branches
- Pull requests to `master` or `develop` branches
- Manual trigger via `workflow_dispatch`

#### 4. Environment Selection

The workflow automatically selects the environment based on the branch:
- `master` branch → `production` environment
- Other branches → `development` environment

### Artifacts

The workflow generates and uploads the following artifacts:

- **playwright-report**: HTML test report (30 days retention)
- **junit-results**: JUnit XML format for CI integration (30 days retention)
- **json-results**: JSON format for programmatic access (30 days retention)

### Test Results

Test results are automatically published as:
- GitHub Actions check run annotations
- Pull request comments (for PRs)

### Example Configuration

```yaml
# GitHub Environment: development
Secrets:
  API_KEY: "your-dev-api-key-here"

Variables:
  BASE_URL: "https://api-dev.example.com"
  AUTH_TYPE: "API_KEY"
  TEST_ENV: "DEV"
  PROFILE: "dev"
```

```yaml
# GitHub Environment: production
Secrets:
  API_KEY: "your-prod-api-key-here"

Variables:
  BASE_URL: "https://api.example.com"
  AUTH_TYPE: "API_KEY"
  TEST_ENV: "PROD"
  PROFILE: "prod"
```

### Troubleshooting

#### Tests fail with "API_KEY not found"
- Ensure the GitHub Environment has `API_KEY` secret configured
- Verify the environment name matches (`development` or `production`)

#### Tests fail with connection errors
- Check `BASE_URL` variable is set correctly
- Verify the API endpoint is accessible from GitHub Actions runners

#### Docker container issues
- The workflow uses `mcr.microsoft.com/playwright:v1.57.0-noble`
- Ensure Node.js version compatibility (container includes Node.js 20)

### Manual Run

To manually trigger the workflow:
1. Go to **Actions** tab in GitHub
2. Select **API Tests** workflow
3. Click **Run workflow**
4. Select branch and click **Run workflow**

