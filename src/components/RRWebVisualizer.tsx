import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  RefreshCw, 
  Activity,
  Eye,
  XCircle,
  Loader2,
  AlertTriangle
} from 'lucide-react';

import { WorkflowVisualizer } from './WorkflowVisualizer';

interface RRWebVisualizerProps {
  sessionId?: string;
  onClose?: () => void;
}

const RRWebVisualizerComponent = React.memo(function RRWebVisualizer({ 
  sessionId: propSessionId, 
  onClose 
}: RRWebVisualizerProps) {
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const sessionId = propSessionId || urlSessionId;
  

  
  const visualizerRef = useRef<WorkflowVisualizer | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [connectedSessionId, setConnectedSessionId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    eventsReceived: 0,
    bytesReceived: 0,
    eventsPerSecond: 0,
    totalEvents: 0,
    duration: 0
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [rrwebLoaded, setRrwebLoaded] = useState(false);
  const [playerState, setPlayerState] = useState<'loading' | 'ready' | 'playing' | 'error'>('loading');
  const [playerError, setPlayerError] = useState<string | null>(null);
  
  // Simple state (official rrweb stream pattern)
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(null);

  // Load rrweb
  useEffect(() => {
    console.log('🎥 [RRWebVisualizer] rrweb imported locally');
    setRrwebLoaded(true);
    addLog('rrweb library loaded successfully', 'success');
  }, []);

  // Throttled log function
  const logBuffer = useRef<string[]>([]);
  const flushLogsTimer = useRef<NodeJS.Timeout | null>(null);
  
  const flushLogs = useCallback(() => {
    if (logBuffer.current.length > 0) {
      setLogs(prev => [...prev.slice(-49), ...logBuffer.current].slice(-50));
      logBuffer.current = [];
    }
    flushLogsTimer.current = null;
  }, []);
  
  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    
    logBuffer.current.push(logEntry);
    
    if (!flushLogsTimer.current) {
      flushLogsTimer.current = setTimeout(flushLogs, 2000);
    }
  }, [flushLogs]);

  // Session ID validation helper
  const validateSessionId = useCallback((sessionId: string) => {
    addLog(`🔍 Session ID validation:`, 'info');
    addLog(`   • Full ID: ${sessionId}`, 'info');
    addLog(`   • Length: ${sessionId.length} characters`, 'info');
    
    const isVisualSession = sessionId.startsWith('visual-');
    const uuidPart = isVisualSession ? sessionId.substring(7) : sessionId;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidUUID = uuidRegex.test(uuidPart);
    
    addLog(`   • Visual session: ${isVisualSession ? '✅' : '❌'}`, isVisualSession ? 'success' : 'info');
    addLog(`   • Valid UUID core: ${isValidUUID ? '✅' : '❌'}`, isValidUUID ? 'success' : 'warning');
    
    return isValidUUID;
  }, [addLog]);

  // Simple initialization (official rrweb stream pattern)
  useEffect(() => {
    if (!rrwebLoaded || !sessionId || visualizerRef.current) {
      return;
    }

    // Wait for iframe to be available AND properly rendered by React
    let attempts = 0;
    const maxAttempts = 50; // 5 seconds max
    
    const initializeWhenReady = () => {
      attempts++;
      
      if (!iframeRef.current) {
        if (attempts >= maxAttempts) {
          console.error('❌ [RRWebVisualizer] Timeout waiting for iframe to be rendered');
          addLog('❌ Timeout waiting for iframe to be rendered', 'error');
          setConnectionStatus('error');
      return;
    }

        // Iframe not ready yet, wait a bit more
        console.log(`🔄 [RRWebVisualizer] Waiting for iframe to be rendered... (attempt ${attempts})`);
        setTimeout(initializeWhenReady, 100);
      return;
    }
    
      // Iframe ref exists, but now wait for React to finish DOM operations
      console.log('✅ [RRWebVisualizer] Iframe ref ready, waiting for React DOM operations...');
      
      // Use requestAnimationFrame to ensure React has completed its render cycle
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Double requestAnimationFrame ensures React's commit phase is complete
          console.log('✅ [RRWebVisualizer] React render cycle complete, initializing WorkflowVisualizer...');
          console.log('🔍 [RRWebVisualizer] Final iframe check - in DOM:', document.contains(iframeRef.current!));
          console.log('🔍 [RRWebVisualizer] Iframe reference details:');
          console.log('  - Iframe object:', iframeRef.current);
          console.log('  - Iframe tagName:', iframeRef.current!.tagName);
          console.log('  - Iframe parentElement:', iframeRef.current!.parentElement);
          console.log('  - Iframe isConnected:', iframeRef.current!.isConnected);

          // Small delay to ensure iframe is fully stable in DOM
          setTimeout(() => {
            // Re-verify iframe is still good before passing to WorkflowVisualizer
            if (!iframeRef.current || !document.contains(iframeRef.current)) {
              console.error('❌ [RRWebVisualizer] Iframe became invalid before WorkflowVisualizer initialization');
              addLog('❌ Iframe became invalid', 'error');
              setConnectionStatus('error');
      return;
    }

            console.log('🎯 [RRWebVisualizer] Final verification before WorkflowVisualizer:');
            console.log('  - Iframe still in DOM:', document.contains(iframeRef.current));
            console.log('  - Iframe still connected:', iframeRef.current.isConnected);

            // Simple visualizer setup
      visualizerRef.current = new WorkflowVisualizer({
        onConnect: (connectedId: string) => {
          setConnectionStatus('connected');
          addLog(`✅ Connected to session: ${connectedId}`, 'success');
        },
        onDisconnect: (event: CloseEvent) => {
          setConnectionStatus('disconnected');
                if (event.code === 1000 && onClose) {
                  setTimeout(onClose, 3000); // Auto-close on completion
          }
        },
        onEvent: (data: any) => {
          if (data.type === 'player_ready') {
            setPlayerState('playing');
                  addLog('🎬 RRWeb player ready!', 'success');
                }
                // Update stats
                const newStats = visualizerRef.current?.getStatistics();
                if (newStats) setStats(newStats);
        },
        onError: (error: Error) => {
          setConnectionStatus('error');
          setPlayerError(error.message);
          addLog(`❌ Error: ${error.message}`, 'error');
        }
      });

            // Initialize player container
            console.log('🚀 [RRWebVisualizer] Passing iframe to WorkflowVisualizer...');
            console.log('🔍 [RRWebVisualizer] Iframe object identity before passing:', iframeRef.current);
            console.log('🔍 [RRWebVisualizer] Iframe.__reactInternalInstance:', (iframeRef.current as any).__reactInternalInstance);
            console.log('🔍 [RRWebVisualizer] Iframe unique ID for tracking:', iframeRef.current.tagName + '-' + Date.now());
            
            // Store reference for debugging
            (window as any).debugIframeRef = iframeRef.current;
            
            visualizerRef.current.initializePlayer(iframeRef.current);
      connectToExistingSession();
          }, 100); // Small delay to ensure DOM stability
        });
      });
    };

    // Start the initialization process
    initializeWhenReady();

    return () => {
      visualizerRef.current?.disconnect();
        visualizerRef.current = null;
      if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
        setAutoCloseTimer(null);
      }
    };
  }, [rrwebLoaded, sessionId, addLog, onClose]);

  const connectToExistingSession = useCallback(async () => {
    if (!visualizerRef.current || !sessionId) return;

    try {
      setConnectionStatus('connecting');
      addLog(`🔗 Connecting to session: ${sessionId}`, 'info');
      
      // Direct connection (official rrweb stream pattern)
      await visualizerRef.current.connectToStream(sessionId);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      addLog(`❌ Connection failed: ${errorMessage}`, 'error');
      setConnectionStatus('error');
    }
  }, [sessionId, addLog]);

  // Utility functions
  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Eye className="h-4 w-4 text-green-500" />;
      case 'connecting':
        return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-blue-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Removed fullscreen-related functions

  if (!rrwebLoaded) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading rrweb visual streaming...</p>
        </div>
      </div>
    );
  }

  // Always embedded mode now
  return (
    <div className="h-full flex flex-col bg-gray-100">
      <div className="bg-gray-800 border-b border-gray-600 px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <span className="text-white">Web Stream</span>
              <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
              <span className="text-gray-300 capitalize">{connectionStatus}</span>
            </div>
            
            {/* Live Stats Integration */}
            {connectionStatus === 'connected' && (
              <div className="flex items-center space-x-3 text-xs">
                <div className="flex items-center space-x-1">
                  <span className="text-gray-400">Events:</span>
                  <span className="text-blue-400 font-medium">{stats.totalEvents}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <span className="text-gray-400">Rate:</span>
                  <span className="text-green-400 font-medium">{stats.eventsPerSecond}/s</span>
                </div>
                <Badge variant="outline" className="text-xs text-green-600 border-green-400">
                  🟢 LIVE
                </Badge>
              </div>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={connectToExistingSession}
              disabled={connectionStatus === 'connecting'}
              className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-white text-xs"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-white min-h-0">
        <div className="h-full p-2 min-h-0">
          <div className="relative w-full h-full border rounded bg-gray-50 overflow-hidden min-h-[400px]">
            {/* Always render iframe - critical for RRWeb injection */}
            <iframe 
              ref={iframeRef} 
              src="about:blank"
              className="w-full h-full overflow-hidden bg-white rounded border-0 rrweb-iframe" 
              title="rrweb-player"
              style={{
                position: 'relative',
                width: '100%',
                height: '100%',
                minHeight: '400px',
                maxHeight: '100%',
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb'
              }}
            />
            
            {/* Overlay states on top of iframe */}
            {connectionStatus === 'connecting' && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-white bg-opacity-90">
                <div className="text-center">
                  <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-blue-500" />
                  <p className="text-sm text-gray-600">Connecting to visual stream...</p>
                  <div className="mt-2 text-xs text-gray-500">
                    Session: {sessionId?.slice(0, 16)}...
                  </div>
                </div>
              </div>
            )}
            
            {connectionStatus === 'error' && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-white bg-opacity-90">
                <div className="text-center max-w-sm">
                  <AlertTriangle className="h-6 w-6 mx-auto mb-2 text-yellow-500" />
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Connection Failed</h3>
                  <p className="text-xs text-gray-600 mb-3">Unable to connect to the rrweb streaming endpoint.</p>
                  <Button size="sm" onClick={connectToExistingSession}>Try Again</Button>
                </div>
              </div>
            )}
            
            {playerState === 'loading' && connectionStatus !== 'connecting' && connectionStatus !== 'error' && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-white bg-opacity-90">
                <div className="text-center text-gray-600">
                  <div className="text-2xl mb-2">🎥</div>
                  <div>Connecting to Web streaming...</div>
                  <div className="text-xs mt-2 text-gray-500">
                    Waiting for /workflows/visual/{sessionId}/stream
                  </div>
                </div>
              </div>
            )}
            
            {playerState === 'error' && connectionStatus !== 'error' && (
              <div className="absolute inset-0 flex items-center justify-center z-10 bg-white bg-opacity-90">
                <div className="text-center text-red-600">
                  <div className="text-2xl mb-2">❌</div>
                  <div>Player Error</div>
                  <div className="text-xs mt-2 text-red-500">
                    {playerError}
                  </div>
                </div>
              </div>
            )}
            
            {connectionStatus === 'connected' && (
              <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-xs font-medium animate-pulse">
                📡 Live
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

RRWebVisualizerComponent.displayName = 'RRWebVisualizer';

export const RRWebVisualizer = RRWebVisualizerComponent;
export default RRWebVisualizer; 