import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, X, HelpCircle } from 'lucide-react';

interface QuestionInputPanelProps {
  questions: string[];
  onChange: (questions: string[]) => void;
}

const SUGGESTED_QUESTIONS = [
  'What is the main contribution of this paper?',
  'How does this approach differ from prior work?',
  'What are the key limitations?',
  'What experiments were conducted to validate the claims?',
  'What are the potential applications?',
  'What future work is suggested?',
];

export function QuestionInputPanel({ questions, onChange }: QuestionInputPanelProps) {
  const [newQuestion, setNewQuestion] = useState('');

  function handleAddQuestion() {
    if (newQuestion.trim() && !questions.includes(newQuestion.trim())) {
      onChange([...questions, newQuestion.trim()]);
      setNewQuestion('');
    }
  }

  function handleRemoveQuestion(index: number) {
    onChange(questions.filter((_, i) => i !== index));
  }

  function handleAddSuggested(question: string) {
    if (!questions.includes(question)) {
      onChange([...questions, question]);
    }
  }

  return (
    <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
      <div className="flex items-center gap-2">
        <HelpCircle className="w-4 h-4 text-primary" />
        <Label className="font-medium">Reading Questions</Label>
      </div>
      <p className="text-xs text-muted-foreground">
        Add questions you want the AI to keep in mind while reading. The AI will try to find answers as it analyzes the paper.
      </p>

      {/* Current Questions */}
      {questions.length > 0 && (
        <div className="space-y-2">
          {questions.map((question, index) => (
            <div
              key={index}
              className="flex items-start gap-2 p-2 bg-background rounded-md"
            >
              <span className="text-sm text-muted-foreground mt-0.5">{index + 1}.</span>
              <span className="flex-1 text-sm">{question}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                onClick={() => handleRemoveQuestion(index)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add New Question */}
      <div className="flex gap-2">
        <Input
          value={newQuestion}
          onChange={(e) => setNewQuestion(e.target.value)}
          placeholder="Enter a question..."
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddQuestion();
            }
          }}
        />
        <Button variant="outline" size="icon" onClick={handleAddQuestion}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Suggested Questions */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Suggested questions:</p>
        <div className="flex flex-wrap gap-1">
          {SUGGESTED_QUESTIONS.filter((q) => !questions.includes(q)).map((question) => (
            <Button
              key={question}
              variant="ghost"
              size="sm"
              className="h-auto py-1 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => handleAddSuggested(question)}
            >
              <Plus className="w-3 h-3 mr-1" />
              {question.length > 40 ? question.slice(0, 40) + '...' : question}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
