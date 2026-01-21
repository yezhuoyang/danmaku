import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogPortal,
  DialogOverlay,
} from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  Settings,
  Key,
  Plus,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Bot,
  Globe,
  Lock,
  Play,
  X,
  Trophy,
} from "lucide-react";
import type { AiAgentHistory, AiModelProvider } from "../../../../shared/types";
import { DEFAULT_AI_MODELS } from "../../../../shared/types";
import * as api from "@/lib/api";
import { toast } from "sonner";

// Provider colors for badges
const PROVIDER_COLORS: Record<AiModelProvider, string> = {
  openai: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  anthropic: 'bg-orange-100 text-orange-700 border-orange-200',
  google: 'bg-blue-100 text-blue-700 border-blue-200',
  xai: 'bg-slate-100 text-slate-700 border-slate-200',
  meta: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  deepseek: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  alibaba: 'bg-amber-100 text-amber-700 border-amber-200',
  mistral: 'bg-purple-100 text-purple-700 border-purple-200',
  cohere: 'bg-rose-100 text-rose-700 border-rose-200',
  custom: 'bg-gray-100 text-gray-700 border-gray-200',
};

interface AISessionSettingsPanelProps {
  paperId: string;
  currentUserId?: string;
  activeSession?: AiAgentHistory | null;
  onSessionChange?: (session: AiAgentHistory | null) => void;
  trigger?: React.ReactNode;
  /** Container element for the dialog portal (used in fullscreen mode) */
  container?: HTMLElement | null;
}

