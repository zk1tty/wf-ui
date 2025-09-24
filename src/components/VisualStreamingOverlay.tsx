import React, { memo } from 'react';
import { X, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { RRWebVisualizer } from './RRWebVisualizer';
import ErrorBoundary from './ErrorBoundary';
import { apiFetch, sessionApiFetch } from '@/lib/api';
import { useAppContext } from '@/contexts/AppContext';
import { useToast } from '@/hooks/use-toast';

interface VisualStreamingOverlayProps {
  sessionId: string;
  workflowInfo: {
    name: string;
    taskId: string;
    mode: string;
    hasStreamingSupport?: boolean;
  };
  isOpen: boolean;
  onClose: () => void;
}

const VisualStreamingOverlayComponent = memo(function VisualStreamingOverlay({
  sessionId,
  workflowInfo,
  isOpen,
  onClose
}: VisualStreamingOverlayProps) {

  
  // CRITICAL FIX: Stabilize onClose callback to prevent infinite remounts
  const stableOnCloseRef = React.useRef(onClose);
  stableOnCloseRef.current = onClose;
  
  const stableOnClose = React.useCallback(() => {
    stableOnCloseRef.current();
  }, []); // Empty deps = stable reference forever

  const { currentUserSessionToken } = useAppContext();
  const { toast } = useToast();
  const [isTerminating, setIsTerminating] = React.useState(false);

  const resolveActiveExecutionId = React.useCallback(async (): Promise<string | null> => {
    try {
      if (!currentUserSessionToken) return null;
      const response = await apiFetch<{ active_executions: Record<string, any> }>(
        `/workflows/executions/active?session_token=${currentUserSessionToken}`,
        { auth: false }
      );
      const entries = Object.entries(response.active_executions || {});
      if (entries.length === 0) return null;
      const first = entries[0];
      const firstId = first ? first[0] : null;
      if (!firstId) return null;
      if (entries.length === 1) return firstId;
      // Try to match by workflow name if multiple
      const matched = entries.find(([, exec]: [string, any]) => exec.workflow_name === workflowInfo.name);
      return matched ? matched[0] : firstId;
    } catch (e) {
      console.error('Failed to resolve active execution ID', e);
      return null;
    }
  }, [currentUserSessionToken, workflowInfo.name]);

  const handleTerminate = React.useCallback(async () => {
    if (isTerminating) return;
    setIsTerminating(true);
    try {
      const executionId = await resolveActiveExecutionId();
      if (!executionId) {
        toast({
          title: 'No active execution found',
          description: 'Could not determine which execution to terminate.',
          variant: 'destructive',
        });
        return;
      }

      const body = {
        mode: 'stop_then_kill' as const,
        timeout_ms: 5000,
        reason: 'user_requested_stop',
      };

      const res = await sessionApiFetch<any>(
        `/workflows/executions/${executionId}/terminate`,
        {
          sessionToken: currentUserSessionToken || undefined,
          body: JSON.stringify(body),
        }
      );

      toast({
        title: res?.status === 'terminating' ? 'Termination initiated' : 'Execution terminated',
        description: res?.message || 'The workflow execution is being stopped.',
      });
    } catch (error) {
      console.error('Terminate execution failed:', error);
      toast({
        title: 'Failed to terminate execution',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsTerminating(false);
    }
  }, [resolveActiveExecutionId, currentUserSessionToken, isTerminating, toast]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      {/* 80% Screen Overlay */}
      <div className="w-[80%] h-[80%] bg-white rounded-lg shadow-2xl flex flex-col overflow-hidden">
        {/* Overlay Header */}
        <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            </div>
            <Badge variant="outline" className={`text-xs border-gray-600 ${
              workflowInfo.hasStreamingSupport 
                ? 'text-green-300 border-green-600' 
                : 'text-yellow-300 border-yellow-600'
            }`}>
              {workflowInfo.hasStreamingSupport ? 'Live Streaming' : 'Limited'}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2">
            <div className="text-sm text-gray-300">
              <span className="font-medium">{workflowInfo.name}</span>
              <span className="mx-2">•</span>
              <span className="capitalize">{workflowInfo.mode}</span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleTerminate}
              disabled={isTerminating}
              className="bg-red-600 hover:bg-red-700"
              title="Terminate this execution"
            >
              <XCircle className="h-4 w-4 mr-1" />
              {isTerminating ? 'Terminating...' : 'Terminate'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={stableOnClose}
              className="text-gray-300 hover:text-white hover:bg-gray-800"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* RRWeb Visualizer Content */}
        <div className="flex-1 relative overflow-hidden">
          <ErrorBoundary
            onError={(error, errorInfo) => {
              console.error('🚨 [VisualStreamingOverlay] RRWebVisualizer error:', error);
              console.error('🚨 [VisualStreamingOverlay] Error info:', errorInfo);
            }}
          >
            <RRWebVisualizer 
              key={`visualizer-${sessionId}`} // Stable key with prefix
              sessionId={sessionId}
              onClose={stableOnClose}
            />
          </ErrorBoundary>
        </div>

        {/* Overlay Footer (Optional) */}
        <div className="bg-gray-50 px-4 py-2 border-t flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-4 text-xs text-gray-600">
            <span>Session: {sessionId.slice(0, 16)}...</span>
            <span>Task ID: {workflowInfo.taskId.slice(0, 8)}...</span>
          </div>
          <div className="text-xs text-gray-600">
            {workflowInfo.hasStreamingSupport ? (
              <span className="text-green-600">✅ Visual mode active</span>
            ) : (
              <span className="text-yellow-600">⚠️ Limited view</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// Enhanced memoization to prevent unnecessary re-renders
const EnhancedVisualStreamingOverlay = memo(VisualStreamingOverlayComponent, (prevProps, nextProps) => {
  const propsChanged = (
    prevProps.sessionId !== nextProps.sessionId ||
    prevProps.isOpen !== nextProps.isOpen ||
    prevProps.onClose !== nextProps.onClose ||
    JSON.stringify(prevProps.workflowInfo) !== JSON.stringify(nextProps.workflowInfo)
  );
  
  // Return true if props are the same (prevent re-render), false if different (allow re-render)
  return !propsChanged;
});

// Add display name for debugging
EnhancedVisualStreamingOverlay.displayName = 'EnhancedVisualStreamingOverlay';

export const VisualStreamingOverlay = EnhancedVisualStreamingOverlay;
export default EnhancedVisualStreamingOverlay; 