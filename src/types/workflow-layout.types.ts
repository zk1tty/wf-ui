import { z } from 'zod';
import type { Node, BuiltInNode } from '@xyflow/react';

export type PositionLoggerNode = Node<{ label: string }, 'position-logger'>;
export type AppNode = BuiltInNode | PositionLoggerNode;

/* ── Input field definition ────────────────────────────────────────── */
export const inputFieldSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean']),
  required: z.boolean().nullable().optional(), // Backend may send null, undefined, or boolean
  value: z.any().optional(), // Backend may send any value or undefined
});

/* ── Step definition ───────────────────────────────────────────────── */
/**
 * VALIDATION STRATEGY:
 * - Schema matches backend API contract exactly (no transformation)
 * - Backend sends: undefined | null | <type>
 * - Schema accepts: undefined | null | <type> via .nullable().optional()
 * - Only validates data structure, doesn't mutate data
 * - Stateless and predictable
 */
export const stepSchema = z.object({
  /* Core fields - match backend ClickStep/InputStep/etc contracts */
  type: z.enum([
    'navigation',
    'click',
    'select_change',
    'input',
    'agent',
    'key_press',
    'scroll',
    'extract_page_content',
    'clipboard_copy',
    'clipboard_paste',
    'click_to_copy',
    'human-input',  // Human input step - waits for user interaction via Control Channel
    'wait',         // Alias for human-input (backward compatibility)
  ]),
  
  /* Optional fields - backend sends these as optional (can be undefined, null, or value) */
  description: z.string().nullable().optional(),
  output: z.unknown().nullable().optional(),
  timestamp: z.number().int().nullable().optional(),
  tabId: z.number().int().nullable().optional(),
  url: z.string().nullable().optional(),
  cssSelector: z.string().nullable().optional(),
  xpath: z.string().nullable().optional(),
  elementTag: z.string().nullable().optional(),
  elementText: z.string().nullable().optional(),
  selectedText: z.string().nullable().optional(),
  value: z.string().nullable().optional(),
  task: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  timeoutMs: z.number().int().nullable().optional(),
  key: z.string().nullable().optional(), // For key_press steps (e.g., 'Control+C', 'Enter')
});

/* ── Execution Statistics ──────────────────────────────────────────── */
export interface ExecutionStats {
  total_executions: number;
  successful_executions: number;
  failed_executions: number;
  success_rate: number;
  average_execution_time: number | null;
  last_execution_at: string | null;
  visual_streaming_usage_rate: number;
}

/* ── Recent Execution ──────────────────────────────────────────────── */
export interface RecentExecution {
  execution_id: string;
  status: 'completed' | 'failed' | 'running' | 'cancelled';
  execution_time_seconds: number | null;
  visual_streaming_enabled: boolean;
  mode: string;
  created_at: string;
}

/* ── Performance Indicators ────────────────────────────────────────── */
export interface PerformanceMetrics {
  trend: 'improving' | 'declining' | 'stable';
  reliability_score: number;
  avg_execution_time_trend: number;
}

/* ── Enhanced Workflow (with execution data) ───────────────────────── */
export interface EnhancedWorkflow extends Workflow {
  execution_stats?: ExecutionStats;
  recent_executions?: RecentExecution[];
  performance?: PerformanceMetrics;
}

/* ── Active Execution ──────────────────────────────────────────────── */
export interface ActiveExecution {
  execution_id: string;
  workflow_id: string;
  workflow_name: string;
  status: string;
  created_at: string;
}

/* ── Workflow wrapper ──────────────────────────────────────────────── */
export const workflowSchema = z.object({
  workflow_analysis: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  steps: z.array(stepSchema),
  input_schema: z.array(inputFieldSchema),
  owner_id: z.string().uuid().nullable().optional(), // UUID owner or NULL for legacy workflows
  id: z.string().uuid().optional(), // Workflow ID
  created_at: z.string().optional(), // ISO timestamp
  updated_at: z.string().optional(), // ISO timestamp
});

/* ── Inferred TypeScript type ───────────────────────────────────────– */
export type Workflow = z.infer<typeof workflowSchema>;

export interface WorkflowMetadata {
  name: string;
  description: string;
  version: string;
  workflow_analysis: string;
  input_schema: any[];
}
