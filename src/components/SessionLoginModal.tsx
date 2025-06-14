import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Chrome, 
  Key, 
  AlertCircle, 
  CheckCircle, 
  ExternalLink,
  Copy,
  Download
} from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { 
  storeSessionToken, 
  hasValidSessionToken,
  initializeSessionFromExtension 
} from '@/utils/authUtils';
import { useToast } from '@/hooks/use-toast';

interface SessionLoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const SessionLoginModal: React.FC<SessionLoginModalProps> = ({
  open,
  onOpenChange
}) => {
  const { setCurrentUserSessionToken } = useAppContext();
  const { toast } = useToast();
  const [sessionToken, setSessionToken] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleSessionTokenSubmit = async () => {
    if (!sessionToken.trim()) {
      setValidationError('Please enter a session token');
      return;
    }

    setIsValidating(true);
    setValidationError(null);

    try {
      // Basic validation - check if it looks like a valid token
      if (sessionToken.length < 10) {
        throw new Error('Session token appears to be too short');
      }

      // Store the session token
      initializeSessionFromExtension(sessionToken);
      setCurrentUserSessionToken(sessionToken);

      toast({
        title: 'Login Successful! ✅',
        description: 'You are now authenticated and can edit workflows.',
      });

      // Close modal and reset form
      onOpenChange(false);
      setSessionToken('');
      setValidationError(null);
    } catch (error) {
      console.error('Session token validation failed:', error);
      setValidationError(
        error instanceof Error ? error.message : 'Invalid session token'
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleGetExtension = () => {
    // Open Chrome Web Store in new tab
    window.open('https://chrome.google.com/webstore', '_blank');
  };

  const copyExtensionUrl = () => {
    navigator.clipboard.writeText('https://chrome.google.com/webstore');
    toast({
      title: 'Copied!',
      description: 'Extension URL copied to clipboard',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Chrome className="h-5 w-5 text-blue-600" />
            <span>Chrome Extension Login</span>
          </DialogTitle>
          <DialogDescription>
            Login using your session token from the Chrome extension to edit workflows and manage your collection.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Extension Installation Guide */}
          <Alert className="border-blue-200 bg-blue-50">
            <Chrome className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-blue-800">Don't have the extension yet?</p>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGetExtension}
                    className="border-blue-300 text-blue-700 hover:bg-blue-100"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Get Extension
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={copyExtensionUrl}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy URL
                  </Button>
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Session Token Input */}
          <div className="space-y-2">
            <Label htmlFor="sessionToken" className="flex items-center space-x-2">
              <Key className="h-4 w-4" />
              <span>Session Token</span>
            </Label>
            <Input
              id="sessionToken"
              type="password"
              placeholder="Paste your session token from the Chrome extension"
              value={sessionToken}
              onChange={(e) => {
                setSessionToken(e.target.value);
                setValidationError(null);
              }}
              className="font-mono text-sm"
              disabled={isValidating}
            />
            <p className="text-xs text-gray-600">
              Get your session token from the Chrome extension settings or popup.
            </p>
          </div>

          {/* Validation Error */}
          {validationError && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {validationError}
              </AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          <div className="bg-gray-50 rounded-lg p-3">
            <h4 className="font-medium text-gray-900 mb-2">How to get your session token:</h4>
            <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
              <li>Install and open the Chrome extension</li>
              <li>Login to your account in the extension</li>
              <li>Copy the session token from extension settings</li>
              <li>Paste it above and click "Login"</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isValidating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSessionTokenSubmit}
            disabled={!sessionToken.trim() || isValidating}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isValidating ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Validating...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Login
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SessionLoginModal; 