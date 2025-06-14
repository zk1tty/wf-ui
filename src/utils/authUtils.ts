/**
 * Auth utilities for session token handling and workflow ownership
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
 * Uses session-based API call (no Authorization headers)
 */
export const checkWorkflowOwnership = async (
  sessionToken: string, 
  workflowId: string
): Promise<boolean> => {
  try {
    console.log('🔐 [Auth] Checking ownership for workflow:', workflowId);
    
    // Import sessionApiFetch dynamically to avoid circular imports
    const { sessionApiFetch } = await import('@/lib/api');
    
    const data: OwnershipCheckResponse = await sessionApiFetch(
      `/workflows/${workflowId}/ownership`,
      {
        sessionToken,
        body: JSON.stringify({ workflow_id: workflowId }),
        method: 'POST'
      }
    );
    
    console.log('🔐 [Auth] Ownership check result:', data);
    return data.is_owner;
  } catch (error) {
    console.error('🔐 [Auth] Error checking ownership:', error);
    return false;
  }
};

/**
 * Get stored session token from sessionStorage
 */
export const getStoredSessionToken = (): string | null => {
  try {
    return sessionStorage.getItem('workflow_session_token');
  } catch (error) {
    console.error('🔐 [Auth] Error getting stored session token:', error);
    return null;
  }
};

/**
 * Check if user came from Chrome extension
 * @deprecated Use isFromExtension from extensionUtils instead
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
 * Initialize session from Chrome extension (simplified)
 * This replaces complex JWT handling with simple session token storage
 */
export const initializeSessionFromExtension = (sessionToken: string): void => {
  try {
    storeSessionToken(sessionToken);
    console.log('🔐 [Auth] Session initialized from Chrome extension');
  } catch (error) {
    console.error('🔐 [Auth] Error initializing session from extension:', error);
  }
};

/**
 * Clear stored auth data
 */
export const clearStoredAuth = (): void => {
  try {
    sessionStorage.removeItem('workflow_session_token');
    sessionStorage.removeItem('workflow_auth_type');
    sessionStorage.removeItem('from_extension');
    console.log('🔐 [Auth] Cleared stored auth data');
  } catch (error) {
    console.error('🔐 [Auth] Error clearing auth data:', error);
  }
};

/**
 * Check if session token exists (simplified - no client-side validation)
 * Note: All validation is done by backend with Supabase
 */
export const hasValidSessionToken = (sessionToken: string | null): boolean => {
  // Simple existence check - backend will validate with Supabase
  return typeof sessionToken === 'string' && sessionToken.trim().length > 0;
};

/**
 * Store session token and mark auth type
 */
export const storeSessionToken = (sessionToken: string): void => {
  try {
    sessionStorage.setItem('workflow_session_token', sessionToken);
    sessionStorage.setItem('workflow_auth_type', 'session');
    sessionStorage.setItem('from_extension', 'true');
    console.log('🔐 [Auth] Session token stored successfully');
  } catch (error) {
    console.error('🔐 [Auth] Error storing session token:', error);
  }
};

/**
 * Get auth type from storage
 */
export const getAuthType = (): string | null => {
  try {
    return sessionStorage.getItem('workflow_auth_type');
  } catch (error) {
    console.error('🔐 [Auth] Error getting auth type:', error);
    return null;
  }
};

/**
 * Determine edit permissions (simplified logic)
 */
export const canEditWorkflow = (
  sessionToken: string | null,
  isOwner: boolean,
  isPublicWorkflow: boolean,
  isLegacyWorkflow: boolean = false
): boolean => {
  // No session token = no editing
  if (!hasValidSessionToken(sessionToken)) return false;
  
  // Owner can always edit their workflows
  if (isOwner) return true;
  
  // Legacy workflows (owner_id = NULL) can be edited by any authenticated user
  if (isLegacyWorkflow) return true;
  
  // Public workflows owned by others = read-only (fork required)
  if (isPublicWorkflow && !isOwner) return false;
  
  // Private workflows = owner only
  return isOwner;
}; 