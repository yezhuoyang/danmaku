import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FlaskConical,
  RefreshCw,
  Loader2,
  BookOpen,
  Globe,
  User,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Zap,
  Star,
  Trophy,
  ArrowUpRight,
} from "lucide-react";
import type { AiAgentHistory, ResearchIdea, PublicInsight } from "../../../../shared/types";
import * as api from "../../lib/api";
import { toast } from "sonner";

interface ResearchIdeasSectionProps {
  paperId: string;
  sessions: AiAgentHistory[];
  currentUserId?: string;
}

export function ResearchIdeasSection({ paperId, sessions, currentUserId }: ResearchIdeasSectionProps) {
  const [activeTab, setActiveTab] = useState<'mine' | 'public'>('mine');
  const [researchIdeas, setResearchIdeas] = useState<ResearchIdea[]>([]);
  const [researchIdeasLoaded, setResearchIdeasLoaded] = useState(false);
  const [publicInsights, setPublicInsights] = useState<PublicInsight[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [expandedPublicSessions, setExpandedPublicSessions] = useState<Set<string>>(new Set());

  // Promotion state
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [promotingIdea, setPromotingIdea] = useState<{idea: ResearchIdea; historyId: string} | null>(null);
  const [promotionTitle, setPromotionTitle] = useState('');
  const [promotionDescription, setPromotionDescription] = useState('');
  const [promotionArea, setPromotionArea] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);

  // Filter sessions that have AI analysis and belong to current user
  const eligibleSessions = sessions.filter(
    s => s.userId === currentUserId &&
         s.apiKeySet &&
         s.sentenceAnalysis &&
         Object.keys(s.sentenceAnalysis).length > 0
  );

  // Load public insights
  useEffect(() => {
    setPublicLoading(true);
    api.getPublicInsights(paperId)
      .then(({ insights }) => {
        // Filter to only include those with research ideas
        const withIdeas = insights.filter(i => i.researchIdeas && i.researchIdeas.length > 0);
        setPublicInsights(withIdeas);
      })
      .catch(console.error)
      .finally(() => setPublicLoading(false));
  }, [paperId]);

  // Load cached insights when session is selected
  useEffect(() => {
    if (selectedSession && currentUserId) {
      api.getInsights(paperId, selectedSession)
        .then(data => {
          if (data.researchIdeas) {
            setResearchIdeas(data.researchIdeas);
            setResearchIdeasLoaded(true);
          }
        })
        .catch(console.error);
    }
  }, [paperId, selectedSession, currentUserId]);

  const handleGenerateResearchIdeas = async (historyId: string) => {
    setIsLoading(true);
    setSelectedSession(historyId);
    try {
      const response = await api.generateResearchIdeas(paperId, historyId);
      setResearchIdeas(response.ideas);
      setResearchIdeasLoaded(true);
      toast.success(`Generated ${response.ideas.length} research ideas!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate research ideas');
    } finally {
      setIsLoading(false);
    }
  };

  const togglePublicSession = (sessionId: string) => {
    setExpandedPublicSessions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sessionId)) {
        newSet.delete(sessionId);
      } else {
        newSet.add(sessionId);
      }
      return newSet;
    });
  };

  // Open promotion dialog
  const openPromotionDialog = (idea: ResearchIdea, historyId: string) => {
    setPromotingIdea({ idea, historyId });
    setPromotionTitle(idea.title);
    setPromotionDescription(idea.description);
    setPromotionArea('');
    setPromotionDialogOpen(true);
  };

  // Handle promotion submit
  const handlePromoteIdea = async () => {
    if (!promotingIdea) return;

    setIsPromoting(true);
    try {
      const result = await api.promoteIdeaToChallenge({
        historyId: promotingIdea.historyId,
        ideaId: promotingIdea.idea.id!,
        title: promotionTitle,
        description: promotionDescription,
        area: promotionArea || undefined,
      });
      toast.success('Research idea promoted to Challenge Problem!');
      setPromotionDialogOpen(false);
      setPromotingIdea(null);
    } catch (error: any) {
      toast.error(error.message || 'Failed to promote idea');
    } finally {
      setIsPromoting(false);
    }
  };

  // Render feasibility badge color
  const getFeasibilityColor = (feasibility: string) => {
    switch (feasibility) {
      case 'high': return 'text-green-600 bg-green-100 dark:bg-green-900/30';
      case 'medium': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
      default: return 'text-red-600 bg-red-100 dark:bg-red-900/30';
    }
  };

  // Render novelty icon
  const getNoveltyIcon = (novelty: string) => {
    switch (novelty) {
      case 'breakthrough': return <Star className="h-3 w-3" />;
      case 'moderate': return <Sparkles className="h-3 w-3" />;
      default: return <Zap className="h-3 w-3" />;
    }
  };

  // Render a single research idea
  const renderIdea = (idea: ResearchIdea, i: number, historyId?: string) => (
    <div key={idea.id || i} className="p-4 bg-muted/50 rounded-lg border">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-4 w-4 text-blue-500" />
            <h4 className="font-medium">{idea.title}</h4>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <Badge className={`text-xs ${getFeasibilityColor(idea.feasibility)}`}>
              {idea.feasibility} feasibility
            </Badge>
            <Badge variant="outline" className="text-xs flex items-center gap-1">
              {getNoveltyIcon(idea.novelty)}
              {idea.novelty}
            </Badge>
            {historyId && currentUserId && idea.id && (
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-xs ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  openPromotionDialog(idea, historyId);
                }}
              >
                <Trophy className="h-3 w-3 mr-1" />
                Promote
              </Button>
            )}
          </div>
        </div>

        <p className="text-sm text-muted-foreground">{idea.description}</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-background rounded">
            <span className="font-medium text-blue-600 dark:text-blue-400">Methodology:</span>
            <p className="text-muted-foreground mt-1">{idea.methodology}</p>
          </div>
          <div className="p-2 bg-background rounded">
            <span className="font-medium text-green-600 dark:text-green-400">Expected Outcome:</span>
            <p className="text-muted-foreground mt-1">{idea.expectedOutcome}</p>
          </div>
        </div>

        {idea.prerequisites && idea.prerequisites.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1">
            <span className="text-xs text-muted-foreground mr-1">Prerequisites:</span>
            {idea.prerequisites.map((prereq, j) => (
              <Badge key={j} variant="secondary" className="text-xs">{prereq}</Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // My ideas content
  const renderMyContent = () => {
    if (eligibleSessions.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No AI sessions available</p>
          <p className="text-sm mt-1">
            Create an AI session and use "Let Agent Read" first.
          </p>
        </div>
      );
    }

    if (!researchIdeasLoaded) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Let the AI propose feasible research ideas that build upon this paper.
          </p>
          <div className="space-y-3">
            {eligibleSessions.map(session => (
              <Button
                key={session.id}
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => handleGenerateResearchIdeas(session.id)}
                disabled={isLoading}
              >
                <div className="flex flex-col items-start gap-1">
                  <span className="font-medium">{session.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {session.modelUsed} - {Object.keys(session.sentenceAnalysis || {}).length} sentences
                  </span>
                </div>
                {isLoading && <Loader2 className="h-4 w-4 ml-auto animate-spin" />}
              </Button>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{researchIdeas.length} research ideas proposed</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setResearchIdeasLoaded(false);
              setResearchIdeas([]);
            }}
          >
            <RefreshCw className="h-3 w-3 mr-1" />Regenerate
          </Button>
        </div>

        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {researchIdeas.map((idea, i) => renderIdea(idea, i, selectedSession || undefined))}
        </div>
      </div>
    );
  };

  // Public ideas content
  const renderPublicContent = () => {
    if (publicLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (publicInsights.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground">
          <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
          <p className="font-medium">No public research ideas yet</p>
          <p className="text-sm mt-1">
            Be the first to generate and share research ideas for this paper!
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Research ideas proposed by other users from their AI sessions.
        </p>
        {publicInsights.map(insight => (
          <div key={insight.sessionId} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => togglePublicSession(insight.sessionId)}
              className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
            >
              <Avatar className="h-8 w-8">
                <AvatarImage src={insight.userAvatar} />
                <AvatarFallback>
                  <User className="h-4 w-4" />
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{insight.userName}</span>
                  <span className="text-xs text-muted-foreground">via {insight.modelUsed}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {insight.researchIdeas?.length || 0} ideas
                </p>
              </div>
              {expandedPublicSessions.has(insight.sessionId) ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {expandedPublicSessions.has(insight.sessionId) && insight.researchIdeas && (
              <div className="p-3 pt-0 space-y-4 border-t">
                {insight.researchIdeas.map((idea, i) => renderIdea(idea, i))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FlaskConical className="h-5 w-5 text-blue-500" />
            Research Ideas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'mine' | 'public')}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="mine" className="flex items-center gap-1.5 text-xs">
                <User className="h-3.5 w-3.5" />
                My Ideas
              </TabsTrigger>
              <TabsTrigger value="public" className="flex items-center gap-1.5 text-xs">
                <Globe className="h-3.5 w-3.5" />
                Public ({publicInsights.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mine" className="mt-0">
              {renderMyContent()}
            </TabsContent>

            <TabsContent value="public" className="mt-0">
              {renderPublicContent()}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Promotion Dialog */}
      <Dialog open={promotionDialogOpen} onOpenChange={setPromotionDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Promote to Challenge Problem
            </DialogTitle>
            <DialogDescription>
              Promote this research idea to the Challenge Problems database for the community to explore.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="promo-title">Title</Label>
              <Input
                id="promo-title"
                value={promotionTitle}
                onChange={(e) => setPromotionTitle(e.target.value)}
                placeholder="Challenge problem title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-description">Description</Label>
              <Textarea
                id="promo-description"
                value={promotionDescription}
                onChange={(e) => setPromotionDescription(e.target.value)}
                placeholder="Describe the challenge problem"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-area">Research Area (optional)</Label>
              <Input
                id="promo-area"
                value={promotionArea}
                onChange={(e) => setPromotionArea(e.target.value)}
                placeholder="e.g., Machine Learning, NLP, Computer Vision"
              />
            </div>

            {promotingIdea && (
              <div className="p-3 bg-muted rounded-lg text-sm">
                <div className="flex items-center gap-2 mb-2">
                  <FlaskConical className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Original Idea</span>
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className={getFeasibilityColor(promotingIdea.idea.feasibility)}>
                    {promotingIdea.idea.feasibility} feasibility
                  </Badge>
                  <Badge variant="outline">
                    {promotingIdea.idea.novelty} novelty
                  </Badge>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromotionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePromoteIdea} disabled={isPromoting || !promotionTitle.trim()}>
              {isPromoting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Promoting...
                </>
              ) : (
                <>
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                  Promote to Challenge
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
