import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Play, Square, RefreshCw, FileText, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  getUserBackgroundJobs,
  cancelBackgroundJob,
  resumeBackgroundJob,
  getBackgroundJobStatus,
} from '@/lib/api';
import type { BackgroundReadingJob, BackgroundJobStatus } from '../../../shared/types';

interface BackgroundReadingManagerProps {
  paperId?: string;
  compact?: boolean;
  className?: string;
  onJobCompleted?: (job: BackgroundReadingJob) => void;
}

const statusColors: Record<BackgroundJobStatus, string> = {
  pending: 'bg-yellow-500',
  running: 'bg-blue-500',
  paused: 'bg-orange-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  cancelled: 'bg-gray-500',
};

const statusLabels: Record<BackgroundJobStatus, string> = {
  pending: 'Queued',
  running: 'Reading...',
  paused: 'Paused',
  completed: 'Complete',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function formatTime(timestamp?: number): string {
  if (!timestamp) return '-';
  return new Date(timestamp * 1000).toLocaleString();
}

function formatDuration(startTimestamp?: number, endTimestamp?: number): string {
  if (!startTimestamp) return '-';
  const end = endTimestamp || Math.floor(Date.now() / 1000);
  const durationSec = end - startTimestamp;

  if (durationSec < 60) return `${durationSec}s`;
  if (durationSec < 3600) return `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`;
  return `${Math.floor(durationSec / 3600)}h ${Math.floor((durationSec % 3600) / 60)}m`;
}

export function BackgroundReadingManager({ paperId, compact = false, className = '', onJobCompleted }: BackgroundReadingManagerProps) {
  const [jobs, setJobs] = useState<BackgroundReadingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [prevJobStatuses, setPrevJobStatuses] = useState<Map<string, BackgroundJobStatus>>(new Map());

  const fetchJobs = useCallback(async () => {
    try {
      const response = await getUserBackgroundJobs({ limit: compact ? 5 : 20 });
      let filteredJobs = response.jobs;

      // Filter by paper if specified
      if (paperId) {
        filteredJobs = filteredJobs.filter(job => job.paperId === paperId);
      }

      // Check for jobs that just completed (transitioned from running/pending to completed)
      if (onJobCompleted) {
        for (const job of filteredJobs) {
          const prevStatus = prevJobStatuses.get(job.id);
          if (prevStatus && (prevStatus === 'running' || prevStatus === 'pending') && job.status === 'completed') {
            // Job just completed!
            onJobCompleted(job);
          }
        }
      }

      // Update previous statuses for next comparison
      const newStatuses = new Map<string, BackgroundJobStatus>();
      for (const job of filteredJobs) {
        newStatuses.set(job.id, job.status);
      }
      setPrevJobStatuses(newStatuses);

      setJobs(filteredJobs);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  }, [paperId, compact, onJobCompleted, prevJobStatuses]);

  // Poll for updates when there are active jobs
  useEffect(() => {
    fetchJobs();

    const hasActiveJobs = jobs.some(
      job => job.status === 'pending' || job.status === 'running'
    );

    if (hasActiveJobs) {
      const interval = setInterval(fetchJobs, 3000); // Poll every 3 seconds
      return () => clearInterval(interval);
    }
  }, [fetchJobs, jobs.length]);

  const handleCancel = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      await cancelBackgroundJob(jobId);
      await fetchJobs();
    } catch (err: any) {
      setError(err.message || 'Failed to cancel job');
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async (jobId: string) => {
    setActionLoading(jobId);
    try {
      await resumeBackgroundJob(jobId);
      await fetchJobs();
    } catch (err: any) {
      setError(err.message || 'Failed to resume job');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center p-4 ${className}`}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (jobs.length === 0 && compact) {
    return null; // Don't show anything in compact mode if no jobs
  }

  if (compact) {
    // Compact mode - just show active jobs as small cards
    const activeJobs = jobs.filter(
      job => job.status === 'pending' || job.status === 'running'
    );

    if (activeJobs.length === 0) return null;

    return (
      <div className={`space-y-2 ${className}`}>
        {activeJobs.map(job => (
          <div
            key={job.id}
            className="flex items-center gap-3 p-2 rounded-lg bg-muted/50 text-sm"
          >
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium">{job.paperTitle || 'Reading paper...'}</div>
              <Progress value={job.progress.percentComplete} className="h-1 mt-1" />
            </div>
            <span className="text-xs text-muted-foreground">
              {job.progress.percentComplete}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleCancel(job.id)}
              disabled={actionLoading === job.id}
            >
              <Square className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    );
  }

  // Full mode - show all jobs with details
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Background Reading Jobs</CardTitle>
            <CardDescription>
              AI reading sessions that continue in the background
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={fetchJobs}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 text-red-600 text-sm flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        {jobs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No background reading jobs</p>
            <p className="text-sm">Start one from the paper detail page</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => (
              <div
                key={job.id}
                className="p-4 rounded-lg border bg-card"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={statusColors[job.status]}>
                        {statusLabels[job.status]}
                      </Badge>
                      {job.paperArxivId && (
                        <span className="text-xs text-muted-foreground">
                          arXiv:{job.paperArxivId}
                        </span>
                      )}
                    </div>
                    <h4 className="font-medium truncate">
                      {job.paperTitle || 'Unknown Paper'}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    {(job.status === 'paused' || job.status === 'failed') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResume(job.id)}
                        disabled={actionLoading === job.id}
                      >
                        {actionLoading === job.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {(job.status === 'pending' || job.status === 'running') && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCancel(job.id)}
                        disabled={actionLoading === job.id}
                      >
                        {actionLoading === job.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>

                {/* Progress */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>
                      Page {job.progress.currentPage} of {job.progress.totalPages}
                    </span>
                    <span>{job.progress.percentComplete}%</span>
                  </div>
                  <Progress value={job.progress.percentComplete} className="h-2" />
                </div>

                {/* Details */}
                <div className="mt-3 grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    <span>Started: {formatTime(job.timing?.startedAt)}</span>
                  </div>
                  {job.timing?.startedAt && (
                    <div>
                      Duration: {formatDuration(job.timing.startedAt, job.timing.completedAt)}
                    </div>
                  )}
                  {job.tokens && job.tokens.total > 0 && (
                    <div>
                      Tokens: {job.tokens.total.toLocaleString()}
                    </div>
                  )}
                  {job.retryCount && job.retryCount > 0 && (
                    <div className="text-orange-500">
                      Retries: {job.retryCount}
                    </div>
                  )}
                </div>

                {/* Error message */}
                {job.error && (
                  <div className="mt-3 p-2 rounded bg-red-500/10 text-red-600 text-xs">
                    <AlertCircle className="h-3 w-3 inline mr-1" />
                    {job.error}
                  </div>
                )}

                {/* Completion indicator */}
                {job.status === 'completed' && (
                  <div className="mt-3 flex items-center gap-2 text-green-600 text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    Reading complete! View results in the AI session.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default BackgroundReadingManager;
