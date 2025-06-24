import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw, Chrome } from 'lucide-react';

interface DevToolsIframeProps {
  sessionId: string;
  className?: string;
  expectedMode?: 'cloud-run' | 'local-run'; // Optional mode hint from workflow execution
  workflowId?: string; // Workflow ID for execution trigger
  inputs?: any; // Workflow inputs for execution
  sessionToken?: string; // Session token for execution
  onExecutionStart?: () => void; // Callback when execution starts
}

interface IframeData {
  iframe_url: string;
  port: number;
  page_id: string;
  loading: boolean;
  error: string | null;
}

interface DevToolsStatus {
  success: boolean;
  session_id: string;
  status: {
    devtools_url: string | null;
    placeholder: boolean;
    active_connections: number;
    pending_connections: number;
    status: 'ready' | 'waiting';
    port: number | null;
    mode: 'cloud-run' | 'local-run' | 'custom' | 'unknown';
  };
  message: string;
}

// Port mapping based on execution mode
const PORT_MAP = {
  'cloud-run': 9223,
  'local-run': 9224,
  'custom': null,
  'unknown': null
} as const;

// Function to extract port from DevTools URL
function extractPortFromUrl(devtoolsUrl: string | undefined): number | null {
  if (!devtoolsUrl) return null;
  const match = devtoolsUrl.match(/ws:\/\/localhost:(\d+)\//);
  return match ? parseInt(match[1], 10) : null;
}

// Helper function to clean up old execution parameters (older than 1 hour)
function cleanupOldExecutionParams() {
  try {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const keysToRemove: string[] = [];
    
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && key.startsWith('execution_params_')) {
        try {
          const data = JSON.parse(sessionStorage.getItem(key) || '{}');
          if (data.timestamp && data.timestamp < oneHourAgo) {
            keysToRemove.push(key);
          }
        } catch (e) {
          // Invalid data, remove it
          keysToRemove.push(key);
        }
      }
    }
    
    keysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
    });
    
    if (keysToRemove.length > 0) {
      console.log(`🧹 [DevToolsIframe] Cleaned up ${keysToRemove.length} old execution params`);
    }
  } catch (error) {
    console.error('Failed to cleanup old execution params:', error);
  }
}

// Helper function to convert input fields array to object
function convertInputsToObject(inputFields: any): Record<string, any> {
  if (!inputFields) return {};
  
  // If it's already an object, return as-is
  if (typeof inputFields === 'object' && !Array.isArray(inputFields)) {
    return inputFields;
  }
  
  // If it's an array of input field objects, convert to key-value pairs
  if (Array.isArray(inputFields)) {
    const inputs: Record<string, any> = {};
    inputFields.forEach((field: any) => {
      if (field && field.name && field.value !== undefined) {
        inputs[field.name] = field.value;
      }
    });
    return inputs;
  }
  
  return {};
}

// Browser detection utility
function getBrowserInfo() {
  const userAgent = navigator.userAgent.toLowerCase();
  const isChrome = userAgent.includes('chrome') && !userAgent.includes('edg');
  const isEdge = userAgent.includes('edg');
  const isFirefox = userAgent.includes('firefox');
  const isSafari = userAgent.includes('safari') && !userAgent.includes('chrome');
  
  return {
    isChrome,
    isEdge,
    isFirefox,
    isSafari,
    isCompatible: isChrome || isEdge, // DevTools work best in Chrome/Edge
    browserName: isChrome ? 'Chrome' : isEdge ? 'Edge' : isFirefox ? 'Firefox' : isSafari ? 'Safari' : 'Unknown'
  };
}

