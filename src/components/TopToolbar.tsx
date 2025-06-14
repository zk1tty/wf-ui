import { Play, Settings, Edit3, Blocks, SidebarOpen, Terminal, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAppContext } from '@/contexts/AppContext';
import { useEffect } from 'react';

export function TopToolbar() {
  const {
    setDisplayMode,
    displayMode,
    currentWorkflowData,
    setActiveDialog,
    checkForUnsavedChanges,
    workflowStatus,
  } = useAppContext();

  // Debug log to see if currentWorkflowData is updating
  console.log("TopToolbar: currentWorkflowData:", currentWorkflowData?.name || "null");

  // Track changes to currentWorkflowData
  useEffect(() => {
    console.log("TopToolbar: currentWorkflowData changed to:", currentWorkflowData?.name || "null");
  }, [currentWorkflowData]);

  const handleRunWithInputs = () => {
    if (checkForUnsavedChanges()) {
      return;
    }
    console.log('Running workflow with inputs:', currentWorkflowData?.name);
    setActiveDialog('run');
  };

  const handleRunAsTool = () => {
    if (checkForUnsavedChanges()) {
      return;
    }
    console.log('Running workflow as tool:', currentWorkflowData?.name);
    setActiveDialog('runAsTool');
  };

  const handleToggleMode = () => {
    if (displayMode === 'canvas') {
      console.log('Editing workflow:', currentWorkflowData?.name);
      setDisplayMode('editor');
    } else {
      console.log('Switching to canvas:', currentWorkflowData?.name);
      setDisplayMode('canvas');
    }
  };

  const handleNavigateToGallery = () => {
    if (checkForUnsavedChanges()) {
      return;
    }
    console.log('Navigating to gallery');
    setDisplayMode('start');
  };

  return (
    <div className="border-b border-gray-200 bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="p-2">
            <SidebarOpen className="w-4 h-4" />
          </SidebarTrigger>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleNavigateToGallery}
            className="flex items-center gap-2 text-purple-600 hover:text-purple-700 hover:bg-purple-50"
            title="Back to Gallery"
          >
            <Palette className="w-5 h-5" />
            <span className="hidden sm:inline">Gallery</span>
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={handleRunWithInputs}
            disabled={!currentWorkflowData || workflowStatus === 'running'}
            className="flex items-center gap-2 text-base px-6 py-3"
          >
            <Play className="w-5 h-5" />
            Run with Inputs
          </Button>

          <Button
            variant="outline"
            size="lg"
            onClick={handleRunAsTool}
            disabled={!currentWorkflowData || workflowStatus === 'running'}
            className="flex items-center gap-2 text-base px-6 py-3"
          >
            <Settings className="w-5 h-5" />
            Run as Tool
          </Button>

          <Button
            variant="default"
            size="lg"
            onClick={handleToggleMode}
            disabled={!currentWorkflowData}
            className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-base px-6 py-3"
          >
            {displayMode === 'editor' 
              ? <>
                  <Blocks className="w-5 h-5" />
                  Canvas
                </>
              : <>
                  <Edit3 className="w-5 h-5" />
                  Edit
                </>}
          </Button>
        </div>
      </div>
    </div>
  );
}
