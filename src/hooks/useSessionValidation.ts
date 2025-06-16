import { useState, useEffect, useCallback } from 'react';
import { 
  getStoredSessionToken, 
  validateSessionToken, 
  clearStoredAuth,
  hasValidSessionToken 
} from '@/utils/authUtils';
import { useAppContext } from '@/contexts/AppContext';

interface SessionValidationState {
  isValid: boolean;
  isChecking: boolean;
  lastChecked: Date | null;
  error: string | null;
}

export const useSessionValidation = (intervalMs: number = 60000) => {
  const { setCurrentUserSessionToken, currentUserSessionToken } = useAppContext();
  const [state, setState] = useState<SessionValidationState>({
    isValid: false,
    isChecking: false,
    lastChecked: null,
    error: null
  });

  const validateSession = useCallback(async () => {
    const storedToken = getStoredSessionToken();
    
    console.log('🔐 [useSessionValidation] Token status:', {
      storedToken: storedToken ? `${storedToken.slice(0,8)}...` : null,
      contextToken: currentUserSessionToken ? `${currentUserSessionToken.slice(0,8)}...` : null,
      tokensMatch: storedToken === currentUserSessionToken
    });
    
    // Sync tokens: if stored token exists but context doesn't have it, update context
    if (storedToken && !currentUserSessionToken) {
      console.log('🔐 [useSessionValidation] Syncing stored token to app context');
      setCurrentUserSessionToken(storedToken);
    }
    
    // Use the stored token for validation (most up-to-date)
    const tokenToValidate = storedToken || currentUserSessionToken;
    
    if (!hasValidSessionToken(tokenToValidate)) {
      console.log('🔐 [useSessionValidation] No valid session token found');
      setState(prev => ({
        ...prev,
        isValid: false,
        isChecking: false,
        lastChecked: new Date(),
        error: 'No session token found'
      }));
      
      // Clear context if it has a token but storage doesn't
      if (currentUserSessionToken && !storedToken) {
        setCurrentUserSessionToken(null);
      }
      
      return false;
    }

    setState(prev => ({ ...prev, isChecking: true, error: null }));

    try {
      console.log('🔐 [useSessionValidation] Validating token with backend...');
      const isValid = await validateSessionToken(tokenToValidate!);
      
      setState(prev => ({
        ...prev,
        isValid,
        isChecking: false,
        lastChecked: new Date(),
        error: isValid ? null : 'Session token is invalid or expired'
      }));

      if (!isValid) {
        console.log('🔐 [useSessionValidation] Token invalid - clearing from context');
        setCurrentUserSessionToken(null);
      } else {
        // Ensure context has the valid token
        if (tokenToValidate !== currentUserSessionToken) {
          console.log('🔐 [useSessionValidation] Updating context with valid token');
          setCurrentUserSessionToken(tokenToValidate);
        }
      }

      return isValid;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Session validation failed';
      setState(prev => ({
        ...prev,
        isValid: false,
        isChecking: false,
        lastChecked: new Date(),
        error: errorMessage
      }));
      
      console.error('🔐 [useSessionValidation] Session validation error:', error);
      return false;
    }
  }, [setCurrentUserSessionToken, currentUserSessionToken]);

  // Periodic validation
  useEffect(() => {
    // Initial validation
    validateSession();

    // Set up interval for periodic validation
    const interval = setInterval(validateSession, intervalMs);

    return () => clearInterval(interval);
  }, [validateSession, intervalMs]);

  // Manual validation function
  const checkSession = useCallback(async (): Promise<boolean> => {
    return await validateSession();
  }, [validateSession]);

  return {
    ...state,
    checkSession,
    refreshSession: validateSession
  };
}; 