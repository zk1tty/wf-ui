import React, { useEffect, useState } from 'react';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { workflowSchema, stepSchema } from '@/types/workflow-layout.types';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { SortableStep } from './SortableStep';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';
import { workflowService } from '@/services/workflowService';

type Workflow = z.infer<typeof workflowSchema>;
type Step = z.infer<typeof stepSchema>;

export function WorkflowEditor() {
  const {
    currentWorkflowData,
    updateWorkflowUI,
    setEditorStatus,
    editorStatus,
    activeDialog,
    setActiveDialog,
    setDisplayMode,
  } = useAppContext();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [oldWorkflow, setOldWorkflow] = useState<Workflow | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (currentWorkflowData) {
      const safeWorkflow = workflowSchema.safeParse(currentWorkflowData);
      if (safeWorkflow.success) {
        setWorkflow(safeWorkflow.data);
        setOldWorkflow(safeWorkflow.data);
        setEditorStatus('saved');
      } else console.error('Invalid workflow data', safeWorkflow.error);
    }
  }, [currentWorkflowData, setEditorStatus]);

  // Track changes and update editor status
  useEffect(() => {
    if (workflow && oldWorkflow) {
      const hasChanges =
        JSON.stringify(workflow) !== JSON.stringify(oldWorkflow);
      setEditorStatus(hasChanges ? 'unsaved' : 'saved');
    }
  }, [workflow, oldWorkflow, setEditorStatus]);

  const updateField = (key: keyof Workflow, value: any) => {
    setWorkflow((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const updateStepField = (index: number, key: keyof Step, value: any) => {
    if (!workflow) return;
    const newSteps = [...workflow.steps];
    const updatedStep = { ...newSteps[index], [key]: value } as Step;
    newSteps[index] = updatedStep;
    setWorkflow({ ...workflow, steps: newSteps });
    console.log(`Step at index ${index} updated:`, updatedStep);
  };

  const addStep = () => {
    if (!workflow) return;
    const newStep = stepSchema.parse({
      description: 'New step',
      type: 'click',
      timestamp: null as number | null,
      tabId: null as number | null,
      output: null,
      url: null,
      cssSelector: null,
      xpath: null,
      elementTag: null,
      elementText: null,
      selectedText: null,
      value: null,
      task: null,
    });
    setWorkflow({ ...workflow, steps: [...workflow.steps, newStep] });
  };

  const deleteStep = (index: number) => {
    if (!workflow) return;
    const updated = workflow.steps.filter((_, i) => i !== index);
    setWorkflow({ ...workflow, steps: updated });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!workflow || !over || active.id === over.id) return;

    const oldIndex = workflow.steps.findIndex((_, i) => i === active.id);
    const newIndex = workflow.steps.findIndex((_, i) => i === over.id);

    setWorkflow({
      ...workflow,
      steps: arrayMove(workflow.steps, oldIndex, newIndex),
    });
  };

  const saveChanges = async () => {
    if (!workflow || !oldWorkflow) return;

    const validation = workflowSchema.safeParse(workflow);
    if (!validation.success) {
      const errorMessage = 'Invalid workflow data';
      setSaveError(errorMessage);
      toast.error(saveError, {
        duration: 4000,
        style: { fontSize: '1.25rem', padding: '16px' },
      });
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const newWorkflow = validation.data;
      const updateResponses: any[] = [];
      const deleteResponses: any[] = [];

      // Step updates (shared indices)
      const sharedLength = Math.min(
        oldWorkflow.steps.length,
        newWorkflow.steps.length
      );

      for (let i = 0; i < sharedLength; i++) {
        const oldStep = oldWorkflow.steps[i];
        const newStep = newWorkflow.steps[i];

        if (JSON.stringify(oldStep) !== JSON.stringify(newStep)) {
          const res = await workflowService.updateWorkflow(
            oldWorkflow.name,
            i,
            newStep
          );
          updateResponses.push(res);
        }
      }

      // Step additions
      for (let i = sharedLength; i < newWorkflow.steps.length; i++) {
        const newStep = newWorkflow.steps[i];
        const res = await workflowService.updateWorkflow(
          oldWorkflow.name,
          i,
          newStep
        );
        updateResponses.push(res);
      }

      // Step deletions (from end down to new length)
      for (
        let i = oldWorkflow.steps.length - 1;
        i >= newWorkflow.steps.length;
        i--
      ) {
        const res = await workflowService.deleteStep(oldWorkflow.name, i);
        deleteResponses.push(res);
      }

      // Handle metadata update if needed
      const shouldUpdateMetadata =
        oldWorkflow.name !== newWorkflow.name ||
        oldWorkflow.description !== newWorkflow.description ||
        oldWorkflow.version !== newWorkflow.version ||
        oldWorkflow.workflow_analysis !== newWorkflow.workflow_analysis ||
        JSON.stringify(oldWorkflow.input_schema) !==
          JSON.stringify(newWorkflow.input_schema);

      const metadataResponse = shouldUpdateMetadata
        ? await workflowService.updateWorkflowMetadata(oldWorkflow.name, {
            name: newWorkflow.name,
            description: newWorkflow.description,
            version: newWorkflow.version,
            input_schema: newWorkflow.input_schema,
            workflow_analysis: newWorkflow.workflow_analysis,
          })
        : { success: true };

      // Collect errors
      const allErrors = [
        ...updateResponses
          .filter((r) => !r.success)
          .map((r) => r.error || 'Step update failed'),
        ...deleteResponses
          .filter((r) => !r.success)
          .map((r) => r.error || 'Step delete failed'),
        ...(metadataResponse.success
          ? []
          : [metadataResponse.error || 'Metadata update failed']),
      ];

      if (allErrors.length === 0) {
        // Update UI state
        updateWorkflowUI(oldWorkflow, newWorkflow);
        setOldWorkflow(newWorkflow);
        setEditorStatus('saved');
        toast.success('Changes saved successfully', {
          icon: <CheckCircle2 className="w-4 h-4 text-green-500" />,
          duration: 2000,
          style: { fontSize: '1.25rem', padding: '16px' },
        });
      } else {
        const errorMessage = allErrors.join('\n');
        setSaveError(errorMessage);
        toast.error(saveError, {
          duration: 4000,
          style: { fontSize: '1.25rem', padding: '16px' },
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unexpected error occurred';
      setSaveError(errorMessage);
      toast.error(saveError, {
        duration: 4000,
        style: { fontSize: '1.25rem', padding: '16px' },
      });
    } finally {
      setIsSaving(false);
      setActiveDialog(null);
    }
  };

  const handleDiscardChanges = () => {
    if (oldWorkflow) {
      setWorkflow(oldWorkflow);
      setEditorStatus('saved');
      setDisplayMode('editor');
      setActiveDialog(null);
    }
  };

  const handleCancel = () => {
    setDisplayMode('editor');
    setActiveDialog(null);
  };

  if (!workflow)
    return <div className="p-8 text-gray-500">No workflow loaded</div>;

  return (
    <div className="relative min-h-screen">
      {activeDialog === 'unsavedChanges' && (
        <UnsavedChangesDialog
          onSave={saveChanges}
          onDiscard={handleDiscardChanges}
          onCancel={handleCancel}
          isSaving={isSaving}
        />
      )}
      <div className="p-6 max-w-4xl mx-auto space-y-6 pb-24">
        <div className="space-y-2">
          <h2 className="text-xl font-semibold mb-3">Workflow Details</h2>
          <Label>Workflow Name</Label>
          <Input
            value={workflow.name}
            onChange={(e) => updateField('name', e.target.value)}
          />
          <Label>Description</Label>
          <Textarea
            value={workflow.description}
            onChange={(e) => updateField('description', e.target.value)}
            className="min-h-[100px] resize-y"
          />
          <Label>Analysis</Label>
          <Textarea
            value={workflow.workflow_analysis}
            onChange={(e) => updateField('workflow_analysis', e.target.value)}
            className="min-h-[150px] resize-y"
          />
        </div>

        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Steps</h2>
          <Button onClick={addStep}>
            <Plus className="w-4 h-4 mr-1" />
            Add Step
          </Button>
        </div>

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={workflow.steps.map((_, index) => index)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {workflow.steps.map((step, index) => (
                <SortableStep
                  key={index}
                  step={step}
                  index={index}
                  onDelete={deleteStep}
                  onUpdate={updateStepField}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="fixed bottom-0 left-0 right-0 ml-40 bg-white border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto space-y-2">
          <Button
            className="w-full ml-10 bg-purple-600 text-white disabled:opacity-50"
            onClick={saveChanges}
            disabled={isSaving || editorStatus === 'saved'}
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving Changes...
              </>
            ) : (
              'Confirm Changes'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
