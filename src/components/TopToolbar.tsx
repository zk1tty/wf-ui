import { Play, Settings, Edit3, Blocks, SidebarOpen, Terminal, Palette, LogIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { useAppContext } from '@/contexts/AppContext';
import { useEffect, useState } from 'react';
import { hasValidSessionToken, canEditWorkflow } from '@/utils/authUtils';
import SessionLoginModal from '@/components/SessionLoginModal';
import SessionStatus from '@/components/SessionStatus';

export function TopToolbar() {
  const {
    setDisplayMode,
    displayMode,
    currentWorkflowData,
    setActiveDialog,
    checkForUnsavedChanges,
    workflowStatus,
    currentUserSessionToken,
    isCurrentUserOwner,
    isCurrentWorkflowPublic
  } = useAppContext();
  
  const [showLoginModal, setShowLoginModal] = useState(false);
  
  const hasSessionToken = hasValidSessionToken(currentUserSessionToken);
  const isLegacyWorkflow = currentWorkflowData?.owner_id === null;
  const canEdit = canEditWorkflow(
    currentUserSessionToken, 
    isCurrentUserOwner, 
    isCurrentWorkflowPublic, 
    isLegacyWorkflow
  );
  const canExecute = hasSessionToken || isCurrentWorkflowPublic;

  // Debug log to see if currentWorkflowData is updating
  console.log("TopToolbar: currentWorkflowData:", currentWorkflowData?.name || "null");

  // Track changes to currentWorkflowData
  useEffect(() => {
    console.log("TopToolbar: currentWorkflowData changed to:", currentWorkflowData?.name || "null");
  }, [currentWorkflowData]);

  const handleRunWithInputs = () => {
    if (!canExecute) {
      setShowLoginModal(true);
      return;
    }
    if (checkForUnsavedChanges()) {
      return;
    }
    console.log('Running workflow with inputs:', currentWorkflowData?.name);
    setActiveDialog('run');
  };

  const handleRunAsTool = () => {
    if (!canExecute) {
      setShowLoginModal(true);
      return;
    }
    if (checkForUnsavedChanges()) {
      return;
    }
    console.log('Running workflow as tool:', currentWorkflowData?.name);
    setActiveDialog('runAsTool');
  };

  const handleToggleMode = () => {
    if (displayMode === 'canvas' && !canEdit) {
      setShowLoginModal(true);
      return;
    }
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
    <>
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

            {/* Session Status in Toolbar */}
            <SessionStatus compact={true} />
          </div>

          <div className="flex items-center gap-3">
            {!hasSessionToken && (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-base px-6 py-3"
              >
                <LogIn className="w-5 h-5" />
                Login
              </Button>
            )}

            <Button
              variant="outline"
              size="lg"
              onClick={handleRunWithInputs}
              disabled={!currentWorkflowData || workflowStatus === 'running' || !canExecute}
              className="flex items-center gap-2 text-base px-6 py-3 disabled:opacity-50"
              title={!canExecute ? 'Login required to execute workflows' : ''}
            >
              <Play className="w-5 h-5" />
              {!canExecute ? 'Login to Run' : 'Run with Inputs'}
            </Button>

            <Button
              variant="outline"
              size="lg"
              onClick={handleRunAsTool}
              disabled={!currentWorkflowData || workflowStatus === 'running' || !canExecute}
              className="flex items-center gap-2 text-base px-6 py-3 disabled:opacity-50"
              title={!canExecute ? 'Login required to execute workflows' : ''}
            >
              <Settings className="w-5 h-5" />
              {!canExecute ? 'Login to Run' : 'Run as Tool'}
            </Button>

            <Button
              variant="default"
              size="lg"
              onClick={handleToggleMode}
              disabled={!currentWorkflowData || (displayMode === 'canvas' && !canEdit)}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-base px-6 py-3 disabled:opacity-50"
              title={displayMode === 'canvas' && !canEdit ? 'Login required to edit workflows' : ''}
            >
              {displayMode === 'editor' 
                ? <>
                    <Blocks className="w-5 h-5" />
                    Canvas
                  </>
                : <>
                    <Edit3 className="w-5 h-5" />
                    {!canEdit ? 'Login to Edit' : 'Edit'}
                  </>}
            </Button>
          </div>
        </div>
      </div>
      
      {/* Session Login Modal */}
      <SessionLoginModal 
        open={showLoginModal} 
        onOpenChange={setShowLoginModal} 
      />
    </>
  );
}
