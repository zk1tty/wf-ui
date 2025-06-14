/**
 * Auth utilities for JWT handling and workflow ownership
 * Supports UUID-based ownership with NULL legacy workflows (Option B)
 */

export interface OwnershipCheckResponse {
  is_owner: boolean;
  owner_id: string | null;
  is_legacy: boolean;
}

/**
 * Check if current user owns a workflow
 * Handles UUID-based ownership and NULL legacy workflows
 */
export const checkWorkflowOwnership = async (
  jwt: string, 
  workflowId: string
): Promise<boolean> => {
  try {
    console.log('🔐 [Auth] Checking ownership for workflow:', workflowId);
    
    const response = await fetch(`/api/workflows/${workflowId}/ownership`, {
      headers: { 
        'Authorization': `Bearer ${jwt}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('🔐 [Auth] Ownership check failed:', response.status);
      return false;
    }
    
    const data: OwnershipCheckResponse = await response.json();
    console.log('🔐 [Auth] Ownership check result:', data);
    
    return data.is_owner;
  } catch (error) {
    console.error('🔐 [Auth] Error checking ownership:', error);
    return false;
  }
};

/**
 * Get stored JWT from sessionStorage
 */
export const getStoredJWT = (): string | null => {
  try {
    return sessionStorage.getItem('workflow_auth');
  } catch (error) {
    console.error('🔐 [Auth] Error getting stored JWT:', error);
    return null;
  }
};

/**
 * Check if user came from Chrome extension
 */
export const isFromExtension = (): boolean => {
  try {
    return sessionStorage.getItem('from_extension') === 'true';
  } catch (error) {
    console.error('🔐 [Auth] Error checking extension origin:', error);
    return false;
  }
};

/**
 * Clear stored auth data
 */
export const clearStoredAuth = (): void => {
  try {
    sessionStorage.removeItem('workflow_auth');
    sessionStorage.removeItem('from_extension');
    console.log('🔐 [Auth] Cleared stored auth data');
  } catch (error) {
    console.error('🔐 [Auth] Error clearing auth data:', error);
  }
};

/**
 * Check if JWT is likely expired (basic check without validation)
 */
export const isJWTLikelyExpired = (jwt: string): boolean => {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3 || !parts[1]) return true;
    
    const payload = JSON.parse(atob(parts[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp && payload.exp < now;
  } catch (error) {
    console.error('🔐 [Auth] Error checking JWT expiration:', error);
    return true; // Assume expired if we can't parse
  }
};

/**
 * Get user ID from JWT (without validation)
 */
export const getUserIdFromJWT = (jwt: string): string | null => {
  try {
    const parts = jwt.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    
    const payload = JSON.parse(atob(parts[1]));
    return payload.sub || payload.user_id || null;
  } catch (error) {
    console.error('🔐 [Auth] Error extracting user ID from JWT:', error);
    return null;
  }
};

/**
 * Determine edit permissions based on auth state and workflow ownership
 */
export const canEditWorkflow = (
  hasJWT: boolean,
  isOwner: boolean,
  isPublicWorkflow: boolean,
  isLegacyWorkflow: boolean = false
): boolean => {
  // No JWT = no editing
  if (!hasJWT) return false;
  
  // Owner can always edit
  if (isOwner) return true;
  
  // Legacy workflows (owner_id = NULL) can be edited by any authenticated user
  if (isLegacyWorkflow) return true;
  
  // Public workflows owned by others = read-only
  if (isPublicWorkflow && !isOwner) return false;
  
  // Private workflows = owner only
  return isOwner;
}; 