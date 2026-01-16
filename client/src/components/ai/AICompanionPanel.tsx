import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus,
  Settings,
  Zap,
  Brain,
  FlaskConical,
  Target,
  Lightbulb,
  HelpCircle,
  BookOpen,
} from "lucide-react";
import {
  aiService,
  AIAnnotationRequest,
  AnnotationSuggestion,
  AnnotationType,
  PaperContent,
  StreamingChunk,
} from "@/lib/ai-service";
import { AISettingsPanel } from "./AISettingsPanel";
import { Annotation, ANNOTATION_COLORS } from "@/components/annotations/AnnotationDanmaku";

interface AICompanionPanelProps {
  paperContent: PaperContent;
  onAddAnnotation: (annotation: Omit<Annotation, 'id' | 'timestamp'>) => void;
  existingAnnotations: Annotation[];
}

const ANNOTATION_TYPE_CONFIG: Record<AnnotationType, { icon: React.ElementType; label: string; color: string }> = {
  equation: { icon: Zap, label: 'Equations', color: '#8B5CF6' },
  conclusion: { icon: Target, label: 'Conclusions', color: '#22C55E' },
  method: { icon: FlaskConical, label: 'Methods', color: '#3B82F6' },
  definition: { icon: BookOpen, label: 'Definitions', color: '#F97316' },
  result: { icon: CheckCircle, label: 'Results', color: '#06B6D4' },
  insight: { icon: Lightbulb, label: 'Insights', color: '#EAB308' },
  question: { icon: HelpCircle, label: 'Questions', color: '#EC4899' },
};

