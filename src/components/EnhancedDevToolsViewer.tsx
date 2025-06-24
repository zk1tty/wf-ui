import React from 'react';
import { DevToolsStatus } from './DevToolsStatus';
import { DevToolsIframe } from './DevToolsIframe';

interface EnhancedDevToolsViewerProps {
  sessionId: string;
  className?: string;
  expectedMode?: 'cloud-run' | 'local-run';
}

export function EnhancedDevToolsViewer({ sessionId, className = '', expectedMode }: EnhancedDevToolsViewerProps) {
  return (
    <div className={`enhanced-devtools-viewer ${className}`}>
      {/* Status Bar */}
      <div className="mb-4">
        <DevToolsStatus sessionId={sessionId} />
      </div>
      
      {/* Full DevTools Interface */}
      <div className="devtools-container">
        <DevToolsIframe sessionId={sessionId} expectedMode={expectedMode} />
      </div>
      
      {/* Usage Instructions */}
      <div className="mt-4 p-4 bg-gray-800/50 rounded-lg">
        <h4 className="text-sm font-semibold text-gray-300 mb-2">Chrome DevTools Features:</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-400">
          <div>🔍 <strong>Elements:</strong> Inspect HTML/CSS</div>
          <div>📊 <strong>Console:</strong> JavaScript logs & errors</div>
          <div>🌐 <strong>Network:</strong> HTTP requests & responses</div>
          <div>📁 <strong>Sources:</strong> Debug JavaScript code</div>
        </div>
        <div className="mt-3 text-xs text-gray-500">
          💡 This is the full Chrome DevTools interface used by developers worldwide. All features are available including:
          Performance profiling, Application storage inspection, Security analysis, and more.
        </div>
        <div className="mt-2 p-2 bg-blue-900/20 border border-blue-600/30 rounded text-xs text-blue-300">
          ⚠️ <strong>Browser Requirement:</strong> Chrome DevTools work best in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong>. 
          Firefox and Safari may have limited functionality due to browser-specific API differences.
        </div>
      </div>
    </div>
  );
} 