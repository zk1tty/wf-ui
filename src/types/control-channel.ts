/**
 * Control Channel Protocol
 * 
 * Simplified message types for forwarding user input to the remote browser.
 * These map directly to Playwright/CDP APIs (page.mouse, page.keyboard, etc.)
 * 
 * NOTE: We DO NOT use rrweb's complex event types here - this is a separate
 * control channel for live user interaction, not for recording/replay.
 */

// ============================================================================
// Control Message Types
// ============================================================================

export type ControlMessage = 
  | MouseControlMessage
  | KeyboardControlMessage
  | WheelControlMessage
  | FocusControlMessage;

// ============================================================================
// Mouse Control
// ============================================================================

export interface MouseControlMessage {
  type: 'mouse';
  action: 'down' | 'up' | 'move' | 'click' | 'dblclick';
  x: number;           // Remote viewport coordinates (after transformation)
  y: number;
  button?: 'left' | 'right' | 'middle';
  clickCount?: number; // For multi-click detection
  timestamp: number;
}

// ============================================================================
// Keyboard Control
// ============================================================================

export interface KeyboardControlMessage {
  type: 'keyboard';
  action: 'down' | 'up' | 'press' | 'type';
  key?: string;        // e.g., 'a', 'Enter', 'Escape', 'ArrowLeft'
  code?: string;       // e.g., 'KeyA', 'Enter', 'Escape'
  text?: string;       // For 'type' action - batch text input
  timestamp: number;
}

// ============================================================================
// Wheel/Scroll Control
// ============================================================================

export interface WheelControlMessage {
  type: 'wheel';
  deltaX: number;      // Horizontal scroll delta
  deltaY: number;      // Vertical scroll delta
  x: number;           // Cursor position during wheel
  y: number;
  timestamp: number;
}

// ============================================================================
// Focus Control (Optional - for advanced targeting)
// ============================================================================

export interface FocusControlMessage {
  type: 'focus';
  selector?: string;   // CSS selector (e.g., '#email-input')
  xpath?: string;      // XPath (alternative to selector)
  x?: number;          // Fallback: click coordinates
  y?: number;
  timestamp: number;
}

// ============================================================================
// Control Channel Session
// ============================================================================

export interface ControlSessionConfig {
  sessionId: string;
  timeout: number;           // Session timeout in milliseconds (default: 5 minutes)
  enableInputMasking: boolean; // Mask sensitive input in logs
}

export interface ControlSessionState {
  isActive: boolean;
  startTime: number | null;
  remainingTime: number;     // Milliseconds remaining
  messagesSent: number;
}

// ============================================================================
// Coordinate Transformation
// ============================================================================

export interface ViewportTransform {
  scaleX: number;      // Horizontal scale factor
  scaleY: number;      // Vertical scale factor
  offsetX: number;     // Horizontal offset
  offsetY: number;     // Vertical offset
}

export interface RemoteCoordinates {
  x: number;
  y: number;
}

// ============================================================================
// WebSocket Message Wrapper
// ============================================================================

export interface ControlChannelMessage {
  session_id: string;
  message: ControlMessage;
}

// ============================================================================
// WebSocket Responses
// ============================================================================

export interface ControlChannelResponse {
  type: 'ack' | 'error' | 'session_expired';
  timestamp: number;
  message?: string;
  error?: string;
}

// ============================================================================
// Helper Type Guards
// ============================================================================

export function isMouseMessage(msg: ControlMessage): msg is MouseControlMessage {
  return msg.type === 'mouse';
}

export function isKeyboardMessage(msg: ControlMessage): msg is KeyboardControlMessage {
  return msg.type === 'keyboard';
}

export function isWheelMessage(msg: ControlMessage): msg is WheelControlMessage {
  return msg.type === 'wheel';
}

export function isFocusMessage(msg: ControlMessage): msg is FocusControlMessage {
  return msg.type === 'focus';
}

