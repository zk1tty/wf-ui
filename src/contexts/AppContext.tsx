import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from 'react';
import { Workflow, EnhancedWorkflow, inputFieldSchema, ActiveExecution } from '../types/workflow-layout.types';
import { workflowService } from '@/services/workflowService';
import { createEnhancedWorkflowService } from '@/services/enhancedWorkflowService';
// import { fetchWorkflowLogs, cancelWorkflow } from '@/services/pollingService';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { hasValidSessionToken, getStoredSessionToken } from '@/utils/authUtils';

export type DisplayMode = 'canvas' | 'editor' | 'start';
export type DialogType =
  | 'run'
  | 'runAsTool'
  | 'unsavedChanges'
  | 'editRecording'
  | 'recordingInProgress'
  | null;
export type SidebarStatus = 'loading' | 'ready' | 'error';
export type EditorStatus = 'saved' | 'unsaved';
export type WorkflowStatus =
  | 'idle'
  | 'running'
  | 'failed'
  | 'cancelling'
  | 'cancelled'
  | 'completed';
export type RecordingStatus =
  | 'idle'
  | 'recording'
  | 'building'
  | 'failed'
  | 'cancelling';

interface AppContextType {
  displayMode: DisplayMode;
  setDisplayMode: (mode: DisplayMode) => void;
  workflowStatus: WorkflowStatus;
  workflowError: string | null;
  currentTaskId: string | null;
  currentExecutionMode: 'cloud-run' | 'local-run' | null;
  currentExecutionInputs: any | null;
  currentLogPosition: number;
  sidebarStatus: SidebarStatus;
  editorStatus: EditorStatus;
  setEditorStatus: (status: EditorStatus) => void;
  currentWorkflowData: Workflow | null;
  isCurrentWorkflowPublic: boolean;
  currentUserSessionToken: string | null;
  isCurrentUserOwner: boolean;
  workflows: EnhancedWorkflow[];
  activeExecutions: Record<string, ActiveExecution>;
  // Visual Streaming Overlay States
  visualOverlayActive: boolean;
  currentStreamingSession: string | null;
  overlayWorkflowInfo: {
    name: string;
    taskId: string;
    mode: string;
    hasStreamingSupport?: boolean;
  } | null;
  setVisualOverlayActive: (active: boolean) => void;
  setCurrentStreamingSession: (sessionId: string | null) => void;
  setOverlayWorkflowInfo: (info: { name: string; taskId: string; mode: string; hasStreamingSupport?: boolean } | null) => void;
  addWorkflow: (workflow: Workflow) => void;
  deleteWorkflow: (workflowId: string) => void;
  selectWorkflow: (workflowName: string) => void;
  activeDialog: DialogType;
  setActiveDialog: (dialog: DialogType) => void;
  executeWorkflow: (
    workflowId: string,
    inputFields: z.infer<typeof inputFieldSchema>[],
    mode?: 'cloud-run' | 'local-run',
    visual?: boolean
  ) => Promise<void>;
  updateWorkflowUI: (oldWorkflow: Workflow, newWorkflow: Workflow) => void;
  startPollingLogs: (taskId: string) => void;
  stopPollingLogs: () => void;
  logData: string[];
  cancelWorkflowExecution: (taskId: string) => Promise<void>;
  checkForUnsavedChanges: () => boolean;
  recordingStatus: RecordingStatus;
  setRecordingStatus: (status: RecordingStatus) => void;
  recordingData: any;
  setRecordingData: (data: any) => void;
  fetchWorkflows: () => Promise<void>;
  setWorkflows: (workflows: Workflow[]) => void;
  setSidebarStatus: (status: SidebarStatus) => void;
  setCurrentWorkflowData: (workflow: Workflow | null, isPublic?: boolean) => void;
  setCurrentUserSessionToken: (sessionToken: string | null) => void;
  setIsCurrentUserOwner: (isOwner: boolean) => void;
  refreshAuthenticationStatus: () => void;
  authRefreshTrigger: number;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const { toast } = useToast();
  const [workflows, setWorkflows] = useState<EnhancedWorkflow[]>([]);
  const [activeExecutions, setActiveExecutions] = useState<Record<string, ActiveExecution>>({});
  const [displayMode, setDisplay] = useState<DisplayMode>('start');
  const [currentWorkflowData, setCurrentWorkflowDataState] =
    useState<Workflow | null>(null);
  const [isCurrentWorkflowPublic, setIsCurrentWorkflowPublic] = useState<boolean>(false);
  