export function DevToolsIframe({ 
  sessionId, 
  className = '', 
  expectedMode,
  workflowId,
  inputs,
  sessionToken,
  onExecutionStart
}: DevToolsIframeProps) {
  const [iframeData, setIframeData] = useState<IframeData>({
    iframe_url: '',
    port: 0,
    page_id: '',
    loading: true,
    error: null
  });
  
  const [detectedMode, setDetectedMode] = useState<string>('unknown');
  const [detectedPort, setDetectedPort] = useState<number | null>(null);
  const [executionTriggered, setExecutionTriggered] = useState<boolean>(false);
  const [executionParams, setExecutionParams] = useState<any>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'executing' | 'completed' | 'disconnected'>('connecting');
  const [workflowStatus, setWorkflowStatus] = useState<string | null>(null);

  const browserInfo = getBrowserInfo();

  // Function to check WebSocket connection status and detect workflow completion
  const checkWebSocketConnection = async () => {
    try {
      const response = await fetch(`/workflows/devtools/${sessionId}/status`);
      const data = await response.json();
      if (data.success) {
        console.log(`🔌 [DevToolsIframe] WebSocket connection check:`, {
          activeConnections: data.status.active_connections,
          pendingConnections: data.status.pending_connections,
          status: data.status.status,
          devtoolsUrl: data.status.devtools_url
        });
        
        if (data.status.active_connections === 0 && connectionState === 'executing') {
          console.warn(`⚠️ [DevToolsIframe] No active WebSocket connections to DevTools. The iframe may not be connecting properly.`);
          
          // Check if browser session has ended (workflow completed)
          setTimeout(() => {
            checkBrowserSessionStatus();
          }, 5000);
        }
      }
    } catch (error) {
      console.error(`❌ [DevToolsIframe] Failed to check WebSocket connection:`, error);
    }
  };

  // Function to check if browser session has ended (workflow completed)
  const checkBrowserSessionStatus = async () => {
    try {
      const response = await fetch(`/workflows/devtools/${sessionId}/iframe`);
      const data = await response.json();
      
      if (data.detail && data.detail.includes('Connection refused')) {
        console.log(`🎯 [DevToolsIframe] Browser session ended - workflow likely completed`);
        setConnectionState('completed');
        setWorkflowStatus('completed');
      }
    } catch (error) {
      console.log(`🎯 [DevToolsIframe] Browser session check failed - workflow likely completed`);
      setConnectionState('completed');
      setWorkflowStatus('completed');
    }
  };

  // Load execution parameters from sessionStorage
  useEffect(() => {
    const loadExecutionParams = () => {
      try {
        // Clean up old execution params first
        cleanupOldExecutionParams();
        
        // Debug: Check all execution params in sessionStorage
        const allKeys = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && key.startsWith('execution_params_')) {
            allKeys.push(key);
          }
        }
        console.log(`🔍 [DevToolsIframe] All execution param keys in sessionStorage:`, allKeys);
        console.log(`🔍 [DevToolsIframe] Looking for key: execution_params_${sessionId}`);
        
        const storedParams = sessionStorage.getItem(`execution_params_${sessionId}`);
        if (storedParams) {
          const params = JSON.parse(storedParams);
          setExecutionParams(params);
                  console.log(`📥 [DevToolsIframe] Loaded execution params for session ${sessionId}:`, {
          workflowId: params.workflowId,
          mode: params.mode,
          visual: params.visual,
          inputCount: Array.isArray(params.inputs) ? params.inputs.length : Object.keys(params.inputs || {}).length,
          hasSessionToken: !!params.sessionToken,
          timestamp: new Date(params.timestamp).toLocaleString()
        });
        console.log(`📥 [DevToolsIframe] Execution params mode: ${params.mode}`);
          console.log(`📋 [DevToolsIframe] Full execution params:`, {
          workflowId: params.workflowId,
          mode: params.mode,
          visual: params.visual,
          inputCount: Array.isArray(params.inputs) ? params.inputs.length : Object.keys(params.inputs || {}).length,
          timestamp: new Date(params.timestamp).toLocaleString()
        });
        } else {
          console.log(`📭 [DevToolsIframe] No execution params found for session ${sessionId}`);
          
          // Fallback: Try to use the most recent execution params if any exist
          if (allKeys.length > 0) {
            console.log(`🔄 [DevToolsIframe] Trying fallback with most recent execution params...`);
            const mostRecentKey = allKeys[allKeys.length - 1]; // Get the last key (most recent)
            const fallbackParams = mostRecentKey ? sessionStorage.getItem(mostRecentKey) : null;
            if (fallbackParams) {
              const params = JSON.parse(fallbackParams);
              setExecutionParams(params);
              console.log(`📥 [DevToolsIframe] Using fallback execution params from ${mostRecentKey}:`, {
                workflowId: params.workflowId,
                mode: params.mode,
                timestamp: new Date(params.timestamp).toLocaleString()
              });
            }
          }
        }
      } catch (error) {
        console.error(`❌ [DevToolsIframe] Failed to load execution params:`, error);
      }
    };

    if (sessionId) {
      loadExecutionParams();
    }
  }, [sessionId]);

  // Function to trigger workflow execution once DevTools is ready
  const triggerWorkflowExecution = async () => {
    // Use stored execution params or fallback to props
    const effectiveWorkflowId = executionParams?.workflowId || workflowId;
    const effectiveInputs = executionParams?.inputs || inputs;
    const effectiveSessionToken = executionParams?.sessionToken || sessionToken;
    // Use detected mode from DevTools session (most reliable), fallback based on port
    let effectiveMode: string;
    if (detectedMode !== 'unknown') {
      effectiveMode = detectedMode;
    } else if (detectedPort === 9223) {
      effectiveMode = 'cloud-run'; // Force cloud-run for port 9223
    } else if (detectedPort === 9224) {
      effectiveMode = 'local-run'; // Force local-run for port 9224
    } else {
      effectiveMode = executionParams?.mode || expectedMode || 'cloud-run';
    }
    
    if (!effectiveWorkflowId || !effectiveSessionToken || executionTriggered) {
      console.log(`⏭️ [DevToolsIframe] Skipping execution trigger:`, {
        workflowId: !!effectiveWorkflowId,
        sessionToken: !!effectiveSessionToken,
        executionTriggered,
        hasExecutionParams: !!executionParams
      });
      return; // Skip if missing required data or already triggered
    }

    try {
      console.log(`🚀 [DevToolsIframe] Triggering workflow execution for ${effectiveWorkflowId}...`);
      console.log(`📋 [DevToolsIframe] Using execution params:`, {
        workflowId: effectiveWorkflowId,
        mode: effectiveMode,
        inputCount: Array.isArray(effectiveInputs) ? effectiveInputs.length : Object.keys(effectiveInputs || {}).length,
        hasSessionToken: !!effectiveSessionToken,
        sessionId: sessionId,
        detectedMode: detectedMode,
        detectedPort: detectedPort,
        expectedMode: expectedMode,
        executionParamsMode: executionParams?.mode
      });
      console.log(`📋 [DevToolsIframe] Mode resolution: detectedMode=${detectedMode}, detectedPort=${detectedPort}, finalMode=${effectiveMode}`);
      
      setExecutionTriggered(true);
      
      // Call the execution API
      const executionPayload = {
        inputs: convertInputsToObject(effectiveInputs) || {},
        session_token: effectiveSessionToken,
        mode: effectiveMode,
        visual: true,
        devtools_session_id: sessionId // Link to existing DevTools session
      };
      
      console.log(`📤 [DevToolsIframe] Sending execution request:`, {
        url: `/workflows/${effectiveWorkflowId}/execute/session`,
        payload: {
          ...executionPayload,
          session_token: '***HIDDEN***' // Hide token in logs
        }
      });
      console.log(`📤 [DevToolsIframe] Request mode: ${executionPayload.mode}, devtools_session_id: ${executionPayload.devtools_session_id}`);
      
      const response = await fetch(`/workflows/${effectiveWorkflowId}/execute/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(executionPayload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
              console.log(`✅ [DevToolsIframe] Workflow execution triggered successfully:`, {
        task_id: result.task_id,
        workflow: result.workflow,
        mode: result.mode,
        visual_enabled: result.visual_enabled,
        devtools_url: result.devtools_url,
        backend_success: result.success,
        message: result.message
      });
        
        // Update connection state to executing
        setConnectionState('executing');
        setWorkflowStatus('running');
        
        // Clean up stored params after successful execution
        sessionStorage.removeItem(`execution_params_${sessionId}`);
        console.log(`🧹 [DevToolsIframe] Cleaned up execution params for session ${sessionId}`);
        
        if (onExecutionStart) {
          onExecutionStart();
        }
      } else {
        throw new Error(result.message || result.detail || 'Execution failed');
      }
    } catch (error) {
      console.error(`❌ [DevToolsIframe] Failed to trigger workflow execution:`, error);
      
      // Handle specific error cases
      const errorMessage = error instanceof Error ? error.message : String(error);
             if (errorMessage.includes('session token') || errorMessage.includes('expired') || errorMessage.includes('Invalid')) {
         console.error(`🔑 [DevToolsIframe] Session token expired or invalid. User needs to re-authenticate.`);
         setAuthError('Your session has expired. Please refresh the page and login again through the Chrome extension.');
         // Clean up expired params
         sessionStorage.removeItem(`execution_params_${sessionId}`);
       }
      
      setExecutionTriggered(false); // Allow retry
    }
  };

  // Step 1: Get DevTools status with mode and port information
  const fetchDevToolsStatus = async (): Promise<DevToolsStatus['status']> => {
    try {
      const response = await fetch(`/workflows/devtools/${sessionId}/status`);
      const data: DevToolsStatus = await response.json();
      
      if (data.success) {
        // Update detected mode and port even if waiting
        const newMode = data.status.mode || 'unknown';
        const newPort = data.status.port;
        
        console.log(`🔍 [DevToolsIframe] DevTools status: mode=${newMode}, port=${newPort}, status=${data.status.status}`);
        console.log(`🔄 [DevToolsIframe] Updating detected mode from ${detectedMode} to ${newMode}`);
        console.log(`🔄 [DevToolsIframe] Updating detected port from ${detectedPort} to ${newPort}`);
        
        setDetectedMode(newMode);
        setDetectedPort(newPort);
        
        if (data.status.status === 'ready') {
          // Validate mode matches expectation
          if (expectedMode && data.status.mode !== expectedMode) {
            console.warn(`🔄 [DevToolsIframe] Mode mismatch: expected ${expectedMode}, got ${data.status.mode}`);
          }
          
          // Validate port matches expected port for mode
          const expectedPort = PORT_MAP[data.status.mode];
          if (expectedPort && data.status.port !== expectedPort) {
            console.warn(`🔄 [DevToolsIframe] Port mismatch: mode ${data.status.mode} expected port ${expectedPort}, got ${data.status.port}`);
          }
          
          return data.status;
        } else if (data.status.status === 'waiting') {
          // If we have execution params and this is a placeholder, trigger execution to start the browser
          if (data.status.placeholder && executionParams && !executionTriggered) {
            console.log(`🎯 [DevToolsIframe] DevTools placeholder detected, triggering execution to start browser...`);
            // Don't throw error, return the status and let the execution trigger handle it
            return data.status;
          }
          // DevTools is still initializing, throw error to trigger retry
          throw new Error(`DevTools initializing: ${data.status.placeholder ? 'Setting up browser...' : 'Waiting for connection...'}`);
        } else {
          throw new Error(`DevTools status: ${data.status.status}`);
        }
      }
      throw new Error(`DevTools not ready: ${data.message}`);
    } catch (error) {
      throw new Error(`Failed to get DevTools status: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Step 2: Get iframe URL with port validation
  const fetchIframeUrl = async (): Promise<any> => {
    try {
      const response = await fetch(`/workflows/devtools/${sessionId}/iframe`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText || response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.iframe_url) {
        // Validate port consistency between status and iframe
        const iframePort = extractPortFromUrl(data.iframe_url);
        if (detectedPort && iframePort && iframePort !== detectedPort) {
          console.warn(`🔄 [DevToolsIframe] Port mismatch: status=${detectedPort}, iframe=${iframePort}`);
        }
        
        console.log(`🖼️ [DevToolsIframe] Iframe URL fetched: port=${data.port || iframePort}, url=${data.iframe_url}`);
        return data;
      }
      
      // Check for browser connection errors
      if (data.detail && data.detail.includes('Connection refused')) {
        throw new Error(`Browser session has ended. The workflow may have completed and the browser process stopped. Please start a new workflow execution to view live DevTools.`);
      }
      
      throw new Error(`Failed to get iframe URL: ${data.detail || 'Unknown error'}`);
    } catch (error) {
      throw new Error(`Failed to fetch iframe URL: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // Main loading logic with enhanced mode detection and retry for waiting status
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 10;
    const retryDelay = 2000; // 2 seconds

    const loadDevTools = async () => {
      setIframeData(prev => ({ ...prev, loading: true, error: null }));
      
      try {
        // Step 1: Check DevTools status and get mode/port (with retry for waiting status)
        console.log(`🔍 [DevToolsIframe] Checking status for session ${sessionId}... (attempt ${retryCount + 1}/${maxRetries})`);
        const statusResult = await fetchDevToolsStatus();
        
        // Use fresh values from API response instead of state (avoid timing issues)
        const currentMode = statusResult.mode || 'unknown';
        const currentPort = statusResult.port || null;
        
        // If it's a placeholder and we have execution params, trigger execution first
        if (statusResult.status === 'waiting' && statusResult.placeholder && executionParams && !executionTriggered) {
          console.log(`🚀 [DevToolsIframe] Triggering execution for placeholder session...`);
          await triggerWorkflowExecution();
          
          // After triggering execution, wait a bit and retry to get the real DevTools status
          setTimeout(() => {
            retryCount++; // Increment retry count
            if (retryCount < maxRetries) {
              console.log(`🔄 [DevToolsIframe] Waiting for browser to start after execution trigger... (${retryCount}/${maxRetries})`);
              loadDevTools();
            }
          }, 3000); // Wait 3 seconds for browser to start
          return;
        }
        
        // Step 2: Get iframe URL (only if DevTools is ready)
        if (statusResult.status === 'ready') {
          console.log(`🖼️ [DevToolsIframe] Fetching iframe URL for mode=${currentMode}, port=${currentPort}...`);
          const iframeDataResponse = await fetchIframeUrl();
          
          setIframeData({
            iframe_url: iframeDataResponse.iframe_url,
            port: iframeDataResponse.port || currentPort || 0,
            page_id: iframeDataResponse.page_id || 'unknown',
            loading: false,
            error: null
          });
          
          console.log(`✅ [DevToolsIframe] DevTools loaded successfully for ${currentMode} mode on port ${currentPort}`);
          
          // Trigger workflow execution if we have execution params and haven't triggered yet
          console.log(`🔍 [DevToolsIframe] Checking execution trigger conditions:`, {
            hasExecutionParams: !!executionParams,
            executionTriggered: executionTriggered,
            shouldTrigger: !!(executionParams && !executionTriggered),
            detectedMode: detectedMode,
            detectedPort: detectedPort
          });
          
          if (executionParams && !executionTriggered) {
            console.log(`🚀 [DevToolsIframe] DevTools ready, triggering workflow execution...`);
            setTimeout(async () => {
              await triggerWorkflowExecution();
            }, 1000); // Small delay to ensure iframe is fully loaded
          } else {
            console.log(`⏭️ [DevToolsIframe] Execution trigger skipped:`, {
              reason: !executionParams ? 'No execution params' : 'Already triggered'
            });
          }
        } else {
          // Still waiting, let the retry logic handle it
          throw new Error(`DevTools still ${statusResult.status}`);
        }
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to load DevTools';
        
        // Check if this is a "waiting" status that should trigger retry
        if (errorMessage.includes('DevTools initializing') && retryCount < maxRetries) {
          retryCount++;
          console.log(`🔄 [DevToolsIframe] DevTools still initializing, retrying in ${retryDelay/1000}s... (${retryCount}/${maxRetries})`);
          
          setTimeout(() => {
            loadDevTools();
          }, retryDelay);
        } else {
          console.error(`❌ [DevToolsIframe] Failed to load DevTools:`, error);
          setIframeData(prev => ({
            ...prev,
            loading: false,
            error: retryCount >= maxRetries 
              ? `DevTools initialization timeout after ${maxRetries} attempts. The browser session may be taking longer than expected to start.`
              : errorMessage
          }));
        }
      }
    };

    if (sessionId) {
      retryCount = 0; // Reset retry count for new session
      loadDevTools();
    }
  }, [sessionId, expectedMode]);

  // Separate effect to trigger execution when params are loaded and DevTools is ready
  useEffect(() => {
    const tryTriggerExecution = async () => {
      if (executionParams && !executionTriggered && !iframeData.loading && iframeData.iframe_url && !iframeData.error) {
        console.log(`🎯 [DevToolsIframe] Execution params loaded and DevTools ready, triggering execution...`);
        setTimeout(async () => {
          await triggerWorkflowExecution();
        }, 1000);
      }
    };

    tryTriggerExecution();
  }, [executionParams, iframeData.loading, iframeData.iframe_url, iframeData.error, executionTriggered]);

  // Show browser compatibility warning
  if (!browserInfo.isCompatible) {
    return (
      <div className={`devtools-browser-warning ${className}`}>
        <div className="flex items-center justify-center h-96 bg-yellow-900/20 border border-yellow-500/30 rounded-lg">
          <div className="text-center text-yellow-300 max-w-md">
            <div className="text-yellow-500 text-4xl mb-4">⚠️</div>
            <h3 className="text-lg font-semibold mb-2">Browser Compatibility Issue</h3>
            <p className="text-sm mb-4">
              Chrome DevTools requires a <strong>Chrome</strong> or <strong>Edge</strong> browser to function properly. 
              You're currently using <strong>{browserInfo.browserName}</strong>.
            </p>
            <div className="bg-yellow-800/30 border border-yellow-600/50 rounded-lg p-3 mb-4 text-left">
              <p className="text-yellow-200 font-medium text-sm mb-2">🔧 How to fix:</p>
              <ul className="text-yellow-300 text-xs space-y-1">
                <li>• Open this page in <strong>Google Chrome</strong> or <strong>Microsoft Edge</strong></li>
                <li>• DevTools use Chrome-specific APIs not available in other browsers</li>
                <li>• This ensures full compatibility with Chrome DevTools interface</li>
              </ul>
            </div>
            <div className="flex items-center justify-center space-x-2 text-xs text-yellow-400">
              <Chrome className="w-4 h-4" />
              <span>Requires Chrome/Edge for optimal experience</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (iframeData.loading) {
    return (
      <div className={`devtools-loading ${className}`}>
        <div className="flex items-center justify-center h-96 bg-gray-900 rounded-lg">
          <div className="text-center text-gray-300">
            <Loader2 className="animate-spin w-8 h-8 text-blue-500 mx-auto mb-4" />
            <p className="text-lg font-medium">Loading Chrome DevTools...</p>
            <div className="mt-3 space-y-1">
              {detectedMode !== 'unknown' && (
                <p className="text-sm text-blue-400">
                  Mode: {detectedMode === 'cloud-run' ? '☁️ Cloud-Run' : 
                         detectedMode === 'local-run' ? '🖥️ Local-Run' : detectedMode}
                </p>
              )}
              <p className="text-sm text-gray-500">
                {detectedPort ? `Port: ${detectedPort}` : 'Detecting port...'}
              </p>
            </div>
            <div className="mt-4 text-xs text-gray-600">
              <div className="flex items-center justify-center space-x-4">
                <span>🔍 Elements</span>
                <span>📊 Console</span>
                <span>🌐 Network</span>
                <span>📁 Sources</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (iframeData.error || authError) {
    return (
      <div className={`devtools-error ${className}`}>
        <div className="flex items-center justify-center h-96 bg-red-900/20 border border-red-500/30 rounded-lg">
          <div className="text-center text-red-300">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {authError ? 'Authentication Required' : 'DevTools Not Available'}
            </h3>
            <p className="text-sm mb-4 max-w-md">{authError || iframeData.error}</p>
            
            {/* Enhanced Debug Information */}
            <details className="mb-4 text-left bg-red-900/20 border border-red-600/30 rounded-lg p-3 max-w-md mx-auto">
              <summary className="cursor-pointer text-sm font-medium text-red-200 mb-2">
                🔍 Debug Information
              </summary>
              <div className="text-xs text-red-300 space-y-1">
                <div><strong>Session ID:</strong> {sessionId?.slice(0, 8)}...</div>
                <div><strong>Expected Mode:</strong> {expectedMode || 'not specified'}</div>
                <div><strong>Detected Mode:</strong> {detectedMode}</div>
                <div><strong>Detected Port:</strong> {detectedPort || 'unknown'}</div>
                <div><strong>Browser:</strong> {browserInfo.browserName} {browserInfo.isCompatible ? '✓' : '❌'}</div>
                {detectedMode !== 'unknown' && (
                  <div><strong>Expected Port:</strong> {PORT_MAP[detectedMode as keyof typeof PORT_MAP] || 'N/A'}</div>
                )}
              </div>
            </details>
            
            <div className="space-y-2">
              <button 
                onClick={() => {
                  // Retry with fresh state
                  setDetectedMode('unknown');
                  setDetectedPort(null);
                  // The loadDevTools function will be called by useEffect
                  setIframeData(prev => ({ ...prev, loading: true, error: null }));
                }}
                className="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`devtools-iframe ${className}`}>
      {/* Enhanced DevTools Header with Mode Information */}
      <div className="devtools-header bg-gray-800 px-4 py-2 rounded-t-lg border-b border-gray-700">
        <div className="flex items-center justify-between text-sm text-gray-300">
          <div className="flex items-center space-x-4">
            <span className="flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              <Chrome className="w-4 h-4 mr-1" />
              Chrome DevTools
            </span>
            
            {/* Mode Badge */}
            <span className={`text-xs px-2 py-1 rounded font-semibold ${
              detectedMode === 'cloud-run' 
                ? 'bg-blue-900/30 text-blue-300 border border-blue-600/50' 
                : detectedMode === 'local-run'
                ? 'bg-green-900/30 text-green-300 border border-green-600/50'
                : 'bg-yellow-900/30 text-yellow-300 border border-yellow-600/50'
            }`}>
              {detectedMode === 'cloud-run' ? '☁️ CLOUD-RUN' : 
               detectedMode === 'local-run' ? '🖥️ LOCAL-RUN' : 
               `🔄 ${detectedMode.toUpperCase()}`}
            </span>
            
            <span className="text-gray-500">Port: {iframeData.port}</span>
            <span className="text-gray-500">
              Page: {iframeData.page_id?.slice(0, 8)}...
            </span>
            <span className="text-xs text-green-400 bg-green-900/30 px-2 py-1 rounded">
              {browserInfo.browserName} ✓
            </span>
          </div>
          <div className="text-xs text-gray-500">
            Full DevTools: Console • Network • Elements • Sources
          </div>
        </div>
      </div>
      
      {/* DevTools Iframe */}
      <div className="devtools-container relative">
        <iframe
          src={iframeData.iframe_url}
          width="100%"
          height="600"
          title="Chrome DevTools"
          className="border-0 rounded-b-lg bg-white"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation allow-modals allow-downloads"
          loading="lazy"
          onLoad={() => {
            console.log('✅ [DevToolsIframe] DevTools iframe loaded successfully');
            // Hide the loading overlay
            const iframe = document.querySelector('.devtools-iframe iframe') as HTMLIFrameElement;
            if (iframe) {
              iframe.setAttribute('data-loaded', 'true');
            }
            
            // Check WebSocket connection after a delay
            setTimeout(() => {
              checkWebSocketConnection();
            }, 3000);
          }}
          onError={(e) => {
            console.error('❌ [DevToolsIframe] Iframe load error:', e);
            const errorMessage = !browserInfo.isCompatible 
              ? `DevTools requires Chrome/Edge browser. Currently using ${browserInfo.browserName}.`
              : 'Failed to load DevTools interface. Check if the browser session is active.';
            setIframeData(prev => ({
              ...prev,
              error: errorMessage
            }));
          }}
        />
        
        {/* Loading overlay for iframe */}
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center rounded-b-lg iframe-overlay">
          <div className="text-center text-gray-300">
            <Loader2 className="animate-spin w-6 h-6 mx-auto mb-2" />
            <p className="text-sm">Initializing DevTools...</p>
          </div>
        </div>
        
        {/* Workflow completion overlay */}
        {connectionState === 'completed' && (
          <div className="absolute inset-0 bg-blue-900/90 flex items-center justify-center rounded-b-lg">
            <div className="text-center text-white max-w-md p-6">
              <div className="text-blue-300 text-4xl mb-4">🎉</div>
              <h3 className="text-lg font-semibold mb-2">Workflow Completed</h3>
              <p className="text-sm mb-4 text-blue-100">
                The workflow has finished executing. The browser session has ended and DevTools is no longer available.
              </p>
              <div className="bg-blue-800/50 border border-blue-600/50 rounded-lg p-3 mb-4 text-left">
                <p className="text-blue-200 font-medium text-sm mb-2">📋 What happened:</p>
                <ul className="text-blue-300 text-xs space-y-1">
                  <li>• Workflow executed successfully in cloud browser</li>
                  <li>• Browser session ended after completion</li>
                  <li>• DevTools connection is no longer available</li>
                  <li>• You can start a new workflow to see live execution again</li>
                </ul>
              </div>
              <button 
                onClick={() => window.close()}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-colors"
              >
                Close DevTools
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// CSS for enhanced DevTools interface with mode indicators
const styles = `
.devtools-iframe iframe {
  transition: opacity 0.3s ease;
}

.devtools-iframe iframe:not([data-loaded]) {
  opacity: 0;
}

.devtools-iframe iframe[data-loaded] + .iframe-overlay {
  display: none;
}

.devtools-iframe iframe:not([data-loaded]) + .iframe-overlay {
  display: flex;
}

/* Mode-specific styling */
.mode-cloud-run {
  background: rgba(33, 150, 243, 0.1);
  color: #64b5f6;
  border: 1px solid rgba(33, 150, 243, 0.3);
}

.mode-local-run {
  background: rgba(76, 175, 80, 0.1);
  color: #81c784;
  border: 1px solid rgba(76, 175, 80, 0.3);
}

.mode-unknown {
  background: rgba(255, 193, 7, 0.1);
  color: #ffb74d;
  border: 1px solid rgba(255, 193, 7, 0.3);
}

.devtools-header {
  transition: all 0.2s ease;
}

.devtools-header:hover {
  background: rgba(55, 65, 81, 0.9);
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
} 