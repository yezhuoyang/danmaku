import { useState, useRef, useEffect } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { LikeButtons } from "@/components/ui/LikeButtons";
import {
  Bot,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Clock,
  User,
  Check,
  X,
  Play,
  Globe,
  Lock,
  BookOpen,
  AlertCircle,
  Key,
  Send,
  Loader2,
  Bug,
  Trophy,
} from "lucide-react";
import type { AiAgentHistory, AiAgentMessage, AiModelInfo, AiModelProvider, AiModelRanking } from "../../../shared/types";
import { DEFAULT_AI_MODELS } from "../../../shared/types";
import * as api from "../lib/api";
import { toast } from "sonner";

// Provider colors for badges
const PROVIDER_COLORS: Record<AiModelProvider, string> = {
  openai: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400',
  anthropic: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400',
  google: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400',
  xai: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300',
  meta: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400',
  deepseek: 'bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400',
  alibaba: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400',
  mistral: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400',
  cohere: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400',
  custom: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300',
};

interface AIAgentHistoryPanelProps {
  paperId: string;
  histories: AiAgentHistory[];
  currentUserId?: string;
  onHistoriesChange: (histories: AiAgentHistory[]) => void;
}

// Format timestamp to relative time
function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

// Single history card component
function HistoryCard({
  history,
  isOwner,
  paperId,
  currentUserId,
  onUpdate,
  onDelete,
  onActivate,
}: {
  history: AiAgentHistory;
  isOwner: boolean;
  paperId: string;
  currentUserId?: string;
  onUpdate: (updated: AiAgentHistory) => void;
  onDelete: (id: string) => void;
  onActivate: (id: string) => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [isSettingApiKey, setIsSettingApiKey] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to check if a message is an internal/system message (not user conversation)
  // These include: system context, page analysis, background generation, review generation
  const isInternalMessage = (content: string) => {
    // Check for various internal message patterns
    if (content.startsWith('[System Context')) return true;
    if (content.startsWith('[Analyze Page')) return true;
    if (content.startsWith('[Page ')) return true;  // Catches "[Page X Analysis]" responses
    if (content.startsWith('[Generate Background')) return true;
    if (content.startsWith('[Generated Background')) return true;
    if (content.startsWith('[Generate Review')) return true;
    if (content.startsWith('[Generated Review')) return true;
    // Also check if content starts with JSON (AI analysis responses)
    if (content.trim().startsWith('{') && content.includes('"sentences"')) return true;
    return false;
  };

  // Count only visible (user conversation) messages
  const visibleMessageCount = history.messages.filter(m =>
    (m.role === 'user' || m.role === 'assistant') && !isInternalMessage(m.content)
  ).length;

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (isExpanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [history.messages, isExpanded]);

  const handleTogglePublic = async () => {
    try {
      const result = await api.updateAiAgentHistory(paperId, history.id, {
        isPublic: !history.isPublic,
      });
      onUpdate(result.history);
      toast.success(result.history.isPublic ? "Made public" : "Made private");
    } catch (error) {
      toast.error("Failed to update visibility");
    }
  };

  const handleDelete = async () => {
    try {
      await api.deleteAiAgentHistory(paperId, history.id);
      onDelete(history.id);
      toast.success("History deleted");
    } catch (error) {
      toast.error("Failed to delete history");
    }
  };

  const handleActivate = async () => {
    try {
      const result = await api.activateAiAgentHistory(paperId, history.id);
      onActivate(history.id);
      toast.success("History activated");
    } catch (error) {
      toast.error("Failed to activate history");
    }
  };

  const handleSetApiKey = async () => {
    if (!apiKeyValue.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    setIsSettingApiKey(true);
    try {
      const result = await api.setSessionApiKey(paperId, history.id, apiKeyValue.trim());
      onUpdate(result.history);
      setApiKeyValue("");
      setShowApiKeyInput(false);
      toast.success("API key set successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to set API key");
    } finally {
      setIsSettingApiKey(false);
    }
  };

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return;

    if (!history.apiKeySet) {
      toast.error("Please set an API key first");
      return;
    }

    setIsSendingMessage(true);
    try {
      const result = await api.chatWithAgent(paperId, history.id, chatMessage.trim());
      onUpdate(result.updatedHistory);
      setChatMessage("");
    } catch (error: any) {
      toast.error(error.message || "Failed to send message");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      className={`border rounded-lg p-4 transition-all ${
        history.isActive
          ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
          : "border-slate-200 dark:border-slate-700"
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-slate-900 dark:text-white truncate">
              {history.title}
            </h4>
            {history.isActive && (
              <Badge className="bg-indigo-500 text-white text-[10px]">
                Active
              </Badge>
            )}
            {history.isPublic ? (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Globe className="w-3 h-3" />
                Public
              </Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px] gap-1">
                <Lock className="w-3 h-3" />
                Private
              </Badge>
            )}
            {/* Model Badge */}
            {history.modelId && (() => {
              const model = DEFAULT_AI_MODELS.find(m => m.id === history.modelId);
              const provider = model?.provider || 'custom';
              const modelName = model?.name || history.modelId;
              return (
                <Badge variant="outline" className={`text-[10px] border ${PROVIDER_COLORS[provider]}`}>
                  {modelName}
                </Badge>
              );
            })()}
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {history.userName}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {visibleMessageCount} messages
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatRelativeTime(history.updatedAt)}
            </span>
            {/* Like/Dislike buttons for AI session - helps with Model Arena rankings */}
            <LikeButtons
              targetType="ai_session"
              targetId={history.id}
              currentUserId={currentUserId}
              size="sm"
            />
          </div>
          {/* AI Reading Status */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {history.sentenceAnalysis && Object.keys(history.sentenceAnalysis).length > 0 ? (
              <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-700">
                <BookOpen className="w-3 h-3" />
                AI Read: {Object.keys(history.sentenceAnalysis).length} sentences
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] gap-1 bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-700">
                <AlertCircle className="w-3 h-3" />
                Not read yet
              </Badge>
            )}
            {history.figureTableAnalysis && Object.keys(history.figureTableAnalysis).length > 0 && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700">
                {Object.keys(history.figureTableAnalysis).length} figures/tables
              </Badge>
            )}
            {/* API Key Status */}
            {history.apiKeySet ? (
              <Badge variant="outline" className="text-[10px] gap-1 bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700">
                <Key className="w-3 h-3" />
                API Key Set
              </Badge>
            ) : isOwner && (
              <Badge variant="outline" className="text-[10px] gap-1 bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-600 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700" onClick={() => setShowApiKeyInput(true)}>
                <Key className="w-3 h-3" />
                Set API Key
              </Badge>
            )}
          </div>
          {/* Token Usage Display - show when API key is set or when there's usage data */}
          {(history.apiKeySet || (history.totalPromptTokens ?? 0) > 0 || (history.totalCompletionTokens ?? 0) > 0) && (() => {
            const promptTokens = history.totalPromptTokens ?? 0;
            const completionTokens = history.totalCompletionTokens ?? 0;
            const maxTokens = history.maxContextTokens ?? 128000;
            const rounds = history.conversationRounds ?? 0;
            const totalTokens = promptTokens + completionTokens;
            const percentage = maxTokens > 0 ? (totalTokens / maxTokens * 100) : 0;

            return (
              <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-2">
                  <span>
                    Token Usage: {totalTokens.toLocaleString()} / {maxTokens.toLocaleString()}
                  </span>
                  <span>
                    {percentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      percentage > 90
                        ? 'bg-red-500'
                        : percentage > 70
                        ? 'bg-amber-500'
                        : 'bg-indigo-500'
                    }`}
                    style={{
                      width: `${Math.min(100, percentage)}%`
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[10px] text-slate-500 dark:text-slate-500">
                  <span>Prompt: {promptTokens.toLocaleString()} | Completion: {completionTokens.toLocaleString()}</span>
                  <span>{rounds} round{rounds !== 1 ? 's' : ''}</span>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Set API Key button - prominent for owner without API key */}
          {isOwner && !history.apiKeySet && (
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                setIsExpanded(true);
                setShowApiKeyInput(true);
              }}
              title="Set API Key to enable AI features"
              className="h-8 px-3 gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
            >
              <Key className="w-4 h-4" />
              <span className="text-xs font-medium">Set API Key</span>
            </Button>
          )}
          {isOwner && !history.isActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleActivate}
              title="Activate this history"
              className="h-8 w-8 p-0"
            >
              <Play className="w-4 h-4 text-green-600" />
            </Button>
          )}
          {isOwner && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleTogglePublic}
              title={history.isPublic ? "Make private" : "Make public"}
              className="h-8 w-8 p-0"
            >
              {history.isPublic ? (
                <EyeOff className="w-4 h-4 text-slate-500" />
              ) : (
                <Eye className="w-4 h-4 text-slate-500" />
              )}
            </Button>
          )}
          {isOwner &&
            (isDeleting ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsDeleting(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDeleting(true)}
                title="Delete history"
                className="h-8 w-8 p-0"
              >
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            ))}
          <Link href={`/paper/${paperId}/session/${history.id}/debug`}>
            <Button
              variant="ghost"
              size="sm"
              title="View full history (debug)"
              className="h-8 w-8 p-0"
            >
              <Bug className="w-4 h-4 text-orange-500" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>

      {/* API Key Input (shown when setting up) */}
      {isExpanded && isOwner && showApiKeyInput && !history.apiKeySet && (
        <div className="mt-4 p-4 border border-dashed border-amber-300 dark:border-amber-700 rounded-lg bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 mb-2">
            <Key className="w-4 h-4 text-amber-600" />
            <h5 className="text-sm font-medium text-amber-800 dark:text-amber-300">Set OpenAI API Key</h5>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">
            Once set, the API key cannot be changed. This key will be used for chat and AI features in this session.
          </p>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="sk-..."
              value={apiKeyValue}
              onChange={(e) => setApiKeyValue(e.target.value)}
              className="flex-1"
            />
            <Button
              size="sm"
              onClick={handleSetApiKey}
              disabled={isSettingApiKey || !apiKeyValue.trim()}
            >
              {isSettingApiKey ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowApiKeyInput(false);
                setApiKeyValue("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Expanded messages - only show user and assistant messages (system/internal messages are on debug page) */}
      {isExpanded && (() => {
        // Filter out system messages AND internal "Let Agent Read" analysis messages
        const visibleMessages = history.messages.filter(m =>
          (m.role === 'user' || m.role === 'assistant') && !isInternalMessage(m.content)
        );
        return visibleMessages.length > 0 ? (
          <div className="mt-4 space-y-3 max-h-80 overflow-y-auto">
            {visibleMessages.map((message, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg text-sm ${
                  message.role === "user"
                    ? "bg-indigo-100 dark:bg-indigo-900/30 ml-8"
                    : "bg-slate-100 dark:bg-slate-800 mr-8"
                }`}
              >
                <div className="flex items-center gap-2 mb-1 text-xs text-slate-500">
                  <span className="font-medium capitalize">{message.role}</span>
                  <span>{formatRelativeTime(message.timestamp)}</span>
                </div>
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : null;
      })()}

      {isExpanded && visibleMessageCount === 0 && (
        <p className="mt-4 text-sm text-slate-500 text-center py-4">
          No messages yet. Start a conversation with the AI agent!
        </p>
      )}

      {/* Chat Input (only for owner with API key set) */}
      {isExpanded && isOwner && history.apiKeySet && (
        <div className="mt-4 flex gap-2">
          <Textarea
            placeholder="Ask the AI about this paper..."
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 min-h-[60px] max-h-32 resize-none"
            rows={2}
          />
          <Button
            size="sm"
            onClick={handleSendMessage}
            disabled={isSendingMessage || !chatMessage.trim()}
            className="self-end h-10"
          >
            {isSendingMessage ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      )}

      {/* Prompt to set API key if expanded and not set */}
      {isExpanded && isOwner && !history.apiKeySet && !showApiKeyInput && (
        <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">
            Set an API key to chat with the AI agent
          </p>
          <Button size="sm" variant="outline" onClick={() => setShowApiKeyInput(true)}>
            <Key className="w-4 h-4 mr-2" />
            Set API Key
          </Button>
        </div>
      )}
    </div>
  );
}

export function AIAgentHistoryPanel({
  paperId,
  histories,
  currentUserId,
  onHistoriesChange,
}: AIAgentHistoryPanelProps) {
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState<string>("gpt-4o");
  const [customModelName, setCustomModelName] = useState("");
  const [topModel, setTopModel] = useState<AiModelRanking | null>(null);

  // Fetch top-ranked model for paper reviewing
  useEffect(() => {
    api.getModelRankings({ limit: 1 })
      .then(({ rankings }) => {
        if (rankings.length > 0) {
          setTopModel(rankings[0]);
        }
      })
      .catch(console.error);
  }, []);

  // Group models by provider for the dropdown
  const modelsByProvider = DEFAULT_AI_MODELS.reduce((acc, model) => {
    if (!acc[model.provider]) acc[model.provider] = [];
    acc[model.provider].push(model);
    return acc;
  }, {} as Record<AiModelProvider, AiModelInfo[]>);

  const providerOrder: AiModelProvider[] = ['openai', 'anthropic', 'google', 'xai', 'meta', 'deepseek', 'alibaba', 'mistral', 'cohere'];
  const providerNames: Record<AiModelProvider, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    xai: 'xAI',
    meta: 'Meta',
    deepseek: 'DeepSeek',
    alibaba: 'Alibaba',
    mistral: 'Mistral AI',
    cohere: 'Cohere',
    custom: 'Custom',
  };

  // Separate own histories from others' public histories
  const ownHistories = histories.filter((h) => h.userId === currentUserId);
  const publicHistories = histories.filter(
    (h) => h.userId !== currentUserId && h.isPublic
  );

  const handleCreate = async () => {
    if (!newTitle.trim()) {
      toast.error("Please enter a title");
      return;
    }

    if (selectedModelId === 'custom' && !customModelName.trim()) {
      toast.error("Please enter a custom model name");
      return;
    }

    try {
      const result = await api.createAiAgentHistory(paperId, {
        title: newTitle.trim(),
        isPublic: newIsPublic,
        modelId: selectedModelId,
        customModelName: selectedModelId === 'custom' ? customModelName.trim() : undefined,
      });

      // Update the list - the new one is active, so deactivate others
      const updatedHistories = histories.map((h) =>
        h.userId === currentUserId ? { ...h, isActive: false } : h
      );
      onHistoriesChange([result.history, ...updatedHistories]);

      setNewTitle("");
      setNewIsPublic(false);
      setSelectedModelId("gpt-4o");
      setCustomModelName("");
      setIsCreating(false);
      toast.success("History created");
    } catch (error) {
      toast.error("Failed to create history");
    }
  };

  const handleUpdate = (updated: AiAgentHistory) => {
    onHistoriesChange(histories.map((h) => (h.id === updated.id ? updated : h)));
  };

  const handleDelete = (id: string) => {
    onHistoriesChange(histories.filter((h) => h.id !== id));
  };

  const handleActivate = (id: string) => {
    // Deactivate all own histories, activate the selected one
    onHistoriesChange(
      histories.map((h) => {
        if (h.userId === currentUserId) {
          return { ...h, isActive: h.id === id };
        }
        return h;
      })
    );
  };

  if (histories.length === 0 && !currentUserId) {
    return null; // Don't show empty panel for non-logged-in users
  }

  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-indigo-500" />
            AI Agent History
          </CardTitle>
          {currentUserId && !isCreating && (
            <Button
              size="sm"
              onClick={() => setIsCreating(true)}
              className="gap-1"
            >
              <Plus className="w-4 h-4" />
              New Session
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Create new history form */}
        {isCreating && (
          <div className="mb-6 p-4 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/20">
            <h4 className="font-medium mb-3">Create New AI Session</h4>
            <div className="space-y-3">
              <div>
                <Input
                  placeholder="Session title (e.g., 'Paper Review', 'Deep Dive Analysis')"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
              </div>
              {/* Top Model Recommendation */}
              {topModel && topModel.score > 0 && (
                <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                  <Trophy className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-yellow-800 dark:text-yellow-200">
                      <span className="font-medium">Top model for reviewing papers:</span>{" "}
                      <button
                        onClick={() => setSelectedModelId(topModel.modelId)}
                        className="font-semibold hover:underline"
                      >
                        {topModel.modelName}
                      </button>
                      <span className="text-yellow-600 dark:text-yellow-400 ml-1">
                        (+{topModel.score} score)
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Model Selector */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  AI Model
                </label>
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="w-full h-10 px-3 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {providerOrder.map((provider) => (
                    modelsByProvider[provider] && (
                      <optgroup key={provider} label={providerNames[provider]}>
                        {modelsByProvider[provider].map((model) => (
                          <option key={model.id} value={model.id}>
                            {model.name}
                          </option>
                        ))}
                      </optgroup>
                    )
                  ))}
                  <optgroup label="Custom">
                    <option value="custom">Custom Model...</option>
                  </optgroup>
                </select>
                {selectedModelId === 'custom' && (
                  <Input
                    className="mt-2"
                    placeholder="Enter custom model name (e.g., 'my-finetuned-gpt4')"
                    value={customModelName}
                    onChange={(e) => setCustomModelName(e.target.value)}
                  />
                )}
                {selectedModelId !== 'custom' && (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {DEFAULT_AI_MODELS.find(m => m.id === selectedModelId)?.description || ''}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsPublic}
                    onChange={(e) => setNewIsPublic(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <Globe className="w-4 h-4 text-slate-500" />
                  Make public (others can view)
                </label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleCreate} size="sm">
                  Create
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsCreating(false);
                    setNewTitle("");
                    setNewIsPublic(false);
                    setSelectedModelId("gpt-4o");
                    setCustomModelName("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Own histories */}
        {currentUserId && ownHistories.length > 0 && (
          <div className="mb-6">
            <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
              Your Sessions ({ownHistories.length})
            </h4>
            <div className="space-y-3">
              {ownHistories.map((history) => (
                <HistoryCard
                  key={history.id}
                  history={history}
                  isOwner={true}
                  paperId={paperId}
                  currentUserId={currentUserId}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onActivate={handleActivate}
                />
              ))}
            </div>
          </div>
        )}

        {/* Public histories from others */}
        {publicHistories.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-3">
              Public Sessions ({publicHistories.length})
            </h4>
            <div className="space-y-3">
              {publicHistories.map((history) => (
                <HistoryCard
                  key={history.id}
                  history={history}
                  isOwner={false}
                  paperId={paperId}
                  currentUserId={currentUserId}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                  onActivate={handleActivate}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {histories.length === 0 && currentUserId && !isCreating && (
          <div className="text-center py-8">
            <Bot className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 mb-4">
              No AI sessions yet. Start a conversation with the AI agent!
            </p>
            <Button onClick={() => setIsCreating(true)} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Session
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