  // Initialize with any existing session token from storage
  const [currentUserSessionToken, setCurrentUserSessionToken] = useState<string | null>(() => {
    try {
      const storedToken = getStoredSessionToken();
      if (storedToken) {
        return storedToken;
      }
      return null;
    } catch (error) {
      console.error('❌ [AppContext] Error loading initial session token:', error);
      return null;
    }
  });
  
  const [isCurrentUserOwner, setIsCurrentUserOwner] = useState<boolean>(false);
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('idle');
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [sidebarStatus, setSidebarStatus] = useState<SidebarStatus>('loading');
  const [editorStatus, setEditorStatus] = useState<EditorStatus>('saved');
  const [logData, setLogData] = useState<string[]>([]);
  const [logPosition, setLogPosition] = useState<number>(0);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [currentExecutionMode, setCurrentExecutionMode] = useState<'cloud-run' | 'local-run' | null>(null);
  const [currentExecutionInputs, setCurrentExecutionInputs] = useState<any | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const [recordingStatus, setRecordingStatus] =
    useState<RecordingStatus>('idle');
  const [recordingData, setRecordingData] = useState<any>(null);
  const [authRefreshTrigger, setAuthRefreshTrigger] = useState<number>(0);

  // Visual Streaming Overlay States
  const [visualOverlayActive, setVisualOverlayActive] = useState(false);
  const [currentStreamingSession, setCurrentStreamingSession] = useState<string | null>(null);
  const [overlayWorkflowInfo, setOverlayWorkflowInfo] = useState<{
    name: string;
    taskId: string;
    mode: string;
    hasStreamingSupport?: boolean;
  } | null>(null);



  // Wrapper function to handle both workflow data and public flag
  const setCurrentWorkflowData = useCallback((workflow: Workflow | null, isPublic: boolean = false) => {
    setCurrentWorkflowDataState(workflow);
    setIsCurrentWorkflowPublic(isPublic);
  }, []);

  const checkForUnsavedChanges = useCallback(() => {
    if (recordingStatus === 'recording') {
      setActiveDialog('recordingInProgress');
      return true;
    }
    if (editorStatus === 'unsaved') {
      setActiveDialog('unsavedChanges');
      return true;
    }
    return false;
  }, [editorStatus, recordingStatus, setActiveDialog]);

  const setDisplayMode = useCallback(
    (mode: DisplayMode) => {
      if (checkForUnsavedChanges()) {
        return;
      }
      setDisplay(mode);
    },
    [checkForUnsavedChanges]
  );

  const selectWorkflow = useCallback(
    (workflowName: string) => {
      console.log("[selectWf] wfname:", workflowName);
      if (checkForUnsavedChanges()) {
        return;
      }
      console.log("[selectWf] workflows:", workflows);
      console.log("[selectWf] obj:", Object.keys(workflows));
      const wf = workflows.find((w) => w.name === workflowName);
      console.log("[selectWf] wf:", wf);
      if (wf) {
        setCurrentWorkflowData(wf, false); // Private workflows are not public
      } else {
        setCurrentWorkflowData(null, false); // fallback
      }
    },
    [workflows, checkForUnsavedChanges]
  );

  const addWorkflow = useCallback(async (workflow: Workflow) => {
    try {
      await workflowService.addWorkflow(
        workflow.name,
        JSON.stringify(workflow)
      );
      setWorkflows((prev) => [workflow, ...prev]);
      toast({
        title: 'Workflow added! ✅',
        description: 'The workflow has been successfully added!',
      });
    } catch (err) {
      toast({
        title: 'Error ❌',
        description: `Failed to add the workflow. ${err}`,
      });
    }
  }, [toast]);

  const deleteWorkflow = useCallback(async (workflowName: string) => {
    try {
      await workflowService.deleteWorkflow(workflowName);
      setWorkflows((prev) => prev.filter((wf) => wf.name !== workflowName));
      toast({
        title: 'Workflow deleted! ✅',
        description: 'The workflow has been successfully deleted!',
      });
    } catch (err) {
      toast({
        title: 'Error ❌',
        description: `Failed to delete the workflow. ${err}`,
      });
    }
  }, [toast]);

