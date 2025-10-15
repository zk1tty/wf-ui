/**
 * Control Channel WebSocket Hook
 * 
 * Manages WebSocket connection for forwarding user input to remote browser.
 * Separate from the visual streaming WebSocket (which receives rrweb events).
 * 
 * Usage:
 *   const { sendMessage, isConnected, sessionState, startSession, stopSession } = 
 *     useControlChannelWebSocket(sessionId);
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { API_ENDPOINTS } from '@/lib/constants';
import type {
  ControlMessage,
  ControlChannelMessage,
  ControlChannelResponse,
  ControlSessionState,
} from '@/types/control-channel';

interface UseControlChannelWebSocketOptions {
  sessionTimeout?: number; // Milliseconds (default: 5 minutes)
  autoReconnect?: boolean;
  onSessionExpired?: () => void;
  onError?: (error: Error) => void;
}

interface UseControlChannelWebSocketResult {
  isConnected: boolean;
  isSessionActive: boolean;
  sessionState: ControlSessionState;
  sendMessage: (message: ControlMessage) => void;
  startSession: () => void;
  stopSession: () => void;
}

const DEFAULT_SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function useControlChannelWebSocket(
  sessionId: string | null | undefined,
  options: UseControlChannelWebSocketOptions = {}
): UseControlChannelWebSocketResult {
  const {
    sessionTimeout = DEFAULT_SESSION_TIMEOUT,
    autoReconnect = false,
    onSessionExpired,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [sessionState, setSessionState] = useState<ControlSessionState>({
    isActive: false,
    startTime: null,
    remainingTime: sessionTimeout,
    messagesSent: 0,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const stopSessionRef = useRef<(() => void) | null>(null); // Ref to avoid dependency cycle

  // Update remaining time every second
  useEffect(() => {
    if (!isSessionActive) return;

    const interval = setInterval(() => {
      setSessionState((prev) => {
        if (!prev.startTime) return prev;

        const elapsed = Date.now() - prev.startTime;
        const remaining = Math.max(0, sessionTimeout - elapsed);

        if (remaining === 0) {
          // Session expired
          console.log('⏱️ [ControlChannel] Session expired via countdown');
          if (stopSessionRef.current) {
            stopSessionRef.current();
          }
          onSessionExpired?.();
        }

        return {
          ...prev,
          remainingTime: remaining,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSessionActive, sessionTimeout, onSessionExpired]);

  const connect = useCallback(() => {
    if (!sessionId || wsRef.current?.readyState === WebSocket.OPEN) return;

    // Clear any existing reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = API_ENDPOINTS.CONTROL_CHANNEL_WS(sessionId);
    console.log('🎮 [ControlChannel] Connecting to:', wsUrl);

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ [ControlChannel] WebSocket connected');
      setIsConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const response: ControlChannelResponse = JSON.parse(event.data);

        switch (response.type) {
          case 'ack':
            console.debug('✅ [ControlChannel] Message acknowledged');
            break;

          case 'error':
            console.error('❌ [ControlChannel] Server error:', response.error);
            onError?.(new Error(response.error || 'Unknown server error'));
            break;

          case 'session_expired':
            console.warn('⏱️ [ControlChannel] Session expired by server');
            // Use ref to avoid dependency cycle
            if (stopSessionRef.current) {
              stopSessionRef.current();
            }
            onSessionExpired?.();
            break;

          default:
            // Handle connection_established and other messages
            console.log('📨 [ControlChannel] Received:', response);
        }
      } catch (error) {
        console.error('❌ [ControlChannel] Failed to parse message:', error);
      }
    };

    ws.onclose = (event) => {
      console.log('🔌 [ControlChannel] WebSocket closed:', event.code, event.reason);
      setIsConnected(false);

      // Auto-reconnect if enabled and not a normal close
      // Use ref to check session state to avoid dependency
      const shouldReconnect = autoReconnect && event.code !== 1000;
      if (shouldReconnect) {
        console.log('🔄 [ControlChannel] Attempting to reconnect in 2 seconds...');
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
      }
    };

    ws.onerror = (error) => {
      console.error('❌ [ControlChannel] WebSocket error:', error);
      onError?.(new Error('WebSocket connection failed'));
    };
  }, [sessionId, autoReconnect, onError, onSessionExpired]); // Removed isSessionActive and stopSession

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Normal closure');
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const startSession = useCallback(() => {
    if (isSessionActive) {
      console.warn('⚠️ [ControlChannel] Session already active');
      return;
    }

    console.log('🎮 [ControlChannel] Starting control session');
    
    setIsSessionActive(true);
    setSessionState({
      isActive: true,
      startTime: Date.now(),
      remainingTime: sessionTimeout,
      messagesSent: 0,
    });

    // Connect WebSocket
    connect();

    // Set session timeout (use ref to avoid dependency)
    sessionTimerRef.current = setTimeout(() => {
      console.warn('⏱️ [ControlChannel] Session timeout reached');
      if (stopSessionRef.current) {
        stopSessionRef.current();
      }
      onSessionExpired?.();
    }, sessionTimeout);
  }, [isSessionActive, sessionTimeout, connect, onSessionExpired]);

  const stopSession = useCallback(() => {
    console.log('🛑 [ControlChannel] Stopping control session');
    console.trace('🔍 [ControlChannel] stopSession() called from:'); // Debug: show call stack

    // Clear session timer
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current);
      sessionTimerRef.current = null;
    }

    // Disconnect WebSocket
    disconnect();

    // Reset state
    setIsSessionActive(false);
    setSessionState({
      isActive: false,
      startTime: null,
      remainingTime: sessionTimeout,
      messagesSent: 0,
    });
  }, [disconnect, sessionTimeout]);

  // Keep stopSession ref updated
  useEffect(() => {
    stopSessionRef.current = stopSession;
  }, [stopSession]);

  const sendMessage = useCallback(
    (message: ControlMessage) => {
      if (!isConnected || !isSessionActive) {
        console.warn('⚠️ [ControlChannel] Cannot send message - not connected or session inactive');
        return;
      }

      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.warn('⚠️ [ControlChannel] WebSocket not ready');
        return;
      }

      if (!sessionId) {
        console.warn('⚠️ [ControlChannel] No session ID');
        return;
      }

      const channelMessage: ControlChannelMessage = {
        session_id: sessionId,
        message,
      };

      try {
        wsRef.current.send(JSON.stringify(channelMessage));
        
        // Update message count
        setSessionState((prev) => ({
          ...prev,
          messagesSent: prev.messagesSent + 1,
        }));

        console.debug('📤 [ControlChannel] Sent:', message.type, message);
      } catch (error) {
        console.error('❌ [ControlChannel] Failed to send message:', error);
        onError?.(error as Error);
      }
    },
    [isConnected, isSessionActive, sessionId, onError]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionTimerRef.current) {
        clearTimeout(sessionTimerRef.current);
      }
      disconnect();
    };
  }, [disconnect]);

  return {
    isConnected,
    isSessionActive,
    sessionState,
    sendMessage,
    startSession,
    stopSession,
  };
}

