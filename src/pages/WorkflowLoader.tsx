// src/pages/WorkflowLoader.tsx
import { useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { workflowService } from "@/services/workflowService";

/** grabs /workflows/:id or /wf/:id, feeds it into context then shows the rest of the app */
export default function WorkflowLoader() {
  const { id } = useParams();                 // uuid from the URL
  const nav      = useNavigate();
  const location = useLocation();
  const { addWorkflow, selectWorkflow, fetchWorkflows, setWorkflows, setSidebarStatus, setCurrentWorkflowData, setDisplayMode } = useAppContext();

  // Determine if this is a public workflow based on the route
  const isPublicWorkflow = location.pathname.startsWith('/wf/');

  useEffect(() => {
    (async () => {
      try {
        setSidebarStatus('loading');
        
        let wf: any;
        if (isPublicWorkflow) {
          // Load public workflow by ID
          wf = await workflowService.getPublicWorkflowById(id!);
          console.log("Public workflow loaded:", wf.name || wf.id, "steps:", wf.steps?.length);
        } else {
          // Load private workflow by name (existing behavior)
          const res = await workflowService.getWorkflowByName(id!);
          wf = typeof res === "string" ? JSON.parse(res) : res;
          console.log("Private workflow loaded:", wf.name, "steps:", wf.steps?.length);
        }

        if (isPublicWorkflow) {
          // For public workflows, we don't need to fetch all workflows or update the sidebar
          // Just set the current workflow and show it
          setCurrentWorkflowData(wf);
          setDisplayMode('canvas'); // Show the workflow in canvas mode
          console.log("WorkflowLoader: Set currentWorkflowData to public workflow:", wf.name || wf.id);
        } else {
          // For private workflows, maintain existing behavior
          // Fetch all workflows
          const allWorkflows = await workflowService.getWorkflows();
          const parsedWorkflows = allWorkflows.map((wf: any) => JSON.parse(wf));

          // Add the current workflow if it's not already in the list
          const existingWf = parsedWorkflows.find(w => w.name === wf.name);
          console.log("existingWf:", existingWf);
          if (!existingWf) {
            parsedWorkflows.push(wf);
          }

          // Update context with all workflows
          setWorkflows(parsedWorkflows);
          setCurrentWorkflowData(wf);
          setDisplayMode('canvas'); // Show the workflow in canvas mode
          console.log("WorkflowLoader: Set currentWorkflowData to private workflow:", wf.name);
        }

        setSidebarStatus('ready');
        nav("/", { replace: true }); // go to normal UI (canvas/editor)
      } catch (e) {
        console.error("Failed to load workflow", e);
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