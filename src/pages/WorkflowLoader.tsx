// src/pages/WorkflowLoader.tsx
import { useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { workflowService } from "@/services/workflowService";
import { checkWorkflowOwnership, getStoredJWT, isFromExtension, isJWTLikelyExpired } from "@/utils/authUtils";

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
    setCurrentUserJWT,
    setIsCurrentUserOwner
  } = useAppContext();

  // Determine if this is a public workflow based on the route
  const isPublicWorkflow = location.pathname.startsWith('/wf/');

  useEffect(() => {
    (async () => {
      try {
        setSidebarStatus('loading');
        
        // 🔐 Check for JWT and authentication state
        const jwt = getStoredJWT();
        const fromExt = isFromExtension();
        
        console.log('🔐 [WorkflowLoader] Auth check:', { 
          hasJWT: !!jwt, 
          fromExtension: fromExt,
          isExpired: jwt ? isJWTLikelyExpired(jwt) : null
        });
        
        if (jwt && !isJWTLikelyExpired(jwt)) {
          setCurrentUserJWT(jwt);
          console.log('🔐 [WorkflowLoader] Valid JWT found');
        } else if (jwt) {
          console.warn('🔐 [WorkflowLoader] JWT appears expired');
          setCurrentUserJWT(null);
        }
        
        let wf: any;
        if (isPublicWorkflow) {
          // Load public workflow by ID
          wf = await workflowService.getPublicWorkflowById(id!);
          console.log("📄 [WorkflowLoader] Public workflow loaded:", wf.name || wf.id, "steps:", wf.steps?.length);
          
          // Check ownership for public workflow
          if (jwt && !isJWTLikelyExpired(jwt) && wf.id) {
            try {
              const isOwner = await checkWorkflowOwnership(jwt, wf.id);
              setIsCurrentUserOwner(isOwner);
              console.log('🔐 [WorkflowLoader] Ownership check result:', isOwner);
            } catch (error) {
              console.error('🔐 [WorkflowLoader] Ownership check failed:', error);
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
          
          // For private workflows, assume ownership if JWT exists
          // (Private workflows are typically accessed by their owners)
          if (jwt && !isJWTLikelyExpired(jwt)) {
            setIsCurrentUserOwner(true);
            console.log('🔐 [WorkflowLoader] Assuming ownership for private workflow');
          } else {
            setIsCurrentUserOwner(false);
          }
          
          // Fetch all workflows (existing behavior)
          const allWorkflows = await workflowService.getWorkflows();
          const parsedWorkflows = allWorkflows.map((wf: any) => JSON.parse(wf));

          // Add the current workflow if it's not already in the list
          const existingWf = parsedWorkflows.find(w => w.name === wf.name);
          console.log("📄 [WorkflowLoader] existingWf:", existingWf);
          if (!existingWf) {
            parsedWorkflows.push(wf);
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