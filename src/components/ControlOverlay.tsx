/**
 * Control Overlay Component
 * 
 * Transparent overlay that captures user input (mouse, keyboard, wheel) and
 * forwards it to the remote browser via the control channel WebSocket.
 * 
 * Positioned absolutely over the rrweb replay iframe to intercept all interactions.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { eventToRemoteCoordinates } from '@/utils/coordinateTransform';
import type { ControlMessage } from '@/types/control-channel';

interface ControlOverlayProps {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  onControlMessage: (message: ControlMessage) => void;
  isActive: boolean;
  className?: string;
}

export const ControlOverlay: React.FC<ControlOverlayProps> = ({
  iframeRef,
  onControlMessage,
  isActive,
  className = '',
}) => {
  // console.log('🏗️ [ControlOverlay] Component created/updated - isActive:', isActive);
  
  const overlayRef = useRef<HTMLDivElement>(null);
  const lastMoveTime = useRef<number>(0);
  const moveThrottleMs = 50; // Throttle mouse move to 20 FPS
  
  // Stabilize callback to prevent infinite re-renders
  const onControlMessageRef = useRef(onControlMessage);
  useEffect(() => {
    // console.log('🔄 [ControlOverlay] onControlMessage callback updated');
    onControlMessageRef.current = onControlMessage;
  }, [onControlMessage]);

  // ============================================================================
  // Mouse Event Handlers
  // ============================================================================

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isActive || !iframeRef.current) return;

      // Get remote coordinates
      const { x, y } = eventToRemoteCoordinates(e.nativeEvent, iframeRef.current);

      // Determine button
      let button: 'left' | 'right' | 'middle' = 'left';
      if (e.button === 2) button = 'right';
      else if (e.button === 1) button = 'middle';

      const message: ControlMessage = {
        type: 'mouse',
        action: 'down',
        x,
        y,
        button,
        timestamp: Date.now(),
      };

      // Don't log pointer down - too noisy, CLICK event is sufficient
      onControlMessage(message);

      // Prevent default to avoid focus changes
      e.preventDefault();
    },
    [isActive, iframeRef, onControlMessage]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isActive || !iframeRef.current) return;

      const { x, y } = eventToRemoteCoordinates(e.nativeEvent, iframeRef.current);

      let button: 'left' | 'right' | 'middle' = 'left';
      if (e.button === 2) button = 'right';
      else if (e.button === 1) button = 'middle';

      const message: ControlMessage = {
        type: 'mouse',
        action: 'up',
        x,
        y,
        button,
        timestamp: Date.now(),
      };

      // Don't log pointer up - too noisy, CLICK event is sufficient
      onControlMessage(message);

      e.preventDefault();
    },
    [isActive, iframeRef, onControlMessage]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isActive || !iframeRef.current) return;

      // Throttle mouse move events
      const now = Date.now();
      if (now - lastMoveTime.current < moveThrottleMs) {
        return;
      }
      lastMoveTime.current = now;

      const { x, y } = eventToRemoteCoordinates(e.nativeEvent, iframeRef.current);

      const message: ControlMessage = {
        type: 'mouse',
        action: 'move',
        x,
        y,
        timestamp: now,
      };

      // Don't log pointer move - very noisy and not useful for text input capture
      onControlMessage(message);
    },
    [isActive, iframeRef, onControlMessage]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive || !iframeRef.current) return;

      const { x, y } = eventToRemoteCoordinates(e.nativeEvent, iframeRef.current);

      let button: 'left' | 'right' | 'middle' = 'left';
      if (e.button === 2) button = 'right';
      else if (e.button === 1) button = 'middle';

      const message: ControlMessage = {
        type: 'mouse',
        action: 'click',
        x,
        y,
        button,
        clickCount: e.detail,
        timestamp: Date.now(),
      };

      // Clean logging - show clicks
      console.log('🖱️ [CLICK]', `(${x}, ${y})`);
      
      onControlMessage(message);

      e.preventDefault();
    },
    [isActive, iframeRef, onControlMessage]
  );

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isActive || !iframeRef.current) return;

      const { x, y } = eventToRemoteCoordinates(e.nativeEvent, iframeRef.current);

      const message: ControlMessage = {
        type: 'mouse',
        action: 'dblclick',
        x,
        y,
        button: 'left',
        clickCount: 2,
        timestamp: Date.now(),
      };

      // Don't log double click - rarely used for form input
      onControlMessage(message);

      e.preventDefault();
    },
    [isActive, iframeRef, onControlMessage]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!isActive || !iframeRef.current) return;

      const { x, y } = eventToRemoteCoordinates(e.nativeEvent, iframeRef.current);

      const message: ControlMessage = {
        type: 'wheel',
        deltaX: e.deltaX,
        deltaY: e.deltaY,
        x,
        y,
        timestamp: Date.now(),
      };

      // Don't log wheel scroll - not useful for text input capture
      onControlMessage(message);

      // Note: Don't call preventDefault() on wheel events - they're passive by default
      // This prevents the "Unable to preventDefault inside passive event listener" warning
    },
    [isActive, iframeRef, onControlMessage]
  );

  // Prevent context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
  }, []);

  // ============================================================================
  // Keyboard Event Handlers (Global)
  // ============================================================================

  // Debug useEffect to track component lifecycle
  // useEffect(() => {
  //   console.log('🔍 [ControlOverlay] General useEffect triggered - isActive:', isActive);
  // });

  useEffect(() => {
    console.log('🔍 [ControlOverlay] Keyboard useEffect triggered - isActive:', isActive);
    
    if (!isActive) {
      console.log('❌ [ControlOverlay] Not active, skipping keyboard listener setup');
      return;
    }

    console.log('✅ [ControlOverlay] Attaching keyboard listeners');

    const handleKeyDown = (e: KeyboardEvent) => {
      // Clean logging - only show text characters and important keys
      if (e.key.length === 1) {
        // Printable character (a, b, 1, @, etc.)
        console.log('⌨️ [TEXT INPUT]', e.key);
      } else if (e.key === 'Enter' || e.key === 'Tab' || e.key === 'Backspace') {
        // Only log important special keys (not Shift, Alt, Ctrl, etc.)
        console.log('⌨️ [TEXT INPUT]', `[${e.key}]`);
      }

      const message: ControlMessage = {
        type: 'keyboard',
        action: 'down',
        key: e.key,
        code: e.code,
        timestamp: Date.now(),
      };

      // Use ref to avoid re-render loop
      onControlMessageRef.current(message);

      // Prevent default to avoid typing into the page
      e.preventDefault();
      e.stopPropagation();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Don't log key up - redundant with key press for text input
      
      const message: ControlMessage = {
        type: 'keyboard',
        action: 'up',
        key: e.key,
        code: e.code,
        timestamp: Date.now(),
      };

      // Use ref to avoid re-render loop
      onControlMessageRef.current(message);

      e.preventDefault();
      e.stopPropagation();
    };

    const handleKeyPress = (e: KeyboardEvent) => {
      // Note: keypress is deprecated and unreliable
      // We now capture printable characters in handleKeyDown instead
      // Keep this handler registered but don't process anything
      e.preventDefault();
      e.stopPropagation();
    };

    // Add global keyboard listeners
    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('keypress', handleKeyPress, true);

    return () => {
      console.log('🗑️ [ControlOverlay] Removing keyboard listeners');
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('keypress', handleKeyPress, true);
    };
  }, [isActive]); // Stable - only depends on isActive

  // ============================================================================
  // Cursor Style
  // ============================================================================

  const cursorStyle = isActive ? 'crosshair' : 'not-allowed';

  // ============================================================================
  // Render
  // ============================================================================

  // console.log('🎮 [ControlOverlay] Render check - isActive:', isActive);
  
  if (!isActive) {
    // console.log('❌ [ControlOverlay] Not active, not rendering overlay');
    return null;
  }

  // console.log('✅ [ControlOverlay] Rendering control overlay');
  return (
    <div
      ref={overlayRef}
      className={`absolute inset-0 z-50 ${className}`}
      style={{
        cursor: cursorStyle,
        backgroundColor: 'transparent',
        pointerEvents: 'auto',
      }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onWheel={handleWheel}
      onContextMenu={handleContextMenu}
      tabIndex={-1} // Make focusable for keyboard events
    >
      {/* Visual indicator that control is active */}
      <div className="absolute top-2 right-2 bg-red-500 text-white px-3 py-1 rounded-md text-xs font-medium shadow-lg animate-pulse">
        🎮 LIVE CONTROL
      </div>

      {/* Instructions overlay */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg text-sm shadow-lg">
        <div className="flex items-center space-x-2">
          <span>🖱️ Mouse & ⌨️ Keyboard forwarded to remote browser</span>
        </div>
      </div>
    </div>
  );
};

export default ControlOverlay;