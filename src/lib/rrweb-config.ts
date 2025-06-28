/**
 * 🎬 RRWeb Configuration - Centralized Settings for Visual Streaming
 * 
 * - WorkflowVisualizer settings (API, reconnection, buffering)
 * - RRWeb Replayer settings (media stability, performance)  
 * - Live streaming settings (buffer timing, duplicate handling)
 * - Error handling patterns (media errors, DOM errors)
 * - Debug configuration (logging, event monitoring)
 * 
 * ⚠️ IMPORTANT: Changes to these settings can significantly impact:
 * - Media playback stability (AbortError prevention)
 * - DOM reconstruction accuracy 
 * - Performance and memory usage
 * - Live streaming smoothness
 */

/**
 * 🔧 WorkflowVisualizer Configuration
 * Core settings for the WorkflowVisualizer class behavior
 */
export const WORKFLOW_VISUALIZER_CONFIG = {
  // API settings
  apiBase: '',                       // Base API path (empty for relative URLs)
  
  // Connection reliability (simplified - no auto-reconnect complexity)
  autoReconnect: false,              // Simplified - no auto-reconnect
  reconnectInterval: 3000,           // 3 seconds between reconnection attempts
  maxReconnectAttempts: 3,           // Maximum reconnection attempts
  
  // Streaming settings
  bufferSize: 1000,                  // Event buffer size (larger for better performance)
  quality: 'standard',               // Default quality setting
} as const;

/**
 * 🎭 RRWeb Replayer Configuration
 * Used when creating the RRWeb replayer instance for live streaming
 */
export const RRWEB_REPLAYER_CONFIG = {
  // 🔴 CORE STREAMING SETTINGS
  liveMode: true,                    // ✅ Required for live streaming
  UNSAFE_replayCanvas: true,         // ✅ Required for canvas content replay
  
  // 🎯 DOM RECONSTRUCTION SETTINGS (Must match backend recording config)
  blockClass: 'rr-block',            // ✅ Block elements with this class
  ignoreClass: 'rr-ignore',          // ✅ Ignore elements with this class  
  maskTextClass: 'rr-mask',          // ✅ Mask text in elements with this class
  
  // 🎨 RENDERING SETTINGS (Must match backend recording config)
  recordCanvas: true,                // ✅ CRITICAL: Must match backend setting
  collectFonts: false,               // ✅ CRITICAL: Must match backend setting
  
  // 🎵 MEDIA STABILITY SETTINGS (Prevents AbortError crashes)
  pauseAnimation: false,             // ✅ Don't pause animations - prevents media conflicts
  skipInactive: false,               // ✅ Don't skip periods - prevents rapid media state changes
  triggerFocus: false,               // ✅ Avoid focus events that trigger media play/pause
  
  // ⚡ PERFORMANCE SETTINGS
  speed: 1,                          // ✅ Normal playback speed for live streaming
  loadTimeout: 10000,                // ✅ 10s timeout for media elements to load
  showWarning: false,                // ✅ Suppress warnings to reduce console noise
  
  // 🎨 CSS SETTINGS
  insertStyleRules: [],              // ✅ Empty - avoid CSS conflicts with media elements
} as const;

/**
 * 🔄 Live Mode Buffer Configuration
 * Controls timing for smooth live streaming playback
 */
export const RRWEB_LIVE_CONFIG = {
  // Buffer time to prevent timing issues during live streaming
  BUFFER_MS: 1000,                   // 1 second buffer for smooth playback
  
  // Event processing settings
  MAX_DUPLICATE_EVENTS: 3,           // Skip events after 3 duplicates with same timestamp
  EVENT_PROCESSING_DELAY: 50,        // 50ms delay between event processing
} as const;

/**
 * 🎯 Backend Recording Configuration (For Reference)
 * These settings should match what the backend uses when recording
 */
export const BACKEND_RECORDING_REFERENCE = {
  // Canvas settings
  recordCanvas: true,                // ✅ MUST MATCH: Backend records canvas
  
  // Font settings  
  collectFonts: false,               // ✅ MUST MATCH: Backend doesn't collect fonts
  
  // DOM sampling (backend settings for reference)
  sampling: {
    scroll: 100,                     // Sample scroll events every 100ms
    media: 800,                      // Sample media events every 800ms
    input: 'last',                   // Use last input value
  },
  
  // SlimDOM optimization (backend settings for reference)
  slimDOMOptions: {
    script: true,                    // Remove script tags
    comment: true,                   // Remove comments
    headFavicon: true,               // Remove favicon links
    headWhitespace: true,            // Remove head whitespace
    headMetaDescKeywords: true,      // Remove meta description/keywords
    headMetaSocial: true,            // Remove social meta tags
    headMetaRobots: true,            // Remove robots meta
    headMetaHttpEquiv: true,         // Remove http-equiv meta
    headMetaAuthorship: true,        // Remove authorship meta
    headMetaVerification: true,      // Remove verification meta
  }
} as const;

/**
 * 🛡️ Error Handling Configuration
 * Settings for graceful error recovery
 */
export const RRWEB_ERROR_CONFIG = {
  // Media error suppression patterns
  SUPPRESS_MEDIA_ERRORS: [
    'AbortError',
    'media playback error', 
    'play() request was interrupted',
    'pause() request was interrupted'
  ],
  
  // DOM error suppression patterns
  SUPPRESS_DOM_ERRORS: [
    'insertBefore',
    'Node was not found',
    'Failed to construct'
  ],
  
  // Console error filtering
  FILTER_CONSOLE_ERRORS: true,       // Filter known RRWeb errors from console
  
  // Promise rejection handling
  HANDLE_UNHANDLED_REJECTIONS: true, // Catch and handle media promise rejections
} as const;

/**
 * 🎪 Development/Debug Configuration
 * Settings for debugging and development
 */
export const RRWEB_DEBUG_CONFIG = {
  // Logging levels
  ENABLE_EVENT_LOGGING: true,        // Log RRWeb events for debugging
  ENABLE_PERFORMANCE_LOGGING: true,  // Log performance metrics
  ENABLE_ERROR_LOGGING: true,        // Log error details
  
  // Event listener debugging
  SETUP_EVENT_LISTENERS: true,       // Setup debug event listeners
  LOG_EVENT_TYPES: [                 // Which event types to log
    'fullsnapshot-rebuilded',
    'event-cast',
    'replay-end',
    'skip-start',
    'skip-end'
  ],
} as const;

/**
 * 🏗️ Helper function to get complete replayer config
 * Combines all settings into final configuration object
 */
export const getRRWebReplayerConfig = (container: HTMLElement) => ({
  root: container,
  ...RRWEB_REPLAYER_CONFIG
});

/**
 * 🔧 Helper function to get WorkflowVisualizer config with optional overrides
 * Allows customization while maintaining centralized defaults
 */
export const getWorkflowVisualizerConfig = (overrides: Partial<typeof WORKFLOW_VISUALIZER_CONFIG> = {}) => ({
  ...WORKFLOW_VISUALIZER_CONFIG,
  ...overrides
});

/**
 * 📊 Export all configs for easy importing
 */
export {
  WORKFLOW_VISUALIZER_CONFIG as VISUALIZER_CONFIG,
  RRWEB_REPLAYER_CONFIG as REPLAYER_CONFIG,
  RRWEB_LIVE_CONFIG as LIVE_CONFIG,
  RRWEB_ERROR_CONFIG as ERROR_CONFIG,
  RRWEB_DEBUG_CONFIG as DEBUG_CONFIG
}; 