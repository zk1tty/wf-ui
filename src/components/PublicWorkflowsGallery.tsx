import React from 'react';
import { usePublicWorkflows } from '@/hooks/usePublicWorkflows';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Globe, Clock, User, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const PublicWorkflowsGallery = () => {
  const { rows: workflows, loading, error } = usePublicWorkflows();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Loader2 className="w-8 h-8 text-purple-600 animate-spin mb-4" />
        <p className="text-lg text-gray-600">Loading public workflows...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <div className="text-red-500 mb-4">
          <Globe className="w-8 h-8 mx-auto mb-2" />
          <p className="text-lg font-semibold">Failed to load workflows</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  if (!workflows || workflows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8">
        <Globe className="w-12 h-12 text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-800 mb-2">No Public Workflows Yet</h2>
        <p className="text-gray-600 text-center max-w-md">
          Be the first to create and share a workflow! Public workflows will appear here for everyone to discover and use.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            <Globe className="inline-block w-10 h-10 mr-3 text-purple-600" />
            Workflow Gallery 🎨
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Discover workflows created by the community.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map((workflow) => (
            <Card key={workflow.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-gray-800 mb-2">
                      {workflow.name || 'Untitled Workflow'}
                    </CardTitle>
                    <CardDescription className="text-sm text-gray-600 line-clamp-2">
                      {workflow.description || 'No description available'}
                    </CardDescription>
                  </div>
                  <Badge variant="secondary" className="ml-2">
                    <Globe className="w-3 h-3 mr-1" />
                    Public
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent>
                <div className="space-y-3">
                  {/* Workflow Stats */}
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-1" />
                      <span>{workflow.created_by || 'Anonymous'}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="w-4 h-4 mr-1" />
                      <span>
                        {workflow.created_at 
                          ? new Date(workflow.created_at).toLocaleDateString()
                          : 'Unknown'
                        }
                      </span>
                    </div>
                  </div>

                  {/* Steps Count */}
                  {workflow.steps && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{workflow.steps.length}</span> steps
                    </div>
                  )}

                  {/* Action Button */}
                  <Button 
                    className="w-full mt-4" 
                    variant="outline"
                    onClick={() => {
                      // TODO: Navigate to workflow detail page
                      window.location.href = `/wf/${workflow.id}`;
                    }}
                  >
                    View Workflow
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}; 