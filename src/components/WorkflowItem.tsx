import { Workflow as WorkflowIcon, Trash2 } from 'lucide-react';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Workflow } from '../types/workflow-layout.types';
import { useAppContext } from '@/contexts/AppContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useState } from 'react';

interface WorkflowItemProps {
  workflow: Workflow;
  onDeleteWorkflow: (workflowId: string) => void;
}

export function WorkflowItem({
  workflow,
  onDeleteWorkflow,
}: WorkflowItemProps) {
  const [isHovered, setIsHovered] = useState(false);
  const { currentWorkflowData, selectWorkflow, displayMode, setDisplayMode } =
    useAppContext();
  const { theme } = useTheme();

  const getWorkflowTimestamp = () => {
    if (!workflow.steps?.length) return '';

    // Find the first step with a timestamp
    const stepWithTimestamp = workflow.steps.find((step) => step.timestamp);
    if (!stepWithTimestamp?.timestamp) return '';

    // Convert timestamp to HH:mm format
    const date = new Date(stepWithTimestamp.timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const isNewWorkflow = () => {
    if (!workflow.steps?.length) return false;
    const stepWithTimestamp = workflow.steps.find((step) => step.timestamp);
    if (!stepWithTimestamp?.timestamp) return false;

    const creationTime = new Date(stepWithTimestamp.timestamp).getTime();
    const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
    return creationTime > threeMinutesAgo;
  };

  const handleClick = () => {
    selectWorkflow(workflow.name);
    if (displayMode === 'start') {
      setDisplayMode('canvas');
    }
  };

  return (
    <SidebarMenuItem key={workflow.name}>
      <SidebarMenuButton
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          `w-full p-4 text-left transition-colors rounded-md min-h-[80px] relative ${
            theme === 'dark' 
              ? 'hover:bg-gray-800' 
              : 'hover:bg-gray-100'
          }`,
          currentWorkflowData?.name === workflow.name &&
            (theme === 'dark' 
              ? 'bg-cyan-900 border-r-2 border-cyan-400'
              : 'bg-purple-50 border-r-2 border-purple-500')
        )}
      >
        <div className="flex items-start gap-3 w-full pr-8">
          <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-md mt-0.5 flex-shrink-0">
            <WorkflowIcon className="w-4 h-4 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className={`font-medium text-sm leading-tight ${
                theme === 'dark' ? 'text-white' : 'text-gray-900'
              }`}>
                {workflow.name}
              </h3>
              {isNewWorkflow() && (
                <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full text-white ${
                  theme === 'dark' 
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500'
                }`}>
                  NEW
                </span>
              )}
            </div>
            <p className={`text-xs leading-tight mb-2 truncate whitespace-nowrap overflow-hidden ${
              theme === 'dark' ? 'text-gray-300' : 'text-gray-500'
            }`}>
              {workflow.description}
            </p>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${
                theme === 'dark' ? 'text-cyan-400' : 'text-purple-600'
              }`}>
                {workflow.steps?.length ?? 0} steps
              </span>
              {getWorkflowTimestamp() && (
                <span className={`text-xs ${
                  theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Created at {getWorkflowTimestamp()}
                </span>
              )}
            </div>
          </div>
        </div>
        {isHovered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onDeleteWorkflow(workflow.name);
            }}
            className="absolute top-1/2 right-3 transform -translate-y-1/2 p-4 w-7 h-10 hover:bg-red-100 hover:text-red-600"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
