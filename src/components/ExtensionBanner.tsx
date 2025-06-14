import React, { useEffect, useState } from 'react';
import { detectExtensionContext, isFromExtension, type ExtensionContext } from '@/utils/extensionUtils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Chrome, ExternalLink, Info } from 'lucide-react';

interface ExtensionBannerProps {
  className?: string;
  showDetails?: boolean;
}

export const ExtensionBanner: React.FC<ExtensionBannerProps> = ({ 
  className = '', 
  showDetails = false 
}) => {
  const [context, setContext] = useState<ExtensionContext | null>(null);
  const [fromExtension, setFromExtension] = useState(false);

  useEffect(() => {
    const extensionContext = detectExtensionContext();
    const isFromExt = isFromExtension();
    
    setContext(extensionContext);
    setFromExtension(isFromExt);
    
    console.log('🔧 [ExtensionBanner] Context:', extensionContext, 'From extension:', isFromExt);
  }, []);

  // Only show if user came from extension or is in extension context
  if (!fromExtension && !context?.isExtension) {
    return null;
  }

  return (
    <div className={`bg-blue-50 border border-blue-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Chrome className="h-5 w-5 text-blue-600" />
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-blue-900">
                Chrome Extension Mode
              </span>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                {context?.isExtension ? 'Active' : 'Connected'}
              </Badge>
            </div>
            {showDetails && (
              <p className="text-xs text-blue-700 mt-1">
                You're using the workflow editor through the Chrome extension
              </p>
            )}
          </div>
        </div>
        
        {showDetails && context && (
          <div className="flex items-center space-x-2">
            {context.extensionId && (
              <Badge variant="outline" className="text-xs">
                ID: {context.extensionId.slice(0, 8)}...
              </Badge>
            )}
            {context.version && (
              <Badge variant="outline" className="text-xs">
                v{context.version}
              </Badge>
            )}
          </div>
        )}
      </div>
      
      {showDetails && (
        <div className="mt-3 pt-3 border-t border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 text-xs text-blue-700">
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${context?.hasTabsPermission ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>Tab Management</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className={`w-2 h-2 rounded-full ${context?.hasStoragePermission ? 'bg-green-500' : 'bg-red-500'}`} />
                <span>Storage Access</span>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-blue-600 hover:text-blue-800"
              onClick={() => {
                // Could open help or extension settings
                console.log('🔧 [ExtensionBanner] Help clicked');
              }}
            >
              <Info className="h-3 w-3 mr-1" />
              Help
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExtensionBanner; 