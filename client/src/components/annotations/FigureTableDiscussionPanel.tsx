import { useState, useCallback, useMemo } from 'react';
import { X, Send, MessageCircle, Reply, Image, Table2, ChevronDown, ChevronUp, Sparkles, AlertTriangle, Lightbulb, Tag, Trash2, LogIn, User, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LikeButtons } from '@/components/ui/LikeButtons';
import { Link } from 'wouter';
import { FigureTableAnnotation, SentenceAnnotationReply, FigureTableLabel } from './types';
import { FigureTable } from '@/lib/figure-table-detector';
import { getFigureTableLabelName, getColorForFigureTableLabel } from '@/lib/ai-document-annotator';
import * as api from '@/lib/api';
import { toast } from 'sonner';

const CAPTION_PREVIEW_CHAR_LIMIT = 150;

/**
 * UserLink component - displays username with popover for profile/follow actions
 */
interface UserLinkProps {
  userId?: string;
  userName: string;
  userAvatar?: string;
  isAI?: boolean;
  currentUserId?: string;
  className?: string;
}

function UserLink({ userId, userName, userAvatar, isAI, currentUserId, className }: UserLinkProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Don't show popover for AI or if no userId
  if (isAI || !userId) {
    return (
      <span className={`${className} inline-flex items-center gap-1.5`}>
        <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center flex-shrink-0">
          {isAI ? (
            <Sparkles className="w-3 h-3 text-indigo-500" />
          ) : (
            <User className="w-3 h-3 text-slate-400" />
          )}
        </span>
        {userName}
      </span>
    );
  }

  const isOwnProfile = currentUserId === userId;

  const handleFollow = async () => {
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className={`${className} inline-flex items-center gap-1.5 hover:underline cursor-pointer`}>
          <span className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden flex-shrink-0">
            {userAvatar ? (
              <img src={userAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-3 h-3 text-slate-400" />
            )}
          </span>
          {userName}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
            {userAvatar ? (
              <img src={userAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-slate-500" />
            )}
          </div>
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

interface DiscussionThreadProps {
  annotation: FigureTableAnnotation;
  onAddReply: (annotationId: string, text: string) => void;
  onDeleteAnnotation?: (annotationId: string) => void;
  onDeleteReply?: (annotationId: string, replyId: string) => void;
  currentUserName?: string;
  currentUserId?: string;
}

function DiscussionThread({ annotation, onAddReply, onDeleteAnnotation, onDeleteReply, currentUserName, currentUserId }: DiscussionThreadProps) {
  const [replyText, setReplyText] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [replyToDelete, setReplyToDelete] = useState<string | null>(null);

  const handleSubmitReply = () => {
    if (replyText.trim()) {
      onAddReply(annotation.id, replyText.trim());
      setReplyText('');
      setShowReplyForm(false);
    }
  };

  const isAI = annotation.isAI;
  const isOwnComment = currentUserName && annotation.userName === currentUserName;

  const handleDeleteComment = () => {
    if (onDeleteAnnotation) {
      onDeleteAnnotation(annotation.id);
    }
    setShowDeleteConfirm(false);
  };

  const handleDeleteReply = (replyId: string) => {
    if (onDeleteReply) {
      onDeleteReply(annotation.id, replyId);
    }
    setReplyToDelete(null);
  };

  return (
    <div className={`border-b border-slate-200 dark:border-slate-700 pb-3 mb-3 last:border-0 last:mb-0 last:pb-0 ${
      isAI ? 'bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20 -mx-4 px-4 py-3 rounded-lg' : ''
    }`}>
      {/* Main comment */}
      <div className="flex gap-2 group relative">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${
            isAI ? 'bg-gradient-to-br from-indigo-500 to-purple-600' : ''
          }`}
          style={{ backgroundColor: isAI ? undefined : (annotation.color || '#22C55E') }}
        >
          {isAI ? (
            <Sparkles className="w-4 h-4" />
          ) : annotation.userAvatar ? (
            <img src={annotation.userAvatar} alt="" className="w-full h-full rounded-full" />
          ) : (
            annotation.userName.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <UserLink
              userId={annotation.userId}
              userName={annotation.userName}
              userAvatar={annotation.userAvatar}
              isAI={isAI}
              currentUserId={currentUserId}
              className={`text-sm font-medium ${isAI ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-slate-200'}`}
            />
            <span className="text-xs text-slate-400">
              {formatTimestamp(annotation.timestamp)}
            </span>
          </div>

          {/* AI Flags */}
          {isAI && annotation.aiFlags && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {annotation.aiFlags.novelty && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-medium flex items-center gap-1">
                  <Lightbulb className="w-3 h-3" />
                  Novelty
                </span>
              )}
              {annotation.aiFlags.correctnessIssue && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Check Correctness
                </span>
              )}
              {annotation.aiFlags.consistencyIssue && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Consistency
                </span>
              )}
            </div>
          )}

          <p className={`text-sm break-words overflow-wrap-anywhere ${isAI ? 'text-slate-700 dark:text-slate-200' : 'text-slate-600 dark:text-slate-300'}`}>
            {annotation.text}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {/* Like/Dislike buttons */}
            <LikeButtons
              targetType="comment"
              targetId={annotation.id}
              currentUserId={currentUserId}
              size="sm"
            />
            {currentUserName ? (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="text-xs text-slate-500 hover:text-green-600 flex items-center gap-1"
              >
                <Reply className="w-3 h-3" />
                Reply
              </button>
            ) : (
              <Link href="/login">
                <span className="text-xs text-slate-400 hover:text-green-600 flex items-center gap-1 cursor-pointer">
                  <LogIn className="w-3 h-3" />
                  Login to reply
                </span>
              </Link>
            )}
            {/* Delete button - only for own comments */}
            {isOwnComment && !isAI && onDeleteAnnotation && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            )}
          </div>
        </div>

        {/* Delete confirmation popup */}
        {showDeleteConfirm && (
          <div className="absolute top-0 right-0 bg-slate-800 rounded-lg shadow-lg px-3 py-2 z-10 flex items-center gap-2">
            <span className="text-xs text-white">Delete?</span>
            <button
              onClick={handleDeleteComment}
              className="w-5 h-5 rounded bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
              title="Confirm delete"
            >
              <X className="w-3 h-3" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="w-5 h-5 rounded bg-slate-600 hover:bg-slate-500 text-white flex items-center justify-center text-xs font-bold"
              title="Cancel"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {/* Replies */}
      {annotation.replies && annotation.replies.length > 0 && (
        <div className="ml-10 mt-2 space-y-2">
          {annotation.replies.map((reply) => {
            const isOwnReply = currentUserName && reply.userName === currentUserName;
            return (
              <div key={reply.id} className="flex gap-2 group relative">
                <div className="w-6 h-6 rounded-full bg-slate-300 dark:bg-slate-600 flex items-center justify-center text-xs text-white flex-shrink-0">
                  {reply.userName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <UserLink
                      userId={reply.userId}
                      userName={reply.userName}
                      userAvatar={reply.userAvatar}
                      currentUserId={currentUserId}
                      className="text-xs font-medium text-slate-700 dark:text-slate-300"
                    />
                    <span className="text-xs text-slate-400">
                      {formatTimestamp(reply.timestamp)}
                    </span>
                    {/* Delete button for own replies */}
                    {isOwnReply && onDeleteReply && (
                      <button
                        onClick={() => setReplyToDelete(reply.id)}
                        className="text-xs text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete reply"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 break-words overflow-wrap-anywhere">
                    {reply.text}
                  </p>
                  {/* Like/Dislike buttons for replies */}
                  <div className="mt-1">
                    <LikeButtons
                      targetType="comment"
                      targetId={reply.id}
                      currentUserId={currentUserId}
                      size="sm"
                    />
                  </div>
                </div>
                {/* Delete confirmation for reply */}
                {replyToDelete === reply.id && (
                  <div className="absolute top-0 right-0 bg-slate-800 rounded-lg shadow-lg px-2 py-1 z-10 flex items-center gap-1">
                    <span className="text-[10px] text-white">Delete?</span>
                    <button
                      onClick={() => handleDeleteReply(reply.id)}
                      className="w-4 h-4 rounded bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                    <button
                      onClick={() => setReplyToDelete(null)}
                      className="w-4 h-4 rounded bg-slate-600 hover:bg-slate-500 text-white flex items-center justify-center text-[10px] font-bold"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reply form */}
      {showReplyForm && (
        <div className="ml-10 mt-2 flex gap-2">
          <input
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply..."
            className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-green-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitReply();
              }
            }}
          />
          <Button size="sm" onClick={handleSubmitReply} className="h-8 bg-green-600 hover:bg-green-700">
            <Send className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

function formatTimestamp(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

interface FigureTableDiscussionPanelProps {
  figureTable: FigureTable | null;
  annotations: FigureTableAnnotation[];
  onAddAnnotation: (annotation: Omit<FigureTableAnnotation, 'id' | 'timestamp'>) => void;
  onAddReply: (annotationId: string, reply: Omit<SentenceAnnotationReply, 'id' | 'timestamp'>) => void;
  onDeleteAnnotation?: (annotationId: string) => void;
  onDeleteReply?: (annotationId: string, replyId: string) => void;
  onClose: () => void;
  isOpen: boolean;
  currentUserName?: string;
  currentUserId?: string;
}

export function FigureTableDiscussionPanel({
  figureTable,
  annotations,
  onAddAnnotation,
  onAddReply,
  onDeleteAnnotation,
  onDeleteReply,
  onClose,
  isOpen,
  currentUserName,
  currentUserId,
}: FigureTableDiscussionPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [isCaptionExpanded, setIsCaptionExpanded] = useState(false);

  // Check if caption needs truncation
  const captionText = figureTable?.caption || '';
  const needsTruncation = captionText.length > CAPTION_PREVIEW_CHAR_LIMIT;
  const displayedCaptionText = needsTruncation && !isCaptionExpanded
    ? captionText.slice(0, CAPTION_PREVIEW_CHAR_LIMIT) + '...'
    : captionText;

  const handleSubmitComment = useCallback(() => {
    if (!figureTable || !newComment.trim()) return;

    onAddAnnotation({
      figureTableId: figureTable.id,
      text: newComment.trim(),
      userName: currentUserName || 'Anonymous',
      replies: [],
    });
    setNewComment('');
  }, [figureTable, newComment, onAddAnnotation, currentUserName]);

  const handleAddReply = useCallback(
    (annotationId: string, text: string) => {
      onAddReply(annotationId, {
        text,
        userName: currentUserName || 'Anonymous',
      });
    },
    [onAddReply, currentUserName]
  );

  // Sort annotations: AI comments first, then by timestamp (newest first)
  const sortedAnnotations = useMemo(() => {
    return [...annotations].sort((a, b) => {
      // AI comments come first
      if (a.isAI && !b.isAI) return -1;
      if (!a.isAI && b.isAI) return 1;
      // Within same category, sort by timestamp (newest first)
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [annotations]);

  const isFigure = figureTable?.type === 'figure';

  // Get AI label color
  const aiLabelColor = figureTable?.aiLabel ? getColorForFigureTableLabel(figureTable.aiLabel) : undefined;

  return (
    <>
      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full w-[380px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-lg ${isFigure ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-orange-500 to-amber-600'} flex items-center justify-center`}>
              {isFigure ? (
                <Image className="w-5 h-5 text-white" />
              ) : (
                <Table2 className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">
                {figureTable?.label || (isFigure ? 'Figure' : 'Table')} Discussion
              </h3>
              <p className="text-xs text-slate-500">
                {annotations.length} comment{annotations.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Caption preview - expandable */}
        {figureTable && (
          <div className={`p-4 ${isFigure ? 'bg-green-50 dark:bg-green-900/20' : 'bg-orange-50 dark:bg-orange-900/20'} border-b border-slate-200 dark:border-slate-700`}>
            {/* AI Label Badge - prominent display */}
            {figureTable.aiLabel && (
              <div className="mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4" style={{ color: aiLabelColor }} />
                <span
                  className="text-sm font-semibold px-2.5 py-1 rounded-md"
                  style={{
                    backgroundColor: `${aiLabelColor}20`,
                    color: aiLabelColor
                  }}
                >
                  {getFigureTableLabelName(figureTable.aiLabel)}
                </span>
              </div>
            )}

            <div className="flex items-center gap-1.5 mb-1.5">
              {isFigure ? (
                <Image className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Table2 className="w-3.5 h-3.5 text-orange-600" />
              )}
              <span className={`text-xs font-medium ${isFigure ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400'}`}>
                {figureTable.label}
              </span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {displayedCaptionText}
            </p>
            {needsTruncation && (
              <button
                onClick={() => setIsCaptionExpanded(!isCaptionExpanded)}
                className={`mt-2 flex items-center gap-1 text-xs font-medium ${isFigure ? 'text-green-600 hover:text-green-700 dark:text-green-400' : 'text-orange-600 hover:text-orange-700 dark:text-orange-400'} transition-colors`}
              >
                {isCaptionExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show full caption ({captionText.length} characters)
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Discussion list */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            {annotations.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500">No comments yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Be the first to discuss this {isFigure ? 'figure' : 'table'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Sort AI comments first, then by timestamp */}
                {sortedAnnotations.map((annotation) => (
                  <DiscussionThread
                    key={annotation.id}
                    annotation={annotation}
                    onAddReply={handleAddReply}
                    onDeleteAnnotation={onDeleteAnnotation}
                    onDeleteReply={onDeleteReply}
                    currentUserName={currentUserName}
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* New comment form */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
          {currentUserName ? (
            <>
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder={`Share your thoughts about this ${isFigure ? 'figure' : 'table'}...`}
                className="mb-2 text-sm resize-none"
                rows={3}
              />
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || !figureTable}
                className={`w-full gap-2 ${isFigure ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}
              >
                <Send className="w-4 h-4" />
                Post Comment
              </Button>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-slate-500 mb-3">Login to join the discussion</p>
              <Link href="/login">
                <Button className={`w-full gap-2 ${isFigure ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}`}>
                  <LogIn className="w-4 h-4" />
                  Log In to Comment
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40"
          onClick={onClose}
        />
      )}
    </>
  );
}