  const updateWorkflowUI = useCallback(
    (oldWorkflow: Workflow, newWorkflow: Workflow) => {
      setWorkflows((prev) =>
        prev.map((wf) => (wf.name === oldWorkflow.name ? newWorkflow : wf))
      );
      if (currentWorkflowData?.name === oldWorkflow.name) {
        setCurrentWorkflowData(newWorkflow, isCurrentWorkflowPublic);
      }
    },
    [currentWorkflowData, isCurrentWorkflowPublic, setCurrentWorkflowData]
  );

  const stopPollingLogs = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPollingLogs = useCallback(
    (taskId: string) => {
      stopPollingLogs();

      const poll = async () => {
        try {
          const data = await workflowService.fetchWorkflowLogs(
            taskId,
            logPosition
          );
          
          // Only update logs if there are actually new logs
          if (data.logs?.length) {
            setLogData((prev) => {
              const newLogs = data.logs.filter((log) => !prev.includes(log));
              return newLogs.length > 0 ? [...prev, ...newLogs] : prev;
            });
          }
          
          // Only update log position if it actually changed
          if (data.log_position !== logPosition) {
            setLogPosition(data.log_position);
          }

          // Only update status if it actually changed
          if (data.status && data.status !== workflowStatus) {
            setWorkflowStatus(data.status as WorkflowStatus);
            if (data.status === 'failed' && data.error) {
              setWorkflowError(data.error);
              setWorkflowStatus('failed');
              stopPollingLogs();
            } else if (
              data.status === 'completed' ||
              data.status === 'cancelled'
            ) {
              stopPollingLogs();
            }
          }

          if (['failed', 'cancelled', 'completed'].includes(workflowStatus)) {
            stopPollingLogs();
            if (workflowStatus === 'failed' && data.error) {
              setWorkflowError(data.error);
            }
          }
        } catch (err) {
          console.error('Polling error:', err);
          setWorkflowError('Failed to fetch workflow logs');
          stopPollingLogs();
          setWorkflowStatus('failed');
        }
      };

      poll();
      pollingRef.current = setInterval(poll, 2000);
    },
    [logPosition, workflowStatus, stopPollingLogs]
  );

  const cancelWorkflowExecution = useCallback(async (taskId: string) => {
    try {
      setWorkflowStatus('cancelling');
      await workflowService.cancelWorkflow(taskId);
    } catch (err) {
      console.error('Failed to cancel workflow:', err);
      setWorkflowError('Failed to cancel workflow');
      setWorkflowStatus('failed');
    }
  }, []);

