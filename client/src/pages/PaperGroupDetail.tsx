import { useState, useEffect, useRef } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  MessageSquare,
  User,
  LogOut,
  Sparkles,
  BookOpen,
  ExternalLink,
  FileText,
  Bot,
  Brain,
  Book,
  Send,
  Key,
  Loader2,
  Lightbulb,
  Plus,
  Pencil,
  HelpCircle,
  FlaskConical,
  Target,
  Lock,
  Globe,
  MoreVertical,
  Trash2,
  Search,
  X,
  ChevronRight,
  GraduationCap,
  Library,
  ListChecks,
  RefreshCw,
  Copy,
  Check,
  Quote,
  AlertTriangle,
  Settings,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import * as api from "../lib/api";
import type {
  PaperGroupWithPapers,
  PaperGroupMember,
  GroupAiSession,
  PaperWithStats,
  AiModelProvider,
} from "../../../shared/types";
import { DEFAULT_AI_MODELS } from "../../../shared/types";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Provider display names
const PROVIDER_NAMES: Record<AiModelProvider, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google',
  xai: 'xAI',
  meta: 'Meta',
  deepseek: 'DeepSeek',
  alibaba: 'Alibaba',
  mistral: 'Mistral',
  cohere: 'Cohere',
  custom: 'Custom',
};

// Group models by provider
const AI_MODELS_BY_PROVIDER = DEFAULT_AI_MODELS.reduce((acc, model) => {
  if (!acc[model.provider]) {
    acc[model.provider] = [];
  }
  acc[model.provider].push(model);
  return acc;
}, {} as Record<AiModelProvider, typeof DEFAULT_AI_MODELS>);

// Content section types
type ContentSection = 'summary' | 'background' | 'ideas' | 'quiz';

