import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Link, useLocation, useRoute } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { GitBranchTree } from "@/components/GitBranchTree";
import { LinkedIdeasPanel } from "@/components/LinkedIdeasPanel";
import { LinkPaperDialog } from "@/components/LinkPaperDialog";
import { LikeButtons } from "@/components/ui/LikeButtons";
import {
  ArrowLeft,
  HelpCircle,
  Lightbulb,
  CheckCircle2,
  Search,
  Clock,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  GitBranch,
  Link as LinkIcon,
  Plus,
  Edit,
  Trash,
  MoreVertical,
  ExternalLink,
  User,
  Tag,
  Send,
  FileText,
} from "lucide-react";
import * as api from "@/lib/api";
import type {
  ChallengeProblem,
  ChallengeComment,
  ChallengeProblemStatus,
  CreateChallengeProblemRequest,
  CreateChallengeCommentRequest,
} from "../../../shared/types";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  unsolved: {
    label: 'Unsolved',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    icon: <HelpCircle className="h-4 w-4" />
  },
  investigating: {
    label: 'Investigating',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    icon: <Search className="h-4 w-4" />
  },
  solved: {
    label: 'Solved',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    icon: <CheckCircle2 className="h-4 w-4" />
  },
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open_question: {
    label: 'Open Question',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <HelpCircle className="h-4 w-4" />
  },
  research_idea: {
    label: 'Research Idea',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    icon: <Lightbulb className="h-4 w-4" />
  },
};