export function AICompanionPanel({
  paperContent,
  onAddAnnotation,
  existingAnnotations,
}: AICompanionPanelProps) {
  const [isConfigured, setIsConfigured] = useState(aiService.isConfigured());
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [suggestions, setSuggestions] = useState<AnnotationSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  
  // Annotation type selection
  const [selectedTypes, setSelectedTypes] = useState<AnnotationType[]>([
    'equation', 'conclusion', 'method', 'definition'
  ]);
  
  // Custom prompt
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);

  const handleTypeToggle = (type: AnnotationType) => {
    setSelectedTypes(prev => 
      prev.includes(type)
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleGenerate = useCallback(async () => {
    if (!aiService.isConfigured()) {
      setError('Please configure your AI settings first');
      return;
    }

    if (selectedTypes.length === 0) {
      setError('Please select at least one annotation type');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStreamingContent('');
    setSuggestions([]);

    const request: AIAnnotationRequest = {
      paper: {
        ...paperContent,
        existingAnnotations: existingAnnotations.map(a => ({
          text: a.text,
          type: a.highlightRegion.type,
          userName: a.userName,
        })),
      },
      annotationTypes: selectedTypes,
      customPrompt: showCustomPrompt ? customPrompt : undefined,
      language: 'auto',
      maxSuggestions: 5,
    };

    try {
      await aiService.generateAnnotationsStream(request, (chunk: StreamingChunk) => {
        switch (chunk.type) {
          case 'content':
            setStreamingContent(prev => prev + (chunk.content || ''));
            break;
          case 'suggestion':
            if (chunk.suggestion) {
              setSuggestions(prev => [...prev, chunk.suggestion!]);
            }
            break;
          case 'error':
            setError(chunk.error || 'Unknown error');
            break;
          case 'done':
            setStreamingContent('');
            break;
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate annotations');
    } finally {
      setIsGenerating(false);
    }
  }, [paperContent, existingAnnotations, selectedTypes, customPrompt, showCustomPrompt]);

  const handleAddSuggestion = (suggestion: AnnotationSuggestion) => {
    // Map suggestion to annotation format
    const typeConfig = ANNOTATION_TYPE_CONFIG[suggestion.type];
    const color = suggestion.suggestedColor || typeConfig.color;
    
    // Calculate position based on positionHint
    const positionY = suggestion.positionHint 
      ? suggestion.positionHint * 800 // Approximate page height
      : 100 + Math.random() * 400;

    const annotation: Omit<Annotation, 'id' | 'timestamp'> = {
      text: suggestion.content,
      latex: suggestion.latex,
      color,
      userName: 'AI Assistant',
      userAvatar: undefined,
      pageNumber: paperContent.pageNumber,
      position: {
        x: 500 + Math.random() * 100,
        y: positionY,
      },
      highlightRegion: {
        x: 50,
        y: positionY - 20,
        width: 400,
        height: 30,
        type: suggestion.type === 'equation' ? 'equation' : 'text',
        label: suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1),
      },
    };

    onAddAnnotation(annotation);
    setAddedIds(prev => new Set(Array.from(prev).concat(suggestion.id)));
  };

  const handleAddAll = () => {
    suggestions.forEach(suggestion => {
      if (!addedIds.has(suggestion.id)) {
        handleAddSuggestion(suggestion);
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-indigo-50/50 to-white dark:from-slate-900 dark:to-slate-800 rounded-lg border border-indigo-100 dark:border-slate-700">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-indigo-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">AI Companion</h3>
            <p className="text-xs text-slate-500">Auto-generate annotations</p>
          </div>
        </div>
        <AISettingsPanel
          onConfigChange={() => setIsConfigured(aiService.isConfigured())}
          trigger={
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="w-4 h-4" />
            </Button>
          }
        />
      </div>

      {/* Configuration Status */}
      {!isConfigured && (
        <div className="mx-4 mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">API Not Configured</p>
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                Click the settings icon to add your OpenAI API key.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Annotation Type Selection */}
      <div className="p-4 border-b border-indigo-100 dark:border-slate-700">
        <Label className="text-sm font-medium mb-3 block">Annotation Types</Label>
        <div className="grid grid-cols-2 gap-2">
          {(Object.entries(ANNOTATION_TYPE_CONFIG) as [AnnotationType, typeof ANNOTATION_TYPE_CONFIG[AnnotationType]][]).map(
            ([type, config]) => {
              const Icon = config.icon;
              const isSelected = selectedTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => handleTypeToggle(type)}
                  className={`
                    flex items-center gap-2 p-2 rounded-lg border text-left text-sm
                    transition-all duration-200
                    ${isSelected
                      ? 'border-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 dark:border-indigo-700'
                      : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'
                    }
                  `}
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${config.color}20` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                  </div>
                  <span className={isSelected ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-600 dark:text-slate-400'}>
                    {config.label}
                  </span>
                </button>
              );
            }
          )}
        </div>
      </div>

      {/* Custom Prompt */}
      <div className="px-4 py-3 border-b border-indigo-100 dark:border-slate-700">
        <button
          onClick={() => setShowCustomPrompt(!showCustomPrompt)}
          className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-indigo-600"
        >
          <Brain className="w-4 h-4" />
          {showCustomPrompt ? 'Hide' : 'Add'} Custom Instructions
        </button>
        {showCustomPrompt && (
          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="E.g., Focus on machine learning concepts, explain in simple terms..."
            className="mt-2 text-sm"
            rows={2}
          />
        )}
      </div>

      {/* Generate Button */}
      <div className="p-4">
        <Button
          onClick={handleGenerate}
          disabled={!isConfigured || isGenerating || selectedTypes.length === 0}
          className="w-full gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Analyzing Page {paperContent.pageNumber}...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Annotations
            </>
          )}
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mx-4 mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Streaming Content */}
      {isGenerating && streamingContent && (
        <div className="mx-4 mb-4 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg border">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              AI is thinking...
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-pre-wrap">
            {streamingContent.slice(-200)}...
          </p>
        </div>
      )}

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex items-center justify-between px-4 py-2 border-t border-indigo-100 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {suggestions.length} Suggestion{suggestions.length > 1 ? 's' : ''}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddAll}
              disabled={suggestions.every(s => addedIds.has(s.id))}
              className="gap-1 text-xs"
            >
              <Plus className="w-3 h-3" />
              Add All
            </Button>
          </div>
          
          <ScrollArea className="flex-1 px-4 pb-4">
            <div className="space-y-3">
              {suggestions.map((suggestion) => {
                const config = ANNOTATION_TYPE_CONFIG[suggestion.type];
                const Icon = config.icon;
                const isAdded = addedIds.has(suggestion.id);
                
                return (
                  <div
                    key={suggestion.id}
                    className={`
                      p-3 rounded-lg border transition-all duration-200
                      ${isAdded
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-indigo-300'
                      }
                    `}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-6 h-6 rounded flex items-center justify-center"
                          style={{ backgroundColor: `${config.color}20` }}
                        >
                          <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
                        </div>
                        <span className="text-xs font-medium" style={{ color: config.color }}>
                          {config.label}
                        </span>
                        <span className="text-xs text-slate-400">
                          {Math.round(suggestion.confidence * 100)}% confident
                        </span>
                      </div>
                      <Button
                        variant={isAdded ? "ghost" : "outline"}
                        size="sm"
                        onClick={() => handleAddSuggestion(suggestion)}
                        disabled={isAdded}
                        className="h-7 text-xs gap-1"
                      >
                        {isAdded ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            Added
                          </>
                        ) : (
                          <>
                            <Plus className="w-3 h-3" />
                            Add
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Target Text */}
                    {suggestion.targetText && (
                      <div className="mb-2 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-300 italic">
                        "{suggestion.targetText.slice(0, 100)}{suggestion.targetText.length > 100 ? '...' : ''}"
                      </div>
                    )}

                    {/* Content */}
                    <p className="text-sm text-slate-700 dark:text-slate-200">
                      {suggestion.content}
                    </p>

                    {/* LaTeX Preview */}
                    {suggestion.latex && (
                      <div className="mt-2 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded text-xs font-mono text-indigo-700 dark:text-indigo-300">
                        {suggestion.latex}
                      </div>
                    )}

                    {/* Reasoning */}
                    {suggestion.reasoning && (
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                        💡 {suggestion.reasoning}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      )}

      {/* Empty State */}
      {!isGenerating && suggestions.length === 0 && isConfigured && (
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div>
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-indigo-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Select annotation types and click "Generate" to let AI analyze the current page.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
