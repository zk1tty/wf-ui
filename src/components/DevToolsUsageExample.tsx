/**
 * DevTools Usage Examples
 * 
 * This file demonstrates how to use the new DevToolsIframe component
 * following the IFRAME_DEVTOOLS_IMPLEMENTATION.md guide
 */

import React, { useState } from 'react';
import { DevToolsIframe } from './DevToolsIframe';
import { EnhancedDevToolsViewer } from './EnhancedDevToolsViewer';
import { Button } from '@/components/ui/button';

// Example 1: Simple DevToolsIframe usage
export function SimpleDevToolsExample() {
  const [sessionId] = useState('example-session-id');

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Simple DevTools Iframe</h3>
      <DevToolsIframe sessionId={sessionId} />
    </div>
  );
}

// Example 2: Enhanced DevTools Viewer with status and instructions
export function EnhancedDevToolsExample() {
  const [sessionId] = useState('example-session-id');

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Enhanced DevTools Viewer</h3>
      <EnhancedDevToolsViewer sessionId={sessionId} />
    </div>
  );
}

// Example 3: Integration with workflow execution
export function WorkflowExecutionExample() {
  const [executionData, setExecutionData] = useState<{
    task_id: string;
    visual_enabled: boolean;
  } | null>(null);

  const handleExecuteWorkflow = async () => {
    // Simulate workflow execution
    const mockResponse = {
      success: true,
      task_id: 'workflow-123-abc',
      workflow: 'Post Tweet with Grok',
      visual_enabled: true,
      devtools_url: 'ws://localhost:9223/devtools/page/123'
    };
    
    setExecutionData(mockResponse);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Workflow Controls */}
      <div className="workflow-panel space-y-4">
        <h3 className="text-lg font-semibold">Workflow Execution</h3>
        <Button onClick={handleExecuteWorkflow}>
          Execute Workflow with Visual Mode
        </Button>
        
        {executionData && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <p className="text-green-800 font-medium">✅ Workflow Started</p>
            <p className="text-green-700 text-sm">
              Task ID: {executionData.task_id}
            </p>
            <p className="text-green-700 text-sm">
              Visual Mode: {executionData.visual_enabled ? 'Enabled' : 'Disabled'}
            </p>
          </div>
        )}
      </div>
      
      {/* DevTools Viewer */}
      {executionData?.task_id && (
        <div className="devtools-panel">
          <h3 className="text-lg font-semibold mb-4">Live Browser View</h3>
          <EnhancedDevToolsViewer sessionId={executionData.task_id} />
        </div>
      )}
    </div>
  );
}

// Example 4: Director.ai-style DevTools integration
export function DirectorAIStyleExample() {
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);

  const startSession = () => {
    setActiveSession('director-session-' + Date.now());
  };

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Top Bar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Director.ai-style DevTools</h1>
        <div className="flex items-center space-x-2">
          <Button size="sm" onClick={startSession}>
            Start Workflow
          </Button>
          {activeSession && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? 'Show DevTools' : 'Minimize DevTools'}
            </Button>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Main Workflow Panel */}
        <div className={`${activeSession && !isMinimized ? 'w-1/2' : 'w-full'} p-4`}>
          <div className="bg-white rounded-lg shadow p-6 h-full">
            <h2 className="text-xl font-semibold mb-4">Workflow Configuration</h2>
            {!activeSession ? (
              <p className="text-gray-600">Click "Start Workflow" to begin execution with live DevTools monitoring.</p>
            ) : (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-800 font-medium">🚀 Workflow Running</p>
                  <p className="text-blue-700 text-sm">Session: {activeSession}</p>
                </div>
                <p className="text-gray-600">
                  Your workflow is now executing. Watch the live browser view in the DevTools panel →
                </p>
              </div>
            )}
          </div>
        </div>

        {/* DevTools Panel */}
        {activeSession && !isMinimized && (
          <div className="w-1/2 border-l bg-white">
            <div className="h-full p-4">
              <EnhancedDevToolsViewer sessionId={activeSession} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Usage Notes:
 * 
 * 1. Simple Integration:
 *    <DevToolsIframe sessionId={taskId} />
 * 
 * 2. Enhanced Experience:
 *    <EnhancedDevToolsViewer sessionId={taskId} />
 * 
 * 3. Key Benefits:
 *    - Full Chrome DevTools interface
 *    - Real-time browser monitoring
 *    - Professional developer experience
 *    - Robust error handling
 *    - Easy integration (just pass sessionId)
 * 
 * 4. Requirements:
 *    - Backend must implement /workflows/devtools/{sessionId}/iframe endpoint
 *    - Chrome DevTools port must be accessible (usually 9223/9224/9222)
 *    - Session must have active browser instance
 */ 