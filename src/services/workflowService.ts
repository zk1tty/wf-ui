import { fetchClient, apiFetch } from '../lib/api';
import {
  Workflow,
  WorkflowMetadata,
  inputFieldSchema,
} from '../types/workflow-layout.types';
import { z } from 'zod';

export interface WorkflowService {
  getWorkflows(): Promise<Workflow[]>;
  getWorkflowByName(name: string): Promise<any>;
  getPublicWorkflowById(id: string): Promise<any>;
  uploadWorkflow(recordingData: any): Promise<{ job_id: string }>;
  getUploadStatus(jobId: string): Promise<any>;
  updateWorkflowMetadata(
    name: string,
    metadata: WorkflowMetadata
  ): Promise<void>;
  executeWorkflow(
    name: string,
    inputFields: z.infer<typeof inputFieldSchema>[]
  ): Promise<{
    task_id: string;
    log_position: number;
  }>;
  getWorkflowCategory(timestamp: number): string;
  addWorkflow(name: string, content: string): Promise<void>;
  deleteWorkflow(name: string): Promise<void>;
  buildWorkflow(name: string, prompt: string, workflow: any): Promise<any>;
  recordWorkflow(): Promise<any>;
  stopRecording(): Promise<any>;
  fetchWorkflowLogs(taskId: string, position: number): Promise<any>;
  cancelWorkflow(taskId: string): Promise<any>;
  deleteStep(
    workflowName: string,
    stepIndex: number
  ): Promise<{ success: boolean; error?: string }>;
}

class WorkflowServiceImpl implements WorkflowService {
  async getWorkflows(): Promise<Workflow[]> {
    const response = await fetchClient.GET('/api/workflows');

    const workflowNames = response.data?.workflows ?? [];

    // Fetch full workflow data for each workflow name
    const workflows = await Promise.all(
      workflowNames.map((name) => this.getWorkflowByName(name))
    );

    return workflows;
  }

  async getWorkflowByName(name: string): Promise<any> {
    const res = await fetchClient.GET('/api/workflows/{name}', {
      params: { path: { name } },
    });

    /** ------------------------------------------------------------------
     *  <openapi-fetch> puts the parsed JSON under `.data` in production
     *  bundles, but under `.body` when the client is built in dev / mock
     *  mode.  Accept either so the caller doesn't have to care.
     *  ------------------------------------------------------------------ */
    const data = (res as any).data ?? (res as any).body ?? null;

    if (!data) {
      console.error('[workflowService] 🛑 unexpected response shape', res);
      throw new Error('Failed to return data from server');
    }

    return data;
  }

  async getPublicWorkflowById(id: string): Promise<any> {
    try {
      // Since there's no direct /workflows/{id} endpoint, we need to:
      // 1. Fetch all public workflows from /workflows/
      // 2. Find the one with matching ID
      console.log('[workflowService] Fetching all public workflows to find ID:', id);
      
      const allWorkflows = await apiFetch<any[]>('/workflows/', { auth: false });
      console.log('[workflowService] All public workflows:', allWorkflows);
      
      if (!Array.isArray(allWorkflows)) {
        throw new Error('Invalid response format: expected array of workflows');
      }
      
      // Find the workflow with matching ID
      const targetWorkflow = allWorkflows.find((wf: any) => {
        // The workflow might have the ID in different places
        const workflowData = wf.json || wf;
        return wf.id === id || workflowData.id === id || 
               wf.name === id || workflowData.name === id;
      });
      
      if (!targetWorkflow) {
        throw new Error(`Workflow with ID "${id}" not found`);
      }
      
      console.log('[workflowService] Found target workflow:', targetWorkflow);
      
      // Extract the actual workflow data from the nested structure
      const workflow = targetWorkflow.json || targetWorkflow;
      
      if (!workflow) {
        throw new Error('No workflow data found in response');
      }
      
      // Normalize the workflow data to match our Zod schema expectations
      const normalizedWorkflow = {
        ...workflow,
        steps: workflow.steps?.map((step: any) => ({
          // Ensure all required fields are present with proper defaults
          description: step.description ?? null,
          output: step.output ?? null,
          timestamp: step.timestamp ?? null,
          tabId: step.tabId ?? null,
          type: step.type,
          // Optional fields - only include if they exist
          ...(step.url !== undefined && { url: step.url }),
          ...(step.cssSelector !== undefined && { cssSelector: step.cssSelector }),
          ...(step.xpath !== undefined && { xpath: step.xpath }),
          ...(step.elementTag !== undefined && { elementTag: step.elementTag }),
          ...(step.elementText !== undefined && { elementText: step.elementText }),
          ...(step.selectedText !== undefined && { selectedText: step.selectedText }),
          ...(step.value !== undefined && { value: step.value }),
          ...(step.task !== undefined && { task: step.task }),
        })) || []
      };
      
      console.log('[workflowService] Normalized workflow data:', normalizedWorkflow);
      
      return normalizedWorkflow;
    } catch (error) {
      console.error('[workflowService] Failed to fetch public workflow:', error);
      throw new Error('Failed to load public workflow');
    }
  }

  async uploadWorkflow(recordingData: any): Promise<{ job_id: string }> {
    try {
      const response = await apiFetch<{ job_id: string }>('/workflows/upload', {
        method: 'POST',
        body: JSON.stringify(recordingData),
        auth: false
      });
      
      console.log('[workflowService] Upload response:', response);
      return response;
    } catch (error) {
      console.error('[workflowService] Failed to upload workflow:', error);
      throw new Error('Failed to upload workflow');
    }
  }