  const executeWorkflow = useCallback(
    async (workflowId: string, inputFields: z.infer<typeof inputFieldSchema>[], mode: 'cloud-run' | 'local-run' = 'cloud-run', visual: boolean = false) => {
      if (!workflowId) return;
      const missingInputs = inputFields.filter(
        (field) => field.required && !field.value
      );
      if (missingInputs.length > 0) {
        setWorkflowError(
          `Missing required inputs: ${missingInputs
            .map((f) => f.name)
            .join(', ')}`
        );
        return;
      }

      // Check authentication before attempting execution
      if (!hasValidSessionToken(currentUserSessionToken)) {
        setWorkflowError('Please login through the Chrome extension to execute workflows.');
        setWorkflowStatus('failed');
        return;
      }

      setWorkflowError(null);
      setCurrentTaskId(null);
      setLogPosition(0);
      setWorkflowStatus('idle');

      try {
        // Show toast for visual mode
        if (visual) {
          toast({
            title: 'Visual Mode Enabled',
            description: `Starting ${mode === 'cloud-run' ? '☁️ cloud-run' : '🖥️ local-run'} execution with live browser view...`,
          });
        }
        
        // Use session token for execution with mode and visual
        console.log('🚀 [AppContext] Starting workflow execution:', {
          workflowId,
          mode,
          visual,
          sessionToken: currentUserSessionToken ? `${currentUserSessionToken.slice(0,8)}...` : null,
          inputFields: inputFields.length
        });

        const result = await workflowService.executeWorkflow(
          workflowId, 
          inputFields, 
          currentUserSessionToken!,  // We've already validated it's not null above
          mode,
          visual
        );
        
        console.log('🎯 [AppContext] Execution result:', result);
        console.log('🎯 [AppContext] Backend success:', result.success);
        console.log('🎯 [AppContext] Workflow name:', result.workflow);
        console.log('🎯 [AppContext] Execution mode:', result.mode);
        console.log('🎯 [AppContext] Visual mode requested:', visual);
        console.log('🎯 [AppContext] Visual enabled in response:', result.visual_enabled);
        console.log('🎯 [AppContext] Visual streaming enabled:', result.visual_streaming_enabled);
        console.log('🎯 [AppContext] Session ID from backend:', result.session_id);
        console.log('🎯 [AppContext] Task ID from backend:', result.task_id);
        console.log('🎯 [AppContext] DevTools URL in response:', result.devtools_url);
        
        // Check if backend execution was successful
        if (!result.success) {
          throw new Error(result.message || 'Backend execution failed');
        }
        
        setCurrentTaskId(result.task_id);
        setCurrentExecutionMode(mode);
        setCurrentExecutionInputs(inputFields);
        setLogPosition(result.log_position);
        setWorkflowStatus('running');
        
        // Store execution parameters in sessionStorage for DevTools execution trigger
        if (visual && result.task_id) {
          const executionParams = {
            workflowId: workflowId,
            inputs: inputFields,
            sessionToken: currentUserSessionToken,
            mode: mode,
            visual: true,
            timestamp: Date.now()
          };
          sessionStorage.setItem(`execution_params_${result.task_id}`, JSON.stringify(executionParams));
          console.log(`💾 [AppContext] Stored execution params for task ${result.task_id}`);
        }
        
        // Handle visual mode - redirect to appropriate viewer based on streaming capability
        if (visual) {
          console.log('🎬 [AppContext] Processing visual mode response:', {
            visual_enabled: result.visual_enabled,
            visual_streaming_enabled: result.visual_streaming_enabled,
            session_id: result.session_id,
            task_id: result.task_id
          });

          if (result.visual_enabled || result.visual_streaming_enabled) {
            // ✅ UPDATED: Backend now returns proper session_id for visual streaming
            // Use exact session_id from backend, fallback to visual-prefixed task_id if needed
            const sessionId = result.session_id || `visual-${result.task_id}`;
            const hasStreamingSupport = result.visual_streaming_enabled || false;
            
            console.log('✅ [AppContext] Workflow started with session ID:', sessionId);
            console.log('✅ [AppContext] Session ID type:', typeof sessionId);
            console.log('✅ [AppContext] Session ID length:', sessionId?.length);
            console.log('✅ [AppContext] Raw result.session_id:', result.session_id);
            console.log('✅ [AppContext] Raw result.task_id:', result.task_id);

            
            // Set overlay state
            setCurrentStreamingSession(sessionId);
            setOverlayWorkflowInfo({
              name: result.workflow,
              taskId: result.task_id,
              mode: mode,
              hasStreamingSupport: hasStreamingSupport
            });
            
            // Add delay to ensure backend has started the workflow
            setTimeout(() => {
              setVisualOverlayActive(true);
            }, 2000); // 2 second delay
            
            // Show success notification with appropriate messaging
            const streamingStatus = hasStreamingSupport ? 'rrweb live streaming' : 'visual mode (limited streaming)';
            toast({
              title: hasStreamingSupport ? 'Visual Streaming Activated' : 'Visual Mode Activated',
              description: `${result.workflow} is running with ${mode === 'cloud-run' ? '☁️ cloud-run' : '🖥️ local-run'} ${streamingStatus}`,
            });
          } else if (result.visual_enabled && result.devtools_url) {
            // Fallback to DevTools iframe viewer
            console.log('✅ [AppContext] Opening DevTools viewer for task:', result.task_id);
            console.log('✅ [AppContext] DevTools URL from backend:', result.devtools_url);
            const devToolsUrl = `${window.location.origin}/devtools/${result.task_id}`;
            window.open(devToolsUrl, '_blank', 'width=1200,height=800');
            
            // Show success notification
            toast({
              title: 'Visual Mode Activated',
              description: `${result.workflow} is running with ${mode === 'cloud-run' ? '☁️ cloud-run' : '🖥️ local-run'} live browser view`,
            });
          } else if (result.visual_enabled) {
            // Visual mode enabled but no specific URL - try DevTools viewer
            console.log('⚠️ [AppContext] Visual enabled but no specific viewer URL, opening DevTools viewer');
            const devToolsUrl = `${window.location.origin}/devtools/${result.task_id}`;
            window.open(devToolsUrl, '_blank', 'width=1200,height=800');
          } else {
            // Backend didn't enable visual mode
            console.warn('❌ [AppContext] Visual mode requested but backend returned visual_enabled:', result.visual_enabled);
            toast({
              title: 'Visual Mode Not Available',
              description: 'The backend did not enable visual mode for this execution.',
            });
          }
        }
        
        setDisplayMode('canvas');
        
        // Only start log polling for non-visual workflows
        // Visual streaming workflows handle their own status through RRWebVisualizer
        if (!visual || (!result.visual_enabled && !result.visual_streaming_enabled)) {
          console.log('📊 [AppContext] Starting log polling for traditional execution');
          startPollingLogs(result.task_id);
        } else {
          console.log('📊 [AppContext] Skipping log polling - visual streaming handles its own status');
        }
      } catch (err) {
        console.error('Workflow execution failed:', err);
        
        // Provide user-friendly error messages
        let errorMessage = 'An error occurred while executing the workflow';
        
        if (err instanceof Error) {
          const errorText = err.message.toLowerCase();
          
          // Handle authentication-related errors
          if (errorText.includes('jwt') || errorText.includes('session authentication') || errorText.includes('unauthorized')) {
            errorMessage = 'Please login through the Chrome extension to execute workflows.';
          } else if (errorText.includes('session token') || errorText.includes('invalid token')) {
            errorMessage = 'Your session has expired. Please login again through the Chrome extension.';
          } else if (errorText.includes('not found') || errorText.includes('404')) {
            errorMessage = 'Workflow not found. Please refresh the page and try again.';
          } else {
            // Use the original error message for other cases
            errorMessage = err.message;
          }
        }
        
        setWorkflowError(errorMessage);
        setWorkflowStatus('failed');
        stopPollingLogs();
      }
    },
    [startPollingLogs, stopPollingLogs, setDisplayMode, currentUserSessionToken]
  );

