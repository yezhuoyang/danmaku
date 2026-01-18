import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Brain,
  CheckCircle,
  XCircle,
  ArrowRight,
  Trophy,
  Target,
  Lightbulb,
  RefreshCw,
  Loader2,
  BookOpen,
  Clock,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  FlaskConical,
  Settings,
  Sparkles,
  AlertTriangle,
  Zap,
  Star,
} from "lucide-react";
import type { AiAgentHistory, OpenQuestion, ResearchIdea } from "../../../shared/types";
import * as api from "../lib/api";
import { toast } from "sonner";

interface AIInsightsPanelProps {
  paperId: string;
  sessions: AiAgentHistory[];
  currentUserId?: string;
}

type QuizState = 'idle' | 'selecting' | 'question' | 'answered' | 'results';

interface CurrentQuestion {
  id: string;
  questionNumber: number;
  question: string;
  choices: { A: string; B: string; C: string; D: string };
  difficulty: string;
  topic: string;
}

interface AnswerResult {
  isCorrect: boolean;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  currentScore: number;
  totalAnswered: number;
}

interface QuizResult {
  finalScore: number;
  correctAnswers: number;
  totalQuestions: number;
  diagnosis: string;
  suggestions: string[];
  questionResults: Array<{
    questionNumber: number;
    question: string;
    userAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    topic: string;
  }>;
}

// Default prompts that users can customize
const DEFAULT_QUIZ_PROMPT = `Generate a multiple-choice quiz question to test understanding of this academic paper.
The question should test comprehension of key concepts, methods, or findings.
Vary the difficulty and topic to provide a comprehensive assessment.`;

const DEFAULT_OPEN_QUESTIONS_PROMPT = `Analyze this academic paper and identify unsolved open research questions.
Look for:
- Questions the authors explicitly mention as future work
- Limitations that suggest areas needing more research
- Assumptions that could be challenged
- Extensions or generalizations that haven't been explored
Provide 3-5 well-thought-out open questions with context and importance assessment.`;

const DEFAULT_RESEARCH_IDEAS_PROMPT = `Based on this academic paper, propose feasible research ideas that could extend or build upon the work.
For each idea, consider:
- What makes it novel compared to existing work
- A practical methodology to pursue it
- Expected outcomes and impact
- Prerequisites and feasibility
Provide 3-5 concrete, actionable research ideas suitable for graduate students or researchers.`;

