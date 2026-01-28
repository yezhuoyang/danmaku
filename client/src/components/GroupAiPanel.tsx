import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  X,
  Bot,
  Send,
  Loader2,
  Key,
  BookOpen,
  MessageSquare,
  FileText,
  CheckCircle,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import * as api from "../lib/api";
import type {
  PaperGroupWithPapers,
  GroupAiSession,
  AiAgentMessage,
} from "../../../shared/types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// AI Models available
const AI_MODELS = [
  { id: "gpt-4o", name: "GPT-4o", provider: "OpenAI" },
  { id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI" },
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI" },
  { id: "claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet", provider: "Anthropic" },
  { id: "claude-3-opus-20240229", name: "Claude 3 Opus", provider: "Anthropic" },
];

interface GroupAiPanelProps {
  group: PaperGroupWithPapers;
  onClose: () => void;
}

export function GroupAiPanel({ group, onClose }: GroupAiPanelProps) {
  // State
  const [sessions, setSessions] = useState<GroupAiSession[]>([]);
  const [activeSession, setActiveSession] = useState<GroupAiSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Session creation
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  // Reading state
  const [isReading, setIsReading] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  // Chat state
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load sessions on mount
  useEffect(() => {
    loadSessions();
  }, [group.id]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages]);

  const loadSessions = async () => {
    setIsLoading(true);
    try {
      const result = await api.getGroupAiSessions(group.id);
      setSessions(result.sessions);
      // Auto-select most recent session
      if (result.sessions.length > 0) {
        setActiveSession(result.sessions[0]);
      } else {
        setShowCreateSession(true);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
      toast.error("Failed to load AI sessions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSession = async () => {
    if (!selectedModel) {
      toast.error("Please select a model");
      return;
    }
    if (!apiKey.trim()) {
      toast.error("Please enter your API key");
      return;
    }

    setIsCreating(true);
    try {
      const result = await api.createGroupAiSession(group.id, {
        modelId: selectedModel,
        apiKey: apiKey.trim(),
        title: `Session - ${new Date().toLocaleDateString()}`,
      });
      setSessions([result.session, ...sessions]);
      setActiveSession(result.session);
      setShowCreateSession(false);
      setApiKey("");
      toast.success("AI session created");
    } catch (error) {
      console.error("Failed to create session:", error);
      toast.error("Failed to create AI session");
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartReading = async () => {
    if (!activeSession) return;

    setIsReading(true);
    setReadingProgress(0);

    try {
      // Simulate progress while reading
      const progressInterval = setInterval(() => {
        setReadingProgress(prev => Math.min(prev + 5, 90));
      }, 500);

      const result = await api.startGroupReading(group.id, activeSession.id);

      clearInterval(progressInterval);
      setReadingProgress(100);

      setActiveSession(result.session);
      setSessions(sessions.map(s => s.id === result.session.id ? result.session : s));
      toast.success("Finished reading all papers!");
    } catch (error) {
      console.error("Failed to read papers:", error);
      toast.error("Failed to read papers");
    } finally {
      setTimeout(() => {
        setIsReading(false);
        setReadingProgress(0);
      }, 500);
    }
  };

  const handleSendMessage = async () => {
    if (!activeSession || !message.trim()) return;

    setIsSending(true);
    try {
      const result = await api.chatWithGroupSession(group.id, activeSession.id, message.trim());
      setActiveSession(result.session);
      setSessions(sessions.map(s => s.id === result.session.id ? result.session : s));
      setMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready": return "bg-green-500";
      case "reading": return "bg-yellow-500";
      case "completed": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const canChat = activeSession?.status === "ready" || activeSession?.status === "completed";

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm">
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-background border-l shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-3">
            <Bot className="h-5 w-5 text-primary" />
            <div>
              <h2 className="font-semibold">AI Reading Session</h2>
              <p className="text-sm text-muted-foreground">{group.name}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : showCreateSession || !activeSession ? (
          /* Create Session Form */
          <div className="flex-1 p-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Start New AI Reading Session
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>AI Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_MODELS.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name} ({model.provider})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>API Key</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="password"
                      placeholder="Enter your API key"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Your API key is encrypted and only used for this session
                  </p>
                </div>

                <div className="pt-4">
                  <Button
                    onClick={handleCreateSession}
                    disabled={isCreating || !selectedModel || !apiKey.trim()}
                    className="w-full"
                  >
                    {isCreating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Bot className="h-4 w-4 mr-2" />
                    )}
                    Create Session
                  </Button>
                </div>

                {sessions.length > 0 && (
                  <>
                    <Separator className="my-4" />
                    <div className="space-y-2">
                      <Label>Or continue an existing session</Label>
                      {sessions.map(session => (
                        <Button
                          key={session.id}
                          variant="outline"
                          className="w-full justify-start"
                          onClick={() => {
                            setActiveSession(session);
                            setShowCreateSession(false);
                          }}
                        >
                          <div className={`w-2 h-2 rounded-full mr-2 ${getStatusColor(session.status)}`} />
                          {session.title}
                          <span className="ml-auto text-xs text-muted-foreground">
                            {new Date(session.createdAt * 1000).toLocaleDateString()}
                          </span>
                        </Button>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Active Session View */
          <>
            {/* Session Info */}
            <div className="p-4 border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(activeSession.status)}`} />
                  <span className="font-medium">{activeSession.title}</span>
                  <Badge variant="outline">{activeSession.modelId}</Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowCreateSession(true)}
                >
                  New Session
                </Button>
              </div>

              {/* Token usage */}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>Prompt: {activeSession.totalPromptTokens.toLocaleString()} tokens</span>
                <span>Completion: {activeSession.totalCompletionTokens.toLocaleString()} tokens</span>
              </div>
            </div>

            {/* Reading Status */}
            {activeSession.status === "active" && (
              <div className="p-4 border-b bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">
                      {group.papers.length} papers ready to read
                    </span>
                  </div>
                  <Button
                    onClick={handleStartReading}
                    disabled={isReading}
                    size="sm"
                  >
                    {isReading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <BookOpen className="h-4 w-4 mr-2" />
                    )}
                    {isReading ? "Reading..." : "Start Reading"}
                  </Button>
                </div>
                {isReading && (
                  <Progress value={readingProgress} className="h-2" />
                )}
              </div>
            )}

            {/* Paper Summaries */}
            {(activeSession.status === "ready" || activeSession.status === "completed") &&
              Object.keys(activeSession.paperSummaries).length > 0 && (
              <div className="p-4 border-b">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">
                    {Object.keys(activeSession.paperSummaries).length} papers read
                  </span>
                </div>
                <ScrollArea className="h-32">
                  <div className="space-y-2">
                    {group.papers.map(paper => (
                      <div
                        key={paper.paperId}
                        className="flex items-center gap-2 text-sm p-2 rounded-md bg-muted/50"
                      >
                        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate">{paper.paper?.title}</span>
                        {activeSession.paperSummaries[paper.paperId] && (
                          <CheckCircle className="h-3 w-3 shrink-0 text-green-500 ml-auto" />
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-4">
              {activeSession.messages.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  {canChat ? (
                    <>
                      <p>Ready to chat about these papers!</p>
                      <p className="text-sm mt-1">
                        Ask questions about the papers in this group.
                      </p>
                    </>
                  ) : (
                    <>
                      <p>Start by reading the papers first</p>
                      <p className="text-sm mt-1">
                        Click "Start Reading" above to begin.
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {activeSession.messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-lg p-3 ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {msg.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {msg.content}
                            </ReactMarkdown>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                        )}
                        <p className="text-xs opacity-70 mt-1">
                          {new Date(msg.timestamp * 1000).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Chat Input */}
            <div className="p-4 border-t">
              <div className="flex gap-2">
                <Input
                  placeholder={canChat ? "Ask about the papers..." : "Read papers first to chat"}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                  disabled={!canChat || isSending}
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!canChat || !message.trim() || isSending}
                >
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
