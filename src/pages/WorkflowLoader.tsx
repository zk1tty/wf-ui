// src/pages/WorkflowLoader.tsx
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAppContext } from "@/contexts/AppContext";
import { workflowService } from "@/services/workflowService";

/** grabs /workflows/:id, feeds it into context then shows the rest of the app */
export default function WorkflowLoader() {
  const { id } = useParams();                 // uuid from the URL
  const nav      = useNavigate();
  const { addWorkflow, selectWorkflow, fetchWorkflows, setWorkflows, setSidebarStatus, setCurrentWorkflowData, setDisplayMode } = useAppContext();

  useEffect(() => {
    (async () => {
      try {
        setSidebarStatus('loading');
        const res =
          await workflowService.getWorkflowByName(id!);
        const wf = typeof res === "string" ? JSON.parse(res) : res;
        console.log("wf.name, steps, steps.length:", wf.name, wf.steps, wf.steps.length);

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
        console.log("WorkflowLoader: Set currentWorkflowData to:", wf.name);

        setSidebarStatus('ready');
        nav("/", { replace: true }); // go to normal UI (canvas/editor)
      } catch (e) {
        console.error("Failed to load workflow", e);
        setSidebarStatus('error');
        nav("/404", { replace: true });
      }
    })();
  }, [id]);

  return <div className="p-10 text-gray-500">Loading workflow…</div>;
}