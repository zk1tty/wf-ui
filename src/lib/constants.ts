// 🌐 Global Constants for API Configuration
// This file centralizes all URL configurations to avoid hardcoding

/**
 * Determines if we're in production environment
 */
export const IS_PRODUCTION = window.location.hostname !== 'localhost';

/**
 * Base API URL - automatically switches between development and production
 * In development, use empty string to leverage Vite proxy
 * In production, use empty string for relative URLs
 */
export const API_BASE_URL = '';

/**
 * WebSocket base URL - automatically switches between development and production
 * In development, use the frontend host (Vite will proxy to backend)
 * In production, use same host with proper protocol
 */
export const WS_BASE_URL = IS_PRODUCTION ? 
  `ws${window.location.protocol === 'https:' ? 's' : ''}://${window.location.host}` : 
  `ws://${window.location.host}`;

/**
 * API Endpoints Configuration
 */
export const API_ENDPOINTS = {
  // Workflow execution
  EXECUTE_WORKFLOW: (workflowId: string) => `${API_BASE_URL}/workflows/${workflowId}/execute/session`,
  
  // Visual streaming endpoints
  VISUAL_STATUS: (sessionId: string) => `${API_BASE_URL}/workflows/visual/${sessionId}/status`,
  VISUAL_VIEWER: (sessionId: string) => `${API_BASE_URL}/workflows/visual/${sessionId}/viewer`,
  VISUAL_STREAM_WS: (sessionId: string) => `${WS_BASE_URL}/workflows/visual/${sessionId}/stream`,
  
  // Standard API endpoints
  WORKFLOWS: `${API_BASE_URL}/workflows`,
  WORKFLOW_LOGS: (taskId: string, position: number) => `${API_BASE_URL}/workflows/${taskId}/logs?position=${position}`,
  CANCEL_WORKFLOW: (taskId: string) => `${API_BASE_URL}/workflows/${taskId}/cancel`,
  
  // Enhanced workflow endpoints
  WORKFLOW_STATS: (workflowId: string) => `${API_BASE_URL}/workflows/executions/stats/${workflowId}`,
  EXECUTION_HISTORY: `${API_BASE_URL}/workflows/executions/history`,
  ACTIVE_EXECUTIONS: `${API_BASE_URL}/workflows/executions/active`,
} as const;