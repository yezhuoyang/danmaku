import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LikeButtons } from '@/components/ui/LikeButtons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronDown,
  ChevronUp,
  User,
  Lightbulb,
  FileText,
  CheckCircle2,
  PenTool,
  BookOpen,
  BarChart3,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Save,
  Trash2,
  Edit3,
  Eye,
  UserPlus,
  UserMinus,
} from 'lucide-react';
import { Link } from 'wouter';
import type { UserReview, CreateUserReviewRequest } from '../../../shared/types';
import * as api from '../lib/api';
import { toast } from 'sonner';

interface UserReviewPanelProps {
  paperId: string;
  userReviews: UserReview[];
  myReview: UserReview | null;
  onReviewSaved?: (review: UserReview) => void;
  onReviewDeleted?: (reviewId: string) => void;
  isLoggedIn: boolean;
}

// Rating descriptions for each score level
const RATING_DESCRIPTIONS = {
  significanceOfProblem: {
    1: 'Minor problem with limited importance',
    2: 'Important problem, but well-studied',
    3: 'Important and emerging problem',
    4: 'Fundamental and critical problem',
  },
  noveltyOfSolution: {
    1: 'Incremental improvement',
    2: 'Some novel elements',
    3: 'Significant novelty',
    4: 'Highly novel approach',
  },
  correctness: {
    1: 'Contains major errors',
    2: 'Minor errors present',
    3: 'Appears correct',
    4: 'Rigorous and verified',
  },
  writingQuality: {
    1: 'Difficult to read',
    2: 'Reasonably clear',
    3: 'Well-written',
    4: 'Excellent clarity',
  },
  relatedWork: {
    1: 'Missing important references',
    2: 'Adequate coverage',
    3: 'Comprehensive',
    4: 'Exemplary coverage',
  },
  robustnessOfEvaluation: {
    1: 'Missing key experiments',
    2: 'Basic evaluation',
    3: 'Well-executed',
    4: 'Comprehensive and rigorous',
  },
};

// User popover component for reviewer profiles
interface ReviewerUserPopoverProps {
  userId: string;
  userName: string;
  userAvatar?: string;
  currentUserId?: string | null;
}

