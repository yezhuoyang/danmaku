import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ChallengeProblem } from "../../../shared/types";
import { Link } from "wouter";
import {
  HelpCircle,
  Lightbulb,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  GitBranch,
  Link as LinkIcon,
  CheckCircle2,
  Search,
  Clock
} from "lucide-react";

interface ChallengeProblemCardProps {
  problem: ChallengeProblem;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  unsolved: {
    label: 'Unsolved',
    color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    icon: <HelpCircle className="h-3 w-3" />
  },
  investigating: {
    label: 'Investigating',
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    icon: <Search className="h-3 w-3" />
  },
  solved: {
    label: 'Solved',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: <CheckCircle2 className="h-3 w-3" />
  },
};

const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  open_question: {
    label: 'Question',
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: <HelpCircle className="h-3 w-3" />
  },
  research_idea: {
    label: 'Idea',
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    icon: <Lightbulb className="h-3 w-3" />
  },
};

const IMPORTANCE_CONFIG: Record<string, { color: string }> = {
  high: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  medium: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' },
  low: { color: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400' },
};

export function ChallengeProblemCard({ problem }: ChallengeProblemCardProps) {
  const statusConfig = STATUS_CONFIG[problem.status] || STATUS_CONFIG.unsolved;
  const typeConfig = TYPE_CONFIG[problem.type] || TYPE_CONFIG.open_question;

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
    if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
    if (seconds < 604800) return Math.floor(seconds / 86400) + "d ago";
    return Math.floor(seconds / 604800) + "w ago";
  };

  const score = problem.upvotes - problem.downvotes;

  return (
    <Link href={`/challenge/${problem.id}`}>
      <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              {/* Type Badge */}
              <Badge className={`text-xs ${typeConfig.color}`} variant="secondary">
                {typeConfig.icon}
                <span className="ml-1">{typeConfig.label}</span>
              </Badge>
              {/* Status Badge */}
              <Badge className={`text-xs ${statusConfig.color}`} variant="secondary">
                {statusConfig.icon}
                <span className="ml-1">{statusConfig.label}</span>
              </Badge>
            </div>
            {/* Importance */}
            {problem.importance && (
              <Badge
                className={`text-xs ${IMPORTANCE_CONFIG[problem.importance]?.color || ''}`}
                variant="secondary"
              >
                {problem.importance}
              </Badge>
            )}
          </div>
          <CardTitle className="text-base line-clamp-2 mt-2">{problem.title}</CardTitle>
          {problem.area && (
            <CardDescription className="text-xs">{problem.area}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {problem.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {problem.description}
            </p>
          )}

          {/* Stats Row */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
            {/* Score */}
            <span className={`flex items-center gap-1 font-medium ${
              score > 0 ? 'text-green-600 dark:text-green-400' :
              score < 0 ? 'text-red-500 dark:text-red-400' :
              'text-slate-500'
            }`}>
              <ThumbsUp className="h-3 w-3" />
              {problem.upvotes}
              <ThumbsDown className="h-3 w-3 ml-1" />
              {problem.downvotes}
            </span>
            {/* Comments */}
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {problem.commentCount}
            </span>
            {/* Sub-questions (for questions only) */}
            {problem.type === 'open_question' && problem.childCount > 0 && (
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <GitBranch className="h-3 w-3" />
                {problem.childCount} sub-questions
              </span>
            )}
            {/* Linked Ideas (for questions only) */}
            {problem.type === 'open_question' && problem.linkedIdeaCount > 0 && (
              <span className="flex items-center gap-1 text-purple-600 dark:text-purple-400">
                <LinkIcon className="h-3 w-3" />
                {problem.linkedIdeaCount} ideas
              </span>
            )}
          </div>

          {/* Tags */}
          {problem.tags && problem.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {problem.tags.slice(0, 3).map((tag, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">
                  {tag}
                </Badge>
              ))}
              {problem.tags.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{problem.tags.length - 3}
                </Badge>
              )}
            </div>
          )}

          {/* Author and Time */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <Avatar className="w-5 h-5">
                <AvatarImage src={problem.userAvatar} />
                <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                  {problem.userName?.charAt(0).toUpperCase() || '?'}
                </AvatarFallback>
              </Avatar>
              <span>{problem.userName}</span>
            </div>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {getTimeAgo(problem.createdAt)}
            </span>
          </div>

          {/* Paper Link (if associated) */}
          {problem.paperTitle && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs text-muted-foreground truncate">
                From: {problem.paperTitle}
              </p>
            </div>
          )}

          {/* Solved Info */}
          {problem.status === 'solved' && problem.solvedByName && (
            <div className="mt-2 pt-2 border-t">
              <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Solved by {problem.solvedByName}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
