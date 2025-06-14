import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Brain, ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import '@/styles/brainAnimation.css';

interface JobStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  estimated_remaining_seconds?: number;
  workflow_id?: string;
  error?: string;
  message?: string;
}

export default function ProcessingPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [jobStatus, setJobStatus] = useState<JobStatus>({ status: 'pending' });
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pollJobStatus = async (id: string) => {
    try {
      const status = await apiFetch<JobStatus>(`/workflows/upload/${id}/status`, { auth: false });
      setJobStatus(status);

      if (status.status === 'completed' && status.workflow_id) {
        setIsPolling(false);
        // Wait a moment to show completion, then redirect
        setTimeout(() => {
          navigate(`/wf/${status.workflow_id}`, { replace: true });
        }, 1500);
      } else if (status.status === 'failed') {
        setIsPolling(false);
        setError(status.error || 'Processing failed');
      } else if (status.status === 'processing' || status.status === 'pending') {
        // Continue polling
        setTimeout(() => pollJobStatus(id), 2000);
      }
    } catch (err) {
      console.error('Failed to poll job status:', err);
      setIsPolling(false);
      setError(err instanceof Error ? err.message : 'Failed to check processing status');
    }
  };

  useEffect(() => {
    if (jobId && isPolling) {
      pollJobStatus(jobId);
    }
  }, [jobId, isPolling]);

  const handleRetry = () => {
    if (jobId) {
      setError(null);
      setIsPolling(true);
      setJobStatus({ status: 'pending' });
      pollJobStatus(jobId);
    }
  };

  const handleBackToGallery = () => {
    navigate('/', { replace: true });
  };

  const getStatusIcon = () => {
    switch (jobStatus.status) {
      case 'completed':
        return <CheckCircle2 className="w-8 h-8 text-green-500" />;
      case 'failed':
        return <XCircle className="w-8 h-8 text-red-500" />;
      case 'processing':
      case 'pending':
      default:
        return <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />;
    }
  };

  const getStatusMessage = () => {
    switch (jobStatus.status) {
      case 'completed':
        return 'Processing completed! Redirecting to your workflow...';
      case 'failed':
        return error || 'Processing failed';
      case 'processing':
        return jobStatus.message || 'Processing your recording...';
      case 'pending':
      default:
        return 'Preparing to process your recording...';
    }
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <Brain className="w-20 h-20 brain-animation" />
          </div>
          <CardTitle className="text-2xl">Processing</CardTitle>
          <CardDescription>
            Analysing your recording...
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status Icon and Message */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              {getStatusIcon()}
            </div>
            <p className="text-sm text-gray-600">
              {getStatusMessage()}
            </p>
          </div>

          {/* Progress Bar */}
          {(jobStatus.status === 'processing' || jobStatus.status === 'pending') && (
            <div className="space-y-2">
              <Progress 
                value={jobStatus.progress || 0} 
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>{jobStatus.progress || 0}% complete</span>
                {jobStatus.estimated_remaining_seconds && (
                  <span>~{formatTime(jobStatus.estimated_remaining_seconds)} remaining</span>
                )}
              </div>
            </div>
          )}

          {/* Job ID */}
          <div className="text-center">
            <p className="text-xs text-gray-400">
              Job ID: {jobId}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleBackToGallery}
              className="flex-1"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Gallery
            </Button>

            {jobStatus.status === 'failed' && (
              <Button
                onClick={handleRetry}
                className="flex-1"
              >
                Retry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 