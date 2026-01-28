import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { X, Send, MessageCircle, Reply, User, ChevronDown, ChevronUp, BookOpen, Sparkles, AlertTriangle, Lightbulb, Tag, Loader2, AtSign, Trash2, LogIn, UserPlus, UserMinus, GripVertical, Pencil, Check, Settings, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { LikeButtons } from '@/components/ui/LikeButtons';
import { Link } from 'wouter';
import { Sentence, SentenceAnnotation, SentenceAnnotationReply, SentenceLabel } from './types';
import { getSentenceLabelName, getColorForSentenceLabel } from '@/lib/ai-document-annotator';
import * as api from '@/lib/api';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Markdown components for AI replies in sentence discussion
const replyMarkdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-xs leading-relaxed mb-1 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside mb-1 space-y-0.5 text-xs">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside mb-1 space-y-0.5 text-xs">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-xs">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-slate-200 dark:bg-slate-600 px-0.5 rounded text-[10px] font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className={`block bg-slate-200 dark:bg-slate-600 p-1 rounded text-[10px] font-mono overflow-x-auto mb-1 ${className}`}>
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-slate-200 dark:bg-slate-600 p-1 rounded text-[10px] font-mono overflow-x-auto mb-1">
      {children}
    </pre>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-slate-400 dark:border-slate-500 pl-2 italic text-xs my-1">
      {children}
    </blockquote>
  ),
};

// Markdown components for main AI annotations (larger text than replies)
const annotationMarkdownComponents = {
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm leading-relaxed mb-2 last:mb-0">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside mb-2 space-y-1 text-sm">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside mb-2 space-y-1 text-sm">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-sm">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="bg-slate-200 dark:bg-slate-600 px-1 py-0.5 rounded text-xs font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className={`block bg-slate-200 dark:bg-slate-600 p-2 rounded text-xs font-mono overflow-x-auto mb-2 ${className}`}>
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-slate-200 dark:bg-slate-600 p-2 rounded text-xs font-mono overflow-x-auto mb-2">
      {children}
    </pre>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-2 border-slate-400 dark:border-slate-500 pl-3 italic text-sm my-2">
      {children}
    </blockquote>
  ),
};

/**
 * Check if a comment contains an @AI mention
 */
function containsAIMention(text: string): boolean {
  return /@ai\b/i.test(text);
}

/**
 * Extract the user's question from a comment with @AI mention
 */
function extractUserQuestion(text: string): string {
  // Remove @AI mention and clean up the text
  return text.replace(/@ai\b/gi, '').trim();
}

const SENTENCE_PREVIEW_CHAR_LIMIT = 200;

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
  annotation: SentenceAnnotation;
  onAddReply: (annotationId: string, text: string) => void;
  onDeleteAnnotation?: (annotationId: string) => void;
  onDeleteReply?: (annotationId: string, replyId: string) => void;
  onEditAnnotation?: (annotationId: string, newText: string) => void;
  onEditReply?: (annotationId: string, replyId: string, newText: string) => void;
  currentUserName?: string;
  currentUserId?: string;
}

