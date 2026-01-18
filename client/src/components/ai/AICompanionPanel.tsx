import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Sparkles,
  Loader2,
  AlertCircle,
  Settings,
  Send,
  MessageCircle,
} from "lucide-react";
import {
  aiService,
  PaperContent,
} from "@/lib/ai-service";
import { AISettingsPanel } from "./AISettingsPanel";
import { Annotation } from "@/components/annotations/AnnotationDanmaku";
import type { AiAgentHistory } from "../../../../shared/types";
import * as api from "@/lib/api";

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AICompanionPanelProps {
  paperContent: PaperContent;
  onAddAnnotation: (annotation: Omit<Annotation, 'id' | 'timestamp'>) => void;
  existingAnnotations: Annotation[];
  /** Callback to search for text in the PDF and get its bounding box */
  onSearchTextInPdf?: (text: string) => { x: number; y: number; width: number; height: number } | null;
  /** The current page's text content for text matching */
  pageTextContent?: string;
  /** Container element for dialog portal (used in fullscreen mode) */
  dialogContainer?: HTMLElement | null;
  /** The currently active AI session */
  activeSession?: AiAgentHistory | null;
  /** Paper ID for API calls */
  paperId?: string;
  /** Callback when session is updated (e.g., token usage changes) */
  onSessionUpdated?: (session: AiAgentHistory) => void;
}

export function AICompanionPanel({
  paperContent,
  dialogContainer,
  activeSession,
  paperId,
  onSessionUpdated,
}: AICompanionPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');

  // Check if we have a properly configured session (with API key)
  const hasActiveSessionWithKey = activeSession && activeSession.apiKeySet;

  // Chat is enabled if we have a session with API key
  const canChat = hasActiveSessionWithKey && paperId;

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    if (!canChat) {
      setError('Please configure an AI session with an API key first');
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Build context about the paper for the chat
      const context = `Paper: ${paperContent.title}
Page ${paperContent.pageNumber} of ${paperContent.totalPages}

Current page text:
${paperContent.pageText?.slice(0, 2000) || 'No text available'}`;

      // Use server-side chat API which uses the session's encrypted API key
      const result = await api.chatWithAgent(
        paperId!,
        activeSession!.id,
        userMessage.content,
        context
      );

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.response,
        timestamp: new Date(),
      };

      setChatMessages(prev => [...prev, assistantMessage]);

      // Update session if callback provided (for token usage tracking)
      if (onSessionUpdated && result.updatedHistory) {
        onSessionUpdated(result.updatedHistory);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gradient-to-b from-indigo-50/50 to-white dark:from-slate-900 dark:to-slate-800 rounded-lg border border-indigo-100 dark:border-slate-700">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-indigo-100 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-800 dark:text-white">AI Companion</h3>
            <p className="text-xs text-slate-500">Chat about the paper</p>
          </div>
        </div>
        <AISettingsPanel
          onConfigChange={() => {}}
          trigger={
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Settings className="w-4 h-4" />
            </Button>
          }
          container={dialogContainer}
        />
      </div>

      {/* Configuration Status - Show based on active session */}
      {!hasActiveSessionWithKey && (
        <div className="flex-shrink-0 mx-4 mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-amber-800 dark:text-amber-200">API Not Configured</p>
              <p className="text-amber-600 dark:text-amber-400 text-xs mt-1">
                {!activeSession
                  ? "Please create and activate an AI session on the Paper Details page first."
                  : "Click the settings icon to add your OpenAI API key."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info about Let Agent Read */}
      <div className="flex-shrink-0 mx-4 mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-lg">
        <div className="flex items-start gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-indigo-800 dark:text-indigo-200">Sentence Analysis</p>
            <p className="text-indigo-600 dark:text-indigo-400 text-xs mt-1">
              Use the <strong>"Let Agent Read"</strong> button in the toolbar to analyze all sentences.
              Then click any sentence to see AI labels and comments in the Discussion panel.
            </p>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="flex-shrink-0 mx-4 mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <ScrollArea className="flex-1 min-h-0 p-4">
        {chatMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
              <MessageCircle className="w-8 h-8 text-indigo-500" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
              Ask questions about the paper
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              e.g., "What is the main contribution?" or "Explain the attention mechanism"
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {chatMessages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                    <span className="text-sm text-slate-500">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Chat Input */}
      <div className="flex-shrink-0 p-4 border-t border-indigo-100 dark:border-slate-700">
        <div className="flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask about the paper..."
            className="text-sm resize-none"
            rows={2}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!canChat || isLoading || !inputMessage.trim()}
            className="h-auto px-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
