import React, { useState, useCallback, useRef, useEffect } from 'react';
import { RRWebVisualizer } from './RRWebVisualizer';
import { ControlChannelToggle } from './ControlChannelToggle';
import { useControlChannelWebSocket } from '@/hooks/useControlChannelWebSocket';
import { Eye, GripVertical } from 'lucide-react';

type VisualPanelProps = {
  isOpen: boolean;
  width: number;
  sessionId: string | null;
  onResizeMouseDown: (e: React.MouseEvent) => void;
  onResizeDoubleClick: () => void;
};

export const VisualPanel: React.FC<VisualPanelProps> = ({
  isOpen,
  width,
  sessionId,
  onResizeMouseDown,
  onResizeDoubleClick,
}) => {
  // Control channel state - SINGLE source of truth
  const [controlEnabled, setControlEnabled] = useState(false);
  
  const {
    isConnected,
    isSessionActive,
    sessionState,
    sendMessage,
    startSession,
    stopSession,
  } = useControlChannelWebSocket(sessionId, {
    onSessionExpired: () => {
      console.log('⏱️ [VisualPanel] Control session expired');
      setControlEnabled(false);
    },
    onError: (error) => {
      console.error('❌ [VisualPanel] Control channel error:', error);
    },
  });

  const handleStartControl = () => {
    setControlEnabled(true);
    startSession();
  };

  const handleStopControl = () => {
    setControlEnabled(false);
    stopSession();
  };
  
  // Stabilize callback to prevent infinite re-renders in ControlOverlay
  const sendMessageRef = useRef(sendMessage);
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);
  
  const handleControlMessage = useCallback((message: any) => {
    // Send message using the hook from VisualPanel
    sendMessageRef.current(message);
  }, []); // No dependencies to keep it stable

  return (
    <>
      {/* Left side Visual panel - dynamic width */}
      <div
        className={`${
          isOpen ? 'opacity-100' : 'opacity-0 w-0'
        } h-full border-r border-gray-200 bg-white overflow-hidden transform transition-all duration-300 ease-in-out flex-shrink-0 z-20`}
        style={{ width: isOpen ? `${width}px` : '0px' }}
      >
        <div className={`${isOpen ? 'opacity-100' : 'opacity-0'} h-full min-h-0 flex flex-col transition-opacity duration-300`}>
          {/* If no session, show standby placeholder */}
          {sessionId ? (
            <div className="h-full min-h-0 flex flex-col">
              {/* Control Panel Header */}
              <div className="border-b border-gray-200 px-3 py-2 flex items-center justify-between bg-gray-50 shrink-0">
                <div className="flex items-center space-x-2">
                  <Eye className="h-4 w-4 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Visual Stream</span>
                </div>
                
                {/* Control Channel Toggle */}
                <ControlChannelToggle
                  isActive={isSessionActive}
                  sessionState={sessionState}
                  onStart={handleStartControl}
                  onStop={handleStopControl}
                  disabled={!sessionId}
                />
              </div>

              {/* RRWebVisualizer with control enabled */}
              <div className="flex-1 min-h-0">
                <RRWebVisualizer 
                  sessionId={sessionId || undefined}
                  controlEnabled={controlEnabled}
                  isControlConnected={isConnected}
                  onControlMessage={handleControlMessage}
                />
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-900 text-gray-300">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white bg-opacity-10 mb-3">
                  <Eye className="w-6 h-6" />
                </div>
                <div className="text-sm">Standby</div>
                <div className="text-xs text-gray-400 mt-1">Visual stream will appear here once started</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Draggable divider for left panel */}
      {isOpen && (
        <div
          className={`relative w-1 h-full bg-gray-300 hover:bg-blue-400 cursor-col-resize flex items-center justify-center transition-all duration-200 z-30`}
          onMouseDown={onResizeMouseDown}
          onDoubleClick={onResizeDoubleClick}
          title="Drag to resize panel • Double-click to reset"
        >
          <div className={`absolute inset-y-0 w-4 flex items-center justify-center translate-x-1.5 rounded transition-all duration-200 hover:bg-gray-200 hover:bg-opacity-70`}>
            <GripVertical className="w-3 h-3 text-gray-600 transition-colors duration-200" />
          </div>
        </div>
      )}
    </>
  );
};

export default VisualPanel;


