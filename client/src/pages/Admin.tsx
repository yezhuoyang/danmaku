import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  Users,
  FileText,
  MessageSquare,
  Bot,
  Star,
  Search,
  Trash2,
  Shield,
  ShieldOff,
  ExternalLink,
  MessageCircle,
  Eye,
  Calendar,
  Key,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import * as api from "../lib/api";
import type {
  AdminStats,
  AdminUser,
  AdminPaper,
  AdminAnnotation,
  AdminAiSession,
  AdminAiReview,
  AdminUserReview,
} from "../lib/api";
import { toast } from "sonner";

// Format date
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}

// Format datetime
function formatDateTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export default function Admin() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // Stats
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersSearch, setUsersSearch] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);

  // Papers
  const [papers, setPapers] = useState<AdminPaper[]>([]);
  const [papersTotal, setPapersTotal] = useState(0);
  const [papersSearch, setPapersSearch] = useState("");
  const [loadingPapers, setLoadingPapers] = useState(false);

  // Annotations
  const [annotations, setAnnotations] = useState<AdminAnnotation[]>([]);
  const [annotationsTotal, setAnnotationsTotal] = useState(0);
  const [annotationsSearch, setAnnotationsSearch] = useState("");
  const [loadingAnnotations, setLoadingAnnotations] = useState(false);

  // AI Sessions
  const [aiSessions, setAiSessions] = useState<AdminAiSession[]>([]);
  const [aiSessionsTotal, setAiSessionsTotal] = useState(0);
  const [aiSessionsSearch, setAiSessionsSearch] = useState("");
  const [loadingAiSessions, setLoadingAiSessions] = useState(false);

  // AI Reviews
  const [aiReviews, setAiReviews] = useState<AdminAiReview[]>([]);
  const [aiReviewsTotal, setAiReviewsTotal] = useState(0);
  const [loadingAiReviews, setLoadingAiReviews] = useState(false);

  // User Reviews
  const [userReviews, setUserReviews] = useState<AdminUserReview[]>([]);
  const [userReviewsTotal, setUserReviewsTotal] = useState(0);
  const [loadingUserReviews, setLoadingUserReviews] = useState(false);

  // Delete confirmation
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: string;
    id: string;
    name: string;
  }>({ open: false, type: "", id: "", name: "" });

  // Check admin access
  useEffect(() => {
    if (user && !user.isAdmin) {
      toast.error("Admin privileges required");
      setLocation("/");
    }
  }, [user, setLocation]);

  // Load stats
  useEffect(() => {
    if (!user?.isAdmin) return;
    loadStats();
  }, [user]);

  async function loadStats() {
    try {
      const { stats: data } = await api.getAdminStats();
      setStats(data);
    } catch (error) {
      toast.error("Failed to load stats");
    } finally {
      setLoadingStats(false);
    }
  }

  // Load users
  async function loadUsers(search?: string) {
    setLoadingUsers(true);
    try {
      const { users: data, total } = await api.adminListUsers({ search, limit: 50 });
      setUsers(data);
      setUsersTotal(total);
    } catch (error) {
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  }

  // Load papers
  async function loadPapers(search?: string) {
    setLoadingPapers(true);
    try {
      const { papers: data, total } = await api.adminListPapers({ search, limit: 50 });
      setPapers(data);
      setPapersTotal(total);
    } catch (error) {
      toast.error("Failed to load papers");
    } finally {
      setLoadingPapers(false);
    }
  }

  // Load annotations
  async function loadAnnotations(search?: string) {
    setLoadingAnnotations(true);
    try {
      const { annotations: data, total } = await api.adminListAnnotations({ search, limit: 50 });
      setAnnotations(data);
      setAnnotationsTotal(total);
    } catch (error) {
      toast.error("Failed to load annotations");
    } finally {
      setLoadingAnnotations(false);
    }
  }

  // Load AI sessions
  async function loadAiSessions(search?: string) {
    setLoadingAiSessions(true);
    try {
      const { sessions: data, total } = await api.adminListAiSessions({ search, limit: 50 });
      setAiSessions(data);
      setAiSessionsTotal(total);
    } catch (error) {
      toast.error("Failed to load AI sessions");
    } finally {
      setLoadingAiSessions(false);
    }
  }

  // Load AI reviews
  async function loadAiReviews() {
    setLoadingAiReviews(true);
    try {
      const { reviews: data, total } = await api.adminListAiReviews({ limit: 50 });
      setAiReviews(data);
      setAiReviewsTotal(total);
    } catch (error) {
      toast.error("Failed to load AI reviews");
    } finally {
      setLoadingAiReviews(false);
    }
  }

  // Load user reviews
  async function loadUserReviews() {
    setLoadingUserReviews(true);
    try {
      const { reviews: data, total } = await api.adminListUserReviews({ limit: 50 });
      setUserReviews(data);
      setUserReviewsTotal(total);
    } catch (error) {
      toast.error("Failed to load user reviews");
    } finally {
      setLoadingUserReviews(false);
    }
  }

  // Toggle admin status
  async function handleToggleAdmin(userId: string, currentIsAdmin: boolean) {
    try {
      await api.adminSetUserAdmin(userId, !currentIsAdmin);
      toast.success(currentIsAdmin ? "Admin privileges removed" : "Admin privileges granted");
      loadUsers(usersSearch);
    } catch (error) {
      toast.error("Failed to update admin status");
    }
  }

  // Handle delete confirmation
  async function handleDelete() {
    const { type, id } = deleteDialog;
    try {
      switch (type) {
        case "user":
          await api.adminDeleteUser(id);
          loadUsers(usersSearch);
          loadStats();
          break;
        case "paper":
          await api.adminDeletePaper(id);
          loadPapers(papersSearch);
          loadStats();
          break;
        case "annotation":
          await api.adminDeleteAnnotation(id);
          loadAnnotations(annotationsSearch);
          loadStats();
          break;
        case "aiSession":
          await api.adminDeleteAiSession(id);
          loadAiSessions(aiSessionsSearch);
          loadStats();
          break;
        case "aiReview":
          await api.adminDeleteAiReview(id);
          loadAiReviews();
          loadStats();
          break;
        case "userReview":
          await api.adminDeleteUserReview(id);
          loadUserReviews();
          loadStats();
          break;
      }
      toast.success("Deleted successfully");
    } catch (error) {
      toast.error("Failed to delete");
    } finally {
      setDeleteDialog({ open: false, type: "", id: "", name: "" });
    }
  }

  if (!user) {
    return null;
  }

  if (!user.isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Shield className="w-16 h-16 mx-auto text-red-500 mb-4" />
            <h2 className="text-xl font-bold mb-2">Access Denied</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-4">
              You need admin privileges to access this page.
            </p>
            <Button onClick={() => setLocation("/")}>Go Home</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
      {/* Header */}
      <header className="border-b bg-white/60 dark:bg-slate-900/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-indigo-600" />
              <h1 className="text-xl font-bold text-slate-800 dark:text-white">
                Admin Dashboard
              </h1>
            </div>
          </div>
          <Badge variant="outline" className="text-indigo-600 border-indigo-300">
            {user.displayName} (Admin)
          </Badge>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {loadingStats ? (
            [...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)
          ) : stats && (
            <>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    <span className="text-sm text-slate-500">Users</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.userCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-slate-500">Papers</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.paperCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare className="w-5 h-5 text-purple-500" />
                    <span className="text-sm text-slate-500">Annotations</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.annotationCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-5 h-5 text-orange-500" />
                    <span className="text-sm text-slate-500">AI Sessions</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.aiSessionCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="w-5 h-5 text-cyan-500" />
                    <span className="text-sm text-slate-500">AI Reviews</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.aiReviewCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Star className="w-5 h-5 text-yellow-500" />
                    <span className="text-sm text-slate-500">User Reviews</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.userReviewCount}</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="users" onClick={() => !users.length && loadUsers()}>
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="papers" onClick={() => !papers.length && loadPapers()}>
              <FileText className="w-4 h-4 mr-2" />
              Papers
            </TabsTrigger>
            <TabsTrigger value="annotations" onClick={() => !annotations.length && loadAnnotations()}>
              <MessageSquare className="w-4 h-4 mr-2" />
              Annotations
            </TabsTrigger>
            <TabsTrigger value="aiSessions" onClick={() => !aiSessions.length && loadAiSessions()}>
              <Bot className="w-4 h-4 mr-2" />
              AI Sessions
            </TabsTrigger>
            <TabsTrigger value="aiReviews" onClick={() => !aiReviews.length && loadAiReviews()}>
              <Bot className="w-4 h-4 mr-2" />
              AI Reviews
            </TabsTrigger>
            <TabsTrigger value="userReviews" onClick={() => !userReviews.length && loadUserReviews()}>
              <Star className="w-4 h-4 mr-2" />
              User Reviews
            </TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Users ({usersTotal})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Search users..."
                        value={usersSearch}
                        onChange={(e) => setUsersSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && loadUsers(usersSearch)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadUsers(usersSearch)}
                      disabled={loadingUsers}
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingUsers ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : users.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No users found</p>
                ) : (
                  <div className="space-y-2">
                    {users.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold">
                            {u.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{u.displayName}</span>
                              <span className="text-sm text-slate-500">@{u.username}</span>
                              {u.isAdmin && (
                                <Badge variant="secondary" className="text-xs">
                                  <Shield className="w-3 h-3 mr-1" />
                                  Admin
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span>{u.paperCount} papers</span>
                              <span>{u.annotationCount} annotations</span>
                              <span>{u.sessionCount} sessions</span>
                              <span>Joined {formatDate(u.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link href={`/profile/${u.id}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleAdmin(u.id, u.isAdmin)}
                            disabled={u.id === user?.id}
                          >
                            {u.isAdmin ? (
                              <ShieldOff className="w-4 h-4 text-orange-500" />
                            ) : (
                              <Shield className="w-4 h-4 text-green-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                type: "user",
                                id: u.id,
                                name: u.displayName,
                              })
                            }
                            disabled={u.id === user?.id}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Papers Tab */}
          <TabsContent value="papers">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Papers ({papersTotal})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Search papers..."
                        value={papersSearch}
                        onChange={(e) => setPapersSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && loadPapers(papersSearch)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadPapers(papersSearch)}
                      disabled={loadingPapers}
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingPapers ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingPapers ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : papers.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No papers found</p>
                ) : (
                  <div className="space-y-2">
                    {papers.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{p.title}</span>
                            {p.arxivId && (
                              <Badge variant="outline" className="text-xs shrink-0">
                                arXiv:{p.arxivId}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3 h-3" /> {p.viewCount}
                            </span>
                            <span>{p.annotationCount} annotations</span>
                            <span>{p.readerCount} readers</span>
                            <span>{p.sessionCount} sessions</span>
                            {p.addedBy && (
                              <span>by {p.addedBy.displayName}</span>
                            )}
                            <span>{formatDate(p.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/paper/${p.id}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                type: "paper",
                                id: p.id,
                                name: p.title,
                              })
                            }
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Annotations Tab */}
          <TabsContent value="annotations">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5" />
                    Annotations ({annotationsTotal})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Search annotations..."
                        value={annotationsSearch}
                        onChange={(e) => setAnnotationsSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && loadAnnotations(annotationsSearch)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadAnnotations(annotationsSearch)}
                      disabled={loadingAnnotations}
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingAnnotations ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAnnotations ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : annotations.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No annotations found</p>
                ) : (
                  <div className="space-y-2">
                    {annotations.map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant={a.isDanmaku ? "default" : "secondary"}
                              className="text-xs shrink-0"
                            >
                              {a.isDanmaku ? "Danmaku" : "Comment"}
                            </Badge>
                            <span className="text-sm truncate">{a.content.text}</span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>by {a.userName}</span>
                            <span>on "{a.paperTitle.slice(0, 30)}..."</span>
                            <span>Page {a.pageNumber}</span>
                            <span>{formatDateTime(a.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/paper/${a.paperId}/read`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                type: "annotation",
                                id: a.id,
                                name: a.content.text.slice(0, 50),
                              })
                            }
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Sessions Tab */}
          <TabsContent value="aiSessions">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    AI Sessions ({aiSessionsTotal})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input
                        placeholder="Search sessions..."
                        value={aiSessionsSearch}
                        onChange={(e) => setAiSessionsSearch(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && loadAiSessions(aiSessionsSearch)}
                        className="pl-9 w-64"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => loadAiSessions(aiSessionsSearch)}
                      disabled={loadingAiSessions}
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingAiSessions ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAiSessions ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : aiSessions.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No AI sessions found</p>
                ) : (
                  <div className="space-y-2">
                    {aiSessions.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{s.title}</span>
                            {s.isActive && (
                              <Badge className="text-xs bg-green-500">Active</Badge>
                            )}
                            {s.hasApiKey && (
                              <Badge variant="outline" className="text-xs">
                                <Key className="w-3 h-3 mr-1" />
                                API Key
                              </Badge>
                            )}
                            {s.hasSentenceAnalysis && (
                              <Badge variant="secondary" className="text-xs">
                                Read Complete
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>by {s.userName}</span>
                            <span>{s.messageCount} messages</span>
                            <span>{s.totalPromptTokens + s.totalCompletionTokens} tokens</span>
                            <span>"{s.paperTitle.slice(0, 30)}..."</span>
                            <span>{formatDateTime(s.updatedAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/paper/${s.paperId}/session/${s.id}/debug`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                type: "aiSession",
                                id: s.id,
                                name: s.title,
                              })
                            }
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Reviews Tab */}
          <TabsContent value="aiReviews">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    AI Reviews ({aiReviewsTotal})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadAiReviews}
                    disabled={loadingAiReviews}
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingAiReviews ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingAiReviews ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : aiReviews.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No AI reviews found</p>
                ) : (
                  <div className="space-y-2">
                    {aiReviews.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate mb-1">{r.paperTitle}</div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>Generated by {r.generatedBy}</span>
                            <span>{formatDateTime(r.generatedAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/paper/${r.paperId}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                type: "aiReview",
                                id: r.id,
                                name: `AI Review for "${r.paperTitle.slice(0, 30)}..."`,
                              })
                            }
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Reviews Tab */}
          <TabsContent value="userReviews">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    User Reviews ({userReviewsTotal})
                  </CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadUserReviews}
                    disabled={loadingUserReviews}
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingUserReviews ? "animate-spin" : ""}`} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {loadingUserReviews ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                  </div>
                ) : userReviews.length === 0 ? (
                  <p className="text-center text-slate-500 py-8">No user reviews found</p>
                ) : (
                  <div className="space-y-2">
                    {userReviews.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate mb-1">{r.paperTitle}</div>
                          <div className="flex items-center gap-4 text-xs text-slate-500">
                            <span>by {r.userName}</span>
                            <span>{formatDateTime(r.createdAt)}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Link href={`/paper/${r.paperId}`}>
                            <Button variant="ghost" size="sm">
                              <ExternalLink className="w-4 h-4" />
                            </Button>
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteDialog({
                                open: true,
                                type: "userReview",
                                id: r.id,
                                name: `${r.userName}'s review`,
                              })
                            }
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => !open && setDeleteDialog({ ...deleteDialog, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to delete: <strong>{deleteDialog.name}</strong>
              <br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