  // Uncomment for debugging
  // useEffect(() => {
  //   const logInterval = setInterval(() => {
  //     console.log('Current workflows:', workflows);
  //     console.log('Current workflow data:', currentWorkflowData);
  //   }, 2000); // Log every 10 seconds

  //   return () => clearInterval(logInterval);
  // }, [workflows, currentWorkflowData]);

  // Enhanced workflow service instance - memoized to prevent recreation
  const enhancedWorkflowService = useMemo(() => 
    createEnhancedWorkflowService(currentUserSessionToken), 
    [currentUserSessionToken]
  );

  // Fetch workflows with execution statistics
  const fetchWorkflows = useCallback(async () => {
    try {
      setSidebarStatus('loading');
      
      // Try to fetch enhanced workflows with stats if session token exists
      if (hasValidSessionToken(currentUserSessionToken)) {
        try {
          const enhancedWorkflows = await enhancedWorkflowService.getAllWorkflowsWithStats();
          setWorkflows(enhancedWorkflows);
          setSidebarStatus('ready');
          return;
        } catch (error) {
          console.warn('[fetchWorkflows] Failed to fetch enhanced workflows, falling back to basic:', error);
        }
      }
      
      // Fallback to basic workflows
      const response = await workflowService.getWorkflows();
      const basicWorkflows: EnhancedWorkflow[] = response.map(workflow => ({
        ...workflow,
        execution_stats: undefined,
        recent_executions: undefined,
        performance: undefined
      }));
      setWorkflows(basicWorkflows);
      setSidebarStatus('ready');
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
      setSidebarStatus('error');
    }
  }, [currentUserSessionToken, enhancedWorkflowService]);

