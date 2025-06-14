import { workflowService } from '@/services/workflowService';

/**
 * Upload workflow recording data and navigate to processing page
 * This function is designed to be called from the Chrome extension
 */
export async function uploadAndNavigateToProcessing(recordingData: any): Promise<string> {
  try {
    // Upload the recording data
    const { job_id } = await workflowService.uploadWorkflow(recordingData);
    
    // Navigate to the processing page
    const processingUrl = `/wf/processing/${job_id}`;
    
    // If running in extension context, open new tab
    if (typeof (globalThis as any).chrome !== 'undefined' && (globalThis as any).chrome.tabs) {
      await (globalThis as any).chrome.tabs.create({
        url: `${window.location.origin}${processingUrl}`,
        active: true
      });
    } else {
      // If running in web context, navigate directly
      window.location.href = processingUrl;
    }
    
    return job_id;
  } catch (error) {
    console.error('Failed to upload and navigate:', error);
    throw error;
  }
}

/**
 * Direct upload function for use in web context
 * Returns the job_id for manual navigation
 */
export async function uploadWorkflowRecording(recordingData: any): Promise<string> {
  const { job_id } = await workflowService.uploadWorkflow(recordingData);
  return job_id;
}

/**
 * Navigate to processing page with job_id
 */
export function navigateToProcessing(jobId: string): void {
  window.location.href = `/wf/processing/${jobId}`;
}

/**
 * Navigate to final workflow page
 */
export function navigateToWorkflow(workflowId: string): void {
  window.location.href = `/wf/${workflowId}`;
} 