export function AIInsightsPanel({ paperId, sessions, currentUserId }: AIInsightsPanelProps) {
  const [activeTab, setActiveTab] = useState<'quiz' | 'questions' | 'ideas'>('quiz');

  // Quiz state
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [previousQuizzes, setPreviousQuizzes] = useState<api.QuizSessionSummary[]>([]);
  const [showPreviousQuizzes, setShowPreviousQuizzes] = useState(false);

  // Open questions state
  const [openQuestions, setOpenQuestions] = useState<OpenQuestion[]>([]);
  const [openQuestionsLoaded, setOpenQuestionsLoaded] = useState(false);

  // Research ideas state
  const [researchIdeas, setResearchIdeas] = useState<ResearchIdea[]>([]);
  const [researchIdeasLoaded, setResearchIdeasLoaded] = useState(false);

  // Shared state
  const [isLoading, setIsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  // Prompt customization
  const [showPromptSettings, setShowPromptSettings] = useState(false);
  const [quizPrompt, setQuizPrompt] = useState(DEFAULT_QUIZ_PROMPT);
  const [openQuestionsPrompt, setOpenQuestionsPrompt] = useState(DEFAULT_OPEN_QUESTIONS_PROMPT);
  const [researchIdeasPrompt, setResearchIdeasPrompt] = useState(DEFAULT_RESEARCH_IDEAS_PROMPT);

  // Filter sessions that have AI analysis
  const eligibleSessions = sessions.filter(
    s => s.userId === currentUserId &&
         s.apiKeySet &&
         s.sentenceAnalysis &&
         Object.keys(s.sentenceAnalysis).length > 0
  );

  // Load previous quizzes
  useEffect(() => {
    if (currentUserId) {
      api.getQuizSessions(paperId)
        .then(({ sessions }) => setPreviousQuizzes(sessions))
        .catch(console.error);
    }
  }, [paperId, currentUserId, quizState]);

  // Load cached insights when session is selected
  useEffect(() => {
    if (selectedSession && currentUserId) {
      api.getInsights(paperId, selectedSession)
        .then(data => {
          if (data.openQuestions) {
            setOpenQuestions(data.openQuestions);
            setOpenQuestionsLoaded(true);
          }
          if (data.researchIdeas) {
            setResearchIdeas(data.researchIdeas);
            setResearchIdeasLoaded(true);
          }
        })
        .catch(console.error);
    }
  }, [paperId, selectedSession, currentUserId]);

  const handleStartQuiz = async (historyId: string) => {
    setIsLoading(true);
    setSelectedSession(historyId);
    try {
      const response = await api.startQuiz(paperId, historyId);
      setQuizSessionId(response.sessionId);
      setCurrentQuestion(response.question as CurrentQuestion);
      setAnsweredCount(response.answeredCount);
      setQuizState('question');
      toast.success('Quiz started! Answer 10 questions to test your understanding.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to start quiz');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!quizSessionId || !currentQuestion || !selectedAnswer) return;

    setIsLoading(true);
    try {
      const response = await api.submitQuizAnswer(
        paperId,
        quizSessionId,
        currentQuestion.id,
        selectedAnswer
      );

      setAnswerResult({
        isCorrect: response.isCorrect,
        correctAnswer: response.correctAnswer,
        explanation: response.explanation,
        currentScore: response.currentScore,
        totalAnswered: response.totalAnswered,
      });
      setAnsweredCount(response.totalAnswered);
      setQuizState('answered');

      if (response.isComplete) {
        const results = await api.getQuizResults(paperId, quizSessionId);
        setQuizResult(results);
      } else if (response.nextQuestion) {
        setCurrentQuestion(response.nextQuestion as CurrentQuestion);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit answer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNextQuestion = () => {
    if (quizResult) {
      setQuizState('results');
    } else {
      setSelectedAnswer(null);
      setAnswerResult(null);
      setQuizState('question');
    }
  };

  const handleQuizReset = () => {
    setQuizState('idle');
    setQuizSessionId(null);
    setCurrentQuestion(null);
    setSelectedAnswer(null);
    setAnswerResult(null);
    setQuizResult(null);
    setAnsweredCount(0);
  };

  const handleGenerateOpenQuestions = async (historyId: string) => {
    setIsLoading(true);
    setSelectedSession(historyId);
    try {
      const response = await api.generateOpenQuestions(paperId, historyId, openQuestionsPrompt);
      setOpenQuestions(response.questions);
      setOpenQuestionsLoaded(true);
      toast.success(`Generated ${response.questions.length} open questions!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate open questions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateResearchIdeas = async (historyId: string) => {
    setIsLoading(true);
    setSelectedSession(historyId);
    try {
      const response = await api.generateResearchIdeas(paperId, historyId, researchIdeasPrompt);
      setResearchIdeas(response.ideas);
      setResearchIdeasLoaded(true);
      toast.success(`Generated ${response.ideas.length} research ideas!`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to generate research ideas');
    } finally {
      setIsLoading(false);
    }
  };

  // No eligible sessions message
  if (eligibleSessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No AI sessions available</p>
            <p className="text-sm mt-1">
              First, create an AI session with an API key and use "Let Agent Read"
              to analyze the paper before using AI insights.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Render importance badge color
  const getImportanceBadgeVariant = (importance: string) => {
    switch (importance) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
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

  // Render novelty badge
  const getNoveltyIcon = (novelty: string) => {
    switch (novelty) {
      case 'breakthrough': return <Star className="h-3 w-3" />;
      case 'moderate': return <Sparkles className="h-3 w-3" />;
      default: return <Zap className="h-3 w-3" />;
    }
  };

  // Session selector component
  const SessionSelector = ({ onSelect, actionText }: { onSelect: (id: string) => void; actionText: string }) => (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground mb-4">
        Choose an AI session to use for {actionText}:
      </p>
      {eligibleSessions.map(session => (
        <Button
          key={session.id}
          variant="outline"
          className="w-full justify-start h-auto py-3"
          onClick={() => onSelect(session.id)}
          disabled={isLoading}
        >
          <div className="flex flex-col items-start gap-1">
            <span className="font-medium">{session.title}</span>
            <span className="text-xs text-muted-foreground">
              {session.modelUsed} - {Object.keys(session.sentenceAnalysis || {}).length} sentences analyzed
            </span>
          </div>
          {isLoading && <Loader2 className="h-4 w-4 ml-auto animate-spin" />}
        </Button>
      ))}
    </div>
  );

  // Quiz content based on state
  const renderQuizContent = () => {
    if (quizState === 'selecting') {
      return (
        <div className="space-y-4">
          <SessionSelector onSelect={handleStartQuiz} actionText="generating quiz questions" />
          <Button variant="ghost" onClick={handleQuizReset} className="w-full">
            Cancel
          </Button>
        </div>
      );
    }

    if (quizState === 'question' && currentQuestion) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Question {currentQuestion.questionNumber} of 10</span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{currentQuestion.difficulty}</Badge>
              <Badge variant="secondary" className="text-xs">{currentQuestion.topic}</Badge>
            </div>
          </div>
          <Progress value={answeredCount * 10} className="h-2" />

          <p className="font-medium text-base leading-relaxed">{currentQuestion.question}</p>

          <div className="space-y-2">
            {(['A', 'B', 'C', 'D'] as const).map(letter => (
              <button
                key={letter}
                onClick={() => setSelectedAnswer(letter)}
                disabled={isLoading}
                className={`w-full p-3 text-left rounded-lg border-2 transition-all ${
                  selectedAnswer === letter
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50'
                }`}
              >
                <span className="font-bold mr-3">{letter}.</span>
                {currentQuestion.choices[letter]}
              </button>
            ))}
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={handleQuizReset} disabled={isLoading}>Quit</Button>
            <Button onClick={handleSubmitAnswer} disabled={!selectedAnswer || isLoading} className="flex-1">
              {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ArrowRight className="h-4 w-4 mr-2" />}
              Submit Answer
            </Button>
          </div>
        </div>
      );
    }

    if (quizState === 'answered' && answerResult) {
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {answerResult.isCorrect ? (
                <>
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="text-green-600 font-medium">Correct!</span>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-500" />
                  <span className="text-red-600 font-medium">Incorrect</span>
                </>
              )}
            </div>
            <Badge variant="outline">Score: {answerResult.currentScore}/{answerResult.totalAnswered}</Badge>
          </div>
          <Progress value={answerResult.totalAnswered * 10} className="h-2" />

          {!answerResult.isCorrect && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm"><span className="font-medium">Correct Answer: </span>{answerResult.correctAnswer}</p>
            </div>
          )}

          <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-2">
              <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-blue-800 dark:text-blue-200">{answerResult.explanation}</p>
            </div>
          </div>

          <Button onClick={handleNextQuestion} className="w-full">
            {quizResult ? (
              <><Trophy className="h-4 w-4 mr-2" />View Results</>
            ) : (
              <><ArrowRight className="h-4 w-4 mr-2" />Next Question</>
            )}
          </Button>
        </div>
      );
    }

    if (quizState === 'results' && quizResult) {
      const scorePercentage = (quizResult.finalScore / 10) * 100;
      const scoreColor =
        quizResult.finalScore >= 8 ? 'text-green-600' :
        quizResult.finalScore >= 6 ? 'text-yellow-600' :
        quizResult.finalScore >= 4 ? 'text-orange-600' : 'text-red-600';

      return (
        <div className="space-y-6">
          <div className="text-center py-4">
            <div className={`text-5xl font-bold ${scoreColor}`}>{quizResult.finalScore}/10</div>
            <p className="text-muted-foreground mt-1">
              {quizResult.correctAnswers} correct out of {quizResult.totalQuestions} questions
            </p>
            <Progress value={scorePercentage} className="h-3 mt-4" />
          </div>

          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2 flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />AI Assessment
            </h4>
            <p className="text-sm text-muted-foreground">{quizResult.diagnosis}</p>
          </div>

          {quizResult.suggestions.length > 0 && (
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-yellow-500" />Suggestions
              </h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                {quizResult.suggestions.map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-primary">-</span>{s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <h4 className="font-medium mb-2">Question Breakdown</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {quizResult.questionResults.map(q => (
                <div key={q.questionNumber} className="flex items-center gap-2 text-sm p-2 bg-muted/30 rounded">
                  {q.isCorrect ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                  <span className="font-medium">Q{q.questionNumber}</span>
                  <span className="text-muted-foreground truncate flex-1">{q.topic}</span>
                  {!q.isCorrect && <span className="text-xs text-muted-foreground">({q.userAnswer} - {q.correctAnswer})</span>}
                </div>
              ))}
            </div>
          </div>

          <Button onClick={handleQuizReset} className="w-full">
            <RefreshCw className="h-4 w-4 mr-2" />Take Another Quiz
          </Button>
        </div>
      );
    }

    // Idle state
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Test your understanding of this paper with a 10-question quiz.
          The AI will generate questions based on your reading session analysis.
        </p>

        <Button onClick={() => setQuizState('selecting')} className="w-full" size="lg">
          <Target className="h-4 w-4 mr-2" />Start Quiz
        </Button>

        {previousQuizzes.length > 0 && (
          <div className="pt-4 border-t">
            <button
              onClick={() => setShowPreviousQuizzes(!showPreviousQuizzes)}
              className="flex items-center justify-between w-full text-sm text-muted-foreground hover:text-foreground"
            >
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />Previous Quizzes ({previousQuizzes.length})
              </span>
              {showPreviousQuizzes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showPreviousQuizzes && (
              <div className="mt-2 space-y-2">
                {previousQuizzes.map(quiz => (
                  <div key={quiz.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg text-sm">
                    <div>
                      <span className="font-medium">{quiz.sessionTitle}</span>
                      <span className="text-muted-foreground ml-2">
                        {new Date(quiz.createdAt * 1000).toLocaleDateString()}
                      </span>
                    </div>
                    {quiz.isComplete ? (
                      <Badge variant={quiz.finalScore! >= 7 ? 'default' : quiz.finalScore! >= 5 ? 'secondary' : 'destructive'}>
                        {quiz.finalScore}/10
                      </Badge>
                    ) : (
                      <Badge variant="outline">In Progress</Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // Open Questions content
  const renderOpenQuestionsContent = () => {
    if (!openQuestionsLoaded) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Let the AI analyze this paper to identify unsolved open research questions
            that could guide future work.
          </p>
          <SessionSelector onSelect={handleGenerateOpenQuestions} actionText="identifying open questions" />
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
          {openQuestions.map((q, i) => (
            <div key={q.id || i} className="p-4 bg-muted/50 rounded-lg border">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm leading-relaxed">{q.question}</p>
                    <Badge variant={getImportanceBadgeVariant(q.importance)} className="flex-shrink-0 text-xs">
                      {q.importance}
                    </Badge>
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
          ))}
        </div>
      </div>
    );
  };

  // Research Ideas content
  const renderResearchIdeasContent = () => {
    if (!researchIdeasLoaded) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Let the AI propose feasible research ideas that build upon or extend the work in this paper.
          </p>
          <SessionSelector onSelect={handleGenerateResearchIdeas} actionText="generating research ideas" />
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
          {researchIdeas.map((idea, i) => (
            <div key={idea.id || i} className="p-4 bg-muted/50 rounded-lg border">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-4 w-4 text-blue-500" />
                    <h4 className="font-medium">{idea.title}</h4>
                  </div>
                  <div className="flex items-center gap-1">
                    <Badge className={`text-xs ${getFeasibilityColor(idea.feasibility)}`}>
                      {idea.feasibility} feasibility
                    </Badge>
                    <Badge variant="outline" className="text-xs flex items-center gap-1">
                      {getNoveltyIcon(idea.novelty)}
                      {idea.novelty}
                    </Badge>
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
          ))}
        </div>
      </div>
    );
  };

  // Prompt settings panel
  const renderPromptSettings = () => (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
      <h4 className="font-medium flex items-center gap-2">
        <Settings className="h-4 w-4" />
        Customize AI Prompts
      </h4>
      <p className="text-xs text-muted-foreground">
        Modify the prompts below to customize how the AI generates content.
        Changes will apply to the next generation.
      </p>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium flex items-center gap-2 mb-2">
            <Brain className="h-3 w-3" />Quiz Questions Prompt
          </label>
          <Textarea
            value={quizPrompt}
            onChange={(e) => setQuizPrompt(e.target.value)}
            rows={3}
            className="text-xs"
            placeholder="Enter custom prompt for quiz generation..."
          />
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 text-xs"
            onClick={() => setQuizPrompt(DEFAULT_QUIZ_PROMPT)}
          >
            Reset to default
          </Button>
        </div>

        <div>
          <label className="text-sm font-medium flex items-center gap-2 mb-2">
            <HelpCircle className="h-3 w-3" />Open Questions Prompt
          </label>
          <Textarea
            value={openQuestionsPrompt}
            onChange={(e) => setOpenQuestionsPrompt(e.target.value)}
            rows={4}
            className="text-xs"
            placeholder="Enter custom prompt for open questions..."
          />
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 text-xs"
            onClick={() => setOpenQuestionsPrompt(DEFAULT_OPEN_QUESTIONS_PROMPT)}
          >
            Reset to default
          </Button>
        </div>

        <div>
          <label className="text-sm font-medium flex items-center gap-2 mb-2">
            <FlaskConical className="h-3 w-3" />Research Ideas Prompt
          </label>
          <Textarea
            value={researchIdeasPrompt}
            onChange={(e) => setResearchIdeasPrompt(e.target.value)}
            rows={4}
            className="text-xs"
            placeholder="Enter custom prompt for research ideas..."
          />
          <Button
            variant="ghost"
            size="sm"
            className="mt-1 text-xs"
            onClick={() => setResearchIdeasPrompt(DEFAULT_RESEARCH_IDEAS_PROMPT)}
          >
            Reset to default
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-purple-500" />
            AI Insights
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPromptSettings(!showPromptSettings)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {showPromptSettings && renderPromptSettings()}

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="quiz" className="flex items-center gap-1.5 text-xs">
              <Brain className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Test Understanding</span>
              <span className="sm:hidden">Quiz</span>
            </TabsTrigger>
            <TabsTrigger value="questions" className="flex items-center gap-1.5 text-xs">
              <HelpCircle className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Open Questions</span>
              <span className="sm:hidden">Questions</span>
            </TabsTrigger>
            <TabsTrigger value="ideas" className="flex items-center gap-1.5 text-xs">
              <FlaskConical className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Research Ideas</span>
              <span className="sm:hidden">Ideas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="quiz" className="mt-4">
            {renderQuizContent()}
          </TabsContent>

          <TabsContent value="questions" className="mt-4">
            {renderOpenQuestionsContent()}
          </TabsContent>

          <TabsContent value="ideas" className="mt-4">
            {renderResearchIdeasContent()}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
