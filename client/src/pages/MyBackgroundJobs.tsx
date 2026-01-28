import { useState, useEffect, useCallback } from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2,
  Play,
  Square,
  RefreshCw,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  BookOpen,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserBackgroundJobs,
  cancelBackgroundJob,
  resumeBackgroundJob,
} from '@/lib/api';
import type { BackgroundReadingJob, BackgroundJobStatus } from '../../../shared/types';

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

export default function MyBackgroundJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<BackgroundReadingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('active');

  const fetchJobs = useCallback(async () => {
    try {
      const response = await getUserBackgroundJobs({ limit: 50 });
      setJobs(response.jobs);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch and polling for active jobs
  useEffect(() => {
    fetchJobs();

    // Poll for updates when there are active jobs
    const interval = setInterval(() => {
      const hasActiveJobs = jobs.some(
        job => job.status === 'pending' || job.status === 'running'
      );
      if (hasActiveJobs) {
        fetchJobs();
      }
    }, 3000);

    return () => clearInterval(interval);
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

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">Please Log In</h1>
        <p className="text-muted-foreground">You need to be logged in to view your background reading jobs.</p>
      </div>
    );
  }

  const activeJobs = jobs.filter(job => job.status === 'pending' || job.status === 'running');
  const completedJobs = jobs.filter(job => job.status === 'completed');
  const otherJobs = jobs.filter(job => job.status === 'paused' || job.status === 'failed' || job.status === 'cancelled');

  const renderJobCard = (job: BackgroundReadingJob) => (
    <Card key={job.id} className="overflow-hidden">
      <CardContent className="p-0">
        {/* Progress bar at top */}
        {(job.status === 'pending' || job.status === 'running') && (
          <div className="h-1 bg-muted">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${job.progress.percentComplete}%` }}
            />
          </div>
        )}

        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={statusColors[job.status]}>
                  {job.status === 'running' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                  {statusLabels[job.status]}
                </Badge>
                {job.paperArxivId && (
                  <span className="text-xs text-muted-foreground">
                    arXiv:{job.paperArxivId}
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-lg truncate mb-1">
                {job.paperTitle || 'Unknown Paper'}
              </h3>

              {/* Progress details */}
              <div className="text-sm text-muted-foreground">
                {job.status === 'running' || job.status === 'pending' ? (
                  <span>
                    Page {job.progress.currentPage} of {job.progress.totalPages} ({job.progress.percentComplete}%)
                  </span>
                ) : job.status === 'completed' ? (
                  <span className="text-green-600">
                    <CheckCircle2 className="h-4 w-4 inline mr-1" />
                    All {job.progress.totalPages} pages analyzed
                  </span>
                ) : (
                  <span>
                    {job.progress.pagesCompleted || 0} of {job.progress.totalPages || '?'} pages completed
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-col items-end gap-2">
              {/* Action buttons */}
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
                      <>
                        <Play className="h-4 w-4 mr-1" />
                        Resume
                      </>
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
                      <>
                        <Square className="h-4 w-4 mr-1" />
                        Cancel
                      </>
                    )}
                  </Button>
                )}
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/paper/${job.paperId}`}>
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          {/* Metadata row */}
          <div className="mt-3 pt-3 border-t flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Started: {formatTime(job.timing?.startedAt)}
            </div>
            {job.timing?.startedAt && (
              <div>
                Duration: {formatDuration(job.timing.startedAt, job.timing.completedAt)}
              </div>
            )}
            {job.tokens && job.tokens.total > 0 && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {job.tokens.total.toLocaleString()} tokens
              </div>
            )}
            {job.retryCount && job.retryCount > 0 && (
              <div className="text-orange-500">
                {job.retryCount} retries
              </div>
            )}
          </div>

          {/* Error message */}
          {job.error && (
            <div className="mt-3 p-2 rounded bg-red-500/10 text-red-600 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{job.error}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <BookOpen className="h-8 w-8" />
            Background Reading
          </h1>
          <p className="text-muted-foreground mt-1">
            AI agents reading papers in the background
          </p>
        </div>
        <Button variant="outline" onClick={fetchJobs} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-500/10 text-red-600 flex items-center gap-2">
          <AlertCircle className="h-5 w-5" />
          {error}
        </div>
      )}

      {loading && jobs.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : jobs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No background reading jobs</h3>
            <p className="text-muted-foreground mb-4">
              Start background reading from any paper's detail page
            </p>
            <Button asChild>
              <Link href="/browse">
                Browse Papers
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="active" className="gap-2">
              <Loader2 className="h-4 w-4" />
              Active ({activeJobs.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Completed ({completedJobs.length})
            </TabsTrigger>
            <TabsTrigger value="other" className="gap-2">
              Other ({otherJobs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="space-y-4">
            {activeJobs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No active reading jobs
                </CardContent>
              </Card>
            ) : (
              activeJobs.map(renderJobCard)
            )}
          </TabsContent>

          <TabsContent value="completed" className="space-y-4">
            {completedJobs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No completed jobs yet
                </CardContent>
              </Card>
            ) : (
              completedJobs.map(renderJobCard)
            )}
          </TabsContent>

          <TabsContent value="other" className="space-y-4">
            {otherJobs.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No paused, failed, or cancelled jobs
                </CardContent>
              </Card>
            ) : (
              otherJobs.map(renderJobCard)
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
