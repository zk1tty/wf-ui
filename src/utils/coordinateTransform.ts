/**
 * Coordinate Transformation Utilities
 * 
 * Converts local preview coordinates to remote browser viewport coordinates.
 * Accounts for scale, scroll offset, and iframe positioning.
 */

import type { ViewportTransform, RemoteCoordinates } from '@/types/control-channel';

/**
 * Calculate viewport transform based on iframe and replayer dimensions
 * 
 * @param iframe - The iframe element containing the rrweb player
 * @returns ViewportTransform with scale and offset values
 */
export function calculateViewportTransform(iframe: HTMLIFrameElement | null): ViewportTransform {
  if (!iframe || !iframe.contentWindow) {
    console.warn('⚠️ [CoordinateTransform] Invalid iframe, using identity transform');
    return {
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
    };
  }

  try {
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    const iframeRect = iframe.getBoundingClientRect();
    
    // Find the rrweb replayer wrapper inside the iframe
    const replayerWrapper = iframeDoc?.querySelector('.replayer-wrapper') as HTMLElement;
    const replayerIframe = iframeDoc?.querySelector('.replayer-wrapper iframe') as HTMLIFrameElement;

    if (!replayerWrapper || !replayerIframe) {
      console.warn('⚠️ [CoordinateTransform] Replayer elements not found, using identity transform');
      return {
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
      };
    }

    // Get the actual dimensions of the recorded viewport
    const remoteWidth = parseInt(replayerIframe.getAttribute('width') || '0', 10);
    const remoteHeight = parseInt(replayerIframe.getAttribute('height') || '0', 10);

    if (!remoteWidth || !remoteHeight) {
      console.warn('⚠️ [CoordinateTransform] Invalid remote dimensions, using identity transform');
      return {
        scaleX: 1,
        scaleY: 1,
        offsetX: 0,
        offsetY: 0,
      };
    }

    // Get the current display size of the replayer iframe
    const displayRect = replayerIframe.getBoundingClientRect();
    const displayWidth = displayRect.width;
    const displayHeight = displayRect.height;

    // Calculate scale factors
    const scaleX = remoteWidth / displayWidth;
    const scaleY = remoteHeight / displayHeight;

    // Calculate offsets (relative to the outer iframe)
    // 🔧 FIX: Account for replayer wrapper positioning within the iframe
    const wrapperRect = replayerWrapper.getBoundingClientRect();
    const wrapperOffsetX = wrapperRect.left - iframeRect.left;
    const wrapperOffsetY = wrapperRect.top - iframeRect.top;
    
    // 🔧 FIX: Try using the wrapper's offsetLeft/offsetTop instead of getBoundingClientRect
    // This might give us more accurate positioning relative to the iframe
    let offsetX = replayerWrapper.offsetLeft;
    let offsetY = replayerWrapper.offsetTop;
    
    // 🐛 DEBUG: Check if we have negative offsets that might cause issues
    if (offsetY < 0) {
      console.warn('⚠️ [CoordinateTransform] Negative Y offset detected:', offsetY);
      console.warn('⚠️ This might cause mouse positioning issues');
    }
    
    // 🐛 DEBUG: Also calculate the original method for comparison
    const originalOffsetX = displayRect.left - iframeRect.left;
    const originalOffsetY = displayRect.top - iframeRect.top;
    
    // 🔧 REMOTE DEPLOYMENT FIX: If the offsetLeft/offsetTop method gives very different results,
    // fall back to the original display rect method for remote environments
    const offsetDifference = Math.abs(offsetX - originalOffsetX);
    if (offsetDifference > 100) { // If difference is more than 100px, likely a remote environment issue
      console.debug('🧐 [CoordinateTransform] Large offset difference detected, using display rect method for remote environment');
      console.debug('🧐 [CoordinateTransform] Difference:', offsetDifference, 'px');
      offsetX = originalOffsetX;
      offsetY = originalOffsetY;
    }
    
    // 🔧 MANUAL OFFSET CORRECTION: For cases where automatic detection doesn't work
    // You can manually adjust these values based on your remote environment
    const MANUAL_OFFSET_X: number = 0; // Add/subtract pixels to fix X-axis offset
    const MANUAL_OFFSET_Y: number = 230; // Add/subtract pixels to fix Y-axis offset (increased to move remote mouse UP)
    
    if (MANUAL_OFFSET_X !== 0 || MANUAL_OFFSET_Y !== 0) {
      console.log('🔧 [CoordinateTransform] Applying manual offset correction:', { x: MANUAL_OFFSET_X, y: MANUAL_OFFSET_Y });
      offsetX += MANUAL_OFFSET_X;
      offsetY += MANUAL_OFFSET_Y;
    }
    
    // 🐛 DEBUG: Re-enable logs to debug remote deployment offset issue
    console.debug('🐛 [CoordinateTransform] Offset comparison:', {
      usingOffsetLeftTop: { x: offsetX, y: offsetY },
      usingBoundingClientRect: { x: wrapperOffsetX, y: wrapperOffsetY },
      originalDisplayOffset: { x: originalOffsetX, y: originalOffsetY },
      wrapperProperties: { 
        offsetLeft: replayerWrapper.offsetLeft, 
        offsetTop: replayerWrapper.offsetTop,
        clientLeft: replayerWrapper.clientLeft,
        clientTop: replayerWrapper.clientTop
      },
      displayRect: { left: displayRect.left, top: displayRect.top },
      iframeRect: { left: iframeRect.left, top: iframeRect.top },
      wrapperRect: { left: wrapperRect.left, top: wrapperRect.top }
    });

    console.debug('🔍 [CoordinateTransform] Calculated transform:', {
      remote: { width: remoteWidth, height: remoteHeight },
      display: { width: displayWidth, height: displayHeight },
      scale: { x: scaleX, y: scaleY },
      offset: { x: offsetX, y: offsetY },
    });

    return {
      scaleX,
      scaleY,
      offsetX,
      offsetY,
    };
  } catch (error) {
    console.error('❌ [CoordinateTransform] Failed to calculate transform:', error);
    return {
      scaleX: 1,
      scaleY: 1,
      offsetX: 0,
      offsetY: 0,
    };
  }
}

