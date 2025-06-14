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
 */
export const checkWorkflowOwnership = async (
  sessionToken: string, 
  workflowId: string
): Promise<boolean> => {
  try {
    console.log('🔐 [Auth] Checking ownership for workflow:', workflowId);
    
    const response = await fetch(`/api/workflows/${workflowId}/ownership`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        session_token: sessionToken,
        workflow_id: workflowId
      })
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
    sessionStorage.removeItem('workflow_session_token');
    sessionStorage.removeItem('workflow_auth_type');
    sessionStorage.removeItem('from_extension');
    console.log('🔐 [Auth] Cleared stored auth data');
  } catch (error) {
    console.error('🔐 [Auth] Error clearing auth data:', error);
  }
};

/**
 * Check if session token exists and is valid format
 * Note: Actual validation is done by backend with Supabase
 */
export const isSessionTokenValid = (sessionToken: string): boolean => {
  try {
    // Basic format check - session tokens should be non-empty strings
    return typeof sessionToken === 'string' && sessionToken.length > 0;
  } catch (error) {
    console.error('🔐 [Auth] Error checking session token format:', error);
    return false;
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
 * Determine edit permissions based on auth state and workflow ownership
 */
export const canEditWorkflow = (
  hasSessionToken: boolean,
  isOwner: boolean,
  isPublicWorkflow: boolean,
  isLegacyWorkflow: boolean = false
): boolean => {
  // No session token = no editing
  if (!hasSessionToken) return false;
  
  // Owner can always edit
  if (isOwner) return true;
  
  // Legacy workflows (owner_id = NULL) can be edited by any authenticated user
  if (isLegacyWorkflow) return true;
  
  // Public workflows owned by others = read-only
  if (isPublicWorkflow && !isOwner) return false;
  
  // Private workflows = owner only
  return isOwner;
}; 