function ReviewerUserPopover({ userId, userName, userAvatar, currentUserId }: ReviewerUserPopoverProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [followStatusLoaded, setFollowStatusLoaded] = useState(false);

  // Load follow status when popover opens
  useEffect(() => {
    if (open && currentUserId && !followStatusLoaded) {
      api.checkFollowing(userId)
        .then(setIsFollowing)
        .catch(console.error)
        .finally(() => setFollowStatusLoaded(true));
    }
  }, [open, currentUserId, userId, followStatusLoaded]);

  const isOwnProfile = currentUserId === userId;

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) {
      toast.error('Please log in to follow users');
      return;
    }

    setIsLoading(true);
    try {
      if (isFollowing) {
        await api.unfollowUser(userId);
        setIsFollowing(false);
        toast.success(`Unfollowed ${userName}`);
      } else {
        await api.followUser(userId);
        setIsFollowing(true);
        toast.success(`Following ${userName}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update follow status');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate consistent color from userId
  const getAvatarColor = (id: string) => {
    const colors = [
      '#6366f1', '#8b5cf6', '#a855f7', '#d946ef',
      '#ec4899', '#f43f5e', '#f97316', '#eab308',
      '#22c55e', '#14b8a6', '#0ea5e9', '#3b82f6'
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) - hash) + id.charCodeAt(i);
      hash = hash & hash;
    }
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <Avatar className="w-10 h-10">
            <AvatarImage src={userAvatar} />
            <AvatarFallback
              className="text-sm text-white font-medium"
              style={{ backgroundColor: getAvatarColor(userId) }}
            >
              {userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <span className="font-medium text-sm text-slate-700 dark:text-slate-200">
              {userName}'s Review
            </span>
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <Avatar className="w-10 h-10">
            <AvatarImage src={userAvatar} />
            <AvatarFallback
              className="text-sm text-white font-medium"
              style={{ backgroundColor: getAvatarColor(userId) }}
            >
              {userName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{userName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/profile/${userId}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(false)}>
              <User className="w-3 h-3 mr-1" />
              Profile
            </Button>
          </Link>
          {!isOwnProfile && currentUserId && (
            <Button
              variant={isFollowing ? "outline" : "default"}
              size="sm"
              className="flex-1"
              onClick={handleFollow}
              disabled={isLoading}
            >
              {isFollowing ? (
                <>
                  <UserMinus className="w-3 h-3 mr-1" />
                  Unfollow
                </>
              ) : (
                <>
                  <UserPlus className="w-3 h-3 mr-1" />
                  Follow
                </>
              )}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Rating selector component
function RatingSelector({
  label,
  value,
  onChange,
  descriptions,
  icon: Icon,
}: {
  label: string;
  value: number;
  onChange: (value: number, text: string) => void;
  descriptions: Record<number, string>;
  icon: React.ElementType;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-indigo-500" />
        <Label className="text-sm font-medium">{label}</Label>
      </div>
      <Select
        value={String(value)}
        onValueChange={(v) => {
          const num = parseInt(v);
          onChange(num, descriptions[num as keyof typeof descriptions]);
        }}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4].map((score) => (
            <SelectItem key={score} value={String(score)}>
              <span className="font-mono mr-2">{score}/4</span>
              <span className="text-slate-600">{descriptions[score as keyof typeof descriptions]}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// Display a single user review (read-only)
function UserReviewCard({ review, index, isOwner, onDelete, currentUserId }: {
  review: UserReview;
  index: number;
  isOwner: boolean;
  onDelete?: () => void;
  currentUserId?: string | null;
}) {
  const [isExpanded, setIsExpanded] = useState(index === 0);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getScoreColor = (score: number, max: number = 4) => {
    const ratio = score / max;
    if (ratio >= 0.75) return 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (ratio >= 0.5) return 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400';
    return 'text-red-600 bg-red-50 dark:bg-red-900/30 dark:text-red-400';
  };

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors py-4"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ReviewerUserPopover
              userId={review.userId}
              userName={review.userName}
              userAvatar={review.userAvatar}
              currentUserId={currentUserId}
            />
            {isOwner && (
              <Badge variant="outline" className="text-xs font-normal text-blue-600 border-blue-300">
                Your Review
              </Badge>
            )}
            {/* Like/Dislike buttons */}
            <LikeButtons
              targetType="user_review"
              targetId={review.id}
              currentUserId={currentUserId || undefined}
              size="md"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 ml-2">
              {review.createdAt === review.updatedAt
                ? `Created ${formatDate(review.createdAt)}`
                : `Updated ${formatDate(review.updatedAt)}`
              }
            </p>
          </div>
          <div className="flex items-center gap-1">
            {isOwner && onDelete && (
              isDeleting ? (
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                  >
                    Confirm
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsDeleting(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsDeleting(true);
                  }}
                  title="Delete review"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              )
            )}
            <Button variant="ghost" size="sm" className="p-0 h-8 w-8">
              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-6">
          {/* Paper Summary */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-blue-500" />
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Paper Summary</h4>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg">
              {review.paperSummary}
            </p>
          </div>

          <Separator />

          {/* Ratings */}
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-500" />
              Evaluation Scores
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { label: 'Significance', score: review.significanceOfProblem, text: review.significanceOfProblemText, icon: Lightbulb },
                { label: 'Novelty', score: review.noveltyOfSolution, text: review.noveltyOfSolutionText, icon: PenTool },
                { label: 'Correctness', score: review.correctness, text: review.correctnessText, icon: CheckCircle2 },
                { label: 'Writing', score: review.writingQuality, text: review.writingQualityText, icon: FileText },
                { label: 'Related Work', score: review.relatedWork, text: review.relatedWorkText, icon: BookOpen },
                { label: 'Evaluation', score: review.robustnessOfEvaluation, text: review.robustnessOfEvaluationText, icon: BarChart3 },
              ].map(({ label, score, text, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                  <div className={`p-1.5 rounded ${getScoreColor(score)}`}>
                    <Icon className="w-3 h-3" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{label}</span>
                      <Badge variant="outline" className={`font-mono text-xs ${getScoreColor(score)}`}>
                        {score}/4
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Strengths & Weaknesses */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ThumbsUp className="w-4 h-4 text-emerald-500" />
                <h4 className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">Strengths</h4>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 bg-emerald-50 dark:bg-emerald-900/20 p-4 rounded-lg whitespace-pre-wrap">
                {review.strengths}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ThumbsDown className="w-4 h-4 text-red-500" />
                <h4 className="text-sm font-semibold text-red-700 dark:text-red-400">Weaknesses</h4>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 bg-red-50 dark:bg-red-900/20 p-4 rounded-lg whitespace-pre-wrap">
                {review.weaknesses}
              </div>
            </div>
          </div>

          {/* Comments */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MessageSquare className="w-4 h-4 text-blue-500" />
              <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Comments for Authors</h4>
            </div>
            <div className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg whitespace-pre-wrap">
              {review.commentsForAuthors}
            </div>
          </div>

          {review.commentsForReaders && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Eye className="w-4 h-4 text-blue-500" />
                <h4 className="text-sm font-semibold text-blue-700 dark:text-blue-400">Comments for Readers</h4>
              </div>
              <div className="text-sm text-slate-600 dark:text-slate-400 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg whitespace-pre-wrap">
                {review.commentsForReaders}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// Review editor form
function ReviewEditor({
  paperId,
  initialReview,
  onSave,
  onCancel,
}: {
  paperId: string;
  initialReview: UserReview | null;
  onSave: (review: UserReview) => void;
  onCancel: () => void;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<CreateUserReviewRequest>({
    paperSummary: initialReview?.paperSummary || '',
    significanceOfProblem: initialReview?.significanceOfProblem || 2,
    significanceOfProblemText: initialReview?.significanceOfProblemText || RATING_DESCRIPTIONS.significanceOfProblem[2],
    noveltyOfSolution: initialReview?.noveltyOfSolution || 2,
    noveltyOfSolutionText: initialReview?.noveltyOfSolutionText || RATING_DESCRIPTIONS.noveltyOfSolution[2],
    correctness: initialReview?.correctness || 3,
    correctnessText: initialReview?.correctnessText || RATING_DESCRIPTIONS.correctness[3],
    writingQuality: initialReview?.writingQuality || 2,
    writingQualityText: initialReview?.writingQualityText || RATING_DESCRIPTIONS.writingQuality[2],
    relatedWork: initialReview?.relatedWork || 2,
    relatedWorkText: initialReview?.relatedWorkText || RATING_DESCRIPTIONS.relatedWork[2],
    robustnessOfEvaluation: initialReview?.robustnessOfEvaluation || 2,
    robustnessOfEvaluationText: initialReview?.robustnessOfEvaluationText || RATING_DESCRIPTIONS.robustnessOfEvaluation[2],
    advancementDisciplines: initialReview?.advancementDisciplines || [],
    strengths: initialReview?.strengths || '',
    weaknesses: initialReview?.weaknesses || '',
    commentsForAuthors: initialReview?.commentsForAuthors || '',
    commentsForReaders: initialReview?.commentsForReaders || '',
  });

  const handleSave = async () => {
    if (!formData.paperSummary.trim()) {
      toast.error('Please provide a paper summary');
      return;
    }
    if (!formData.strengths.trim()) {
      toast.error('Please list at least one strength');
      return;
    }
    if (!formData.weaknesses.trim()) {
      toast.error('Please list at least one weakness');
      return;
    }
    if (!formData.commentsForAuthors.trim()) {
      toast.error('Please provide comments for authors');
      return;
    }

    setIsSaving(true);
    try {
      const result = await api.saveUserReview(paperId, formData);
      toast.success(initialReview ? 'Review updated' : 'Review saved');
      onSave(result.review);
    } catch (error) {
      toast.error('Failed to save review');
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Edit3 className="h-5 w-5 text-blue-500" />
          {initialReview ? 'Edit Your Review' : 'Write Your Review'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Paper Summary */}
        <div className="space-y-2">
          <Label htmlFor="summary">Paper Summary *</Label>
          <Textarea
            id="summary"
            value={formData.paperSummary}
            onChange={(e) => setFormData({ ...formData, paperSummary: e.target.value })}
            placeholder="Summarize the paper's main contributions, methodology, and findings..."
            className="min-h-[100px]"
          />
        </div>

        {/* Ratings */}
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Evaluation Scores</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <RatingSelector
              label="Significance of Problem"
              value={formData.significanceOfProblem}
              onChange={(v, t) => setFormData({ ...formData, significanceOfProblem: v, significanceOfProblemText: t })}
              descriptions={RATING_DESCRIPTIONS.significanceOfProblem}
              icon={Lightbulb}
            />
            <RatingSelector
              label="Novelty of Solution"
              value={formData.noveltyOfSolution}
              onChange={(v, t) => setFormData({ ...formData, noveltyOfSolution: v, noveltyOfSolutionText: t })}
              descriptions={RATING_DESCRIPTIONS.noveltyOfSolution}
              icon={PenTool}
            />
            <RatingSelector
              label="Correctness"
              value={formData.correctness}
              onChange={(v, t) => setFormData({ ...formData, correctness: v, correctnessText: t })}
              descriptions={RATING_DESCRIPTIONS.correctness}
              icon={CheckCircle2}
            />
            <RatingSelector
              label="Writing Quality"
              value={formData.writingQuality}
              onChange={(v, t) => setFormData({ ...formData, writingQuality: v, writingQualityText: t })}
              descriptions={RATING_DESCRIPTIONS.writingQuality}
              icon={FileText}
            />
            <RatingSelector
              label="Related Work"
              value={formData.relatedWork}
              onChange={(v, t) => setFormData({ ...formData, relatedWork: v, relatedWorkText: t })}
              descriptions={RATING_DESCRIPTIONS.relatedWork}
              icon={BookOpen}
            />
            <RatingSelector
              label="Robustness of Evaluation"
              value={formData.robustnessOfEvaluation}
              onChange={(v, t) => setFormData({ ...formData, robustnessOfEvaluation: v, robustnessOfEvaluationText: t })}
              descriptions={RATING_DESCRIPTIONS.robustnessOfEvaluation}
              icon={BarChart3}
            />
          </div>
        </div>

        <Separator />

        {/* Strengths & Weaknesses */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="strengths" className="flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-emerald-500" />
              Strengths *
            </Label>
            <Textarea
              id="strengths"
              value={formData.strengths}
              onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
              placeholder="- Key strength 1&#10;- Key strength 2&#10;- ..."
              className="min-h-[120px]"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="weaknesses" className="flex items-center gap-2">
              <ThumbsDown className="w-4 h-4 text-red-500" />
              Weaknesses *
            </Label>
            <Textarea
              id="weaknesses"
              value={formData.weaknesses}
              onChange={(e) => setFormData({ ...formData, weaknesses: e.target.value })}
              placeholder="- Key weakness 1&#10;- Key weakness 2&#10;- ..."
              className="min-h-[120px]"
            />
          </div>
        </div>

        {/* Comments */}
        <div className="space-y-2">
          <Label htmlFor="comments" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-blue-500" />
            Comments for Authors *
          </Label>
          <Textarea
            id="comments"
            value={formData.commentsForAuthors}
            onChange={(e) => setFormData({ ...formData, commentsForAuthors: e.target.value })}
            placeholder="Detailed feedback, questions, and suggestions for improvement..."
            className="min-h-[150px]"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="readerComments" className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-blue-500" />
            Comments for Readers (Optional)
          </Label>
          <Textarea
            id="readerComments"
            value={formData.commentsForReaders || ''}
            onChange={(e) => setFormData({ ...formData, commentsForReaders: e.target.value })}
            placeholder="Meta-comments about the paper's contribution, impact, or reading notes..."
            className="min-h-[80px]"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
          >
            {isSaving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                {initialReview ? 'Update Review' : 'Save Review'}
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function UserReviewPanel({
  paperId,
  userReviews,
  myReview,
  onReviewSaved,
  onReviewDeleted,
  isLoggedIn,
}: UserReviewPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user ID from myReview
  useEffect(() => {
    if (myReview) {
      setCurrentUserId(myReview.userId);
    }
  }, [myReview]);

  const handleSave = (review: UserReview) => {
    setIsEditing(false);
    setCurrentUserId(review.userId);
    onReviewSaved?.(review);
  };

  const handleDelete = async (reviewId: string) => {
    try {
      await api.deleteUserReview(paperId, reviewId);
      toast.success('Review deleted');
      onReviewDeleted?.(reviewId);
    } catch (error) {
      toast.error('Failed to delete review');
      console.error(error);
    }
  };

  // Show editor if editing
  if (isEditing) {
    return (
      <ReviewEditor
        paperId={paperId}
        initialReview={myReview}
        onSave={handleSave}
        onCancel={() => setIsEditing(false)}
      />
    );
  }

  // No reviews and not logged in
  if (userReviews.length === 0 && !isLoggedIn) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            User Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <User className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 mb-2">
              No user reviews yet for this paper
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Log in to write a review
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // No reviews but logged in
  if (userReviews.length === 0 && isLoggedIn && !myReview) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-blue-500" />
            User Reviews
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <User className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 mb-4">
              No user reviews yet for this paper
            </p>
            <Button
              onClick={() => setIsEditing(true)}
              className="bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700"
            >
              <Edit3 className="w-4 h-4 mr-2" />
              Write the First Review
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Has reviews
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <User className="h-5 w-5 text-blue-500" />
          User Reviews ({userReviews.length})
        </h2>
        {isLoggedIn && !myReview && (
          <Button
            onClick={() => setIsEditing(true)}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Edit3 className="w-3 h-3" />
            Write Review
          </Button>
        )}
        {isLoggedIn && myReview && (
          <Button
            onClick={() => setIsEditing(true)}
            size="sm"
            variant="outline"
            className="gap-2"
          >
            <Edit3 className="w-3 h-3" />
            Edit Your Review
          </Button>
        )}
      </div>
      <div className="space-y-4">
        {userReviews.map((review, index) => (
          <UserReviewCard
            key={review.id}
            review={review}
            index={index}
            isOwner={review.userId === currentUserId || review.userId === myReview?.userId}
            onDelete={review.userId === myReview?.userId ? () => handleDelete(review.id) : undefined}
            currentUserId={currentUserId}
          />
        ))}
      </div>
    </div>
  );
}
