import * as fs from 'fs';
import * as path from 'path';

export interface ProfileConfig {
  BASE_URL?: string;
  API_KEY?: string;
  USER_CLIENT_ID?: string;
  CLIENT_ID?: string;
  USER_CLIENT_SECRET?: string;
  CLIENT_SECRET?: string;
  TENANT_ID?: string;
  TENANT_TSG_ID?: string;
  TSG_ID?: string;
  SERVICE_NAME?: string;
  TEST_ENV?: string;
  AUTH_TYPE?: 'API_KEY' | 'OAUTH2';
}

/**
 * Load a profile configuration from JSON file
 */
export function loadProfile(
  profileName: string = 'default',
  tenantIndex: number = 0,
  tenantId?: string
): ProfileConfig {
  const profilePath = path.join(process.cwd(), 'profiles', `${profileName}.json`);

  if (!fs.existsSync(profilePath)) {
    console.warn(`Profile not found: ${profilePath}, using defaults`);
    return {};
  }

  try {
    const profileContent = fs.readFileSync(profilePath, 'utf-8');
    const profile = JSON.parse(profileContent) as ProfileConfig | ProfileConfig[];

    // Handle multi-tenant profiles (array)
    if (Array.isArray(profile)) {
      if (tenantId) {
        const tenantProfile = profile.find((p) => p.TENANT_ID === tenantId);
        if (tenantProfile) {
          return tenantProfile;
        }
      }
      if (tenantIndex >= 0 && tenantIndex < profile.length) {
        return profile[tenantIndex];
      }
      return profile[0] || {};
    }

    // Single tenant profile (object)
    return profile;
  } catch (error) {
    console.error(`Failed to load profile ${profileName}:`, error);
    return {};
  }
}

/**
 * Check if a profile is multi-tenant format
 */
export function isMultiTenantProfile(profileName: string): boolean {
  const profilePath = path.join(process.cwd(), 'profiles', `${profileName}.json`);

  if (!fs.existsSync(profilePath)) {
    return false;
  }

  try {
    const profileContent = fs.readFileSync(profilePath, 'utf-8');
    const profile = JSON.parse(profileContent);
    return Array.isArray(profile);
  } catch {
    return false;
  }
}

/**
 * Get all tenants from a multi-tenant profile
 */
export function getAllTenants(profileName: string): ProfileConfig[] {
  const profilePath = path.join(process.cwd(), 'profiles', `${profileName}.json`);

  if (!fs.existsSync(profilePath)) {
    return [];
  }

  try {
    const profileContent = fs.readFileSync(profilePath, 'utf-8');
    const profile = JSON.parse(profileContent);

    if (Array.isArray(profile)) {
      return profile;
    }

    return [profile];
  } catch {
    return [];
  }
}

