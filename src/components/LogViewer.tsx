import React, { useEffect, useRef, useState } from 'react';
import { useAppContext } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';

export const LogViewer = () => {
  const {
    logData,
    workflowStatus,
    workflowError,
    startPollingLogs,
    stopPollingLogs,
    cancelWorkflowExecution,
    currentTaskId,
  } = useAppContext();
  const { theme } = useTheme();

  const [isCancelling, setIsCancelling] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (currentTaskId) {
      startPollingLogs(currentTaskId);
    }
    return () => {
      stopPollingLogs();
    };
  }, [currentTaskId, startPollingLogs, stopPollingLogs]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logData]);

  const handleCancel = async () => {
    if (workflowStatus !== 'running') return;
    setIsCancelling(true);
    try {
      if (currentTaskId) {
        await cancelWorkflowExecution(currentTaskId);
      }
    } catch (error) {
      console.error('Failed to cancel workflow:', error);
    } finally {
      setIsCancelling(false);
    }
  };

  const downloadLogs = () => {
    if (logData.length === 0) return;
    const blob = new Blob([logData.join('')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `workflow-logs-${currentTaskId}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const formatLog = (log: string, index: number) => {
    const timestampMatch = log.match(/^\[(.*?)\]/);
    if (timestampMatch) {
      const timestamp = timestampMatch[0];
      const message = log.substring(timestamp.length);
      return (
        <div key={index} className="log-line">
          <span className="log-timestamp">{timestamp}</span>
          <span className="log-message">{message}</span>
        </div>
      );
    }
    return (
      <div key={index} className="log-line">
        {log}
      </div>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-[#e6f7ff] text-[#1890ff] border border-[#91d5ff]';
      case 'completed':
        return 'bg-[#f6ffed] text-[#52c41a] border border-[#b7eb8f]';
      case 'cancelling':
        return 'bg-[#fff2f0] text-orange-500 border border-[#ffccc7]';
      case 'cancelled':
        return 'bg-[#fff1f0] text-[#ff1a1a] border border-[#ff4d4f]';
      case 'failed':
        return 'bg-[#fff2f0] text-[#ff4d4f] border border-[#ffccc7]';
      default:
        return 'bg-[#fafafa] text-[#888] border border-[#ddd]';
    }
  };

  return (
    <div className={`p-4 h-full ${theme === 'dark' ? 'bg-black' : 'bg-white'}`}>
      <div className={`max-w-6xl mx-auto h-full flex flex-col border rounded-md overflow-hidden font-mono ${
        theme === 'dark' 
          ? 'border-gray-700 bg-gray-900' 
          : 'border-[#ddd] bg-[#f8f9fa]'
      }`}>
        <div className={`flex justify-between px-2 py-1 border-b ${
          theme === 'dark' 
            ? 'bg-gray-800 border-gray-700' 
            : 'bg-[#f0f2f5] border-[#ddd]'
        }`}>
          <div className={`font-semibold ${
            theme === 'dark' ? 'text-white' : 'text-[#333]'
          }`}>
            Workflow Execution Logs
          </div>
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2">
              {workflowStatus === 'running' && (
                <button
                  className={`flex items-center gap-1 py-1 px-2 border rounded text-xs transition ${
                    theme === 'dark'
                      ? 'bg-gray-700 border-gray-600 text-red-400 hover:bg-gray-600 hover:border-gray-500'
                      : 'bg-[#fff2f0] border-[#ffccc7] text-[#ff4d4f] hover:bg-[#fff1f0] hover:border-[#ffa39e]'
                  } ${
                    isCancelling ? 'opacity-60 cursor-not-allowed' : ''
                  }`}
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel'}
                </button>
              )}
              {logData.length > 0 && (
                <button
                  className={`flex items-center gap-1 py-1 px-2 border rounded text-xs transition ${
                    theme === 'dark' 
                      ? 'bg-gray-700 border-gray-600 text-white hover:bg-gray-600 hover:border-gray-500' 
                      : 'bg-[#f5f5f5] border-[#ddd] text-[#333] hover:bg-[#e6e6e6] hover:border-[#ccc]'
                  }`}
                  onClick={downloadLogs}
                >
                  Download
                </button>
              )}
            </div>
            <div
              className={`py-0.5 px-2 rounded text-xs font-medium ${getStatusColor(
                workflowStatus
              )}`}
            >
              Status:{' '}
              {workflowStatus.charAt(0).toUpperCase() + workflowStatus.slice(1)}
            </div>
          </div>
        </div>

        <div
          className={`flex-1 overflow-y-auto p-3 text-xs leading-normal whitespace-pre-wrap break-words min-h-0 max-h-[calc(100vh-15rem)] ${
            theme === 'dark' 
              ? 'bg-gray-900 text-gray-300' 
              : 'bg-white text-[#333]'
          }`}
          ref={logContainerRef}
        >
          {logData.length > 0 ? (
            logData.map((log, index) => formatLog(log, index))
          ) : (
            <div className={`italic py-5 text-center ${
              theme === 'dark' ? 'text-gray-400' : 'text-[#999]'
            }`}>
              {workflowStatus === 'running'
                ? 'Waiting for logs...'
                : 'No logs available'}
            </div>
          )}

          {workflowError && (
            <div className="mt-2 p-2 rounded bg-[#fff2f0] text-[#ff4d4f] border border-[#ffccc7]">
              <strong>Error:</strong> {workflowError}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
