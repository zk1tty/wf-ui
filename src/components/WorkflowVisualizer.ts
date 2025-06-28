import { API_ENDPOINTS } from '@/lib/constants';

// Simple RRWeb event type (no complex viewport management)
type RRWebEvent = any;

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
}

interface WorkflowVisualizerStats {
  eventsReceived: number;
  bytesReceived: number;
  startTime: number | null;
}

export class WorkflowVisualizer {
  private config: WorkflowVisualizerConfig;
  private state: WorkflowVisualizerState;
  private callbacks: WorkflowVisualizerCallbacks;
  private stats: WorkflowVisualizerStats;
  private playerContainer: HTMLElement | null = null;
  private rrwebCode: string | null = null; // Cached rrweb source code
  private rrwebCSS: string | null = null; // Cached rrweb CSS

  // Step 4: Simplified constructor - official rrweb stream pattern
  constructor(options: Partial<WorkflowVisualizerCallbacks> = {}) {
    this.config = {
      apiBase: '',
      autoReconnect: false, // Simplified - no auto-reconnect complexity
      reconnectInterval: 3000,
      maxReconnectAttempts: 3,
      bufferSize: 1000,
      quality: 'standard'
    };
    
    this.state = {
      isConnected: false,
      sessionId: null,
      websocket: null,
      replayer: null
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
      console.log('🚀 [WorkflowVisualizer] Starting workflow...');
      console.log('🔍 [WorkflowVisualizer] Workflow name:', workflowName);
      console.log('🔍 [WorkflowVisualizer] Inputs:', inputs);
      console.log('🔍 [WorkflowVisualizer] Options:', options);
      
      const requestBody = {
        inputs: inputs,
        session_token: options.sessionToken,
        mode: options.mode || 'cloud-run',
        visual: true,
        visual_streaming: true,
        visual_quality: options.quality || this.config.quality,
        visual_events_buffer: options.bufferSize || this.config.bufferSize
      };
      
      console.log('📤 [WorkflowVisualizer] Request body:', requestBody);
      
      const response = await fetch(API_ENDPOINTS.EXECUTE_WORKFLOW(workflowName), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });
      
      console.log('📥 [WorkflowVisualizer] Response status:', response.status);
      console.log('🔍 [WorkflowVisualizer] Response headers:', Object.fromEntries(response.headers.entries()));
      
      const result = await response.json();
      console.log('📋 [WorkflowVisualizer] Response data:', result);
      
      if (result.success) {
        const sessionId = result.session_id || result.task_id;
        console.log('✅ [WorkflowVisualizer] Workflow started successfully');
        console.log('🔍 [WorkflowVisualizer] Session ID:', sessionId);
        
        if (sessionId) {
          this.state.sessionId = sessionId;
          console.log('🔌 [WorkflowVisualizer] Initiating WebSocket connection...');
          await this.connectToStream(sessionId);
          console.log('✅ [WorkflowVisualizer] WebSocket connection established');
          return { ...result, session_id: sessionId };
        } else {
          throw new Error('No session ID or task ID returned from backend');
        }
      } else {
        console.error('❌ [WorkflowVisualizer] Workflow start failed:', result.message);
        throw new Error(result.message || 'Failed to start visual workflow');
      }
      
    } catch (error) {
      console.error('❌ [WorkflowVisualizer] startWorkflow error:', error);
      this.callbacks.onError(error as Error);
      throw error;
    }
  }

  // Step 4: Simplified connection - official rrweb stream pattern
  async connectToStream(sessionId: string): Promise<void> {
    const wsUrl = API_ENDPOINTS.VISUAL_STREAM_WS(sessionId);
    
    console.log('🔌 [WorkflowVisualizer] Connecting to WebSocket:', wsUrl);
    console.log('🔍 [WorkflowVisualizer] Session ID:', sessionId);
    
    this.state.sessionId = sessionId;
    this.state.websocket = new WebSocket(wsUrl);
    this.stats.startTime = Date.now();
    
    this.state.websocket.onopen = () => {
      this.state.isConnected = true;
      console.log('✅ [WorkflowVisualizer] WebSocket connected successfully');
      console.log('🔍 [WorkflowVisualizer] WebSocket readyState:', this.state.websocket?.readyState);
      console.log('🔍 [WorkflowVisualizer] WebSocket protocol:', this.state.websocket?.protocol);
      this.callbacks.onConnect(sessionId);
    };
    
    this.state.websocket.onmessage = (event) => {
      console.log('📨 [WorkflowVisualizer] Raw WebSocket message received');
      console.log('🔍 [WorkflowVisualizer] Message type:', typeof event.data);
      console.log('🔍 [WorkflowVisualizer] Message size:', event.data instanceof Blob ? event.data.size : event.data.length);
      this.handleMessage(event);
    };
    
    this.state.websocket.onclose = (event) => {
      this.state.isConnected = false;
      console.log('🔌 [WorkflowVisualizer] WebSocket closed');
      console.log('🔍 [WorkflowVisualizer] Close code:', event.code);
      console.log('🔍 [WorkflowVisualizer] Close reason:', event.reason);
      console.log('🔍 [WorkflowVisualizer] Was clean:', event.wasClean);
      this.callbacks.onDisconnect(event);
    };

    this.state.websocket.onerror = (error) => {
      console.error('❌ [WorkflowVisualizer] WebSocket error:', error);
      console.log('🔍 [WorkflowVisualizer] WebSocket readyState:', this.state.websocket?.readyState);
      this.callbacks.onError(new Error('WebSocket connection failed'));
    };
  }

  initializePlayer(iframe: HTMLIFrameElement): void {
    if (!iframe) {
      console.error('❌ [WorkflowVisualizer] Invalid iframe provided to initializePlayer');
      return;
    }
    
    // Reset duplicate event tracking for new session
    this.lastEventTimestamp = 0;
    this.duplicateEventCount = 0;
    console.log('🔄 [WorkflowVisualizer] Reset duplicate event tracking for new session');
    
    console.log('🔍 [WorkflowVisualizer] Received iframe object identity:', iframe);
    console.log('🔍 [WorkflowVisualizer] Is same as debugIframeRef?', iframe === (window as any).debugIframeRef);
    console.log('🔍 [WorkflowVisualizer] Iframe DOM status on arrival:');
    console.log('  - In DOM:', document.contains(iframe));
    console.log('  - isConnected:', iframe.isConnected);
    console.log('  - parentElement:', iframe.parentElement);
    
    this.playerContainer = iframe;
    
    // Step 1: Main Context Fetch - official RRWeb pattern
    this.fetchRRWebCode().then(() => {
      // Step 2: Re-fetch iframe reference in case React re-rendered during async operation
      const currentIframe = (window as any).debugIframeRef;
      
      if (!currentIframe) {
        console.error('❌ [WorkflowVisualizer] Iframe reference lost during async operation');
        this.callbacks.onError(new Error('Iframe reference lost during async operation'));
        return;
      }
      
      console.log('🔄 [WorkflowVisualizer] Re-checking iframe after async fetch:');
      console.log('  - Original iframe still in DOM:', document.contains(iframe));
      console.log('  - Current iframe in DOM:', document.contains(currentIframe));
      console.log('  - Same iframe object?', iframe === currentIframe);
      
      // Use the current iframe reference
      this.playerContainer = currentIframe;
      this.injectRRWebIntoIframe(currentIframe);
    }).catch((error: Error) => {
      console.error('❌ [WorkflowVisualizer] Failed to fetch rrweb code:', error);
      this.callbacks.onError(error);
    });
  }

  // Step 2: Simplified message handling - official rrweb stream pattern
  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      let data: any;
      
      console.log('🔍 [WorkflowVisualizer] Parsing message...');
      
      // Parse message (handle both string and Blob)
      if (event.data instanceof Blob) {
        console.log('🔍 [WorkflowVisualizer] Processing Blob message');
        data = JSON.parse(await event.data.text());
      } else {
        console.log('🔍 [WorkflowVisualizer] Processing string message');
        data = JSON.parse(event.data);
      }
      
      console.log('📋 [WorkflowVisualizer] Parsed message data:', {
        type: typeof data,
        keys: Object.keys(data),
        hasEventData: !!data.event_data,
        eventDataType: data.event_data ? typeof data.event_data : 'none'
      });
      
      // Update basic stats
      this.stats.eventsReceived++;
      this.stats.bytesReceived += event.data instanceof Blob ? event.data.size : event.data.length;
      
      console.log('📊 [WorkflowVisualizer] Stats updated:', {
        eventsReceived: this.stats.eventsReceived,
        bytesReceived: this.stats.bytesReceived
      });
      
      // Official rrweb live mode pattern: simple event routing
      if (data.event_data) {
        console.log('🎬 [WorkflowVisualizer] Event data found:', {
          type: data.event_data.type,
          timestamp: data.event_data.timestamp
        });
        
        // Identify event type for debugging
        if (data.event_data.type === 2) {
          console.log('📸 [WorkflowVisualizer] FULL SNAPSHOT EVENT detected');
        } else if (data.event_data.type === 3) {
          console.log('🎞️ [WorkflowVisualizer] INCREMENTAL SNAPSHOT EVENT detected');
        }
        
        // Official live mode pattern: just add the event immediately
        this.addEventDirectly(data.event_data);
      } else {
        console.log('ℹ️ [WorkflowVisualizer] Control message received (no event_data)');
      }
      
      this.callbacks.onEvent(data);
      
    } catch (error) {
      console.error('❌ [WorkflowVisualizer] Failed to handle message:', error);
      console.error('🔍 [WorkflowVisualizer] Raw message data:', event.data);
      this.callbacks.onError(error as Error);
    }
  }

  // Step 4: Simplified statistics - official rrweb stream pattern
  getStatistics(): any {
    const duration = this.stats.startTime ? (Date.now() - this.stats.startTime) / 1000 : 0;
    return {
      totalEvents: this.stats.eventsReceived,
      eventsPerSecond: duration > 0 ? Math.round(this.stats.eventsReceived / duration) : 0,
      eventsReceived: this.stats.eventsReceived,
      bytesReceived: this.stats.bytesReceived
    };
  }

  getConnectionState(): { isConnected: boolean; sessionId: string | null } {
    return {
      isConnected: this.state.isConnected,
      sessionId: this.state.sessionId
    };
  }

  // Step 4: Simplified disconnect - official rrweb stream pattern
  disconnect(): void {
    this.state.isConnected = false;
    
    if (this.state.websocket) {
      this.state.websocket.close();
      this.state.websocket = null;
    }
    
    this.state.replayer = null;
    
    // Reset duplicate event tracking
    this.lastEventTimestamp = 0;
    this.duplicateEventCount = 0;
  }

  // Official rrweb live mode pattern - simple event addition with duplicate filtering
  private lastEventTimestamp: number = 0;
  private duplicateEventCount: number = 0;
  
  private addEventDirectly(event: any): void {
    console.log('🎯 [WorkflowVisualizer] Adding event to live replayer:', {
      type: event.type,
      timestamp: event.timestamp
    });
    
    // Filter duplicate timestamp events to prevent rapid rebuild cycles
    if (event.timestamp === this.lastEventTimestamp) {
      this.duplicateEventCount++;
      if (this.duplicateEventCount > 3) {
        console.warn('🔄 [WorkflowVisualizer] Skipping duplicate timestamp event to prevent media conflicts:', {
          timestamp: event.timestamp,
          duplicateCount: this.duplicateEventCount
        });
        return;
      }
    } else {
      this.lastEventTimestamp = event.timestamp;
      this.duplicateEventCount = 0;
    }
    
    // Official live mode pattern: just add the event, RRWeb handles everything
    if (this.state.replayer) {
      this.state.replayer.addEvent(event);
      console.log('✅ [WorkflowVisualizer] Event added to live replayer');
    } else {
      console.error('❌ [WorkflowVisualizer] No replayer instance available');
    }
  }

  // Setup RRWeb event listeners for debugging and monitoring
  private setupReplayerEventListeners(): void {
    if (!this.state.replayer) {
      console.error('❌ [WorkflowVisualizer] Cannot setup event listeners - no replayer instance');
      return;
    }

    console.log('🎧 [WorkflowVisualizer] Setting up RRWeb event listeners...');

    // Critical events for debugging insertBefore errors
    this.state.replayer.on('fullsnapshot-rebuilded', (event: any) => {
      console.log('📸 [RRWeb Event] Full snapshot rebuilded:', {
        timestamp: event.timestamp,
        type: event.type
      });
    });

    this.state.replayer.on('event-cast', (event: any) => {
      console.log('🎬 [RRWeb Event] Event cast:', {
        type: event.type,
        timestamp: event.timestamp
      });
    });

    // CSS loading events (could relate to DOM timing issues)
    this.state.replayer.on('load-stylesheet-start', () => {
      console.log('🎨 [RRWeb Event] Started loading stylesheets');
    });

    this.state.replayer.on('load-stylesheet-end', () => {
      console.log('🎨 [RRWeb Event] Finished loading stylesheets');
    });

    // State tracking events
    this.state.replayer.on('start', () => {
      console.log('▶️ [RRWeb Event] Replayer started');
    });

    this.state.replayer.on('pause', () => {
      console.log('⏸️ [RRWeb Event] Replayer paused');
    });

    this.state.replayer.on('finish', () => {
      console.log('🏁 [RRWeb Event] Replayer finished');
    });

    // Viewport changes in iframe
    this.state.replayer.on('resize', (payload: any) => {
      console.log('📐 [RRWeb Event] Viewport resized:', payload);
    });

    // Error-related events
    this.state.replayer.on('skip-start', (payload: any) => {
      console.log('⏭️ [RRWeb Event] Started skipping inactive time:', payload);
    });

    this.state.replayer.on('skip-end', (payload: any) => {
      console.log('⏭️ [RRWeb Event] Finished skipping inactive time:', payload);
    });

    console.log('✅ [WorkflowVisualizer] RRWeb event listeners configured');
  }



  // Step 1: Main Context Fetch - Official RRWeb Pattern (Puppeteer approach)
  private async fetchRRWebCode(): Promise<void> {
    // If already cached, no need to fetch again
    if (this.rrwebCode && this.rrwebCSS) {
      console.log('✅ [WorkflowVisualizer] Using cached rrweb code and CSS');
      return;
    }

    console.log('🌐 [WorkflowVisualizer] Fetching rrweb code and CSS from CDN (production-ready)...');

    try {
      // Try jsdelivr.net first (best CORS support)
      try {
        const [jsResponse, cssResponse] = await Promise.all([
          fetch('https://cdn.jsdelivr.net/npm/rrweb@latest/dist/rrweb.js'),
          fetch('https://cdn.jsdelivr.net/npm/rrweb@latest/dist/style.css')
        ]);
        
        if (!jsResponse.ok || !cssResponse.ok) {
          throw new Error(`CDN fetch failed: JS ${jsResponse.status}, CSS ${cssResponse.status}`);
        }

        this.rrwebCode = await jsResponse.text();
        this.rrwebCSS = await cssResponse.text();
        
        console.log(`✅ [WorkflowVisualizer] jsdelivr.net rrweb fetched (JS: ${Math.round(this.rrwebCode.length / 1024)} KB, CSS: ${Math.round(this.rrwebCSS.length / 1024)} KB)`);
        
      } catch {
        console.warn('⚠️ [WorkflowVisualizer] jsdelivr.net failed, trying unpkg.com fallback...');
        
        // Fallback to unpkg.com 
        const [jsResponse, cssResponse] = await Promise.all([
          fetch('https://unpkg.com/rrweb@2.0.0-alpha.4/dist/rrweb.js'),
          fetch('https://unpkg.com/rrweb@2.0.0-alpha.4/dist/style.css')
        ]);
        
        if (!jsResponse.ok || !cssResponse.ok) {
          throw new Error(`Fallback CDN fetch failed: JS ${jsResponse.status}, CSS ${cssResponse.status}`);
        }

        this.rrwebCode = await jsResponse.text();
        this.rrwebCSS = await cssResponse.text();
        
        console.log(`✅ [WorkflowVisualizer] unpkg.com fallback used (JS: ${Math.round(this.rrwebCode.length / 1024)} KB, CSS: ${Math.round(this.rrwebCSS.length / 1024)} KB)`);
      }
      
    } catch (error) {
      const errorMessage = `Failed to fetch rrweb from all CDNs: ${error}`;
      console.error('❌ [WorkflowVisualizer]', errorMessage);
      throw new Error(errorMessage);
    }

    // Validate fetched code
    if (!this.rrwebCode || this.rrwebCode.length < 1000) {
      throw new Error('Fetched rrweb code appears to be invalid or too small');
    }

    // Check if it contains expected rrweb signatures
    if (!this.rrwebCode.includes('rrweb') || !this.rrwebCode.includes('Replayer')) {
      throw new Error('Fetched code does not appear to be valid rrweb library');
    }

    // Validate CSS
    if (!this.rrwebCSS || this.rrwebCSS.length < 100) {
      throw new Error('Fetched rrweb CSS appears to be invalid or too small');
    }

    console.log('🎯 [WorkflowVisualizer] rrweb code and CSS validated and ready for injection');
  }

  // STEP 2: Wait for DOM attachment FIRST, then contentWindow
  private async waitForIframeWindow(iframe: HTMLIFrameElement): Promise<Window | null> {
    return new Promise((resolve, reject) => {
      console.log('🔍 [Step 2] Waiting for DOM attachment first...');
      
      let attempts = 0;
      const maxAttempts = 200; // 4 seconds at 20ms intervals
      
      const timeout = setTimeout(() => {
        console.error('🔍 [Step 2] TIMEOUT - Final diagnostic:');
        console.error('  - Total attempts:', attempts);
        console.error('  - Final DOM status:', document.contains(iframe));
        console.error('  - Final parentElement:', iframe.parentElement?.tagName);
        console.error('  - Final contentWindow:', iframe.contentWindow);
        reject(new Error(`Iframe never attached to DOM after ${attempts} attempts`));
      }, 4000);

      const checkDomAndWindow = () => {
        attempts++;
        const inDOM = document.contains(iframe);
        
        if (inDOM) {
          // NOW that it's in DOM, check contentWindow
          const contentWindow = iframe.contentWindow;
          if (contentWindow) {
            console.log(`✅ [Step 2] SUCCESS - DOM attached AND contentWindow available (attempt ${attempts})`);
            clearTimeout(timeout);
            resolve(contentWindow);
            return;
          } else {
            console.log(`🔄 [Step 2] In DOM but contentWindow still null (attempt ${attempts})`);
          }
        }

        // Log progress every 25 attempts (0.5 seconds)
        if (attempts % 25 === 0) {
          console.log(`🔄 [Step 2] Waiting for DOM attachment... (attempt ${attempts})`);
          console.log(`  - In DOM: ${inDOM}`);
          console.log(`  - parentElement: ${iframe.parentElement?.tagName || 'none'}`);
          console.log(`  - contentWindow: ${iframe.contentWindow ? 'available' : 'null'}`);
        }

        if (attempts < maxAttempts) {
          setTimeout(checkDomAndWindow, 20);
        }
      };

      // Also try load event - but only if already in DOM
      iframe.addEventListener('load', () => {
        console.log('🎯 [Step 2] Load event fired');
        if (document.contains(iframe)) {
          const contentWindow = iframe.contentWindow;
          if (contentWindow) {
            console.log('✅ [Step 2] SUCCESS via load event');
            clearTimeout(timeout);
            resolve(contentWindow);
          }
        } else {
          console.log('⚠️ [Step 2] Load event fired but iframe not in DOM yet');
        }
      }, { once: true });

      // Start checking immediately
      console.log('🔄 [Step 2] Starting DOM attachment + contentWindow polling...');
      setTimeout(checkDomAndWindow, 50); // Small initial delay for React to finish
    });
  }

    private async injectRRWebIntoIframe(iframe: HTMLIFrameElement): Promise<void> {
    try {
      console.log('🔍 [WorkflowVisualizer] About to start iframe verification...');
      console.log('🔍 [WorkflowVisualizer] Iframe object identity at verification start:', iframe);
      console.log('🔍 [WorkflowVisualizer] Is still same as debugIframeRef?', iframe === (window as any).debugIframeRef);
      console.log('🔍 [WorkflowVisualizer] playerContainer same as iframe?', this.playerContainer === iframe);
      
      // STEP 1: Basic iframe verification
      console.log('🔍 [Step 1] Basic iframe verification...');
      console.log('  - Iframe object:', !!iframe);
      console.log('  - Iframe constructor:', iframe.constructor.name);
      console.log('  - Iframe tagName:', iframe.tagName);
      console.log('  - Iframe src:', iframe.src);
      console.log('  - Iframe readyState:', (iframe as any).readyState);
      console.log('  - Iframe complete:', (iframe as any).complete);
      console.log('  - Iframe in DOM:', document.contains(iframe));
      console.log('  - Iframe parentNode:', !!iframe.parentNode);
      console.log('  - Iframe contentWindow (immediate):', iframe.contentWindow);
      console.log('  - Iframe contentDocument (immediate):', iframe.contentDocument);

      // STEP 3: Manual iframe creation test
      console.log('🔍 [Step 3] Manual iframe creation test...');
      const testIframe = document.createElement('iframe');
      testIframe.src = 'about:blank';
      testIframe.style.display = 'none';
      document.body.appendChild(testIframe);
      
      console.log('  - Test iframe created');
      console.log('  - Test iframe contentWindow (immediate):', testIframe.contentWindow);
      
      setTimeout(() => {
        console.log('  - Test iframe contentWindow (after 100ms):', testIframe.contentWindow);
        document.body.removeChild(testIframe);
      }, 100);

      // Wait for iframe window to be available
      let iframeWindow = await this.waitForIframeWindow(iframe);
      
      // STEP 4: Forced iframe initialization if normal method fails
      if (!iframeWindow) {
        console.log('🔍 [Step 4] Attempting forced iframe initialization...');
        
        // Try different src values
        const originalSrc = iframe.src;
        console.log('  - Original src:', originalSrc);
        
        // Try data URL
        iframe.src = 'data:text/html,<!DOCTYPE html><html><head></head><body></body></html>';
        await new Promise(resolve => setTimeout(resolve, 200));
        console.log('  - After data URL, contentWindow:', iframe.contentWindow);
        
        if (!iframe.contentWindow) {
          // Try javascript: URL
          iframe.src = 'javascript:void(0)';
          await new Promise(resolve => setTimeout(resolve, 200));
          console.log('  - After javascript URL, contentWindow:', iframe.contentWindow);
        }
        
        if (!iframe.contentWindow) {
          // Try removing and re-adding to DOM
          const parent = iframe.parentElement;
          if (parent) {
            console.log('  - Trying DOM re-attachment...');
            parent.removeChild(iframe);
            await new Promise(resolve => setTimeout(resolve, 50));
            iframe.src = 'about:blank';
            parent.appendChild(iframe);
            await new Promise(resolve => setTimeout(resolve, 200));
            console.log('  - After DOM re-attachment, contentWindow:', iframe.contentWindow);
          }
        }
        
        iframeWindow = iframe.contentWindow;
        if (!iframeWindow) {
          throw new Error('All iframe initialization methods failed');
        }
        
        console.log('✅ [Step 4] Forced initialization successful!');
      }

      console.log('🚀 [WorkflowVisualizer] Starting Puppeteer-pattern rrweb injection...');

      // Step 2: Puppeteer Pattern - Execute injection code INSIDE iframe context
      if (!this.rrwebCode || !this.rrwebCSS) {
        throw new Error('RRWeb code and CSS not available - fetchRRWebCode must be called first');
      }

      console.log(`🎭 [WorkflowVisualizer] Executing injection inside iframe context (JS: ${Math.round(this.rrwebCode.length / 1024)} KB, CSS: ${Math.round(this.rrwebCSS.length / 1024)} KB)...`);
      
      // Official Puppeteer pattern adapted for browser - execute INSIDE iframe
      const injectionScript = `
        (function(rrwebCode, rrwebCSS) {
          console.log('🎯 [IframeContext] Starting rrweb injection from inside iframe...');
          
          // Add global media error handling inside iframe context
          console.log('🎵 [IframeContext] Setting up iframe media error handlers...');
          
          // Override console.error to catch RRWeb media errors
          const originalConsoleError = console.error;
          console.error = function(...args) {
            const errorMsg = args.join(' ');
            if (errorMsg.includes('media playback error') || 
                errorMsg.includes('AbortError') ||
                errorMsg.includes('play() request was interrupted')) {
              console.warn('🎵 [IframeContext] Caught media error in iframe:', errorMsg);
              console.log('🔧 [IframeContext] Media error suppressed - continuing RRWeb processing');
              return; // Don't log the error
            }
            // Log other errors normally
            originalConsoleError.apply(console, args);
          };
          
          // Global error handler for unhandled errors in iframe
          window.addEventListener('error', function(event) {
            if (event.message && (
              event.message.includes('AbortError') ||
              event.message.includes('media playback error') ||
              event.message.includes('play() request was interrupted')
            )) {
              console.warn('🎵 [IframeContext] Caught global media error:', event.message);
              console.log('🔧 [IframeContext] Preventing error propagation');
              event.preventDefault();
              event.stopPropagation();
              return false;
            }
          });
          
          // Promise rejection handler for media errors
          window.addEventListener('unhandledrejection', function(event) {
            if (event.reason && typeof event.reason === 'object') {
              const errorMsg = event.reason.message || String(event.reason);
              if (errorMsg.includes('AbortError') || 
                  errorMsg.includes('media playback error') ||
                  errorMsg.includes('play() request was interrupted')) {
                console.warn('🎵 [IframeContext] Caught unhandled media promise rejection:', errorMsg);
                console.log('🔧 [IframeContext] Promise rejection handled');
                event.preventDefault();
                return false;
              }
            }
          });
          
          console.log('✅ [IframeContext] Iframe media error handlers configured');
          
          // Helper to protect a single media element (defined first for reuse)
          function protectSingleMediaElement(element) {
            const originalPlay = element.play;
            const originalPause = element.pause;
            let playPromise = null;
            let isPlaying = false;
            
            element.play = function() {
              try {
                if (isPlaying || playPromise) {
                  console.log('🎵 [IframeContext] Skipping redundant play() on media element');
                  return Promise.resolve();
                }
                
                isPlaying = true;
                playPromise = originalPlay.call(this);
                
                if (playPromise && typeof playPromise.then === 'function') {
                  return playPromise.then(() => {
                    playPromise = null;
                    return;
                  }).catch((error) => {
                    playPromise = null;
                    isPlaying = false;
                    if (error.name === 'AbortError' || error.message.includes('interrupted')) {
                      console.warn('🎵 [IframeContext] Media play() aborted - handled gracefully');
                      return Promise.resolve();
                    }
                    throw error;
                  });
                }
                
                return playPromise || Promise.resolve();
              } catch (error) {
                isPlaying = false;
                playPromise = null;
                if (error.name === 'AbortError' || error.message.includes('interrupted')) {
                  console.warn('🎵 [IframeContext] Media play() error handled:', error.message);
                  return Promise.resolve();
                }
                throw error;
              }
            };
            
            element.pause = function() {
              try {
                if (playPromise) {
                  playPromise.then(() => {
                    originalPause.call(this);
                    isPlaying = false;
                  }).catch(() => {
                    isPlaying = false;
                  });
                } else {
                  originalPause.call(this);
                  isPlaying = false;
                }
              } catch (error) {
                console.warn('🎵 [IframeContext] Media pause() error handled:', error.message);
                isPlaying = false;
              }
            };
          }
          
          // Additional protection: Override media element methods to prevent rapid play/pause cycles
          function protectMediaElements() {
            const originalCreateElement = document.createElement;
            document.createElement = function(tagName) {
              const element = originalCreateElement.call(document, tagName);
              
                             // Protect video and audio elements from rapid play/pause cycles
               if (tagName.toLowerCase() === 'video' || tagName.toLowerCase() === 'audio') {
                 console.log('🎵 [IframeContext] Protecting newly created media element:', tagName);
                 protectSingleMediaElement(element);
               }
              
              return element;
            };
            
                         console.log('✅ [IframeContext] Media element protection configured');
           }
           
           // Protect existing media elements in the DOM
           function protectExistingMediaElements() {
             const mediaElements = document.querySelectorAll('video, audio');
             console.log('🎵 [IframeContext] Found ' + mediaElements.length + ' existing media elements to protect');
             mediaElements.forEach(protectSingleMediaElement);
           }
           
           // Watch for dynamically added media elements (during RRWeb reconstruction)
           function setupMediaObserver() {
             const observer = new MutationObserver((mutations) => {
               mutations.forEach((mutation) => {
                 mutation.addedNodes.forEach((node) => {
                   if (node.nodeType === 1) { // Element node
                     const element = node;
                     // Check if it's a media element
                     if (element.tagName === 'VIDEO' || element.tagName === 'AUDIO') {
                       console.log('🎵 [IframeContext] Protecting dynamically added media element:', element.tagName);
                       protectSingleMediaElement(element);
                     }
                     // Check for media elements within added element
                     const mediaChildren = element.querySelectorAll && element.querySelectorAll('video, audio');
                     if (mediaChildren && mediaChildren.length > 0) {
                       console.log('🎵 [IframeContext] Protecting ' + mediaChildren.length + ' media elements in added subtree');
                       mediaChildren.forEach(protectSingleMediaElement);
                     }
                   }
                 });
               });
             });
             
             observer.observe(document.body || document.documentElement, {
               childList: true,
               subtree: true
             });
             
             console.log('✅ [IframeContext] Media mutation observer configured');
           }
           
           
           // Apply media protection after DOM is ready
           if (document.readyState === 'loading') {
             document.addEventListener('DOMContentLoaded', () => {
               protectMediaElements();
               protectExistingMediaElements();
               setupMediaObserver();
             });
           } else {
             protectMediaElements();
             protectExistingMediaElements();
             setupMediaObserver();
           }
          
          function loadCSS(cssCode) {
            console.log('🎨 [IframeContext] Loading RRWeb CSS directly into iframe...');
            
            // Official RRWeb CSS injection pattern
            const styleEl = document.createElement('style');
            styleEl.type = 'text/css';
            styleEl.innerHTML = cssCode;
            
            if (document.head) {
              document.head.appendChild(styleEl);
              console.log('✅ [IframeContext] RRWeb CSS injected directly to head');
            } else {
              // Fallback for timing issues
              requestAnimationFrame(() => {
                if (document.head) {
                  document.head.appendChild(styleEl);
                  console.log('✅ [IframeContext] RRWeb CSS injected via requestAnimationFrame');
                } else {
                  document.documentElement.appendChild(styleEl);
                  console.log('✅ [IframeContext] RRWeb CSS injected to documentElement');
                }
              });
            }
            
            return styleEl;
          }
          
          function loadScript(code) {
            const s = document.createElement('script');
            s.type = 'text/javascript';
            s.innerHTML = code;
            
            if (document.head) {
              document.head.append(s);
              console.log('✅ [IframeContext] RRWeb JS injected directly to head');
            } else {
              // Puppeteer's requestAnimationFrame fallback for timing
              requestAnimationFrame(() => {
                if (document.head) {
                  document.head.append(s);
                  console.log('✅ [IframeContext] RRWeb JS injected via requestAnimationFrame');
                } else {
                  document.documentElement.appendChild(s);
                  console.log('✅ [IframeContext] RRWeb JS injected to documentElement');
                }
              });
            }
          }
          
          // Load CSS first, then JavaScript
          loadCSS(rrwebCSS);
          loadScript(rrwebCode);
          
          // Return success indicator
          return 'css_and_js_injection_started';
        })(${JSON.stringify(this.rrwebCode)}, ${JSON.stringify(this.rrwebCSS)});
      `;

      // Execute injection script inside iframe context (Puppeteer pattern)
      const result = (iframeWindow as any).eval(injectionScript);
      console.log('🎭 [WorkflowVisualizer] Injection executed inside iframe, result:', result);
      
      // Small delay to allow script execution to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Check if rrweb is now available
      if ((iframeWindow as any).rrweb) {
        console.log('🎯 [WorkflowVisualizer] rrweb object available after CSS+JS injection!');
        console.log('✅ [WorkflowVisualizer] RRWeb CSS and JavaScript successfully loaded into iframe');
        await this.createRRWebReplayer(iframe);
      } else {
        console.error('❌ [WorkflowVisualizer] rrweb object not available after injection');
        console.log('🔍 [WorkflowVisualizer] Available objects in iframe:', Object.keys(iframeWindow));
        throw new Error('CSS+JS injection failed - rrweb not available');
      }
      
    } catch (error) {
      console.error('❌ [WorkflowVisualizer] Failed to inject rrweb using Puppeteer pattern:', error);
      this.callbacks.onError(error as Error);
    }
  }

  private async createRRWebReplayer(iframe: HTMLIFrameElement): Promise<void> {
    try {
      const iframeWindow = iframe.contentWindow;
      const iframeDoc = iframe.contentDocument;
      
      console.log('🎬 [WorkflowVisualizer] Creating rrweb replayer in iframe...');
      console.log('🔍 [WorkflowVisualizer] Iframe window available:', !!iframeWindow);
      console.log('🔍 [WorkflowVisualizer] Iframe document available:', !!iframeDoc);
      
      if (!iframeWindow || !(iframeWindow as any).rrweb) {
        console.error('❌ [WorkflowVisualizer] rrweb not available in iframe window');
        console.log('🔍 [WorkflowVisualizer] Available objects in iframe:', Object.keys(iframeWindow || {}));
        throw new Error('rrweb not available in iframe');
      }

      console.log('✅ [WorkflowVisualizer] rrweb object found:', typeof (iframeWindow as any).rrweb);
      console.log('🔍 [WorkflowVisualizer] rrweb.Replayer available:', !!(iframeWindow as any).rrweb.Replayer);

      // Don't reinitialize the document - it already has rrweb injected and working
      console.log('✅ [WorkflowVisualizer] Using existing iframe document with rrweb already injected');

      // Create simple container for rrweb (official pattern)
      const replayerContainer = iframeDoc?.createElement('div');
      if (replayerContainer && iframeDoc && iframeDoc.body) {
        replayerContainer.id = 'rrweb-replayer-container';
        replayerContainer.style.cssText = 'width: 100%; height: 100%; position: absolute; top: 0; left: 0;';
        iframeDoc.body.appendChild(replayerContainer);
        console.log('✅ [WorkflowVisualizer] RRWeb replayer container created and added to existing document');
      } else {
        console.error('❌ [WorkflowVisualizer] Failed to create container - missing document or body');
        throw new Error('Cannot create replayer container - iframe document or body not available');
      }

      // Official rrweb stream pattern - match backend recording configuration
      this.state.replayer = new (iframeWindow as any).rrweb.Replayer([], {
        root: replayerContainer,
        UNSAFE_replayCanvas: true,
        liveMode: true,
        blockClass: 'rr-block',        // Match backend config
        ignoreClass: 'rr-ignore',      // Match backend config  
        maskTextClass: 'rr-mask',      // Match backend config
        recordCanvas: true,            // ✅ MATCH backend: True
        collectFonts: false,           // ✅ MATCH backend: False
        // Media error handling to prevent AbortError issues
        pauseAnimation: false,         // Don't pause animations that might cause media conflicts
        skipInactive: false,           // Don't skip inactive periods to avoid rapid media state changes
        speed: 1,                      // Consistent playback speed
        loadTimeout: 10000,            // Longer timeout for media elements
        showWarning: false,            // Suppress warnings that might relate to media loading
        // Add media-specific error recovery
        insertStyleRules: [],          // Avoid CSS conflicts with media elements
        triggerFocus: false            // Avoid focus events that might trigger media play/pause
      });

      // Step 2: Let rrweb handle CSS insertion internally (official pattern)

      console.log('✅ [WorkflowVisualizer] RRWeb replayer instance created successfully');

      // Add event listeners for debugging and monitoring
      this.setupReplayerEventListeners();

      // Official rrweb live mode pattern with buffer for smooth playback
      const BUFFER_MS = 1000; // 1 second buffer to prevent timing issues
      this.state.replayer.startLive(Date.now() - BUFFER_MS);
      
      console.log(`✅ [WorkflowVisualizer] RRWeb replayer started in live mode with ${BUFFER_MS}ms buffer`);
      
      // Step 3: Add error boundary for CSS insertion and media playback issues
      if (typeof (iframeWindow as any).addEventListener === 'function') {
        (iframeWindow as any).addEventListener('error', (event: ErrorEvent) => {
          if (event.message && event.message.includes('insertBefore')) {
            console.warn('🔧 [WorkflowVisualizer] Caught insertBefore error in iframe:', event.message);
            // Don't propagate - let rrweb continue processing other events
            event.preventDefault();
            return false;
          }
          
          // Handle media playback errors (AbortError from rapid play/pause cycles)
          if (event.message && (
            event.message.includes('AbortError') || 
            event.message.includes('play() request was interrupted') ||
            event.message.includes('media playback error')
          )) {
            console.warn('🎵 [WorkflowVisualizer] Caught media playback error in iframe:', event.message);
            console.log('🔧 [WorkflowVisualizer] This is expected with live mode + media content - continuing...');
            // Don't propagate - this is expected with live streaming + media
            event.preventDefault();
            return false;
          }
        });
        
        // Also catch unhandled promise rejections for media errors
        (iframeWindow as any).addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
          if (event.reason && typeof event.reason === 'object') {
            const errorMsg = event.reason.message || String(event.reason);
            if (errorMsg.includes('AbortError') || 
                errorMsg.includes('play() request was interrupted') ||
                errorMsg.includes('media playback error')) {
              console.warn('🎵 [WorkflowVisualizer] Caught unhandled media promise rejection:', errorMsg);
              console.log('🔧 [WorkflowVisualizer] Preventing unhandled rejection - this is expected with live mode + media');
              event.preventDefault();
              return false;
            }
          }
        });
      }
      
      // Official live mode pattern: replayer is ready after startLive()
      this.callbacks.onEvent({ type: 'player_ready' });
    } catch (error) {
      console.error('❌ [WorkflowVisualizer] Failed to create rrweb replayer:', error);
      console.error('💥 [WorkflowVisualizer] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      this.callbacks.onError(error as Error);
    }
  }
}

export type { 
  WorkflowVisualizerConfig, 
  WorkflowVisualizerCallbacks, 
  WorkflowVisualizerState, 
  WorkflowVisualizerStats 
}; 