export default function PaperGroupDetail() {
  const [, params] = useRoute("/paper-groups/:id");
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading, logout } = useAuth();
  const groupId = params?.id;

  // Group data
  const [group, setGroup] = useState<PaperGroupWithPapers | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // AI Session state
  const [sessions, setSessions] = useState<GroupAiSession[]>([]);
  const [activeSession, setActiveSession] = useState<GroupAiSession | null>(null);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [selectedModel, setSelectedModel] = useState("gpt-4o-mini");
  const [apiKey, setApiKey] = useState("");
  const [tokenLimit, setTokenLimit] = useState(100000);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [showTokenLimitDialog, setShowTokenLimitDialog] = useState(false);
  const [newTokenLimit, setNewTokenLimit] = useState(100000);

  // Reading state
  const [isReading, setIsReading] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  // Chat state
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generated content state
  const [generatedContent, setGeneratedContent] = useState<{
    summary?: string;
    background?: string;
    ideas?: string;
    quiz?: string;
  }>({});
  const [isGenerating, setIsGenerating] = useState<ContentSection | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  // Add papers dialog
  const [showAddPapers, setShowAddPapers] = useState(false);
  const [paperSearchQuery, setPaperSearchQuery] = useState("");
  const [paperSearchResults, setPaperSearchResults] = useState<PaperWithStats[]>([]);
  const [isSearchingPapers, setIsSearchingPapers] = useState(false);

  // Edit group dialog
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editVisibility, setEditVisibility] = useState<"private" | "public">("private");
  const [isUpdating, setIsUpdating] = useState(false);

  // Load group data
  useEffect(() => {
    if (groupId) {
      loadGroup();
      loadSessions();
    }
  }, [groupId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeSession?.messages]);

  const loadGroup = async () => {
    if (!groupId) return;
    setIsLoading(true);
    try {
      const result = await api.getPaperGroup(groupId);
      setGroup(result.group);
      setEditName(result.group.name);
      setEditDescription(result.group.description || "");
      setEditVisibility(result.group.visibility);
    } catch (error) {
      console.error("Failed to load group:", error);
      toast.error("Failed to load paper group");
      setLocation("/paper-groups");
    } finally {
      setIsLoading(false);
    }
  };

  const loadSessions = async () => {
    if (!groupId) return;
    try {
      const result = await api.getGroupAiSessions(groupId);
      setSessions(result.sessions);
      if (result.sessions.length > 0) {
        setActiveSession(result.sessions[0]);
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
    }
  };

  const handleCreateSession = async () => {
    if (!groupId || !selectedModel || !apiKey.trim()) return;

    setIsCreatingSession(true);
    try {
      const result = await api.createGroupAiSession(groupId, {
        modelId: selectedModel,
        apiKey: apiKey.trim(),
        title: `Reading Session - ${new Date().toLocaleDateString()}`,
        tokenLimit: tokenLimit,
      });
      setSessions([result.session, ...sessions]);
      setActiveSession(result.session);
      setShowCreateSession(false);
      setApiKey("");
      setTokenLimit(100000);
      toast.success("AI session created");
    } catch (error) {
      console.error("Failed to create session:", error);
      toast.error("Failed to create AI session");
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleUpdateTokenLimit = async () => {
    if (!groupId || !activeSession) return;

    try {
      const result = await api.updateGroupSessionTokenLimit(
        groupId,
        activeSession.id,
        newTokenLimit
      );
      setActiveSession(result.session);
      setSessions(sessions.map((s) => (s.id === result.session.id ? result.session : s)));
      setShowTokenLimitDialog(false);
      toast.success("Token limit updated");
    } catch (error) {
      console.error("Failed to update token limit:", error);
      toast.error("Failed to update token limit");
    }
  };

  const handleStartReading = async () => {
    if (!groupId || !activeSession) return;

    setIsReading(true);
    setReadingProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setReadingProgress((prev) => Math.min(prev + 5, 90));
      }, 500);

      const result = await api.startGroupReading(groupId, activeSession.id);

      clearInterval(progressInterval);
      setReadingProgress(100);

      setActiveSession(result.session);
      setSessions(sessions.map((s) => (s.id === result.session.id ? result.session : s)));
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
    if (!groupId || !activeSession || !message.trim()) return;

    setIsSending(true);
    try {
      const result = await api.chatWithGroupSession(groupId, activeSession.id, message.trim());
      setActiveSession(result.session);
      setSessions(sessions.map((s) => (s.id === result.session.id ? result.session : s)));
      setMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      toast.error("Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateContent = async (section: ContentSection) => {
    if (!groupId || !activeSession || activeSession.status !== "ready") {
      toast.error("Please complete reading all papers first");
      return;
    }

    setIsGenerating(section);
    try {
      const prompts: Record<ContentSection, string> = {
        summary: `Based on all the papers you've read in this group, provide a comprehensive literature review and combined summary. Include:
1. Overview of the research area
2. Key themes and findings across papers
3. How the papers relate to each other
4. Major contributions of each paper
5. Current state of the field based on these papers`,
        background: `Based on all the papers in this group, identify and explain the necessary background knowledge needed to understand this research area. Include:
1. Foundational concepts and definitions
2. Key mathematical or technical prerequisites
3. Historical context and seminal works
4. Important terminology explained
5. Recommended reading order for newcomers`,
        ideas: `Based on the papers in this group, identify potential research opportunities and ideas. Include:
1. Gaps in the current research
2. Unexplored combinations of techniques
3. Open problems mentioned in the papers
4. Potential applications not yet explored
5. Cross-disciplinary opportunities
6. Specific research questions worth investigating`,
        quiz: `Create a comprehensive quiz to test understanding of the papers in this group. Include:
1. 5 multiple choice questions about key concepts
2. 3 short answer questions about methodology
3. 2 essay questions about implications and future directions
4. Answer key with explanations`,
      };

      const result = await api.chatWithGroupSession(
        groupId,
        activeSession.id,
        prompts[section]
      );

      setActiveSession(result.session);
      setSessions(sessions.map((s) => (s.id === result.session.id ? result.session : s)));

      // Extract the latest assistant message as the generated content
      const lastMessage = result.session.messages[result.session.messages.length - 1];
      if (lastMessage?.role === "assistant") {
        setGeneratedContent((prev) => ({
          ...prev,
          [section]: lastMessage.content,
        }));
      }

      toast.success(`Generated ${section}!`);
    } catch (error) {
      console.error(`Failed to generate ${section}:`, error);
      toast.error(`Failed to generate ${section}`);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleCopyContent = async (section: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedSection(section);
      setTimeout(() => setCopiedSection(null), 2000);
      toast.success("Copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy");
    }
  };

  const handleSearchPapers = async () => {
    if (!paperSearchQuery.trim()) return;

    setIsSearchingPapers(true);
    try {
      const result = await api.listPapers({ q: paperSearchQuery.trim(), limit: 20 });
      const existingIds = new Set(group?.papers.map((p) => p.paperId) || []);
      setPaperSearchResults(result.papers.filter((p: PaperWithStats) => !existingIds.has(p.id)));
    } catch (error) {
      console.error("Failed to search papers:", error);
      toast.error("Failed to search papers");
    } finally {
      setIsSearchingPapers(false);
    }
  };

  const handleAddPaper = async (paper: PaperWithStats) => {
    if (!groupId) return;
    try {
      await api.addPapersToGroup(groupId, [paper.id]);
      await loadGroup();
      setPaperSearchResults(paperSearchResults.filter((p) => p.id !== paper.id));
      toast.success("Paper added to group");
    } catch (error) {
      console.error("Failed to add paper:", error);
      toast.error("Failed to add paper");
    }
  };

  const handleRemovePaper = async (paperId: string) => {
    if (!groupId) return;
    try {
      await api.removePaperFromGroup(groupId, paperId);
      await loadGroup();
      toast.success("Paper removed from group");
    } catch (error) {
      console.error("Failed to remove paper:", error);
      toast.error("Failed to remove paper");
    }
  };

  const handleUpdateGroup = async () => {
    if (!groupId || !editName.trim()) return;

    setIsUpdating(true);
    try {
      await api.updatePaperGroup(groupId, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        visibility: editVisibility,
      });
      await loadGroup();
      setShowEditGroup(false);
      toast.success("Group updated");
    } catch (error) {
      console.error("Failed to update group:", error);
      toast.error("Failed to update group");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!groupId) return;
    if (!confirm("Are you sure you want to delete this paper group?")) return;

    try {
      await api.deletePaperGroup(groupId);
      toast.success("Group deleted");
      setLocation("/paper-groups");
    } catch (error) {
      console.error("Failed to delete group:", error);
      toast.error("Failed to delete group");
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const canChat = activeSession?.status === "ready" || activeSession?.status === "completed";
  const isOwner = user?.id === group?.userId;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
        <div className="container py-8">
          <Skeleton className="h-8 w-48 mb-4" />
          <Skeleton className="h-64 w-full mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!group) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40 flex items-center justify-center">
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-2">Group not found</h2>
          <p className="text-muted-foreground mb-4">This paper group doesn't exist or you don't have access.</p>
          <Button asChild>
            <Link href="/paper-groups">Back to Paper Groups</Link>
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/60 dark:bg-slate-900/80 backdrop-blur-md border-b border-indigo-200/50 dark:border-slate-800">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/paper-groups">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Link>
            </Button>
            <div className="hidden sm:block h-6 w-px bg-slate-300 dark:bg-slate-700" />
            <div className="hidden sm:flex items-center gap-2">
              <Library className="h-5 w-5 text-indigo-600" />
              <span className="font-semibold">Paper Group</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {authLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : user ? (
              <>
                <NotificationBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <User className="h-4 w-4" />
                      {user.displayName}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <Link href={`/profile/${user.id}`}>
                      <DropdownMenuItem>
                        <User className="h-4 w-4 mr-2" />
                        Profile
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuItem onClick={handleLogout}>
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/login">Login</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href="/register">Register</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="container py-8">
        {/* Group Hero Section */}
        <div className="mb-8">
          <Card className="overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 h-32" />
            <CardContent className="relative pt-0 -mt-16 px-6 pb-6">
              <div className="flex items-start justify-between">
                <div className="flex items-end gap-4">
                  <div className="w-24 h-24 rounded-xl bg-white dark:bg-slate-800 shadow-lg flex items-center justify-center border-4 border-white dark:border-slate-800">
                    <Library className="h-12 w-12 text-indigo-600" />
                  </div>
                  <div className="pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <h1 className="text-2xl font-bold">{group.name}</h1>
                      <Badge variant={group.visibility === "public" ? "default" : "secondary"}>
                        {group.visibility === "public" ? (
                          <><Globe className="h-3 w-3 mr-1" /> Public</>
                        ) : (
                          <><Lock className="h-3 w-3 mr-1" /> Private</>
                        )}
                      </Badge>
                    </div>
                    {group.description && (
                      <p className="text-muted-foreground">{group.description}</p>
                    )}
                    <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="h-4 w-4" />
                        {group.papers.length} papers
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        by {group.userName}
                      </span>
                    </div>
                  </div>
                </div>

                {isOwner && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowEditGroup(true)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Edit Group
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={handleDeleteGroup} className="text-red-600">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Group
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Papers List */}
          <div className="lg:col-span-2 space-y-6">
            {/* Papers in Group */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Papers in this Group
                  </CardTitle>
                  {isOwner && (
                    <Button size="sm" onClick={() => setShowAddPapers(true)}>
                      <Plus className="h-4 w-4 mr-1" />
                      Add Papers
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {group.papers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No papers in this group yet.</p>
                    {isOwner && (
                      <Button variant="outline" size="sm" className="mt-3" onClick={() => setShowAddPapers(true)}>
                        Add your first paper
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {group.papers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <Link href={`/paper/${member.paperId}`}>
                            <h3 className="font-medium hover:text-indigo-600 transition-colors line-clamp-2">
                              {member.paper?.title || "Untitled Paper"}
                            </h3>
                          </Link>
                          <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                            {member.paper?.authors?.slice(0, 3).join(", ")}
                            {member.paper?.authors && member.paper.authors.length > 3 && " et al."}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {member.paper?.arxivId && (
                            <Badge variant="outline" className="text-xs">arXiv</Badge>
                          )}
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/paper/${member.paperId}/read`}>
                              Read <ChevronRight className="h-3 w-3 ml-1" />
                            </Link>
                          </Button>
                          {isOwner && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-red-600"
                              onClick={() => handleRemovePaper(member.paperId)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* AI Generated Content Sections */}
            {canChat && (
              <>
                {/* Combined Summary / Literature Review */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Book className="h-5 w-5 text-blue-600" />
                          Literature Review & Summary
                        </CardTitle>
                        <CardDescription>AI-generated overview of all papers</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {generatedContent.summary && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyContent("summary", generatedContent.summary!)}
                          >
                            {copiedSection === "summary" ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleGenerateContent("summary")}
                          disabled={isGenerating === "summary"}
                        >
                          {isGenerating === "summary" ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : generatedContent.summary ? (
                            <RefreshCw className="h-4 w-4 mr-1" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-1" />
                          )}
                          {generatedContent.summary ? "Regenerate" : "Generate"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {generatedContent.summary ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {generatedContent.summary}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Book className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Generate a comprehensive literature review</p>
                        <p className="text-sm mt-1">covering all papers in this group</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Background Knowledge */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <GraduationCap className="h-5 w-5 text-green-600" />
                          Background Knowledge
                        </CardTitle>
                        <CardDescription>Prerequisites to understand this research</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {generatedContent.background && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyContent("background", generatedContent.background!)}
                          >
                            {copiedSection === "background" ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleGenerateContent("background")}
                          disabled={isGenerating === "background"}
                        >
                          {isGenerating === "background" ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : generatedContent.background ? (
                            <RefreshCw className="h-4 w-4 mr-1" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-1" />
                          )}
                          {generatedContent.background ? "Regenerate" : "Generate"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {generatedContent.background ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {generatedContent.background}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <GraduationCap className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Generate background knowledge requirements</p>
                        <p className="text-sm mt-1">to help newcomers understand this field</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Research Ideas */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Lightbulb className="h-5 w-5 text-yellow-600" />
                          Research Ideas
                        </CardTitle>
                        <CardDescription>Potential research opportunities identified</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {generatedContent.ideas && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyContent("ideas", generatedContent.ideas!)}
                          >
                            {copiedSection === "ideas" ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleGenerateContent("ideas")}
                          disabled={isGenerating === "ideas"}
                        >
                          {isGenerating === "ideas" ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : generatedContent.ideas ? (
                            <RefreshCw className="h-4 w-4 mr-1" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-1" />
                          )}
                          {generatedContent.ideas ? "Regenerate" : "Generate"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {generatedContent.ideas ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {generatedContent.ideas}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Lightbulb className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Generate research ideas and opportunities</p>
                        <p className="text-sm mt-1">based on gaps and connections between papers</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Quiz */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <ListChecks className="h-5 w-5 text-purple-600" />
                          Test Your Understanding
                        </CardTitle>
                        <CardDescription>Quiz to verify comprehension</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        {generatedContent.quiz && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopyContent("quiz", generatedContent.quiz!)}
                          >
                            {copiedSection === "quiz" ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => handleGenerateContent("quiz")}
                          disabled={isGenerating === "quiz"}
                        >
                          {isGenerating === "quiz" ? (
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          ) : generatedContent.quiz ? (
                            <RefreshCw className="h-4 w-4 mr-1" />
                          ) : (
                            <Sparkles className="h-4 w-4 mr-1" />
                          )}
                          {generatedContent.quiz ? "Regenerate" : "Generate"}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {generatedContent.quiz ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {generatedContent.quiz}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <ListChecks className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p>Generate a quiz to test understanding</p>
                        <p className="text-sm mt-1">of all papers in this group</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Right Column - AI Chat */}
          <div className="space-y-6">
            {/* AI Reading Session Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-indigo-600" />
                  AI Reading Assistant
                </CardTitle>
                <CardDescription>
                  Have AI read all papers and answer your questions
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!activeSession ? (
                  <div className="space-y-4">
                    <div className="text-center py-4 text-muted-foreground">
                      <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                      <p>Start an AI reading session</p>
                      <p className="text-sm mt-1">to analyze all papers in this group</p>
                    </div>
                    <Button className="w-full" onClick={() => setShowCreateSession(true)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Start AI Session
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Session Info */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge variant={activeSession.status === "ready" ? "default" : "secondary"}>
                          {activeSession.status}
                        </Badge>
                        <span className="text-muted-foreground">{activeSession.modelId}</span>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setShowCreateSession(true)}>
                        New Session
                      </Button>
                    </div>

                    {/* Reading Progress */}
                    {activeSession.status === "active" && (
                      <div className="space-y-3 p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">
                            {group.papers.length} papers ready to read
                          </span>
                          <Button size="sm" onClick={handleStartReading} disabled={isReading}>
                            {isReading ? (
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            ) : (
                              <BookOpen className="h-4 w-4 mr-1" />
                            )}
                            {isReading ? "Reading..." : "Start Reading"}
                          </Button>
                        </div>
                        {isReading && <Progress value={readingProgress} className="h-2" />}
                      </div>
                    )}

                    {/* Paper Summaries */}
                    {(activeSession.status === "ready" || activeSession.status === "completed") &&
                      Object.keys(activeSession.paperSummaries).length > 0 && (
                        <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                          <div className="flex items-center gap-2 text-green-700 dark:text-green-300 mb-2">
                            <Check className="h-4 w-4" />
                            <span className="text-sm font-medium">
                              {Object.keys(activeSession.paperSummaries).length} papers read
                            </span>
                          </div>
                          <p className="text-xs text-green-600 dark:text-green-400">
                            Ready to answer questions about all papers!
                          </p>
                        </div>
                      )}

                    {/* Token Usage */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          Total: {(activeSession.totalPromptTokens + activeSession.totalCompletionTokens).toLocaleString()} tokens
                          {activeSession.tokenLimit > 0 && (
                            <span> / {activeSession.tokenLimit.toLocaleString()} limit</span>
                          )}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            setNewTokenLimit(activeSession.tokenLimit || 100000);
                            setShowTokenLimitDialog(true);
                          }}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Adjust Limit
                        </Button>
                      </div>
                      {activeSession.tokenLimit > 0 && (
                        <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all ${
                              (activeSession.totalPromptTokens + activeSession.totalCompletionTokens) / activeSession.tokenLimit > 0.9
                                ? 'bg-red-500'
                                : (activeSession.totalPromptTokens + activeSession.totalCompletionTokens) / activeSession.tokenLimit > 0.7
                                ? 'bg-amber-500'
                                : 'bg-green-500'
                            }`}
                            style={{
                              width: `${Math.min(100, ((activeSession.totalPromptTokens + activeSession.totalCompletionTokens) / activeSession.tokenLimit) * 100)}%`,
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Token Limit Warning */}
                    {activeSession.tokenLimitReached && (
                      <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                            Token Limit Reached
                          </p>
                          <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                            You've used {(activeSession.totalPromptTokens + activeSession.totalCompletionTokens).toLocaleString()} of your {activeSession.tokenLimit.toLocaleString()} token limit.
                            Increase your limit to continue.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 h-7 text-xs border-amber-300 dark:border-amber-700"
                            onClick={() => {
                              setNewTokenLimit(Math.max(activeSession.tokenLimit * 2, 200000));
                              setShowTokenLimitDialog(true);
                            }}
                          >
                            Increase Limit
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Chat Interface */}
            {activeSession && (
              <Card className="flex flex-col" style={{ height: "500px" }}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Chat with AI
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col overflow-hidden p-0">
                  <ScrollArea className="flex-1 px-4">
                    {activeSession.messages.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-50" />
                        {canChat ? (
                          <p className="text-sm">Ask questions about the papers!</p>
                        ) : (
                          <p className="text-sm">Read the papers first to chat</p>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4 py-4">
                        {activeSession.messages.map((msg, index) => (
                          <div
                            key={index}
                            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                          >
                            <div
                              className={`max-w-[90%] rounded-lg p-3 ${
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
                  <div className="p-4 border-t">
                    <div className="flex gap-2">
                      <Input
                        placeholder={canChat ? "Ask about the papers..." : "Read papers first"}
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
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            {canChat && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Quick Questions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {[
                    "What are the main contributions of each paper?",
                    "How do these papers relate to each other?",
                    "What are the key differences in methodology?",
                    "What are the limitations mentioned?",
                  ].map((q) => (
                    <Button
                      key={q}
                      variant="outline"
                      size="sm"
                      className="w-full justify-start text-left h-auto py-2"
                      onClick={() => {
                        setMessage(q);
                        handleSendMessage();
                      }}
                      disabled={isSending}
                    >
                      <Quote className="h-3 w-3 mr-2 shrink-0" />
                      <span className="line-clamp-1">{q}</span>
                    </Button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Create Session Dialog */}
      <Dialog open={showCreateSession} onOpenChange={setShowCreateSession}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Start AI Reading Session
            </DialogTitle>
            <DialogDescription>
              Select an AI model and provide your API key to analyze papers
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>AI Model</Label>
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {Object.entries(AI_MODELS_BY_PROVIDER).map(([provider, models]) => (
                    <SelectGroup key={provider}>
                      <SelectLabel className="font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                        {PROVIDER_NAMES[provider as AiModelProvider]}
                      </SelectLabel>
                      {models.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
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
            <div className="space-y-2">
              <Label>Token Limit</Label>
              <Select
                value={tokenLimit.toString()}
                onValueChange={(v) => setTokenLimit(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select token limit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50000">50,000 tokens (~$0.50)</SelectItem>
                  <SelectItem value="100000">100,000 tokens (~$1.00)</SelectItem>
                  <SelectItem value="200000">200,000 tokens (~$2.00)</SelectItem>
                  <SelectItem value="500000">500,000 tokens (~$5.00)</SelectItem>
                  <SelectItem value="1000000">1,000,000 tokens (~$10.00)</SelectItem>
                  <SelectItem value="0">Unlimited (no limit)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Set a spending limit. You can increase it later if needed.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateSession(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={isCreatingSession || !selectedModel || !apiKey.trim()}
            >
              {isCreatingSession ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bot className="h-4 w-4 mr-2" />
              )}
              Create Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Papers Dialog */}
      <Dialog open={showAddPapers} onOpenChange={setShowAddPapers}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add Papers to Group
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search papers..."
                  value={paperSearchQuery}
                  onChange={(e) => setPaperSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchPapers()}
                  className="pl-9"
                />
              </div>
              <Button onClick={handleSearchPapers} disabled={isSearchingPapers}>
                {isSearchingPapers ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            <ScrollArea className="h-64">
              {paperSearchResults.length > 0 ? (
                <div className="space-y-2">
                  {paperSearchResults.map((paper) => (
                    <div
                      key={paper.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium line-clamp-1">{paper.title}</p>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {paper.authors?.slice(0, 3).join(", ")}
                        </p>
                      </div>
                      <Button size="sm" onClick={() => handleAddPaper(paper)}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add
                      </Button>
                    </div>
                  ))}
                </div>
              ) : paperSearchQuery ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No papers found</p>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Search className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p>Search for papers to add</p>
                </div>
              )}
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Group Dialog */}
      <Dialog open={showEditGroup} onOpenChange={setShowEditGroup}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-5 w-5" />
              Edit Group
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Group name"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Optional description"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={editVisibility} onValueChange={(v: "private" | "public") => setEditVisibility(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">
                    <span className="flex items-center gap-2">
                      <Lock className="h-4 w-4" /> Private
                    </span>
                  </SelectItem>
                  <SelectItem value="public">
                    <span className="flex items-center gap-2">
                      <Globe className="h-4 w-4" /> Public
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditGroup(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateGroup} disabled={isUpdating || !editName.trim()}>
              {isUpdating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Token Limit Dialog */}
      <Dialog open={showTokenLimitDialog} onOpenChange={setShowTokenLimitDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Adjust Token Limit
            </DialogTitle>
            <DialogDescription>
              Set a new token limit for this AI session
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {activeSession && (
              <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <div className="text-sm font-medium">Current Usage</div>
                <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                  {(activeSession.totalPromptTokens + activeSession.totalCompletionTokens).toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground ml-1">tokens</span>
                </div>
                {activeSession.tokenLimit > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Current limit: {activeSession.tokenLimit.toLocaleString()} tokens
                  </div>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>New Token Limit</Label>
              <Select
                value={newTokenLimit.toString()}
                onValueChange={(v) => setNewTokenLimit(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select token limit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="50000">50,000 tokens (~$0.50)</SelectItem>
                  <SelectItem value="100000">100,000 tokens (~$1.00)</SelectItem>
                  <SelectItem value="200000">200,000 tokens (~$2.00)</SelectItem>
                  <SelectItem value="500000">500,000 tokens (~$5.00)</SelectItem>
                  <SelectItem value="1000000">1,000,000 tokens (~$10.00)</SelectItem>
                  <SelectItem value="2000000">2,000,000 tokens (~$20.00)</SelectItem>
                  <SelectItem value="0">Unlimited (no limit)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Estimated costs based on GPT-4o-mini pricing. Actual costs may vary by model.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTokenLimitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateTokenLimit}>
              Update Limit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