export default function ChallengeProblemDetail() {
  const [, params] = useRoute("/challenge/:id");
  const problemId = params?.id;
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [problem, setProblem] = useState<ChallengeProblem | null>(null);
  const [progressTree, setProgressTree] = useState<ChallengeProblem[]>([]);
  const [comments, setComments] = useState<ChallengeComment[]>([]);
  const [loading, setLoading] = useState(true);

  // Add sub-question dialog
  const [addSubDialogOpen, setAddSubDialogOpen] = useState(false);
  const [subQuestionTitle, setSubQuestionTitle] = useState("");
  const [subQuestionDescription, setSubQuestionDescription] = useState("");
  const [addingSubQuestion, setAddingSubQuestion] = useState(false);
  const [parentIdForSub, setParentIdForSub] = useState<string | null>(null);

  // Edit status dialog
  const [editStatusOpen, setEditStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ChallengeProblemStatus>("unsolved");
  const [solutionSummary, setSolutionSummary] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Comment input
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);

  // Link paper dialog
  const [linkPaperDialogOpen, setLinkPaperDialogOpen] = useState(false);

  // Fetch problem details
  useEffect(() => {
    if (!problemId) return;

    setLoading(true);
    api.getChallengeProblem(problemId)
      .then(({ problem, comments, progressTree }) => {
        setProblem(problem);
        setComments(comments);
        setProgressTree(progressTree);
      })
      .catch((error) => {
        console.error("Failed to fetch problem:", error);
        toast.error("Failed to load problem");
        setLocation("/challenge-problems");
      })
      .finally(() => setLoading(false));
  }, [problemId, setLocation]);

  const handleAddSubQuestion = async () => {
    if (!subQuestionTitle.trim()) {
      toast.error("Title is required");
      return;
    }

    setAddingSubQuestion(true);
    try {
      const request: CreateChallengeProblemRequest = {
        type: "open_question",
        title: subQuestionTitle.trim(),
        description: subQuestionDescription.trim() || undefined,
        parentId: parentIdForSub || problemId,
      };

      const newProblem = await api.createChallengeProblem(request);
      toast.success("Sub-question added!");

      // Refresh the page to show updated tree
      const { problem: updatedProblem, progressTree: updatedTree } = await api.getChallengeProblem(problemId!);
      setProblem(updatedProblem);
      setProgressTree(updatedTree);

      setAddSubDialogOpen(false);
      setSubQuestionTitle("");
      setSubQuestionDescription("");
      setParentIdForSub(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to add sub-question");
    } finally {
      setAddingSubQuestion(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!problem) return;

    setUpdatingStatus(true);
    try {
      await api.updateChallengeProblem(problem.id, {
        status: newStatus,
        solutionSummary: newStatus === 'solved' ? solutionSummary.trim() : undefined,
      });
      toast.success("Status updated!");

      // Refresh problem
      const { problem: updatedProblem, progressTree: updatedTree, comments: updatedComments } = await api.getChallengeProblem(problemId!);
      setProblem(updatedProblem);
      setProgressTree(updatedTree);
      setComments(updatedComments);

      setEditStatusOpen(false);
      setSolutionSummary("");
    } catch (error: any) {
      toast.error(error.message || "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim() || !problem) return;

    setSubmittingComment(true);
    try {
      const request: CreateChallengeCommentRequest = {
        content: newComment.trim(),
        parentId: replyTo || undefined,
      };

      await api.addChallengeComment(problem.id, request);
      toast.success("Comment added!");

      // Refresh comments
      const { comments: updatedComments } = await api.getChallengeComments(problem.id);
      setComments(updatedComments);
      setNewComment("");
      setReplyTo(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to add comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.deleteChallengeComment(commentId);
      toast.success("Comment deleted");
      const { comments: updatedComments } = await api.getChallengeComments(problem!.id);
      setComments(updatedComments);
    } catch (error: any) {
      toast.error(error.message || "Failed to delete comment");
    }
  };

  const openAddSubDialog = (parentId?: string) => {
    setParentIdForSub(parentId || null);
    setAddSubDialogOpen(true);
  };

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    if (seconds < 604800) return Math.floor(seconds / 86400) + "d ago";
    return Math.floor(seconds / 604800) + "w ago";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-indigo-950/20">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <Skeleton className="h-8 w-48" />
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!problem) {
    return null;
  }

  const statusConfig = STATUS_CONFIG[problem.status] || STATUS_CONFIG.unsolved;
  const typeConfig = TYPE_CONFIG[problem.type] || TYPE_CONFIG.open_question;
  const isOwner = user?.id === problem.userId;
  const isQuestion = problem.type === 'open_question';

  // Find root problem for the tree
  const rootId = problem.rootId || problem.id;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 dark:from-slate-950 dark:to-indigo-950/20">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/challenge-problems">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              {typeConfig.icon}
              <span className="text-sm font-medium text-muted-foreground">
                {typeConfig.label}
              </span>
            </div>
          </div>

          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => {
                  setNewStatus(problem.status);
                  setEditStatusOpen(true);
                }}>
                  <Edit className="h-4 w-4 mr-2" />
                  Update Status
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-red-600"
                  onClick={async () => {
                    if (confirm("Are you sure you want to delete this problem?")) {
                      try {
                        await api.deleteChallengeProblem(problem.id);
                        toast.success("Problem deleted");
                        setLocation("/challenge-problems");
                      } catch (error: any) {
                        toast.error(error.message || "Failed to delete");
                      }
                    }
                  }}
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Problem Card - Full Width */}
        <Card className="mb-6">
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge className={`${typeConfig.color}`} variant="secondary">
                        {typeConfig.icon}
                        <span className="ml-1">{typeConfig.label}</span>
                      </Badge>
                      <Badge className={`${statusConfig.color} border`} variant="secondary">
                        {statusConfig.icon}
                        <span className="ml-1">{statusConfig.label}</span>
                      </Badge>
                      {problem.importance && (
                        <Badge variant="outline" className="text-xs">
                          {problem.importance} importance
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="text-xl">{problem.title}</CardTitle>
                  </div>

                  {/* Voting */}
                  <LikeButtons
                    targetType="challenge_problem"
                    targetId={problem.id}
                    currentUserId={user?.id}
                    initialStatus={{
                      likeCount: problem.upvotes,
                      dislikeCount: problem.downvotes,
                      userVote: null,
                    }}
                  />
                </div>

                {/* Author */}
                <div className="flex items-center gap-2 mt-2">
                  <Link href={`/profile/${problem.userId}`}>
                    <div className="flex items-center gap-2 hover:opacity-80">
                      <Avatar className="w-6 h-6">
                        <AvatarImage src={problem.userAvatar} />
                        <AvatarFallback className="text-xs">
                          {problem.userName?.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">
                        {problem.userName}
                      </span>
                    </div>
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    • {getTimeAgo(problem.createdAt)}
                  </span>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Description */}
                {problem.description && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Description</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {problem.description}
                    </p>
                  </div>
                )}

                {/* Context */}
                {problem.context && (
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Context</h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                      {problem.context}
                    </p>
                  </div>
                )}

                {/* Research Idea specific fields */}
                {problem.type === 'research_idea' && (
                  <>
                    {problem.methodology && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Proposed Methodology</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {problem.methodology}
                        </p>
                      </div>
                    )}
                    {problem.expectedOutcome && (
                      <div>
                        <h4 className="text-sm font-semibold mb-1">Expected Outcome</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {problem.expectedOutcome}
                        </p>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-4">
                      {problem.feasibility && (
                        <div>
                          <span className="text-xs text-muted-foreground">Feasibility:</span>
                          <Badge variant="outline" className="ml-1">{problem.feasibility}</Badge>
                        </div>
                      )}
                      {problem.novelty && (
                        <div>
                          <span className="text-xs text-muted-foreground">Novelty:</span>
                          <Badge variant="outline" className="ml-1">{problem.novelty}</Badge>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Solution Summary (if solved) */}
                {problem.status === 'solved' && problem.solutionSummary && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                    <h4 className="text-sm font-semibold mb-1 flex items-center gap-2 text-green-800 dark:text-green-400">
                      <CheckCircle2 className="h-4 w-4" />
                      Solution
                    </h4>
                    <p className="text-sm whitespace-pre-wrap">
                      {problem.solutionSummary}
                    </p>
                    {problem.solvedByName && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Solved by {problem.solvedByName}
                      </p>
                    )}
                  </div>
                )}

                {/* Area and Tags */}
                <div className="flex flex-wrap gap-2 pt-2 border-t">
                  {problem.area && (
                    <Badge variant="secondary">
                      <Tag className="h-3 w-3 mr-1" />
                      {problem.area}
                    </Badge>
                  )}
                  {problem.tags.map((tag, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Paper Link */}
                {problem.paperTitle && (
                  <div className="pt-2 border-t">
                    <Link href={`/paper/${problem.paperId}`}>
                      <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 hover:underline">
                        <ExternalLink className="h-4 w-4" />
                        From paper: {problem.paperTitle}
                      </div>
                    </Link>
                  </div>
                )}

                {/* Action Buttons */}
                {user && (
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {isQuestion && (
                      <Button variant="outline" size="sm" onClick={() => openAddSubDialog()}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Sub-Question
                      </Button>
                    )}
                    {isOwner && (
                      <Button variant="outline" size="sm" onClick={() => setLinkPaperDialogOpen(true)}>
                        <FileText className="h-4 w-4 mr-1" />
                        {problem.paperId ? "Change Paper" : "Link Paper"}
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

        {/* Research Progress - Full Width Below Title */}
        {isQuestion && progressTree.length > 0 && (
          <div className="mb-6">
            <GitBranchTree
              tree={progressTree}
              currentProblemId={problem.id}
              title="Research Progress"
              onAddSubQuestion={user ? openAddSubDialog : undefined}
              fullWidth
            />
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Comments Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Discussion
                  <Badge variant="secondary">{comments.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Comment Input */}
                {user && (
                  <div className="mb-4">
                    {replyTo && (
                      <div className="mb-2 text-xs text-muted-foreground flex items-center gap-2">
                        Replying to comment
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 px-1"
                          onClick={() => setReplyTo(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment..."
                        rows={2}
                        className="flex-1"
                      />
                      <Button
                        onClick={handleSubmitComment}
                        disabled={!newComment.trim() || submittingComment}
                        size="sm"
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Comments List */}
                {comments.length === 0 ? (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    No comments yet. Be the first to discuss!
                  </div>
                ) : (
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        currentUserId={user?.id}
                        onReply={(id) => setReplyTo(id)}
                        onDelete={handleDeleteComment}
                        problemId={problem.id}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Linked Ideas (for questions) */}
            {isQuestion && (
              <LinkedIdeasPanel
                questionId={problem.id}
                currentUserId={user?.id}
                onUpdate={async () => {
                  const { problem: updated } = await api.getChallengeProblem(problem.id);
                  setProblem(updated);
                }}
              />
            )}

            {/* Stats */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Stats</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Upvotes</span>
                  <span className="font-medium">{problem.upvotes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Downvotes</span>
                  <span className="font-medium">{problem.downvotes}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Comments</span>
                  <span className="font-medium">{problem.commentCount}</span>
                </div>
                {isQuestion && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Sub-questions</span>
                      <span className="font-medium">{problem.childCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Linked ideas</span>
                      <span className="font-medium">{problem.linkedIdeaCount}</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Add Sub-Question Dialog */}
      <Dialog open={addSubDialogOpen} onOpenChange={setAddSubDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Sub-Question</DialogTitle>
            <DialogDescription>
              Break down this problem into a smaller, more focused question.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="subTitle">Title *</Label>
              <Input
                id="subTitle"
                value={subQuestionTitle}
                onChange={(e) => setSubQuestionTitle(e.target.value)}
                placeholder="What specific aspect needs to be addressed?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subDescription">Description</Label>
              <Textarea
                id="subDescription"
                value={subQuestionDescription}
                onChange={(e) => setSubQuestionDescription(e.target.value)}
                placeholder="Provide context..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddSubDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSubQuestion}
              disabled={!subQuestionTitle.trim() || addingSubQuestion}
            >
              {addingSubQuestion ? "Adding..." : "Add Sub-Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Status Dialog */}
      <Dialog open={editStatusOpen} onOpenChange={setEditStatusOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={(v) => setNewStatus(v as ChallengeProblemStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unsolved">Unsolved</SelectItem>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="solved">Solved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {newStatus === 'solved' && (
              <div className="space-y-2">
                <Label htmlFor="solution">Solution Summary</Label>
                <Textarea
                  id="solution"
                  value={solutionSummary}
                  onChange={(e) => setSolutionSummary(e.target.value)}
                  placeholder="Describe how this was solved..."
                  rows={4}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditStatusOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateStatus} disabled={updatingStatus}>
              {updatingStatus ? "Updating..." : "Update"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link Paper Dialog */}
      <LinkPaperDialog
        open={linkPaperDialogOpen}
        onOpenChange={setLinkPaperDialogOpen}
        currentPaperId={problem?.paperId}
        currentPaperTitle={problem?.paperTitle}
        onLinkPaper={async (paperId) => {
          await api.updateChallengeProblem(problem!.id, { paperId });
          const { problem: updated } = await api.getChallengeProblem(problem!.id);
          setProblem(updated);
        }}
        onUnlinkPaper={async () => {
          await api.updateChallengeProblem(problem!.id, { paperId: null });
          const { problem: updated } = await api.getChallengeProblem(problem!.id);
          setProblem(updated);
        }}
      />
    </div>
  );
}

// Comment Item Component
function CommentItem({
  comment,
  currentUserId,
  onReply,
  onDelete,
  problemId,
  depth = 0,
}: {
  comment: ChallengeComment;
  currentUserId?: string;
  onReply: (id: string) => void;
  onDelete: (id: string) => void;
  problemId: string;
  depth?: number;
}) {
  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    return Math.floor(seconds / 86400) + "d ago";
  };

  const isOwner = currentUserId === comment.userId;

  return (
    <div className={depth > 0 ? "ml-6 border-l-2 border-slate-200 dark:border-slate-700 pl-4" : ""}>
      <div className="flex items-start gap-2">
        <Link href={`/profile/${comment.userId}`}>
          <Avatar className="w-7 h-7">
            <AvatarImage src={comment.userAvatar} />
            <AvatarFallback className="text-xs">
              {comment.userName?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link href={`/profile/${comment.userId}`}>
              <span className="text-sm font-medium hover:underline">
                {comment.userName}
              </span>
            </Link>
            <span className="text-xs text-muted-foreground">
              {getTimeAgo(comment.createdAt)}
            </span>
          </div>
          <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>
          <div className="flex items-center gap-2 mt-1">
            <LikeButtons
              targetType="challenge_comment"
              targetId={comment.id}
              currentUserId={currentUserId}
              initialStatus={{
                likeCount: comment.upvotes,
                dislikeCount: comment.downvotes,
                userVote: null,
              }}
              size="sm"
            />
            {currentUserId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => onReply(comment.id)}
              >
                Reply
              </Button>
            )}
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-red-500"
                onClick={() => onDelete(comment.id)}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2 space-y-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              currentUserId={currentUserId}
              onReply={onReply}
              onDelete={onDelete}
              problemId={problemId}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
