/**
 * Control Channel Toggle Component
 * 
 * UI button to start/stop control channel sessions with:
 * - 5-minute timeout
 * - Lock badge indicator
 * - Session timer countdown
 * - Instant cancel capability
 */

import React, { useMemo } from 'react';
import { Lock, LockOpen, Clock, X } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import type { ControlSessionState } from '@/types/control-channel';

interface ControlChannelToggleProps {
  isActive: boolean;
  sessionState: ControlSessionState;
  onStart: () => void;
  onStop: () => void;
  disabled?: boolean;
  className?: string;
}

export const ControlChannelToggle: React.FC<ControlChannelToggleProps> = ({
  isActive,
  sessionState,
  onStart,
  onStop,
  disabled = false,
  className = '',
}) => {
  // Format remaining time as MM:SS
  const formattedTime = useMemo(() => {
    const totalSeconds = Math.floor(sessionState.remainingTime / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, [sessionState.remainingTime]);

  // Determine badge color based on remaining time
  const getBadgeColor = () => {
    const remainingSeconds = sessionState.remainingTime / 1000;
    if (remainingSeconds < 60) return 'bg-red-500';
    if (remainingSeconds < 120) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (!isActive) {
    // Inactive state - show "Activate User Input" button
    return (
      <Button
        onClick={onStart}
        disabled={disabled}
        variant="outline"
        size="sm"
        className={`flex items-center space-x-2 border-blue-500 hover:bg-blue-50 ${className}`}
      >
        <LockOpen className="h-4 w-4 text-blue-500" />
        <span className="text-sm">Activate User Input</span>
      </Button>
    );
  }

  // Active state - show session info and cancel button
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Lock badge */}
      <Badge
        variant="outline"
        className={`${getBadgeColor()} text-white border-0 px-2 py-1 animate-pulse`}
      >
        <Lock className="h-3 w-3 mr-1 inline" />
        ACTIVE
      </Badge>

      {/* Timer */}
      <Badge variant="outline" className="border-gray-400 px-2 py-1">
        <Clock className="h-3 w-3 mr-1 inline" />
        {formattedTime}
      </Badge>

      {/* Messages sent counter */}
      {sessionState.messagesSent > 0 && (
        <Badge variant="outline" className="border-gray-400 px-2 py-1 text-xs">
          {sessionState.messagesSent} msgs
        </Badge>
      )}

      {/* Cancel button */}
      <Button
        onClick={onStop}
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
        title="Stop control session"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default ControlChannelToggle;

