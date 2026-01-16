import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
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
  MapPin,
  Search,
} from "lucide-react";
import {
  aiService,
  AIAnnotationRequest,
  AnnotationSuggestion,
  AnnotationType,
  PaperContent,
  StreamingChunk,
  fuzzyFindTextInPage,
} from "@/lib/ai-service";
import { AISettingsPanel } from "./AISettingsPanel";
import { Annotation, ANNOTATION_COLORS } from "@/components/annotations/AnnotationDanmaku";

interface AICompanionPanelProps {
  paperContent: PaperContent;
  onAddAnnotation: (annotation: Omit<Annotation, 'id' | 'timestamp'>) => void;
  existingAnnotations: Annotation[];
  /** Callback to search for text in the PDF and get its bounding box */
  onSearchTextInPdf?: (text: string) => { x: number; y: number; width: number; height: number } | null;
  /** The current page's text content for text matching */
  pageTextContent?: string;
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

// Map annotation type to highlight region type
const TYPE_TO_REGION: Record<AnnotationType, 'text' | 'equation' | 'figure' | 'table'> = {
  equation: 'equation',
  conclusion: 'text',
  method: 'text',
  definition: 'text',
  result: 'text',
  insight: 'text',
  question: 'text',
};

export function AICompanionPanel({
  paperContent,
  onAddAnnotation,
  existingAnnotations,
  onSearchTextInPdf,
  pageTextContent,
}: AICompanionPanelProps) {
  const [isConfigured, setIsConfigured] = useState(aiService.isConfigured());
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [suggestions, setSuggestions] = useState<AnnotationSuggestion[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  
  // Track text match status for each suggestion
  const [matchStatus, setMatchStatus] = useState<Record<string, { found: boolean; matchedText?: string; confidence?: number }>>({});
  
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

  // Find text position in the page
  const findTextPosition = useCallback((suggestion: AnnotationSuggestion): { 
    found: boolean; 
    region?: { x: number; y: number; width: number; height: number };
    matchedText?: string;
    confidence?: number;
  } => {
    const textToSearch = suggestion.exactQuote || suggestion.targetText || '';
    const keyPhrase = suggestion.keyPhrase;
    
    // First try using the PDF search callback if available
    if (onSearchTextInPdf && textToSearch) {
      const result = onSearchTextInPdf(textToSearch);
      if (result) {
        return { found: true, region: result, matchedText: textToSearch, confidence: 1.0 };
      }
      // Try key phrase
      if (keyPhrase) {
        const keyResult = onSearchTextInPdf(keyPhrase);
        if (keyResult) {
          return { found: true, region: keyResult, matchedText: keyPhrase, confidence: 0.8 };
        }
      }
    }
    
    // Fall back to text content matching
    const searchText = pageTextContent || paperContent.pageText;
    if (searchText && textToSearch) {
      const match = fuzzyFindTextInPage(searchText, textToSearch, keyPhrase);
      if (match) {
        // Estimate position based on character position in text
        // This is a rough approximation - actual PDF coordinates would be better
        const totalChars = searchText.length;
        const relativePosition = match.start / totalChars;
        
        // Estimate Y position based on relative text position
        // Assuming page height of ~800px and text area from y=100 to y=700
        const estimatedY = 100 + relativePosition * 600;
        
        return {
          found: true,
          region: {
            x: 100,
            y: Math.max(80, Math.min(700, estimatedY)),
            width: Math.min(400, match.text.length * 6),
            height: 25,
          },
          matchedText: match.text,
          confidence: match.confidence,
        };
      }
    }
    
    return { found: false };
  }, [onSearchTextInPdf, pageTextContent, paperContent.pageText]);

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
    setMatchStatus({});

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
      console.log('Starting AI annotation generation with request:', request);
      await aiService.generateAnnotationsStream(request, (chunk: StreamingChunk) => {
        console.log('Received chunk:', chunk.type, chunk);
        switch (chunk.type) {
          case 'content':
            setStreamingContent(prev => prev + (chunk.content || ''));
            break;
          case 'suggestion':
            console.log('Received suggestion:', chunk.suggestion);
            if (chunk.suggestion) {
              const suggestion = chunk.suggestion;
              setSuggestions(prev => [...prev, suggestion]);
              
              // Check if we can find the text in the page
              const matchResult = findTextPosition(suggestion);
              setMatchStatus(prev => ({
                ...prev,
                [suggestion.id]: {
                  found: matchResult.found,
                  matchedText: matchResult.matchedText,
                  confidence: matchResult.confidence,
                },
              }));
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
  }, [paperContent, existingAnnotations, selectedTypes, customPrompt, showCustomPrompt, findTextPosition]);

  const handleAddSuggestion = (suggestion: AnnotationSuggestion) => {
    // Map suggestion to annotation format
    const typeConfig = ANNOTATION_TYPE_CONFIG[suggestion.type];
    const color = suggestion.suggestedColor || typeConfig.color;
    
    // Find the text position
    const positionResult = findTextPosition(suggestion);
    
    let highlightRegion: Annotation['highlightRegion'];
    let position: Annotation['position'];
    
    if (positionResult.found && positionResult.region) {
      // Use the found position
      highlightRegion = {
        x: positionResult.region.x,
        y: positionResult.region.y,
        width: positionResult.region.width,
        height: positionResult.region.height,
        type: TYPE_TO_REGION[suggestion.type],
        label: suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1),
      };
      position = {
        x: positionResult.region.x + positionResult.region.width + 20,
        y: positionResult.region.y,
      };
    } else {
      // Fallback to position hint or random position
      const positionY = suggestion.positionHint 
        ? suggestion.positionHint * 700 + 50
        : 100 + Math.random() * 400;
      
      highlightRegion = {
        x: 100,
        y: positionY,
        width: 350,
        height: 25,
        type: TYPE_TO_REGION[suggestion.type],
        label: suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1),
      };
      position = {
        x: 470,
        y: positionY,
      };
    }

    const annotation: Omit<Annotation, 'id' | 'timestamp'> = {
      text: suggestion.content,
      latex: suggestion.latex,
      color,
      userName: 'AI Assistant',
      userAvatar: undefined,
      pageNumber: paperContent.pageNumber,
      position,
      highlightRegion,
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
                const match = matchStatus[suggestion.id];
                
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

                    {/* Text Location Status */}
                    {match && (
                      <div className={`mb-2 px-2 py-1 rounded text-xs flex items-center gap-1 ${
                        match.found 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                      }`}>
                        {match.found ? (
                          <>
                            <MapPin className="w-3 h-3" />
                            <span>Location found ({Math.round((match.confidence || 0) * 100)}% match)</span>
                          </>
                        ) : (
                          <>
                            <Search className="w-3 h-3" />
                            <span>Text not found - will use approximate position</span>
                          </>
                        )}
                      </div>
                    )}

                    {/* Exact Quote - the text AI identified */}
                    {(suggestion.exactQuote || suggestion.targetText) && (
                      <div className="mb-2 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs text-slate-600 dark:text-slate-300">
                        <div className="flex items-center gap-1 mb-1 text-slate-500">
                          <Search className="w-3 h-3" />
                          <span className="font-medium">Target text:</span>
                        </div>
                        <span className="italic">
                          "{(suggestion.exactQuote || suggestion.targetText || '').slice(0, 150)}
                          {(suggestion.exactQuote || suggestion.targetText || '').length > 150 ? '...' : ''}"
                        </span>
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