  async getUploadStatus(jobId: string): Promise<any> {
    try {
      const status = await apiFetch<any>(`/workflows/upload/${jobId}/status`, { auth: false });
      console.log('[workflowService] Upload status:', status);
      return status;
    } catch (error) {
      console.error('[workflowService] Failed to get upload status:', error);
      throw new Error('Failed to get upload status');
    }
  }

  async updateWorkflowMetadata(
    name: string,
    metadata: WorkflowMetadata
  ): Promise<any> {
    const response = await fetchClient.POST('/api/workflows/update-metadata', {
      body: { name, metadata: metadata as any },
    });
    console.log('Response from updateWorkflowMetadata:', response);
    if (!response.data) {
      throw new Error('Failed to return data from server');
    }
    
    const data = response.data;
    if (!data.success) {
      throw new Error(data.error || 'Failed to update workflow metadata');
    }
    
    return data;
  }

  async updateWorkflow(
    filename: string,
    nodeId: number,
    stepData: any
  ): Promise<any> {
    const response = await fetchClient.POST('/api/workflows/update', {
      body: { filename, nodeId, stepData },
    });
    console.log('Response from updateWorkflow:', response);
    if (!response.data) {
      throw new Error('Failed to return data from server');
    }
    
    const data = response.data;
    if (!data.success) {
      throw new Error(data.error || 'Failed to update workflow');
    }
    
    return data;
  }

  async deleteStep(workflowName: string, stepIndex: number): Promise<any> {
    const response = await fetchClient.POST('/api/workflows/delete-step', {
      body: { workflowName, stepIndex },
    });
    console.log('Response from deleteStep:', response);
    if (!response.data) {
      throw new Error('Failed to return data from server');
    }
    
    const data = response.data;
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete step');
    }
    
    return data;
  }

  async executeWorkflow(
    name: string,
    inputFields: z.infer<typeof inputFieldSchema>[]
  ): Promise<{
    task_id: string;
    log_position: number;
    message: string;
  }> {
    const inputs: any = {};
    inputFields.forEach((field) => {
      inputs[field.name] = field.value;
    });

    const response = await fetchClient.POST('/api/workflows/execute', {
      body: { name, inputs },
    });
    if (!response.data) {
      throw new Error('Failed to return data from server');
    }

    return response.data;
  }

  async recordWorkflow(): Promise<any> {
    const response = await fetchClient.POST('/api/workflows/record', {
      body: undefined,
    });
    if (!response.data) {
      throw new Error('Failed to return data from server');
    }
    
    const data = response.data;
    if (!data.success) {
      throw new Error(data.error || 'Failed to record workflow');
    }
    
    return data;
  }

  async stopRecording(): Promise<any> {
    const response = await fetchClient.POST('/api/workflows/cancel-recording', {
      body: undefined,
    });
    if (!response.data) {
      throw new Error('Failed to return data from server');
    }
    
    const data = response.data;
    if (!data.success) {
      throw new Error(data.error || 'Failed to stop recording');
    }
    
    return data;
  }

  async buildWorkflow(
    name: string,
    prompt: string,
    workflow: any
  ): Promise<any> {
    const response = await fetchClient.POST(
      '/api/workflows/build-from-recording',
      {
        body: { name, prompt, workflow },
      }
    );
    
    // Handle HTTP errors (like 422 validation errors)
    if (!response.response.ok) {
      const status = response.response.status;
      const statusText = response.response.statusText;
      throw new Error(`Request failed with ${status} ${statusText}. Please check your workflow data.`);
    }
    
    if (!response.data) {
      throw new Error('Failed to return data from server');
    }
    
    const data = response.data;
    if (!data.success) {
      throw new Error(data.error || data.message || 'Failed to build workflow');
    }
    
    return data;
  }

  async addWorkflow(name: string, content: string): Promise<void> {
    const response = await fetchClient.POST('/api/workflows/add', {
      body: { name, content },
    });

    if (!response.data) {
      throw new Error('Failed to add workflow');
    }

    const data = response.data;
    if (!data.success) {
      throw new Error(data.error || 'Failed to add workflow');
    }
  }

  async deleteWorkflow(name: string): Promise<void> {
    const response = await fetchClient.DELETE('/api/workflows/{name}', {
      params: { path: { name } },
    });

    if (!response.data) {
      throw new Error('Failed to delete workflow');
    }

    const data = response.data;
    if (!data.success) {
      throw new Error(data.error || 'Failed to delete workflow');
    }
  }

  async fetchWorkflowLogs(taskId: string, position: number) {
    const response = await fetchClient.GET('/api/workflows/logs/{task_id}', {
      params: { path: { task_id: taskId }, query: { position } },
    });

    if (!response.data) {
      throw new Error('Failed to return data from server');
    }

    return response.data;
  }

  async cancelWorkflow(taskId: string) {
    const response = await fetchClient.POST(
      '/api/workflows/tasks/{task_id}/cancel',
      {
        params: { path: { task_id: taskId } },
      }
    );

    if (!response.data) {
      throw new Error('Failed to return data from server');
    }

    const data = response.data;
    if (!data?.success) {
      throw new Error(data.message || 'Failed to cancel workflow');
    }

    return data;
  }

  getWorkflowCategory(timestamp: number): string {
    const now = new Date();
    const lastRun = new Date(timestamp);

    const diff = now.getTime() - lastRun.getTime();
    const diffInDays = diff / (1000 * 60 * 60 * 24);

    if (diffInDays < 1 && lastRun.getDate() === now.getDate()) return 'today';
    if (diffInDays < 2) return 'yesterday';
    if (diffInDays < 7) return 'last-week';
    if (diffInDays < 30) return 'last-month';
    return 'older';
  }
}

export const workflowService = new WorkflowServiceImpl();
