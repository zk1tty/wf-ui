import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAppContext } from '@/contexts/AppContext';
import { 
  ArrowLeft, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  Activity,
  Eye,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
  Send,
  MessageSquare,
  Cloud,
  Monitor,
  AlertTriangle
} from 'lucide-react';

import * as rrweb from 'rrweb';

interface RRWebEvent {
  type: number;
  timestamp: number;
  data: any;
}

interface WorkflowVisualizerConfig {
  apiBase: string;
  autoReconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  bufferSize: number;
  quality: string;
}

interface WorkflowVisualizerCallbacks {
  onConnect: (sessionId: string) => void;
  onDisconnect: (event: CloseEvent) => void;
  onEvent: (data: any) => void;
  onError: (error: Error) => void;
}

interface WorkflowVisualizerState {
  isConnected: boolean;
  sessionId: string | null;
  websocket: WebSocket | null;
  replayer: any;
  events: RRWebEvent[];
}

interface WorkflowVisualizerStats {
  eventsReceived: number;
  bytesReceived: number;
  startTime: number | null;
}

// Enhanced WorkflowVisualizer Class - Phase 4 Implementation
class WorkflowVisualizer {
  private config: WorkflowVisualizerConfig;
  private state: WorkflowVisualizerState;
  private callbacks: WorkflowVisualizerCallbacks;
  private stats: WorkflowVisualizerStats;
  private playerContainer: HTMLElement | null = null;
  private reconnectAttempts = 0;
  private pingInterval: NodeJS.Timeout | null = null;
  private lastMessageTime = 0;

  constructor(options: Partial<WorkflowVisualizerConfig> & Partial<WorkflowVisualizerCallbacks> = {}) {
    this.config = {
      apiBase: options.apiBase || '',
      autoReconnect: options.autoReconnect !== false,
      reconnectInterval: options.reconnectInterval || 3000,
      maxReconnectAttempts: options.maxReconnectAttempts || 5,
      bufferSize: options.bufferSize || 1000,
      quality: options.quality || 'standard'
    };
    
    this.state = {
      isConnected: false,
      sessionId: null,
      websocket: null,
      replayer: null,
      events: []
    };
    
    this.callbacks = {
      onConnect: options.onConnect || (() => {}),
      onDisconnect: options.onDisconnect || (() => {}),
      onEvent: options.onEvent || (() => {}),
      onError: options.onError || (() => {})
    };
    
    this.stats = {
      eventsReceived: 0,
      bytesReceived: 0,
      startTime: null
    };
  }

