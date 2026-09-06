/**
 * Tenant management utilities
 * Handles tenant/organization storage and retrieval
 */

export const TENANT_STORAGE_KEY = 'selected_tenant';

export interface Tenant {
  id: string;
  name: string;
  schemaName?: string;
}

/**
 * Get the current tenant from localStorage
 */
export const getCurrentTenant = (): Tenant | null => {
  try {
    const stored = localStorage.getItem(TENANT_STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
};

/**
 * Set the current tenant in localStorage
 */
export const setCurrentTenant = (tenant: Tenant): void => {
  try {
    localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(tenant));
  } catch (error) {
    console.error('Failed to store tenant:', error);
  }
};

/**
 * Remove the current tenant from localStorage
 */
export const removeCurrentTenant = (): void => {
  try {
    localStorage.removeItem(TENANT_STORAGE_KEY);
  } catch (error) {
    console.error('Failed to remove tenant:', error);
  }
};

/**
 * Get tenant ID for API calls
 */
export const getTenantId = (): string | null => {
  const tenant = getCurrentTenant();
  return tenant?.id || null;
};

/**
 * Check if a tenant is selected
 */
export const hasTenant = (): boolean => {
  return !!getCurrentTenant();
};