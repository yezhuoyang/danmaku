import { useState, useEffect, useCallback } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as api from '@/lib/api';
import { LikeTargetType, LikeStatus } from '../../../../shared/types';
import { toast } from 'sonner';

interface LikeButtonsProps {
  targetType: LikeTargetType;
  targetId: string;
  currentUserId?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  // Optional initial status to avoid fetching
  initialStatus?: LikeStatus;
  // Callback when like status changes
  onStatusChange?: (status: LikeStatus) => void;
}

export function LikeButtons({
  targetType,
  targetId,
  currentUserId,
  size = 'sm',
  className,
  initialStatus,
  onStatusChange,
}: LikeButtonsProps) {
  const [status, setStatus] = useState<LikeStatus>(
    initialStatus || { likeCount: 0, dislikeCount: 0, userVote: null }
  );
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(!!initialStatus);

  // Fetch initial status if not provided
  useEffect(() => {
    if (!hasFetched && targetId) {
      api.getLikeStatus(targetType, targetId)
        .then((newStatus) => {
          setStatus(newStatus);
          setHasFetched(true);
        })
        .catch((err) => {
          console.error('Failed to fetch like status:', err);
          setHasFetched(true);
        });
    }
  }, [targetType, targetId, hasFetched]);

  const handleVote = useCallback(async (isLike: boolean) => {
    if (!currentUserId) {
      toast.error('Please log in to vote');
      return;
    }

    if (isLoading) return;

    setIsLoading(true);
    try {
      const response = await api.likeTarget(targetType, targetId, isLike);
      const newStatus: LikeStatus = {
        likeCount: response.likeCount,
        dislikeCount: response.dislikeCount,
        userVote: response.userVote,
      };
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    } catch (err: any) {
      toast.error(err.message || 'Failed to vote');
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, isLoading, targetType, targetId, onStatusChange]);

  const sizeClasses = {
    sm: {
      button: 'p-0.5',
      icon: 'w-3 h-3',
      text: 'text-[10px]',
      gap: 'gap-0.5',
    },
    md: {
      button: 'p-1',
      icon: 'w-4 h-4',
      text: 'text-xs',
      gap: 'gap-1',
    },
    lg: {
      button: 'p-1.5',
      icon: 'w-5 h-5',
      text: 'text-sm',
      gap: 'gap-1.5',
    },
  };

  const sizes = sizeClasses[size];

  return (
    <div className={cn('flex items-center', sizes.gap, className)}>
      {/* Like button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          handleVote(true);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={isLoading}
        className={cn(
          'flex items-center rounded transition-colors',
          sizes.button,
          sizes.gap,
          status.userVote === 'like'
            ? 'text-green-600 dark:text-green-400'
            : 'text-slate-400 hover:text-green-500 dark:text-slate-500 dark:hover:text-green-400',
          isLoading && 'opacity-50 cursor-not-allowed'
        )}
        title="Like"
      >
        <ThumbsUp className={cn(sizes.icon, status.userVote === 'like' && 'fill-current')} />
        {status.likeCount > 0 && (
          <span className={sizes.text}>{status.likeCount}</span>
        )}
      </button>

      {/* Dislike button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          handleVote(false);
        }}
        onMouseDown={(e) => e.stopPropagation()}
        disabled={isLoading}
        className={cn(
          'flex items-center rounded transition-colors',
          sizes.button,
          sizes.gap,
          status.userVote === 'dislike'
            ? 'text-red-600 dark:text-red-400'
            : 'text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400',
          isLoading && 'opacity-50 cursor-not-allowed'
        )}
        title="Dislike"
      >
        <ThumbsDown className={cn(sizes.icon, status.userVote === 'dislike' && 'fill-current')} />
        {status.dislikeCount > 0 && (
          <span className={sizes.text}>{status.dislikeCount}</span>
        )}
      </button>
    </div>
  );
}