/**
 * Transform local preview coordinates to remote viewport coordinates
 * 
 * @param localX - X coordinate in the preview (relative to iframe)
 * @param localY - Y coordinate in the preview (relative to iframe)
 * @param transform - Viewport transform (scale and offset)
 * @returns Remote coordinates in the original viewport
 */
export function toRemoteCoordinates(
  localX: number,
  localY: number,
  transform: ViewportTransform
): RemoteCoordinates {
  // Subtract offset to get coordinates relative to replayer iframe
  const adjustedX = localX - transform.offsetX;
  const adjustedY = localY - transform.offsetY;

  // Apply scale to convert to remote viewport
  const remoteX = Math.round(adjustedX * transform.scaleX);
  const remoteY = Math.round(adjustedY * transform.scaleY);

  console.debug('🎯 [CoordinateTransform]', {
    local: { x: localX, y: localY },
    adjusted: { x: adjustedX, y: adjustedY },
    remote: { x: remoteX, y: remoteY },
  });

  // 🐛 DEBUG: Re-enable logs to debug remote deployment offset issue
  console.debug('🐛 [CoordinateTransform] Mouse offset debug:', {
    input: { localX, localY },
    transform: { scaleX: transform.scaleX, scaleY: transform.scaleY, offsetX: transform.offsetX, offsetY: transform.offsetY },
    calculation: {
      adjustedX: `${localX} - ${transform.offsetX} = ${adjustedX}`,
      adjustedY: `${localY} - ${transform.offsetY} = ${adjustedY}`,
      scaledX: `${adjustedX} * ${transform.scaleX} = ${remoteX}`,
      scaledY: `${adjustedY} * ${transform.scaleY} = ${remoteY}`
    },
    result: { remoteX, remoteY }
  });

  return {
    x: remoteX,
    y: remoteY,
  };
}

/**
 * Transform event coordinates to remote viewport coordinates
 * Convenience wrapper for mouse/pointer events
 * 
 * @param event - Mouse or Pointer event
 * @param iframe - The iframe element containing the rrweb player
 * @returns Remote coordinates
 */
export function eventToRemoteCoordinates(
  event: MouseEvent | PointerEvent,
  iframe: HTMLIFrameElement | null
): RemoteCoordinates {
  if (!iframe) {
    return { x: event.clientX, y: event.clientY };
  }

  const iframeRect = iframe.getBoundingClientRect();
  
  // Get coordinates relative to the iframe
  const localX = event.clientX - iframeRect.left;
  const localY = event.clientY - iframeRect.top;

  // Calculate transform
  const transform = calculateViewportTransform(iframe);

  // Convert to remote coordinates
  return toRemoteCoordinates(localX, localY, transform);
}

/**
 * Check if coordinates are within the replayer bounds
 * 
 * @param localX - X coordinate relative to iframe
 * @param localY - Y coordinate relative to iframe
 * @param iframe - The iframe element containing the rrweb player
 * @returns True if coordinates are within bounds
 */
export function isWithinReplayerBounds(
  localX: number,
  localY: number,
  iframe: HTMLIFrameElement | null
): boolean {
  if (!iframe || !iframe.contentDocument) {
    return false;
  }

  try {
    const replayerIframe = iframe.contentDocument.querySelector('.replayer-wrapper iframe') as HTMLIFrameElement;
    if (!replayerIframe) {
      return false;
    }

    const iframeRect = iframe.getBoundingClientRect();
    const replayerRect = replayerIframe.getBoundingClientRect();

    // Adjust replayer rect to be relative to outer iframe
    const adjustedReplayerRect = {
      left: replayerRect.left - iframeRect.left,
      top: replayerRect.top - iframeRect.top,
      right: replayerRect.right - iframeRect.left,
      bottom: replayerRect.bottom - iframeRect.top,
    };

    return (
      localX >= adjustedReplayerRect.left &&
      localX <= adjustedReplayerRect.right &&
      localY >= adjustedReplayerRect.top &&
      localY <= adjustedReplayerRect.bottom
    );
  } catch (error) {
    console.error('❌ [CoordinateTransform] Failed to check bounds:', error);
    return false;
  }
}