  // Poll for active executions
  const pollActiveExecutions = useCallback(async () => {
    if (!hasValidSessionToken(currentUserSessionToken)) {
      setActiveExecutions(prev => Object.keys(prev).length === 0 ? prev : {});
      return;
    }

    try {
      const active = await enhancedWorkflowService.getActiveExecutions();
      
      // Only update if active executions actually changed
      setActiveExecutions(prev => {
        const prevKeys = Object.keys(prev).sort();
        const activeKeys = Object.keys(active).sort();
        
        // Quick check if keys are different
        if (prevKeys.length !== activeKeys.length || 
            prevKeys.some((key, index) => key !== activeKeys[index])) {
          return active;
        }
        
        // Check if any execution details changed
        const hasChanges = activeKeys.some(key => 
          JSON.stringify(prev[key]) !== JSON.stringify(active[key])
        );
        
        return hasChanges ? active : prev;
      });
    } catch (error) {
      console.warn('Failed to poll active executions:', error);
    }
  }, [currentUserSessionToken, enhancedWorkflowService]);

  useEffect(() => {
    fetchWorkflows();
  }, []);

  // Poll for active executions every 5 seconds when authenticated
  useEffect(() => {
    if (!hasValidSessionToken(currentUserSessionToken)) {
      return;
    }

    // Initial poll
    pollActiveExecutions();

    // Set up polling interval - reduced frequency to minimize re-renders
    const interval = setInterval(pollActiveExecutions, 10000);
    
    return () => clearInterval(interval);
  }, [currentUserSessionToken, pollActiveExecutions]); // Added pollActiveExecutions to dependencies

  // Update enhanced service when session token changes
  useEffect(() => {
    enhancedWorkflowService.updateSessionToken(currentUserSessionToken);
  }, [currentUserSessionToken]);

  const refreshAuthenticationStatus = useCallback(() => {
    console.log('🔄 [AppContext] Refreshing authentication status across all components');
    // Trigger a re-render of all components that depend on authentication state
    setAuthRefreshTrigger(prev => prev + 1);
    
    // Also trigger a small delay to ensure state has propagated
    setTimeout(() => {
      console.log('🔄 [AppContext] Authentication refresh completed');
    }, 100);
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    selectWorkflow,
    displayMode,
    setDisplayMode,
    workflowStatus,
    workflowError,
    currentTaskId,
    currentExecutionMode,
    currentExecutionInputs,
    currentLogPosition: logPosition,
    currentWorkflowData,
    isCurrentWorkflowPublic,
    currentUserSessionToken,
    isCurrentUserOwner,
    workflows,
    addWorkflow,
    deleteWorkflow,
    activeDialog,
    setActiveDialog,
    executeWorkflow,
    updateWorkflowUI,
    startPollingLogs,
    stopPollingLogs,
    logData,
    cancelWorkflowExecution,
    sidebarStatus,
    editorStatus,
    setEditorStatus,
    checkForUnsavedChanges,
    recordingStatus,
    setRecordingStatus,
    recordingData,
    setRecordingData,
    fetchWorkflows,
    setWorkflows,
    setSidebarStatus,
    setCurrentWorkflowData,
    setCurrentUserSessionToken,
    setIsCurrentUserOwner,
    refreshAuthenticationStatus,
    authRefreshTrigger,
    activeExecutions,
    visualOverlayActive,
    currentStreamingSession,
    overlayWorkflowInfo,
    setVisualOverlayActive,
    setCurrentStreamingSession,
    setOverlayWorkflowInfo
  }), [
    selectWorkflow,
    displayMode,
    setDisplayMode,
    workflowStatus,
    workflowError,
    currentTaskId,
    currentExecutionMode,
    currentExecutionInputs,
    logPosition,
    currentWorkflowData,
    isCurrentWorkflowPublic,
    currentUserSessionToken,
    isCurrentUserOwner,
    workflows,
    addWorkflow,
    deleteWorkflow,
    activeDialog,
    setActiveDialog,
    executeWorkflow,
    updateWorkflowUI,
    startPollingLogs,
    stopPollingLogs,
    logData,
    cancelWorkflowExecution,
    sidebarStatus,
    editorStatus,
    setEditorStatus,
    checkForUnsavedChanges,
    recordingStatus,
    setRecordingStatus,
    recordingData,
    setRecordingData,
    fetchWorkflows,
    setWorkflows,
    setSidebarStatus,
    setCurrentWorkflowData,
    setCurrentUserSessionToken,
    setIsCurrentUserOwner,
    refreshAuthenticationStatus,
    authRefreshTrigger,
    activeExecutions,
    visualOverlayActive,
    currentStreamingSession,
    overlayWorkflowInfo,
    setVisualOverlayActive,
    setCurrentStreamingSession,
    setOverlayWorkflowInfo
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};