function DiscussionThread({ annotation, onAddReply, onDeleteAnnotation, onDeleteReply, onEditAnnotation, onEditReply, currentUserName, currentUserId }: DiscussionThreadProps) {
  const [replyText, setReplyText] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [replyToDelete, setReplyToDelete] = useState<string | null>(null);
  const [isEditingComment, setIsEditingComment] = useState(false);
  const [editCommentText, setEditCommentText] = useState(annotation.text);
  const [editingReplyId, setEditingReplyId] = useState<string | null>(null);
  const [editReplyText, setEditReplyText] = useState('');

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

  const handleEditCommentClick = () => {
    setEditCommentText(annotation.text);
    setIsEditingComment(true);
  };

  const handleSaveComment = () => {
    if (onEditAnnotation && editCommentText.trim()) {
      onEditAnnotation(annotation.id, editCommentText.trim());
    }
    setIsEditingComment(false);
  };

  const handleCancelEditComment = () => {
    setEditCommentText(annotation.text);
    setIsEditingComment(false);
  };

  const handleEditReplyClick = (replyId: string, replyText: string) => {
    setEditingReplyId(replyId);
    setEditReplyText(replyText);
  };

  const handleSaveReply = (replyId: string) => {
    if (onEditReply && editReplyText.trim()) {
      onEditReply(annotation.id, replyId, editReplyText.trim());
    }
    setEditingReplyId(null);
    setEditReplyText('');
  };

  const handleCancelEditReply = () => {
    setEditingReplyId(null);
    setEditReplyText('');
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
          style={{ backgroundColor: isAI ? undefined : (annotation.color || '#3B82F6') }}
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

          {isEditingComment ? (
            /* Edit mode for comment */
            <div className="space-y-2">
              <textarea
                value={editCommentText}
                onChange={(e) => setEditCommentText(e.target.value)}
                className="w-full text-sm text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    handleCancelEditComment();
                  } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    handleSaveComment();
                  }
                }}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSaveComment}
                  className="text-xs px-2 py-1 bg-green-500 hover:bg-green-600 text-white rounded flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  Save
                </button>
                <button
                  onClick={handleCancelEditComment}
                  className="text-xs px-2 py-1 bg-slate-500 hover:bg-slate-600 text-white rounded flex items-center gap-1"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Render AI annotations with markdown, others as plain text */}
              {isAI ? (
                <div className="text-sm text-slate-700 dark:text-slate-200 break-words [overflow-wrap:anywhere]">
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={annotationMarkdownComponents}
                  >
                    {annotation.text}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm break-words overflow-wrap-anywhere text-slate-600 dark:text-slate-300">
                  {annotation.text}
                </p>
              )}
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
                    className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1"
                  >
                    <Reply className="w-3 h-3" />
                    Reply
                  </button>
                ) : (
                  <Link href="/login">
                    <span className="text-xs text-slate-400 hover:text-indigo-600 flex items-center gap-1 cursor-pointer">
                      <LogIn className="w-3 h-3" />
                      Login to reply
                    </span>
                  </Link>
                )}
                {/* Edit button - only for own comments and not AI */}
                {isOwnComment && !isAI && onEditAnnotation && (
                  <button
                    onClick={handleEditCommentClick}
                    className="text-xs text-blue-400 hover:text-blue-600 flex items-center gap-1"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
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
            </>
          )}
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
            const isEditingThisReply = editingReplyId === reply.id;
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
                    {/* Edit button for own replies */}
                    {isOwnReply && onEditReply && !isEditingThisReply && (
                      <button
                        onClick={() => handleEditReplyClick(reply.id, reply.text)}
                        className="text-xs text-slate-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Edit reply"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    )}
                    {/* Delete button for own replies */}
                    {isOwnReply && onDeleteReply && !isEditingThisReply && (
                      <button
                        onClick={() => setReplyToDelete(reply.id)}
                        className="text-xs text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete reply"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  {isEditingThisReply ? (
                    /* Edit mode for reply */
                    <div className="space-y-1.5 mt-1">
                      <input
                        type="text"
                        value={editReplyText}
                        onChange={(e) => setEditReplyText(e.target.value)}
                        className="w-full text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            handleCancelEditReply();
                          } else if (e.key === 'Enter') {
                            handleSaveReply(reply.id);
                          }
                        }}
                        autoFocus
                      />
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleSaveReply(reply.id)}
                          className="text-[10px] px-1.5 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded flex items-center gap-0.5"
                        >
                          <Check className="w-2.5 h-2.5" />
                          Save
                        </button>
                        <button
                          onClick={handleCancelEditReply}
                          className="text-[10px] px-1.5 py-0.5 bg-slate-500 hover:bg-slate-600 text-white rounded flex items-center gap-0.5"
                        >
                          <X className="w-2.5 h-2.5" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Render AI replies with markdown, others as plain text */}
                      {reply.userName === 'AI Assistant' ? (
                        <div className="text-xs text-slate-600 dark:text-slate-400 break-words [overflow-wrap:anywhere]">
                          <ReactMarkdown
                            remarkPlugins={[remarkMath]}
                            rehypePlugins={[rehypeKatex]}
                            components={replyMarkdownComponents}
                          >
                            {reply.text}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-600 dark:text-slate-400 break-words overflow-wrap-anywhere">
                          {reply.text}
                        </p>
                      )}
                      {/* Like/Dislike buttons for replies */}
                      <div className="mt-1">
                        <LikeButtons
                          targetType="comment"
                          targetId={reply.id}
                          currentUserId={currentUserId}
                          size="sm"
                        />
                      </div>
                    </>
                  )}
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
            className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmitReply();
              }
            }}
          />
          <Button size="sm" onClick={handleSubmitReply} className="h-8">
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