export function AISessionSettingsPanel({
  paperId,
  currentUserId,
  activeSession,
  onSessionChange,
  trigger,
  container,
}: AISessionSettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<AiAgentHistory[]>([]);
  const [loading, setLoading] = useState(false);

  // Create session state
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("gpt-4o");
  const [customModelName, setCustomModelName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // API key state
  const [showApiKeyInput, setShowApiKeyInput] = useState<string | null>(null);
  const [apiKeyValue, setApiKeyValue] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSettingApiKey, setIsSettingApiKey] = useState(false);

  // Load sessions when dialog opens
  useEffect(() => {
    if (open && paperId) {
      loadSessions();
    }
  }, [open, paperId]);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const result = await api.getAiAgentHistories(paperId);
      setSessions(result.histories);
    } catch (error) {
      console.error("Failed to load sessions:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!newTitle.trim()) {
      toast.error("Please enter a session title");
      return;
    }

    setIsSubmitting(true);
    try {
      const modelId = selectedModelId === 'custom' ? customModelName : selectedModelId;
      const modelInfo = DEFAULT_AI_MODELS.find(m => m.id === selectedModelId);

      const result = await api.createAiAgentHistory(paperId, {
        title: newTitle.trim(),
        modelId,
        modelName: modelInfo?.name || customModelName,
        provider: modelInfo?.provider || 'custom',
        isPublic: newIsPublic,
      });

      setSessions(prev => [result.history, ...prev]);
      setIsCreating(false);
      setNewTitle("");
      setNewIsPublic(false);
      setSelectedModelId("gpt-4o");
      setCustomModelName("");

      // Auto-activate the new session
      await handleActivateSession(result.history.id);
      toast.success("Session created and activated");
    } catch (error: any) {
      toast.error(error.message || "Failed to create session");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleActivateSession = async (sessionId: string) => {
    try {
      await api.activateAiAgentHistory(paperId, sessionId);
      const updatedSessions = sessions.map(s => ({
        ...s,
        isActive: s.id === sessionId,
      }));
      setSessions(updatedSessions);
      const activatedSession = updatedSessions.find(s => s.id === sessionId);
      if (activatedSession) {
        onSessionChange?.(activatedSession);
      }
    } catch (error) {
      toast.error("Failed to activate session");
    }
  };

  const handleSetApiKey = async (sessionId: string) => {
    if (!apiKeyValue.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    setIsSettingApiKey(true);
    try {
      const result = await api.setSessionApiKey(paperId, sessionId, apiKeyValue.trim());
      setSessions(prev => prev.map(s => s.id === sessionId ? result.history : s));
      setApiKeyValue("");
      setShowApiKeyInput(null);

      // Update active session if this is the active one
      if (activeSession?.id === sessionId) {
        onSessionChange?.(result.history);
      }

      toast.success("API key set successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to set API key");
    } finally {
      setIsSettingApiKey(false);
    }
  };

  // Group sessions
  const ownSessions = sessions.filter(s => s.userId === currentUserId);
  const publicSessions = sessions.filter(s => s.isPublic && s.userId !== currentUserId);

  // Group models by provider
  const modelsByProvider: Record<string, typeof DEFAULT_AI_MODELS> = {};
  const providerOrder: AiModelProvider[] = ['openai', 'anthropic', 'google', 'xai', 'deepseek', 'meta', 'mistral', 'cohere', 'alibaba'];
  const providerNames: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    google: 'Google',
    xai: 'xAI',
    deepseek: 'DeepSeek',
    meta: 'Meta',
    mistral: 'Mistral AI',
    cohere: 'Cohere',
    alibaba: 'Alibaba',
  };

  for (const model of DEFAULT_AI_MODELS) {
    if (!modelsByProvider[model.provider]) {
      modelsByProvider[model.provider] = [];
    }
    modelsByProvider[model.provider].push(model);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="w-4 h-4" />
            AI Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogPortal container={container}>
        <DialogOverlay className="z-[100]" />
        <DialogPrimitive.Content
          className="bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-[100] grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-[500px] max-h-[90vh] flex flex-col"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-500" />
              AI Session Settings
            </DialogTitle>
            <DialogDescription>
              Select or create an AI session to enable chat and analysis features.
              Your API key is securely encrypted on the server.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto flex-1 max-h-[60vh]">
            {/* Current Active Session Status */}
            {activeSession ? (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800 dark:text-green-200">
                      Active: {activeSession.title}
                    </span>
                  </div>
                  {activeSession.apiKeySet ? (
                    <Badge variant="outline" className="bg-green-100 text-green-700 text-xs">
                      <Key className="w-3 h-3 mr-1" />
                      API Key Set
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-100 text-amber-700 text-xs">
                      <Key className="w-3 h-3 mr-1" />
                      No API Key
                    </Badge>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  No active session. Create or select a session below.
                </p>
              </div>
            )}

            {/* Create New Session */}
            {!isCreating ? (
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setIsCreating(true)}
              >
                <Plus className="w-4 h-4" />
                Create New Session
              </Button>
            ) : (
              <div className="p-4 border rounded-lg space-y-3 bg-slate-50 dark:bg-slate-800/50">
                <h4 className="font-medium text-sm">New AI Session</h4>

                <Input
                  placeholder="Session title (e.g., 'Paper Review')"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateSession()}
                />

                {/* Model Selector */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    AI Model
                  </label>
                  <select
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                      placeholder="Custom model name"
                      value={customModelName}
                      onChange={(e) => setCustomModelName(e.target.value)}
                    />
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsPublic}
                    onChange={(e) => setNewIsPublic(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <Globe className="w-4 h-4 text-slate-500" />
                  Make public
                </label>

                <div className="flex gap-2">
                  <Button onClick={handleCreateSession} size="sm" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsCreating(false);
                      setNewTitle("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
              </div>
            )}

            {/* Your Sessions */}
            {ownSessions.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Your Sessions
                </h4>
                <div className="space-y-2">
                  {ownSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      isActive={session.isActive}
                      isOwner={true}
                      showApiKeyInput={showApiKeyInput === session.id}
                      apiKeyValue={apiKeyValue}
                      showApiKey={showApiKey}
                      isSettingApiKey={isSettingApiKey}
                      onActivate={() => handleActivateSession(session.id)}
                      onSetApiKeyClick={() => {
                        setShowApiKeyInput(session.id);
                        setApiKeyValue("");
                      }}
                      onApiKeyChange={setApiKeyValue}
                      onToggleShowApiKey={() => setShowApiKey(!showApiKey)}
                      onSaveApiKey={() => handleSetApiKey(session.id)}
                      onCancelApiKey={() => {
                        setShowApiKeyInput(null);
                        setApiKeyValue("");
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Public Sessions */}
            {publicSessions.length > 0 && (
              <div>
                <h4 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  Public Sessions
                </h4>
                <div className="space-y-2">
                  {publicSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      isActive={session.isActive}
                      isOwner={false}
                      showApiKeyInput={false}
                      apiKeyValue=""
                      showApiKey={false}
                      isSettingApiKey={false}
                      onActivate={() => {}}
                      onSetApiKeyClick={() => {}}
                      onApiKeyChange={() => {}}
                      onToggleShowApiKey={() => {}}
                      onSaveApiKey={() => {}}
                      onCancelApiKey={() => {}}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {!loading && sessions.length === 0 && !isCreating && (
              <div className="text-center py-6 text-slate-500">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No sessions yet. Create one to get started!</p>
              </div>
            )}
          </div>

          {/* Close button */}
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

// Session card sub-component
function SessionCard({
  session,
  isActive,
  isOwner,
  showApiKeyInput,
  apiKeyValue,
  showApiKey,
  isSettingApiKey,
  onActivate,
  onSetApiKeyClick,
  onApiKeyChange,
  onToggleShowApiKey,
  onSaveApiKey,
  onCancelApiKey,
}: {
  session: AiAgentHistory;
  isActive: boolean;
  isOwner: boolean;
  showApiKeyInput: boolean;
  apiKeyValue: string;
  showApiKey: boolean;
  isSettingApiKey: boolean;
  onActivate: () => void;
  onSetApiKeyClick: () => void;
  onApiKeyChange: (value: string) => void;
  onToggleShowApiKey: () => void;
  onSaveApiKey: () => void;
  onCancelApiKey: () => void;
}) {
  const modelInfo = DEFAULT_AI_MODELS.find(m => m.id === session.modelId);
  const providerColor = PROVIDER_COLORS[session.provider as AiModelProvider] || PROVIDER_COLORS.custom;

  return (
    <div
      className={`p-3 border rounded-lg ${
        isActive
          ? 'border-indigo-300 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-900/20'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-medium text-sm truncate">{session.title}</span>
          {isActive && (
            <Badge variant="outline" className="bg-indigo-100 text-indigo-700 text-xs flex-shrink-0">
              Active
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {session.isPublic ? (
            <Globe className="w-3.5 h-3.5 text-slate-400" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-slate-400" />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className={`text-xs ${providerColor}`}>
          {session.modelName || modelInfo?.name || session.modelId}
        </Badge>
        {session.apiKeySet ? (
          <Badge variant="outline" className="bg-green-50 text-green-600 text-xs">
            <Key className="w-3 h-3 mr-1" />
            Key Set
          </Badge>
        ) : (
          <Badge variant="outline" className="bg-slate-50 text-slate-500 text-xs">
            <Key className="w-3 h-3 mr-1" />
            No Key
          </Badge>
        )}
      </div>

      {/* API Key Input */}
      {showApiKeyInput && (
        <div className="mt-3 p-2 bg-white dark:bg-slate-800 rounded border space-y-2">
          <div className="relative">
            <Input
              type={showApiKey ? "text" : "password"}
              value={apiKeyValue}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="Enter API key..."
              className="pr-10 text-sm h-8"
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={onToggleShowApiKey}
            >
              {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={onSaveApiKey} disabled={isSettingApiKey}>
              {isSettingApiKey ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancelApiKey}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Actions */}
      {isOwner && !showApiKeyInput && (
        <div className="flex gap-2 mt-2">
          {!isActive && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onActivate}>
              <Play className="w-3 h-3" />
              Activate
            </Button>
          )}
          {!session.apiKeySet && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200" onClick={onSetApiKeyClick}>
              <Key className="w-3 h-3" />
              Set API Key
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
