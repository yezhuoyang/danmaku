import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  HelpCircle,
  RefreshCw,
  Loader2,
  BookOpen,
  Globe,
  User,
  ChevronDown,
  ChevronUp,
  Trophy,
  ArrowUpRight,
  GitBranch,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import type { AiAgentHistory, OpenQuestion, PublicInsight, SuggestedParent } from "../../../../shared/types";
import * as api from "../../lib/api";
import { toast } from "sonner";

interface OpenQuestionsSectionProps {
  paperId: string;
  sessions: AiAgentHistory[];
  currentUserId?: string;
}

export function OpenQuestionsSection({ paperId, sessions, currentUserId }: OpenQuestionsSectionProps) {
  const [activeTab, setActiveTab] = useState<'mine' | 'public'>('mine');
  const [openQuestions, setOpenQuestions] = useState<OpenQuestion[]>([]);
  const [openQuestionsLoaded, setOpenQuestionsLoaded] = useState(false);
  const [publicInsights, setPublicInsights] = useState<PublicInsight[]>([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [expandedPublicSessions, setExpandedPublicSessions] = useState<Set<string>>(new Set());

  // Promotion to Challenge Problem
  const [promotionDialogOpen, setPromotionDialogOpen] = useState(false);
  const [promotingQuestion, setPromotingQuestion] = useState<{question: OpenQuestion; historyId: string} | null>(null);
  const [promotionTitle, setPromotionTitle] = useState('');
  const [promotionDescription, setPromotionDescription] = useState('');
  const [promotionArea, setPromotionArea] = useState('');
  const [isPromoting, setIsPromoting] = useState(false);

  // AI Parent suggestion
  const [suggestedParents, setSuggestedParents] = useState<SuggestedParent[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [loadingParents, setLoadingParents] = useState(false);

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
        // Filter to only include those with open questions
        const withQuestions = insights.filter(i => i.openQuestions && i.openQuestions.length > 0);
        setPublicInsights(withQuestions);
      })
      .catch(console.error)
      .finally(() => setPublicLoading(false));
  }, [paperId]);

  // Load cached insights when session is selected
  useEffect(() => {
    if (selectedSession && currentUserId) {
      api.getInsights(paperId, selectedSession)
        .then(data => {
          if (data.openQuestions) {
            setOpenQuestions(data.openQuestions);
            setOpenQuestionsLoaded(true);
          }
        })
        .catch(console.error);
    }
  }, [paperId, selectedSession, currentUserId]);

  const handleGenerateOpenQuestions = async (historyId: string) => {
    setIsLoading(true);
    setSelectedSession(historyId);
    try {
      const response = await api.generateOpenQuestions(paperId, historyId);
      setOpenQuestions(response.questions);
      setOpenQuestionsLoaded(true);
      toast.success(`Generated ${response.questions.length} open questions!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate open questions');
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

  // Handle opening promotion dialog
  const openPromotionDialog = (question: OpenQuestion, historyId: string) => {
    setPromotingQuestion({ question, historyId });
    setPromotionTitle(question.question);
    setPromotionDescription(question.context || '');
    setPromotionArea(question.relatedTopics?.[0] || '');
    setSuggestedParents([]);
    setSelectedParentId('');
    setPromotionDialogOpen(true);
  };

  // Get API key from the session for AI calls
  const getApiKeyFromSession = (historyId: string) => {
    const session = sessions.find(s => s.id === historyId);
    return session?.apiKey || '';
  };

  // Handle suggesting parent problems
  const handleSuggestParents = async () => {
    if (!promotingQuestion || !promotionTitle) return;

    const apiKey = getApiKeyFromSession(promotingQuestion.historyId);
    if (!apiKey) {
      toast.error('No API key available. Configure your AI session first.');
      return;
    }

    setLoadingParents(true);
    try {
      const { suggestions } = await api.suggestParentProblem({
        title: promotionTitle,
        description: promotionDescription,
        apiKey,
        provider: 'openai',
      });
      setSuggestedParents(suggestions);
      if (suggestions.length === 0) {
        toast.info('No suitable parent problems found. This will be a top-level challenge.');
      } else {
        toast.success(`Found ${suggestions.length} potential parent problems`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to suggest parents');
    } finally {
      setLoadingParents(false);
    }
  };

  // Handle promotion submit
  const handlePromoteQuestion = async () => {
    if (!promotingQuestion) return;

    setIsPromoting(true);
    try {
      await api.promoteIdeaToChallenge({
        historyId: promotingQuestion.historyId,
        ideaId: promotingQuestion.question.id || `q-${Date.now()}`,
        title: promotionTitle,
        description: promotionDescription,
        area: promotionArea || undefined,
        type: 'open_question',
        parentId: selectedParentId || undefined,
      });
      toast.success('Question promoted to Challenge Problems!');
      setPromotionDialogOpen(false);
      setPromotingQuestion(null);
      setSuggestedParents([]);
      setSelectedParentId('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to promote question');
    } finally {
      setIsPromoting(false);
    }
  };

  // Render importance badge color
  const getImportanceBadgeVariant = (importance: string) => {
    switch (importance) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  // Render a single question
  const renderQuestion = (q: OpenQuestion, i: number, historyId?: string) => (
    <div key={q.id || i} className="p-4 bg-muted/50 rounded-lg border">
      <div className="flex items-start gap-3">
        <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
          <HelpCircle className="h-3.5 w-3.5 text-purple-600" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-medium text-sm leading-relaxed">{q.question}</p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge variant={getImportanceBadgeVariant(q.importance)} className="text-xs">
                {q.importance}
              </Badge>
              {currentUserId && historyId && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                  onClick={(e) => {
                    e.stopPropagation();
                    openPromotionDialog(q, historyId);
                  }}
                >
                  <Trophy className="h-3 w-3 mr-1" />
                  Promote
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{q.context}</p>
          {q.relatedTopics && q.relatedTopics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {q.relatedTopics.map((topic, j) => (
                <Badge key={j} variant="outline" className="text-xs">{topic}</Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // My questions content
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

    if (!openQuestionsLoaded) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Let the AI analyze this paper to identify unsolved open research questions.
          </p>
          <div className="space-y-3">
            {eligibleSessions.map(session => (
              <Button
                key={session.id}
                variant="outline"
                className="w-full justify-start h-auto py-3"
                onClick={() => handleGenerateOpenQuestions(session.id)}
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
          <span className="text-sm text-muted-foreground">{openQuestions.length} open questions identified</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setOpenQuestionsLoaded(false);
              setOpenQuestions([]);
            }}
          >
            <RefreshCw className="h-3 w-3 mr-1" />Regenerate
          </Button>
        </div>

        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {openQuestions.map((q, i) => renderQuestion(q, i, selectedSession || undefined))}
        </div>
      </div>
    );
  };

  // Public questions content
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
          <p className="font-medium">No public open questions yet</p>
          <p className="text-sm mt-1">
            Be the first to generate and share open questions for this paper!
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Open questions identified by other users from their AI sessions.
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
                  {insight.openQuestions?.length || 0} questions
                </p>
              </div>
              {expandedPublicSessions.has(insight.sessionId) ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            {expandedPublicSessions.has(insight.sessionId) && insight.openQuestions && (
              <div className="p-3 pt-0 space-y-3 border-t">
                {insight.openQuestions.map((q, i) => renderQuestion(q, i, insight.sessionId))}
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
            <HelpCircle className="h-5 w-5 text-purple-500" />
            Open Questions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'mine' | 'public')}>
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="mine" className="flex items-center gap-1.5 text-xs">
                <User className="h-3.5 w-3.5" />
                My Questions
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
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-yellow-500" />
              Promote to Challenge Problem
            </DialogTitle>
            <DialogDescription>
              Add this open question to the Challenge Problems database for the community to explore and solve.
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
              <Label htmlFor="promo-desc">Description</Label>
              <Textarea
                id="promo-desc"
                value={promotionDescription}
                onChange={(e) => setPromotionDescription(e.target.value)}
                placeholder="Describe the problem and why it's important..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-area">Research Area (optional)</Label>
              <Input
                id="promo-area"
                value={promotionArea}
                onChange={(e) => setPromotionArea(e.target.value)}
                placeholder="e.g., Machine Learning, Cryptography"
              />
            </div>

            {/* Parent Problem Suggestion */}
            <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Parent Problem (optional)
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSuggestParents}
                  disabled={loadingParents || !promotionTitle.trim()}
                >
                  {loadingParents ? (
                    <>
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                      Finding...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 mr-1" />
                      Find Parent with AI
                    </>
                  )}
                </Button>
              </div>

              {suggestedParents.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    AI suggests adding this as a sub-problem of:
                  </p>
                  <Select value={selectedParentId} onValueChange={setSelectedParentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a parent problem (or leave empty for top-level)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No parent (top-level problem)</SelectItem>
                      {suggestedParents.map((parent) => (
                        <SelectItem key={parent.id} value={parent.id}>
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[350px]">{parent.title}</span>
                            <Badge variant="secondary" className="text-xs">
                              {Math.round(parent.confidence * 100)}%
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedParentId && (
                    <div className="text-xs text-muted-foreground p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <span className="font-medium">AI reasoning: </span>
                      {suggestedParents.find(p => p.id === selectedParentId)?.reasoning}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Click "Find Parent with AI" to analyze existing challenge problems and suggest where this should be placed in the hierarchy.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromotionDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePromoteQuestion} disabled={isPromoting || !promotionTitle.trim()}>
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