  async startWorkflow(workflowName: string, inputs: any = {}, options: any = {}): Promise<any> {
    try {
      const response = await fetch(`${this.config.apiBase}/workflows/${workflowName}/execute/session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: inputs,
          session_token: options.sessionToken,
          mode: options.mode || 'cloud-run',
          visual: true,
          visual_streaming: true,
          visual_quality: options.quality || this.config.quality,
          visual_events_buffer: options.bufferSize || this.config.bufferSize
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // For rrweb streaming, use the task_id as session_id
        const sessionId = result.session_id || result.task_id;
        if (sessionId) {
          this.state.sessionId = sessionId;
          await this.connectToStream(sessionId);
          return { ...result, session_id: sessionId };
        } else {
          throw new Error('No session ID or task ID returned from backend');
        }
      } else {
        throw new Error(result.message || 'Failed to start visual workflow');
      }
      
    } catch (error) {
      this.callbacks.onError(error as Error);
      throw error;
    }
  }

  async connectToStream(sessionId: string): Promise<void> {
    // Use direct backend connection for rrweb streaming
    const isProduction = window.location.hostname !== 'localhost';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = isProduction 
      ? `${protocol}//${window.location.host}/workflows/visual/${sessionId}/stream`
      : `ws://localhost:8000/workflows/visual/${sessionId}/stream`;
    
    console.log(`🔌 [RRWebVisualizer] Connecting to rrweb stream: ${wsUrl}`);
    
    this.state.websocket = new WebSocket(wsUrl);
    this.stats.startTime = Date.now();
    this.reconnectAttempts = 0;
    
    // Set a timeout to show error state if connection takes too long
    const connectionTimeout = setTimeout(() => {
      if (!this.state.isConnected) {
        console.log('⏰ [RRWebVisualizer] Connection timeout - backend rrweb endpoint not responding');
        this.callbacks.onError(new Error('Connection timeout - rrweb streaming endpoint not available'));
        if (this.state.websocket) {
          this.state.websocket.close();
        }
      }
    }, 5000); // 5 second timeout for rrweb
    
    this.state.websocket.onopen = () => {
      clearTimeout(connectionTimeout);
      this.state.isConnected = true;
      console.log(`✅ [RRWebVisualizer] Connected to rrweb stream: ${wsUrl}`);
      
      // Send client ready message to backend
      if (this.state.websocket) {
        const clientMessage = { type: 'client_ready', session_id: sessionId };
        console.log(`📤 [RRWebVisualizer] Sending client ready:`, clientMessage);
        this.state.websocket.send(JSON.stringify(clientMessage));
      }
      
      this.callbacks.onConnect(sessionId);
      
      // Start periodic ping to check connection health
      this.startConnectionHealthCheck();
      
      // Show warning if no rrweb events received after 15 seconds
      setTimeout(() => {
        if (this.state.isConnected) {
          const rrwebEventCount = this.state.events.length;
          if (rrwebEventCount === 0) {
            console.log(`⚠️ [RRWebVisualizer] Connected and receiving status messages, but no rrweb events after 15s`);
            console.log(`🔍 [RRWebVisualizer] This means:`);
            console.log(`   • WebSocket connection: ✅ Working`);
            console.log(`   • Backend responding: ✅ Working`);
            console.log(`   • RRWeb recording: ❌ Not streaming events`);
            console.log(`💡 [RRWebVisualizer] Check if the workflow is running with visual rrweb recording enabled`);
          }
        }
      }, 15000);
    };
    
    this.state.websocket.onmessage = async (event) => {
      await this.handleMessage(event);
    };
    
    this.state.websocket.onclose = (event) => {
      clearTimeout(connectionTimeout);
      console.log(`🔌 [RRWebVisualizer] RRWeb WebSocket closed: ${event.code} - ${event.reason}`);
      this.handleDisconnection(event);
    };

    this.state.websocket.onerror = (error) => {
      clearTimeout(connectionTimeout);
      console.error('🔌 [RRWebVisualizer] RRWeb WebSocket error:', error);
      this.callbacks.onError(new Error('RRWeb WebSocket connection failed - backend endpoint not available'));
    };
  }



  initializePlayer(container: HTMLElement): void {
    this.playerContainer = container;
    this.state.events = [];
    container.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f8f9fa;">
        <div style="text-align: center; color: #6c757d;">
          <div style="font-size: 24px; margin-bottom: 8px;">🎥</div>
          <div>Connecting to RRWeb streaming...</div>
          <div style="font-size: 12px; margin-top: 8px; color: #999;">
            Waiting for /workflows/visual/{sessionId}/stream
          </div>
        </div>
      </div>
    `;
  }

  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      let messageData: string;
      
      // Handle different message data types
      if (event.data instanceof Blob) {
        // Convert Blob to text
        messageData = await event.data.text();
        console.log('🔄 [RRWebVisualizer] Converted Blob to text:', messageData.substring(0, 200) + '...');
      } else if (typeof event.data === 'string') {
        messageData = event.data;
      } else {
        // Handle other types (ArrayBuffer, etc.)
        messageData = String(event.data);
      }
      
      // Parse the JSON data
      const data = JSON.parse(messageData);
      
      this.stats.eventsReceived++;
      this.stats.bytesReceived += messageData.length;
      this.lastMessageTime = Date.now();
      
      console.log(`📨 [RRWebVisualizer] Raw message received:`, data);
      
      // Handle different message types from backend
      switch (data.type) {
        case 'connection_established':
          console.log('✅ [RRWebVisualizer] Connection established:', data);
          break;
          
        case 'status':
          console.log('📊 [RRWebVisualizer] Status update:', data);
          break;
          
        case 'rrweb_event':
          console.log('🎥 [RRWebVisualizer] Received rrweb event:', data.event_data?.type);
          this.handleRRWebEvent(data);
          break;
          
        case 'pong':
          // Backend responding to our ping - connection is healthy
          console.log('🏓 [RRWebVisualizer] Pong received - connection healthy');
          break;
          
        default:
          // Handle legacy format or other message types
          if (data.event_data) {
            console.log('🎥 [RRWebVisualizer] Legacy rrweb event:', data.event_data.type);
            this.handleRRWebEvent(data);
          } else {
            console.log('📨 [RRWebVisualizer] Unknown message type:', data);
          }
          break;
      }
      
      this.callbacks.onEvent(data);
      
    } catch (error) {
      console.error('🔌 [RRWebVisualizer] Message parsing error:', error);
      console.error('🔌 [RRWebVisualizer] Raw message data:', event.data);
      this.callbacks.onError(error as Error);
    }
  }

  private handleRRWebEvent(eventData: any): void {
    const event = eventData.event_data;
    this.state.events.push(event);
    
    // Type 2 is FullSnapshot - triggers replayer creation
    if (event.type === 2 && !this.state.replayer) {
      this.createReplayer();
    } else if (this.state.replayer) {
      this.addEventToPlayer(event);
    }
  }

  private createReplayer(): void {
    if (!this.playerContainer) {
      console.error('Player container not available');
      return;
    }

    this.playerContainer.innerHTML = '';
    
    try {
      this.state.replayer = new rrweb.Replayer(this.state.events, {
        root: this.playerContainer,
        liveMode: true,
        UNSAFE_replayCanvas: true
      });
      
      this.state.replayer.startLive(Date.now() - 1000);
      console.log('✅ [RRWebVisualizer] rrweb replayer created and started');
    } catch (error) {
      console.error('Failed to create rrweb replayer:', error);
      this.callbacks.onError(error as Error);
    }
  }

  private addEventToPlayer(event: RRWebEvent): void {
    if (this.state.replayer && typeof this.state.replayer.addEvent === 'function') {
      this.state.replayer.addEvent(event);
    }
  }

  private handleDisconnection(event: CloseEvent): void {
    this.state.isConnected = false;
    this.callbacks.onDisconnect(event);
    
    // Auto-reconnect logic
    if (this.config.autoReconnect && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        if (this.state.sessionId) {
          this.connectToStream(this.state.sessionId);
        }
      }, this.config.reconnectInterval);
    }
  }

  private startConnectionHealthCheck(): void {
    // Clear any existing interval
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }
    
    this.lastMessageTime = Date.now();
    
    // Check connection health every 10 seconds
    this.pingInterval = setInterval(() => {
      const timeSinceLastMessage = Date.now() - this.lastMessageTime;
      
      if (this.state.isConnected) {
        if (timeSinceLastMessage > 30000) { // 30 seconds without messages
          console.log(`⚠️ [RRWebVisualizer] No messages received for ${Math.round(timeSinceLastMessage/1000)}s`);
          console.log(`🔍 [RRWebVisualizer] Connection appears idle - backend may not be sending data`);
        }
        
        // Send ping to keep connection alive
        if (this.state.websocket && this.state.websocket.readyState === WebSocket.OPEN) {
          this.state.websocket.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
      }
    }, 10000);
  }

  disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.state.websocket) {
      this.state.websocket.close();
    }
    this.state.isConnected = false;
  }

  getStatistics(): any {
    const duration = this.stats.startTime ? (Date.now() - this.stats.startTime) / 1000 : 0;
    return {
      eventsReceived: this.stats.eventsReceived,
      bytesReceived: this.stats.bytesReceived,
      eventsPerSecond: duration > 0 ? Math.round(this.stats.eventsReceived / duration) : 0,
      totalEvents: this.state.events.length,
      duration: Math.round(duration)
    };
  }

  getConnectionState(): { isConnected: boolean; sessionId: string | null } {
    return {
      isConnected: this.state.isConnected,
      sessionId: this.state.sessionId
    };
  }
}

interface RRWebVisualizerProps {
  sessionId?: string;
}

export function RRWebVisualizer({ sessionId: propSessionId }: RRWebVisualizerProps) {
  const { sessionId: urlSessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const sessionId = propSessionId || urlSessionId;
  
  console.log('🎥 [RRWebVisualizer] Component initialized with sessionId:', sessionId);
  
  const { 
    currentExecutionMode, 
    currentTaskId, 
    currentWorkflowData,
    currentUserSessionToken,
    currentExecutionInputs
  } = useAppContext();
  
  const visualizerRef = useRef<WorkflowVisualizer | null>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const [workflowStatus, setWorkflowStatus] = useState<'idle' | 'connecting' | 'running' | 'completed' | 'error'>('idle');
  const [mode, setMode] = useState<'cloud-run' | 'local-run' | null>(null);
  const [rrwebLoaded, setRrwebLoaded] = useState(false);

  // Initialize rrweb (now using local import)
  useEffect(() => {
    console.log('🎥 [RRWebVisualizer] rrweb imported locally');
    setRrwebLoaded(true);
    addLog('rrweb library loaded successfully', 'success');
  }, []);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setLogs(prev => [...prev.slice(-49), logEntry]); // Keep last 50 logs
  }, []);

  // Initialize visualizer
  useEffect(() => {
    console.log('🎥 [RRWebVisualizer] Initialize effect triggered:', { rrwebLoaded, sessionId });
    if (!rrwebLoaded || !sessionId) {
      console.log('🎥 [RRWebVisualizer] Skipping initialization - rrwebLoaded:', rrwebLoaded, 'sessionId:', sessionId);
      return;
    }

    console.log('🎥 [RRWebVisualizer] Initializing visualizer...');
    const initializeVisualizer = () => {
      visualizerRef.current = new WorkflowVisualizer({
        onConnect: (connectedId: string) => {
          setConnectionStatus('connected');
          setConnectedSessionId(connectedId);
          addLog(`Connected to session: ${connectedId}`, 'success');
        },
        onDisconnect: (event: CloseEvent) => {
          setConnectionStatus('disconnected');
          addLog(`Disconnected (code: ${event.code})`, 'warning');
        },
        onEvent: (data: any) => {
          const newStats = visualizerRef.current?.getStatistics();
          if (newStats) {
            setStats(newStats);
          }
          
          if (data.event_data) {
            addLog(`rrweb event: type ${data.event_data.type}`, 'info');
          }
        },
        onError: (error: Error) => {
          setConnectionStatus('error');
          addLog(`Error: ${error.message}`, 'error');
        }
      });

      if (playerContainerRef.current) {
        visualizerRef.current.initializePlayer(playerContainerRef.current);
      }

      // Try to connect to existing session
      connectToExistingSession();
    };

    initializeVisualizer();

    return () => {
      if (visualizerRef.current) {
        visualizerRef.current.disconnect();
      }
    };
  }, [rrwebLoaded, sessionId]);

  const connectToExistingSession = useCallback(async () => {
    if (!visualizerRef.current || !sessionId) return;

    try {
      setConnectionStatus('connecting');
      setWorkflowStatus('connecting');
      addLog('Connecting to rrweb streaming session...', 'info');
      
      // Check rrweb streaming status (new endpoint)
      addLog(`Checking rrweb stream status for: ${sessionId}`, 'info');
      
      try {
        const isProduction = window.location.hostname !== 'localhost';
        const baseUrl = isProduction ? '' : 'http://localhost:8000';
        const response = await fetch(`${baseUrl}/workflows/visual/${sessionId}/status`);
        
        if (response.ok) {
          const statusData = await response.json();
          
          if (statusData.success) {
            addLog(`✅ RRWeb session found: ${statusData.streaming_active ? 'active' : 'inactive'}`, 'success');
            addLog(`📊 Events processed: ${statusData.events_processed || 0}`, 'info');
            addLog(`👥 Connected clients: ${statusData.connected_clients || 0}`, 'info');
            
            if (statusData.streaming_active) {
              addLog('✅ RRWeb streaming is active - ready to connect', 'success');
            } else {
              addLog('⚠️ RRWeb streaming not active yet - will attempt connection', 'warning');
            }
          } else {
            addLog(`⚠️ RRWeb session status check failed`, 'warning');
          }
        } else {
          addLog(`⚠️ RRWeb status endpoint not available (${response.status})`, 'warning');
        }
      } catch (statusError) {
        addLog(`⚠️ Could not check rrweb status: ${statusError}`, 'warning');
      }
      
      // Connect to rrweb streaming
      addLog('Connecting to rrweb WebSocket stream...', 'info');
      await visualizerRef.current.connectToStream(sessionId);
      
    } catch (error) {
      addLog(`Failed to connect: ${error}`, 'error');
      setConnectionStatus('error');
      setWorkflowStatus('error');
    }
  }, [sessionId, addLog]);

  const startNewWorkflow = useCallback(async () => {
    if (!visualizerRef.current || !currentWorkflowData) return;

    try {
      setWorkflowStatus('connecting');
      addLog('Starting new visual workflow...', 'info');
      
      const workflowId = currentWorkflowData.id || currentWorkflowData.name;
      const inputs: any = {};
      
      if (currentExecutionInputs) {
        currentExecutionInputs.forEach((field: any) => {
          inputs[field.name] = field.value;
        });
      }

      const result = await visualizerRef.current.startWorkflow(workflowId, inputs, {
        mode: currentExecutionMode || 'cloud-run',
        quality: 'standard',
        sessionToken: currentUserSessionToken
      });

      setMode(result.mode);
      setWorkflowStatus('running');
      addLog(`Workflow started: ${result.workflow}`, 'success');
      
    } catch (error) {
      addLog(`Failed to start workflow: ${error}`, 'error');
      setWorkflowStatus('error');
    }
  }, [currentWorkflowData, currentExecutionInputs, currentExecutionMode, addLog]);

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

  const getModeIcon = () => {
    return mode === 'cloud-run' ? <Cloud className="h-4 w-4" /> : <Monitor className="h-4 w-4" />;
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  console.log('🎥 [RRWebVisualizer] Rendering - rrwebLoaded:', rrwebLoaded, 'connectionStatus:', connectionStatus);

  if (!rrwebLoaded) {
    console.log('🎥 [RRWebVisualizer] Showing loading state');
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
          <p className="text-gray-600">Loading rrweb visual streaming...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`h-screen flex flex-col bg-gray-100 ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 shadow-sm">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/')}
              className="flex items-center space-x-2 text-gray-300 hover:text-white hover:bg-gray-800"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Workflows</span>
            </Button>
            
            <Separator orientation="vertical" className="h-6 bg-gray-600" />
            
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <span className="font-medium text-white">rrweb Visual Streaming</span>
              <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                Phase 4
              </Badge>
              {sessionId && (
                <Badge variant="outline" className="text-xs border-gray-600 text-gray-300">
                  {sessionId.slice(0, 8)}...
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2 text-sm text-gray-300">
              <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
              <span className="capitalize">{connectionStatus}</span>
              {mode && (
                <>
                  <span>•</span>
                  <div className="flex items-center space-x-1">
                    {getModeIcon()}
                    <span>{mode}</span>
                  </div>
                </>
              )}
            </div>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={connectToExistingSession}
              disabled={connectionStatus === 'connecting'}
              className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            <Button 
              variant="outline" 
              size="sm" 
              onClick={toggleFullscreen}
              className="border-gray-600 text-gray-300 hover:bg-gray-800 hover:text-white"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-b px-4 py-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-4">
            <span><strong>Status:</strong> {workflowStatus}</span>
            <span><strong>Events:</strong> {stats.eventsReceived}</span>
            <span><strong>Data:</strong> {Math.round(stats.bytesReceived / 1024)} KB</span>
            <span><strong>Rate:</strong> {stats.eventsPerSecond}/s</span>
          </div>
          
          {connectionStatus === 'disconnected' && (
            <div className="flex gap-2">
              <Button size="sm" onClick={startNewWorkflow} disabled={!currentWorkflowData}>
                Start Visual Workflow
              </Button>
              <Button size="sm" variant="outline" onClick={connectToExistingSession}>
                Check Session Status
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* rrweb Player */}
        <div className="flex-1 bg-white">
          {connectionStatus === 'connecting' ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className="text-gray-600">Connecting to visual stream...</p>
              </div>
            </div>
          ) : connectionStatus === 'error' ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center max-w-lg">
                <AlertTriangle className="h-8 w-8 mx-auto mb-4 text-yellow-500" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">RRWeb Streaming Connection Failed</h3>
                <p className="text-gray-600 mb-4">Unable to connect to the rrweb streaming endpoint.</p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
                  <p className="text-blue-800 font-medium text-sm mb-2">🔧 Troubleshooting:</p>
                  <ul className="text-blue-700 text-xs space-y-1">
                    <li>• Check backend is running on port 8000</li>
                    <li>• Verify session ID: {sessionId}</li>
                    <li>• Ensure rrweb streaming is enabled for this session</li>
                    <li>• Try the built-in viewer as alternative</li>
                  </ul>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      const isProduction = window.location.hostname !== 'localhost';
                      const baseUrl = isProduction ? '' : 'http://localhost:8000';
                      window.open(`${baseUrl}/workflows/visual/${sessionId}/viewer`, '_blank');
                    }}
                  >
                    Open Built-in RRWeb Viewer
                  </Button>
                  <Button onClick={connectToExistingSession}>Try Again</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full p-4">
              <div ref={playerContainerRef} className="w-full h-full border rounded-lg bg-gray-50" />
            </div>
          )}
        </div>

        {/* Sidebar with Logs */}
        {!isFullscreen && (
          <div className="w-80 bg-white border-l">
            <Card className="h-full rounded-none border-0">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <Terminal className="h-4 w-4" />
                    <span>Event Log</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {logs.length}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="h-96 overflow-y-auto bg-gray-900 text-green-400 p-3 rounded text-xs font-mono">
                  {logs.length === 0 ? (
                    <p className="text-gray-500">Waiting for events...</p>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="mb-1">
                        {log}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default RRWebVisualizer; 