import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
} from "lucide-react";
import type { AiAgentHistory } from "../../../../shared/types";
import * as api from "../../lib/api";
import { toast } from "sonner";

interface QuizSectionProps {
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

export function QuizSection({ paperId, sessions, currentUserId }: QuizSectionProps) {
  const [quizState, setQuizState] = useState<QuizState>('idle');
  const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<CurrentQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null);
  const [answerResult, setAnswerResult] = useState<AnswerResult | null>(null);
  const [quizResult, setQuizResult] = useState<QuizResult | null>(null);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [previousQuizzes, setPreviousQuizzes] = useState<api.QuizSessionSummary[]>([]);
  const [showPreviousQuizzes, setShowPreviousQuizzes] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Filter sessions that have AI analysis and belong to current user
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

  const handleStartQuiz = async (historyId: string) => {
    setIsLoading(true);
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

  // No eligible sessions message
  if (eligibleSessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="h-5 w-5 text-purple-500" />
            Test Understanding
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 text-muted-foreground">
            <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p className="font-medium">No AI sessions available</p>
            <p className="text-sm mt-1">
              First, create an AI session with an API key and use "Let Agent Read"
              to analyze the paper before taking a quiz.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Session selector component
  const SessionSelector = () => (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground mb-4">
        Choose an AI session to use for generating quiz questions:
      </p>
      {eligibleSessions.map(session => (
        <Button
          key={session.id}
          variant="outline"
          className="w-full justify-start h-auto py-3"
          onClick={() => handleStartQuiz(session.id)}
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

  // Render content based on state
  const renderContent = () => {
    if (quizState === 'selecting') {
      return (
        <div className="space-y-4">
          <SessionSelector />
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-5 w-5 text-purple-500" />
          Test Understanding
        </CardTitle>
      </CardHeader>
      <CardContent>
        {renderContent()}
      </CardContent>
    </Card>
  );
}