interface SentenceDiscussionPanelProps {
  sentence: Sentence | null;
  annotations: SentenceAnnotation[];
  onAddAnnotation: (annotation: Omit<SentenceAnnotation, 'id' | 'timestamp'>) => void;
  onAddReply: (annotationId: string, reply: Omit<SentenceAnnotationReply, 'id' | 'timestamp'>) => void;
  onDeleteAnnotation?: (annotationId: string) => void;
  onDeleteReply?: (annotationId: string, replyId: string) => void;
  onEditAnnotation?: (annotationId: string, newText: string) => void;
  onEditReply?: (annotationId: string, replyId: string, newText: string) => void;
  onClose: () => void;
  isOpen: boolean;
  /** Whether the AI agent has read the entire paper (enables @AI follow-up) */
  agentHasRead?: boolean;
  /** Callback to handle AI follow-up questions */
  onAIFollowUp?: (sentenceId: string, question: string, sentenceText: string, sectionInfo?: string) => Promise<string>;
  currentUserName?: string;
  currentUserId?: string;
  /** AI prompt template for @AI follow-up questions (user can customize) */
  aiPromptTemplate?: string;
  /** Callback to update the AI prompt template */
  onAiPromptTemplateChange?: (template: string) => void;
}

export function SentenceDiscussionPanel({
  sentence,
  annotations,
  onAddAnnotation,
  onAddReply,
  onDeleteAnnotation,
  onDeleteReply,
  onEditAnnotation,
  onEditReply,
  onClose,
  isOpen,
  agentHasRead = false,
  onAIFollowUp,
  currentUserName,
  currentUserId,
  aiPromptTemplate,
  onAiPromptTemplateChange,
}: SentenceDiscussionPanelProps) {
  const [newComment, setNewComment] = useState('');
  const [isSentenceExpanded, setIsSentenceExpanded] = useState(false);
  const [isAIResponding, setIsAIResponding] = useState(false);
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState('');

  // Resizable panel state
  const [panelWidth, setPanelWidth] = useState(380);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);

  const MIN_PANEL_WIDTH = 320;
  const MAX_PANEL_WIDTH = 1200;

  // Handle resize drag
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;

      // Calculate new width based on mouse position (dragging from left edge)
      const deltaX = resizeRef.current.startX - e.clientX;
      const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, resizeRef.current.startWidth + deltaX));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeRef.current = { startX: e.clientX, startWidth: panelWidth };
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [panelWidth]);

  // Check if sentence needs truncation
  const sentenceText = sentence?.text || '';
  const needsTruncation = sentenceText.length > SENTENCE_PREVIEW_CHAR_LIMIT;
  const displayedSentenceText = needsTruncation && !isSentenceExpanded
    ? sentenceText.slice(0, SENTENCE_PREVIEW_CHAR_LIMIT) + '...'
    : sentenceText;

  const handleSubmitComment = useCallback(async () => {
    if (!sentence || !newComment.trim()) return;

    const commentText = newComment.trim();
    const userName = currentUserName || 'Anonymous';

    // Check for @AI mention and trigger follow-up if agent has read the paper
    if (containsAIMention(commentText) && agentHasRead && onAIFollowUp) {
      const userQuestion = extractUserQuestion(commentText);
      if (userQuestion) {
        setIsAIResponding(true);
        setNewComment('');
        try {
          const sectionInfo = sentence.section?.fullTitle;
          const aiResponse = await onAIFollowUp(
            sentence.id,
            userQuestion,
            sentence.text,
            sectionInfo
          );

          // Add user's question first (appears at top due to earlier timestamp)
          onAddAnnotation({
            sentenceId: sentence.id,
            text: commentText,
            userName: userName,
            replies: [],
          });

          // Then add AI response below (AI mentions @Username when replying)
          onAddAnnotation({
            sentenceId: sentence.id,
            text: `@${userName} ${aiResponse}`,
            userName: 'AI Assistant',
            replies: [],
            isAI: true,
          });
        } catch (error) {
          console.error('AI follow-up failed:', error);
          // Add user's question first
          onAddAnnotation({
            sentenceId: sentence.id,
            text: commentText,
            userName: userName,
            replies: [],
          });

          // Then add error message as annotation, still mentioning the user
          onAddAnnotation({
            sentenceId: sentence.id,
            text: `@${userName} Sorry, I couldn't respond to your question. ${error instanceof Error ? error.message : 'Please try again.'}`,
            userName: 'AI Assistant',
            replies: [],
            isAI: true,
          });
        } finally {
          setIsAIResponding(false);
        }
        return;
      }
    }

    // Regular comment (no @AI mention)
    onAddAnnotation({
      sentenceId: sentence.id,
      text: commentText,
      userName: userName,
      replies: [],
    });
    setNewComment('');
  }, [sentence, newComment, onAddAnnotation, agentHasRead, onAIFollowUp, currentUserName]);

  const handleAddReply = useCallback(
    (annotationId: string, text: string) => {
      onAddReply(annotationId, {
        text,
        userName: currentUserName || 'Anonymous',
      });
    },
    [onAddReply, currentUserName]
  );

  // Sort annotations: by timestamp (oldest first for natural conversation flow)
  const sortedAnnotations = useMemo(() => {
    // Create array with original indices to preserve insertion order for same timestamps
    const annotationsWithIndex = annotations.map((ann, idx) => ({ ann, idx }));
    return annotationsWithIndex
      .sort((a, b) => {
        const timeA = new Date(a.ann.timestamp).getTime();
        const timeB = new Date(b.ann.timestamp).getTime();
        // Sort by timestamp (oldest first - so conversation flows top to bottom)
        // If timestamps are equal, preserve original insertion order
        if (timeA === timeB) {
          return a.idx - b.idx;
        }
        return timeA - timeB;
      })
      .map(item => item.ann);
  }, [annotations]);

  // Get AI label color
  const aiLabelColor = sentence?.aiLabel ? getColorForSentenceLabel(sentence.aiLabel) : undefined;

  return (
    <>
      {/* Panel */}
      <div
        className={`fixed top-0 right-0 h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 shadow-2xl transform z-50 flex flex-col ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: `${panelWidth}px`,
          transition: isResizing ? 'none' : 'transform 300ms ease-in-out',
        }}
      >
        {/* Resize handle */}
        <div
          className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize group z-10 flex items-center"
          onMouseDown={handleResizeStart}
        >
          {/* Visual indicator */}
          <div className="absolute left-0 top-0 bottom-0 w-1 bg-transparent group-hover:bg-indigo-400/50 transition-colors" />
          {/* Grip icon - visible on hover */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-100 dark:bg-indigo-900 rounded-r px-0.5 py-2">
            <GripVertical className="w-3 h-4 text-indigo-500" />
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 dark:text-white">Discussion</h3>
              <p className="text-xs text-slate-500">
                {annotations.length} comment{annotations.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* AI Prompt Settings button - only show when agent has read */}
            {agentHasRead && aiPromptTemplate && onAiPromptTemplateChange && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setEditingPrompt(aiPromptTemplate);
                  setShowPromptSettings(!showPromptSettings);
                }}
                className={`h-8 w-8 ${showPromptSettings ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-600' : ''}`}
                title="AI Prompt Settings"
              >
                <Settings className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* AI Prompt Settings Panel - collapsible */}
        {showPromptSettings && aiPromptTemplate && onAiPromptTemplateChange && (
          <div className="p-4 bg-indigo-50 dark:bg-indigo-950/50 border-b border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-medium text-indigo-800 dark:text-indigo-200">
                  @AI Prompt Template
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEditingPrompt(`The user has a question "{{QUESTION}}" in Section "{{SECTION}}", for sentence: "{{SENTENCE}}"

{{ANALYSIS_CONTEXT}}

Please answer the user's question about this sentence in the context of the paper.
Be concise but thorough (2-4 sentences typically).
If you don't know or the question is outside the paper's scope, say so honestly.`);
                }}
                className="h-7 text-xs text-indigo-600 hover:text-indigo-800"
                title="Reset to default template"
              >
                <RotateCcw className="w-3 h-3 mr-1" />
                Reset
              </Button>
            </div>
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mb-2">
              Customize the prompt sent to AI when you ask @AI questions. Use placeholders:
            </p>
            <div className="flex flex-wrap gap-1 mb-2">
              <code className="text-[10px] px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded">{'{{QUESTION}}'}</code>
              <code className="text-[10px] px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded">{'{{SECTION}}'}</code>
              <code className="text-[10px] px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded">{'{{SENTENCE}}'}</code>
              <code className="text-[10px] px-1.5 py-0.5 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded">{'{{ANALYSIS_CONTEXT}}'}</code>
            </div>
            <Textarea
              value={editingPrompt}
              onChange={(e) => setEditingPrompt(e.target.value)}
              className="mb-2 text-xs font-mono bg-white dark:bg-slate-800 border-indigo-300 dark:border-indigo-700 min-h-[120px]"
              rows={6}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingPrompt(aiPromptTemplate);
                  setShowPromptSettings(false);
                }}
                className="h-7 text-xs"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onAiPromptTemplateChange(editingPrompt);
                  setShowPromptSettings(false);
                }}
                className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700"
              >
                Save Template
              </Button>
            </div>
          </div>
        )}

        {/* Sentence preview - expandable */}
        {sentence && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
            {/* AI Label Badge - prominent display */}
            {sentence.aiLabel && (
              <div className="mb-3 flex items-center gap-2">
                <Tag className="w-4 h-4" style={{ color: aiLabelColor }} />
                <span
                  className="text-sm font-semibold px-2.5 py-1 rounded-md"
                  style={{
                    backgroundColor: `${aiLabelColor}20`,
                    color: aiLabelColor
                  }}
                >
                  {getSentenceLabelName(sentence.aiLabel)}
                </span>
              </div>
            )}

            {/* Section info badge */}
            {sentence.section && (
              <div className="mb-2 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
                  In section {sentence.section.fullTitle}
                </span>
              </div>
            )}
            <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
              <User className="w-3 h-3" />
              Selected sentence
            </p>
            <p className="text-sm text-slate-700 dark:text-slate-300 italic">
              "{displayedSentenceText}"
            </p>
            {needsTruncation && (
              <button
                onClick={() => setIsSentenceExpanded(!isSentenceExpanded)}
                className="mt-2 flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
              >
                {isSentenceExpanded ? (
                  <>
                    <ChevronUp className="w-3 h-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3 h-3" />
                    Show full sentence ({sentenceText.length} characters)
                  </>
                )}
              </button>
            )}
          </div>
        )}

        {/* Discussion list - with proper overflow handling */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4">
            {annotations.length === 0 ? (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                <p className="text-sm text-slate-500">No comments yet</p>
                <p className="text-xs text-slate-400 mt-1">
                  Be the first to start a discussion
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
                    onEditAnnotation={onEditAnnotation}
                    onEditReply={onEditReply}
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
              {/* AI responding indicator */}
              {isAIResponding && (
                <div className="mb-3 flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-2 rounded-lg">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI is thinking...</span>
                </div>
              )}

              <div className="relative">
                <Textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder={agentHasRead ? "Add your thoughts... (type @AI to ask a follow-up question)" : "Add your thoughts..."}
                  className="mb-2 text-sm resize-none"
                  rows={3}
                  disabled={isAIResponding}
                />
                {/* @AI hint badge */}
                {agentHasRead && !newComment.includes('@AI') && !newComment.includes('@ai') && (
                  <div className="absolute bottom-4 right-2 flex items-center gap-1 text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                    <AtSign className="w-3 h-3" />
                    <span>AI</span>
                  </div>
                )}
              </div>
              <Button
                onClick={handleSubmitComment}
                disabled={!newComment.trim() || !sentence || isAIResponding}
                className="w-full gap-2"
              >
                {isAIResponding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Waiting for AI...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Post Comment
                  </>
                )}
              </Button>
            </>
          ) : (
            <div className="text-center py-2">
              <p className="text-sm text-slate-500 mb-3">Login to join the discussion</p>
              <Link href="/login">
                <Button className="w-full gap-2">
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
