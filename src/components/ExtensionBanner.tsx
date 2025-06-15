import React, { useEffect, useState } from 'react';
import { detectExtensionContext, isFromExtension, type ExtensionContext } from '@/utils/extensionUtils';
import { Chrome } from 'lucide-react';

// Compact version for navigation bar
interface CompactExtensionIndicatorProps {
  className?: string;
}

export const CompactExtensionIndicator: React.FC<CompactExtensionIndicatorProps> = ({ 
  className = '' 
}) => {
  const [context, setContext] = useState<ExtensionContext | null>(null);
  const [fromExtension, setFromExtension] = useState(false);

  useEffect(() => {
    const extensionContext = detectExtensionContext();
    const isFromExt = isFromExtension();
    
    setContext(extensionContext);
    setFromExtension(isFromExt);
  }, []);

  // Only show if user came from extension or is in extension context
  if (!fromExtension && !context?.isExtension) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <Chrome className="h-4 w-4 text-blue-600" />
      <span className="text-sm font-medium text-blue-900">
        Chrome Extension
      </span>
      <div 
        className="w-2 h-2 rounded-full bg-red-500" 
        title={context?.isExtension ? 'Active' : 'Connected'}
      />
    </div>
  );
}; 