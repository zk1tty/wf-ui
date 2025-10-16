import { useState, useEffect, useRef } from 'react';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { X, Save, GripVertical, Trash2 } from 'lucide-react';
import { stepSchema } from '@/types/workflow-layout.types';
import { useTheme } from '@/contexts/ThemeContext';
import './StepSettingCard.css';

type Step = z.infer<typeof stepSchema>;
type StepType = z.infer<typeof stepSchema>['type'];

// Get the step types used in the dropdowns from the schema
const stepTypes = stepSchema.shape.type.options as StepType[];

interface StepSettingCardProps {
  step: Step;
  stepIndex: number;
  onSave: (stepIndex: number, updatedStep: Step) => void;
  onDelete?: (stepIndex: number) => void;
  onClose: () => void;
  disabled?: boolean;
  positionMode?: 'right' | 'left';
  compact?: boolean;
}

export function StepSettingCard({
  step,
  stepIndex,
  onSave,
  onDelete,
  onClose,
  disabled = false,
  positionMode = 'right',
  compact = false,
}: StepSettingCardProps) {
  const { theme } = useTheme();
  const [editedStep, setEditedStep] = useState<Step>(step);
  const [hasChanges, setHasChanges] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Update editedStep when step prop changes (when selecting different steps)
  useEffect(() => {
    setEditedStep(step);
    setHasChanges(false);
  }, [step]);

  const updateStepField = (key: keyof Step, value: any) => {
    const updated = { ...editedStep, [key]: value };
    setEditedStep(updated);
    setHasChanges(JSON.stringify(updated) !== JSON.stringify(step));
  };

  const handleSave = () => {
    onSave(stepIndex, editedStep);
    setHasChanges(false);
    onClose();
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(stepIndex);
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      // Reset to original values
      setEditedStep(step);
      setHasChanges(false);
    }
    onClose();
  };

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging && cardRef.current) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      // Constrain to viewport
      const maxX = window.innerWidth - cardRef.current.offsetWidth;
      const maxY = window.innerHeight - cardRef.current.offsetHeight;
      
      const constrainedX = Math.max(0, Math.min(newX, maxX));
      const constrainedY = Math.max(0, Math.min(newY, maxY));
      
      cardRef.current.style.position = 'fixed';
      cardRef.current.style.left = `${constrainedX}px`;
      cardRef.current.style.top = `${constrainedY}px`;
      cardRef.current.style.zIndex = '10'; // Lower z-index to stay below panels
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Add global event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // Function to determine which attributes to show based on step type
  const getRelevantAttributes = (stepType: string) => {
    const attributes = {
      description: true, // Always show description
      output: false,
      url: false,
      cssSelector: false,
      xpath: false,
      elementTag: false,
      elementText: false,
      selectedText: false,
      task: false,
      value: false,
      key: false,
      content: false,
      timeoutMs: true, // Always show timeout as it's generally useful
    };

    switch (stepType) {
      case 'navigation':
        attributes.output = true;
        attributes.url = true;
        break;
      
      case 'click':
      case 'click_to_copy':
        attributes.cssSelector = true;
        attributes.xpath = true;
        attributes.elementTag = true;
        attributes.elementText = true;
        attributes.output = true;
        break;
      
      case 'input':
        attributes.cssSelector = true;
        attributes.xpath = true;
        attributes.elementTag = true;
        attributes.value = true;
        attributes.output = true;
        break;
      
      case 'select_change':
        attributes.cssSelector = true;
        attributes.xpath = true;
        attributes.elementTag = true;
        attributes.value = true;
        attributes.output = true;
        break;
      
      case 'key_press':
        attributes.key = true;
        attributes.output = true;
        break;
      
      case 'clipboard_copy':
        attributes.cssSelector = true;
        attributes.xpath = true;
        attributes.elementTag = true;
        attributes.selectedText = true;
        attributes.output = true;
        break;
      
      case 'clipboard_paste':
        attributes.cssSelector = true;
        attributes.xpath = true;
        attributes.elementTag = true;
        attributes.content = true;
        attributes.output = true;
        break;
      
      case 'scroll':
        attributes.cssSelector = true;
        attributes.xpath = true;
        attributes.output = true;
        break;
      
      case 'extract_page_content':
        attributes.cssSelector = true;
        attributes.xpath = true;
        attributes.output = true;
        break;
      
      case 'agent':
        attributes.task = true;
        attributes.output = true;
        break;
      
      case 'wait':
      case 'human-input':
        // Minimal attributes for wait steps
        attributes.output = true;
        break;
      
      default:
        // For unknown types, show all attributes
        Object.keys(attributes).forEach(key => {
          attributes[key as keyof typeof attributes] = true;
        });
    }

    return attributes;
  };

  const relevantAttributes = getRelevantAttributes(editedStep.type);

  return (
    <Card 
      ref={cardRef}
      className={`step-setting-card ${
        compact 
          ? 'w-[384px] max-h-[480px]' 
          : 'w-[336px] h-[554px]'
      } overflow-y-auto relative ${
        theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-white border-gray-200'
      } shadow-lg ${isDragging ? 'cursor-grabbing dragging' : ''} ${
        compact ? 'step-setting-card-compact' : ''
      }`}
    >
      <CardHeader className="pb-2 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!compact && (
              <div 
                className="drag-handle cursor-move p-1 hover:bg-gray-700 rounded"
                onMouseDown={handleMouseDown}
              >
                <GripVertical className="w-4 h-4 text-gray-400" />
              </div>
            )}
            {positionMode === 'left' && (
              <div className="text-xs text-gray-500 italic">
                Repositioned to fit view
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="p-1 h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            theme === 'dark' 
              ? 'bg-gray-700 text-gray-300' 
              : 'bg-gray-100 text-gray-600'
          }`}>
            Step {stepIndex + 1}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
            theme === 'dark'
              ? 'bg-purple-800 text-purple-200'
              : 'bg-purple-100 text-purple-700'
          }`}>
            {editedStep.type}
          </span>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3 px-4">
        {/* Type Selection */}
        <div className="space-y-1">
          <Label className={`text-sm font-medium ${
            theme === 'dark' ? 'text-white' : 'text-gray-700'
          }`}>
            Type
          </Label>
          <Select
            value={editedStep.type}
            onValueChange={(value) => updateStepField('type', value)}
            disabled={disabled}
          >
            <SelectTrigger className={theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {stepTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div className="space-y-1">
          <Label className={`text-sm font-medium ${
            theme === 'dark' ? 'text-white' : 'text-gray-700'
          }`}>
            Description
          </Label>
          <Textarea
            value={editedStep.description ?? ''}
            onChange={(e) => updateStepField('description', e.target.value)}
            placeholder="Describe what this step does..."
            className={`min-h-[60px] resize-none ${
              theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''
            }`}
            disabled={disabled}
          />
        </div>

        {/* Output */}
        {relevantAttributes.output && (
          <div className="space-y-1">
            <Label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-700'
            }`}>
              Output
            </Label>
            <Input
              value={String(editedStep.output ?? '')}
              onChange={(e) => updateStepField('output', e.target.value)}
              placeholder="Expected output or result"
              className={theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''}
              disabled={disabled}
            />
          </div>
        )}

        {/* URL (for navigation steps) */}
        {relevantAttributes.url && (
          <div className="space-y-1">
            <Label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-700'
            }`}>
              URL
            </Label>
            <Input
              value={editedStep.url ?? ''}
              onChange={(e) => updateStepField('url', e.target.value)}
              placeholder="https://example.com"
              className={theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''}
              disabled={disabled}
            />
          </div>
        )}

        {/* CSS Selector */}
        {relevantAttributes.cssSelector && (
          <div className="space-y-1">
            <Label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-700'
            }`}>
              CssSelector
            </Label>
            <Input
              value={editedStep.cssSelector ?? ''}
              onChange={(e) => updateStepField('cssSelector', e.target.value)}
              placeholder="e.g., div.goog-inline-block.grid4-inner-container"
              className={theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''}
              disabled={disabled}
            />
          </div>
        )}

        {/* XPath */}
        {relevantAttributes.xpath && (
          <div className="space-y-1">
            <Label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-700'
            }`}>
              Xpath
            </Label>
            <Input
              value={editedStep.xpath ?? ''}
              onChange={(e) => updateStepField('xpath', e.target.value)}
              placeholder="e.g., //div[@class='container']"
              className={theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''}
              disabled={disabled}
            />
          </div>
        )}

        {/* Element Tag */}
        {relevantAttributes.elementTag && (
          <div className="space-y-1">
            <Label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-700'
            }`}>
              ElementTag
            </Label>
            <Input
              value={editedStep.elementTag ?? ''}
              onChange={(e) => updateStepField('elementTag', e.target.value)}
              placeholder="e.g., DIV, BUTTON, INPUT"
              className={theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''}
              disabled={disabled}
            />
          </div>
        )}

        {/* Element Text */}
        {relevantAttributes.elementText && (
          <div className="space-y-1">
            <Label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-700'
            }`}>
              ElementText
            </Label>
            <Input
              value={editedStep.elementText ?? ''}
              onChange={(e) => updateStepField('elementText', e.target.value)}
              placeholder="Text content of the element"
              className={theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''}
              disabled={disabled}
            />
          </div>
        )}

        {/* Selected Text (for clipboard_copy) */}
        {relevantAttributes.selectedText && (
          <div className="space-y-1">
            <Label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-700'
            }`}>
              SelectedText
            </Label>
            <Input
              value={editedStep.selectedText ?? ''}
              onChange={(e) => updateStepField('selectedText', e.target.value)}
              placeholder="Text to be copied"
              className={theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''}
              disabled={disabled}
            />
          </div>
        )}

        {/* Task (for agent steps) */}
        {relevantAttributes.task && (
          <div className="space-y-1">
            <Label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-700'
            }`}>
              Task
            </Label>
            <Textarea
              value={editedStep.task ?? ''}
              onChange={(e) => updateStepField('task', e.target.value)}
              placeholder="Describe the task for the agent"
              className={`min-h-[60px] resize-none ${
                theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''
              }`}
              disabled={disabled}
            />
          </div>
        )}

        {/* Value */}
        {relevantAttributes.value && (
          <div className="space-y-1">
            <Label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-700'
            }`}>
              Value
            </Label>
            <Input
              value={editedStep.value ?? ''}
              onChange={(e) => updateStepField('value', e.target.value)}
              placeholder="Input value"
              className={theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''}
              disabled={disabled}
            />
          </div>
        )}

        {/* Key (for key_press steps) */}
        {relevantAttributes.key && (
          <div className="space-y-1">
            <Label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-700'
            }`}>
              Key
            </Label>
            <Input
              value={editedStep.key ?? ''}
              onChange={(e) => updateStepField('key', e.target.value)}
              placeholder="e.g., Control+C, Enter, Tab"
              className={theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''}
              disabled={disabled}
            />
          </div>
        )}

        {/* Content (for clipboard_paste steps) */}
        {relevantAttributes.content && (
          <div className="space-y-1">
            <Label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-700'
            }`}>
              Content
            </Label>
            <Textarea
              value={editedStep.content ?? ''}
              onChange={(e) => updateStepField('content', e.target.value)}
              placeholder="Content to paste"
              className={`min-h-[60px] resize-none ${
                theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''
              }`}
              disabled={disabled}
            />
          </div>
        )}

        {/* Timeout */}
        {relevantAttributes.timeoutMs && (
          <div className="space-y-1">
            <Label className={`text-sm font-medium ${
              theme === 'dark' ? 'text-white' : 'text-gray-700'
            }`}>
              Timeout (ms)
            </Label>
            <Input
              type="number"
              value={editedStep.timeoutMs ?? ''}
              onChange={(e) => {
                const value = e.target.value === '' ? null : parseInt(e.target.value, 10);
                updateStepField('timeoutMs', value);
              }}
              placeholder="Timeout in milliseconds"
              className={theme === 'dark' ? 'bg-gray-800 border-gray-600' : ''}
              disabled={disabled}
            />
          </div>
        )}

        {/* Save and Delete Buttons */}
        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-700">
          {onDelete && (
            <Button
              onClick={handleDelete}
              disabled={disabled}
              variant="destructive"
              size="sm"
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || disabled}
            className={`flex items-center gap-2 ${
              theme === 'dark' 
                ? 'bg-purple-600 hover:bg-purple-700' 
                : 'bg-purple-600 hover:bg-purple-700'
            } text-white`}
          >
            <Save className="w-4 h-4" />
            Save
          </Button>
        </div>
      </CardContent>
      
    </Card>
  );
}
