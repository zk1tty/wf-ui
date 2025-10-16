import React, { useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  MarkerType,
  ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { WorkflowStepNode } from './WorkflowStepNode';
import { DotsBackground } from './DotsBackground';
import { useAppContext } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useAppContext as useAppContextRaw } from '@/contexts/AppContext';
import { getOrderedSteps } from '@/services/workflowSelectors';
import { z } from 'zod';
import { stepSchema } from '@/types/workflow-layout.types';

// Create a custom node type that passes the click handler, save handler, and delete handler
const createNodeTypes = (onStepClick: (stepIndex: number) => void, onSaveStep: (stepIndex: number, updatedStep: any) => void, onDeleteStep: (stepIndex: number) => void) => ({
  workflowStep: (props: any) => <WorkflowStepNode {...props} onStepClick={onStepClick} onSaveStep={onSaveStep} onDeleteStep={onDeleteStep} />,
});

type Step = z.infer<typeof stepSchema>;

export function WorkflowCanvas() {
  const { currentWorkflowData, updateWorkflowUI } = useAppContext();
  const { currentRunId } = useAppContextRaw();
  const { theme } = useTheme();
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  

  const initialNodes: Node[] = useMemo(() => {
    if (!currentWorkflowData) {
      return [
        {
          id: 'placeholder',
          type: 'workflowStep',
          position: { x: 250, y: 200 },
          data: {
            label: 'Select a workflow to visualize',
            action: 'info',
            target: '',
            stepNumber: 1,
          },
        },
      ];
    }

    return currentWorkflowData.steps.map((step, index) => ({
      id: `step-${index + 1}`,
      type: 'workflowStep',
      position: { x: 100, y: 100 + index * 150 },
      data: {
        description: step.description,
        action: step.type,
        target: step.cssSelector,
        value: step.value,
        stepNumber: index + 1,
      },
    }));
  }, [currentWorkflowData]);

  const initialEdges: Edge[] = useMemo(() => {
    if (!currentWorkflowData) return [];

    return currentWorkflowData.steps.slice(0, -1).map((_, index) => ({
      id: `e-step-${index + 1}-step-${index + 2}`,
      source: `step-${index + 1}`,
      target: `step-${index + 2}`,
      type: 'smoothstep',
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
  }, [currentWorkflowData]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );




  // Handle step click to open setting card
  const handleStepClick = useCallback((_stepIndex: number) => {
    // This is now handled by the WorkflowStepNode itself
  }, []);

  // Handle step setting card close
  const handleCloseStepSetting = useCallback(() => {
    // This is now handled by the WorkflowStepNode itself
  }, []);

  // Handle step save
  const handleSaveStep = useCallback((stepIndex: number, updatedStep: Step) => {
    if (!currentWorkflowData) return;
    
    const updatedSteps = [...currentWorkflowData.steps];
    updatedSteps[stepIndex] = updatedStep;
    
    const updatedWorkflow = {
      ...currentWorkflowData,
      steps: updatedSteps
    };
    
    // Update the workflow in the context
    updateWorkflowUI(currentWorkflowData, updatedWorkflow);
    
    // Close the setting card
    handleCloseStepSetting();
  }, [currentWorkflowData, updateWorkflowUI, handleCloseStepSetting]);

  // Handle step delete
  const handleDeleteStep = useCallback((stepIndex: number) => {
    if (!currentWorkflowData) return;
    
    const updatedSteps = currentWorkflowData.steps.filter((_, index) => index !== stepIndex);
    
    const updatedWorkflow = {
      ...currentWorkflowData,
      steps: updatedSteps
    };
    
    // Update the workflow in the context
    updateWorkflowUI(currentWorkflowData, updatedWorkflow);
    
    // Close the setting card
    handleCloseStepSetting();
  }, [currentWorkflowData, updateWorkflowUI, handleCloseStepSetting]);

  // Update nodes when currentWorkflowData changes
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
    requestAnimationFrame(() => {
      reactFlowInstanceRef.current?.fitView({ padding: 0.2 });
    });
  }, [currentWorkflowData, initialNodes, initialEdges, setNodes, setEdges]);

  // Live status mapping: overlay reducer state onto nodes by stepNumber
  React.useEffect(() => {
    if (!currentRunId) return;
    const uiSteps = getOrderedSteps(currentRunId);
    try {
      console.log('[RunEvents][Canvas] currentRunId=', currentRunId, 'uiSteps count=', uiSteps.length, 'sample=', uiSteps[0]);
    } catch {}
    // Do an initial overlay if steps already exist
    if (uiSteps.length) {
      setNodes((prev) =>
        prev.map((n) => {
          const match = uiSteps.find((s) => `step-${s.stepIndex}` === n.id);
          if (!match) return n;
          return {
            ...n,
            data: {
              ...n.data,
              status: match.status,
              fallbackLabel: match.fallbackLabel,
            },
          } as Node;
        })
      );
    }
    const handler = (e: Event) => {
      const refreshed = getOrderedSteps(currentRunId);
      try {
        const detail = (e as CustomEvent).detail;
        console.log('[RunEvents][Canvas][update]', { runId: currentRunId, count: refreshed.length, sample: refreshed[0], detail });
        console.log('[RunEvents][Canvas][nodes-before]', prevNodeIds());
      } catch {}
      setNodes((prev) =>
        prev.map((n) => {
          const m = refreshed.find((s) => `step-${s.stepIndex}` === n.id);
          if (!m) return n;
          return { ...n, data: { ...n.data, status: m.status, fallbackLabel: m.fallbackLabel } } as Node;
        })
      );
      try {
        console.log('[RunEvents][Canvas][nodes-after]', prevNodeIds());
      } catch {}
    };
    window.addEventListener('wfui-run-events-update', handler as any);
    return () => window.removeEventListener('wfui-run-events-update', handler as any);
  }, [currentRunId, setNodes]);

  function prevNodeIds() {
    try {
      return nodes.map((n) => n.id);
    } catch {
      return [] as string[];
    }
  }

  // Theme-based styling matching step setting card
  const canvasStyle = {
    backgroundColor: theme === 'dark' ? '#0f1216' : '#f9fafb'
  };
  
  const controlsClass = theme === 'dark' 
    ? 'workflow-controls bg-gray-800/80 backdrop-blur-sm border border-gray-600/50 rounded-lg shadow-lg text-white' 
    : 'workflow-controls bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm';
  const minimapClass = theme === 'dark'
    ? 'workflow-minimap bg-gray-800/80 backdrop-blur-sm border border-gray-600/50 rounded-lg shadow-lg'
    : 'workflow-minimap bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm';

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={createNodeTypes(handleStepClick, handleSaveStep, handleDeleteStep)}
        onInit={(instance) => {
          reactFlowInstanceRef.current = instance;
        }}
        fitView
        style={canvasStyle}
        defaultViewport={{ x: 0, y: 0, zoom: 1 }}
      >
        <DotsBackground theme={theme} />
        <Controls className={controlsClass} />
        <MiniMap
          className={minimapClass}
          nodeColor={(node) => {
            // Enhanced colors for dark mode visibility
            if (node.data?.action === 'navigation') return theme === 'dark' ? '#60a5fa' : '#3b82f6';
            if (node.data?.action === 'click') return theme === 'dark' ? '#34d399' : '#10b981';
            if (node.data?.action === 'input') return theme === 'dark' ? '#fbbf24' : '#f59e0b';
            if (node.data?.action === 'key_press') return theme === 'dark' ? '#a78bfa' : '#8b5cf6';
            if (node.data?.action === 'agent') return theme === 'dark' ? '#9ca3af' : '#6b7280';
            if (node.data?.action === 'select_change') return theme === 'dark' ? '#22d3ee' : '#06b6d4';
            if (node.data?.action === 'clipboard_copy') return theme === 'dark' ? '#fb923c' : '#ea580c';
            if (node.data?.action === 'clipboard_paste') return theme === 'dark' ? '#f472b6' : '#db2777';
            return theme === 'dark' ? '#9ca3af' : '#6b7280';
          }}
        />
      </ReactFlow>

    </div>
  );
}
