import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PaperWithStats } from "../../../shared/types";
import { Link } from "wouter";
import { Users, MessageSquare, Star, Sparkles } from "lucide-react";

interface PaperCardProps {
  paper: PaperWithStats;
}

export function PaperCard({ paper }: PaperCardProps) {
  const authors = paper.authors.slice(0, 3).join(", ") +
    (paper.authors.length > 3 ? " et al." : "");

  return (
    <Link href={`/paper/${paper.id}`}>
      <Card className="h-full cursor-pointer hover:shadow-md transition-shadow overflow-hidden">
        {/* Paper Avatar as Hero Image */}
        {paper.activeAvatarUrl && (
          <div className="aspect-video bg-slate-100 dark:bg-slate-800 overflow-hidden">
            <img
              src={paper.activeAvatarUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <CardHeader className="pb-2">
          <CardTitle className="text-base line-clamp-2">{paper.title}</CardTitle>
          <CardDescription className="text-sm">{authors}</CardDescription>
        </CardHeader>
        <CardContent>
          {paper.abstract && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
              {paper.abstract}
            </p>
          )}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              {paper.readerCount}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              {paper.annotationCount}
            </span>
            {paper.averageRating && (
              <span className="flex items-center gap-1">
                <Star className="h-3 w-3" />
                {paper.averageRating.toFixed(1)}
              </span>
            )}
            {paper.hasAiAnalysis && (
              <Badge variant="secondary" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                AI
              </Badge>
            )}
          </div>
          {paper.arxivId && (
            <div className="mt-2">
              <Badge variant="outline" className="text-xs">
                arXiv:{paper.arxivId}
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
