// src/pages/WorkflowLoader.tsx
import { useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { workflowService } from "@/services/workflowService";
import { checkWorkflowOwnership, getStoredSessionToken, isFromExtension, hasValidSessionToken } from "@/utils/authUtils";

/** grabs /workflows/:id or /wf/:id, feeds it into context then shows the rest of the app */
export default function WorkflowLoader() {
  const { id } = useParams();                 // uuid from the URL
  const nav      = useNavigate();
  const location = useLocation();
  const { 
    addWorkflow, 
    selectWorkflow, 
    fetchWorkflows, 
    setWorkflows, 
    setSidebarStatus, 
    setCurrentWorkflowData, 
    setDisplayMode,
    setCurrentUserSessionToken,
    setIsCurrentUserOwner
  } = useAppContext();

  // Determine if this is a public workflow based on the route
  const isPublicWorkflow = location.pathname.startsWith('/wf/');

  useEffect(() => {
    (async () => {
      try {
        setSidebarStatus('loading');
        
        // Check for session token and authentication state
        const sessionToken = getStoredSessionToken();
        const fromExt = isFromExtension();
        
        if (hasValidSessionToken(sessionToken)) {
          setCurrentUserSessionToken(sessionToken);
        } else {
          setCurrentUserSessionToken(null);
        }
        
        let wf: any;
        if (isPublicWorkflow) {
          // Load public workflow by ID
          wf = await workflowService.getPublicWorkflowById(id!);
          console.log("📄 [WorkflowLoader] Public workflow loaded:", wf.name || wf.id, "steps:", wf.steps?.length);
          console.log("📄 [WorkflowLoader] Workflow data:", { id: wf.id, owner_id: wf.owner_id, name: wf.name });
          
          // Check ownership for public workflow
          if (hasValidSessionToken(sessionToken) && wf.id) {
            try {
              const isOwner = await checkWorkflowOwnership(sessionToken!, wf.id);
              setIsCurrentUserOwner(isOwner);
            } catch (error) {
              console.error('❌ [WorkflowLoader] Ownership check failed:', error);
              setIsCurrentUserOwner(false);
            }
          } else {
            setIsCurrentUserOwner(false);
          }
          
          setCurrentWorkflowData(wf, true); // Mark as public
          setDisplayMode('canvas');
          console.log("📄 [WorkflowLoader] Set currentWorkflowData to public workflow:", wf.name || wf.id);
        } else {
          // Load private workflow by name (existing behavior)
          const res = await workflowService.getWorkflowByName(id!);
          wf = typeof res === "string" ? JSON.parse(res) : res;
          console.log("📄 [WorkflowLoader] Private workflow loaded:", wf.name, "steps:", wf.steps?.length);
          
          // For private workflows, assume ownership if session token exists
          // (Private workflows are typically accessed by their owners)
          if (hasValidSessionToken(sessionToken)) {
            setIsCurrentUserOwner(true);
          } else {
            setIsCurrentUserOwner(false);
          }
          
          // Fetch all workflows (existing behavior)
          const allWorkflows = await workflowService.getWorkflows();
          const parsedWorkflows = allWorkflows.map((wf: any) => {
            const workflow = typeof wf === "string" ? JSON.parse(wf) : wf;
            // Convert to enhanced workflow format
            return {
              ...workflow,
              execution_stats: undefined,
              recent_executions: undefined,
              performance: undefined
            };
          });

          // Add the current workflow if it's not already in the list
          const existingWf = parsedWorkflows.find(w => w.name === wf.name);
          console.log("📄 [WorkflowLoader] existingWf:", existingWf);
          if (!existingWf) {
            parsedWorkflows.push({
              ...wf,
              execution_stats: undefined,
              recent_executions: undefined,
              performance: undefined
            });
          }

          // Update context with all workflows
          setWorkflows(parsedWorkflows);
          setCurrentWorkflowData(wf, false); // Mark as private
          setDisplayMode('canvas');
          console.log("📄 [WorkflowLoader] Set currentWorkflowData to private workflow:", wf.name);
        }

        setSidebarStatus('ready');
        nav("/", { replace: true }); // go to normal UI (canvas/editor)
      } catch (e) {
        console.error("❌ [WorkflowLoader] Failed to load workflow", e);
        setSidebarStatus('error');
        nav("/404", { replace: true });
      }
    })();
  }, [id, isPublicWorkflow]);

  return (
    <div className="p-10 text-gray-500">
      Loading {isPublicWorkflow ? 'public' : 'private'} workflow…
    </div>
  );
}