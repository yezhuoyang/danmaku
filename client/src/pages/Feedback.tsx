import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import * as api from "@/lib/api";
import type {
  FeedbackRequest,
  FeedbackType,
  FeedbackStatus,
  FeedbackSort,
  FeedbackPriority,
} from "@/lib/api";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Icons
import {
  Bug,
  Lightbulb,
  Plus,
  ThumbsUp,
  MessageSquare,
  Clock,
  CheckCircle2,
  Circle,
  XCircle,
  AlertTriangle,
  ArrowUpDown,
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  Trash2,
  Edit,
  Send,
  Loader2,
  Home,
  User,
  Mail,
  ImagePlus,
  X,
  ZoomIn,
  Eye,
  Image as ImageIcon,
} from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

// Status badge colors
const STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  in_progress: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  resolved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  closed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  wont_fix: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_ICONS: Record<FeedbackStatus, typeof Circle> = {
  open: Circle,
  in_progress: Clock,
  resolved: CheckCircle2,
  closed: XCircle,
  wont_fix: XCircle,
};

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  closed: "Closed",
  wont_fix: "Won't Fix",
};

const PRIORITY_COLORS: Record<FeedbackPriority, string> = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};

export default function Feedback() {
  const { user } = useAuth();

  // State
  const [feedback, setFeedback] = useState<FeedbackRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<FeedbackStatus | "all">("all");
  const [sortBy, setSortBy] = useState<FeedbackSort>("newest");

  // Submit dialog
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    type: "bug" as FeedbackType,
    title: "",
    description: "",
    images: [] as string[],
    submitterName: "",
    submitterEmail: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image preview dialog
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Detail view dialog
  const [detailDialog, setDetailDialog] = useState<{
    open: boolean;
    feedback: FeedbackRequest | null;
  }>({
    open: false,
    feedback: null,
  });

  // Admin response dialog
  const [adminDialog, setAdminDialog] = useState<{
    open: boolean;
    feedback: FeedbackRequest | null;
    status: FeedbackStatus;
    priority: FeedbackPriority;
    adminResponse: string;
  }>({
    open: false,
    feedback: null,
    status: "open",
    priority: "medium",
    adminResponse: "",
  });
  const [updatingAdmin, setUpdatingAdmin] = useState(false);

  // Load feedback
  async function loadFeedback() {
    setLoading(true);
    try {
      const result = await api.listFeedback({
        type: typeFilter === "all" ? undefined : typeFilter,
        status: statusFilter === "all" ? undefined : statusFilter,
        sort: sortBy,
        page,
        limit: 15,
      });
      setFeedback(result.feedback);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (error) {
      toast.error("Failed to load feedback");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFeedback();
  }, [typeFilter, statusFilter, sortBy, page]);

  // Handle image upload
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;

    const remainingSlots = 5 - submitForm.images.length;
    if (remainingSlots <= 0) {
      toast.error("Maximum 5 images allowed");
      return;
    }

    Array.from(files).slice(0, remainingSlots).forEach((file) => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 5MB)`);
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setSubmitForm((prev) => ({
          ...prev,
          images: [...prev.images, dataUrl],
        }));
      };
      reader.readAsDataURL(file);
    });

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  // Remove image from form
  function removeImage(index: number) {
    setSubmitForm((prev) => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index),
    }));
  }

  // Submit feedback
  async function handleSubmit() {
    if (!submitForm.title.trim() || submitForm.title.trim().length < 5) {
      toast.error("Title must be at least 5 characters");
      return;
    }
    if (!submitForm.description.trim() || submitForm.description.trim().length < 10) {
      toast.error("Description must be at least 10 characters");
      return;
    }

    setSubmitting(true);
    try {
      const imageCount = submitForm.images.length;
      console.log('[DEBUG] Submitting feedback with', imageCount, 'images');
      if (imageCount > 0) {
        console.log('[DEBUG] First image starts with:', submitForm.images[0].substring(0, 50));
        console.log('[DEBUG] First image length:', submitForm.images[0].length);
      }
      const result = await api.submitFeedback({
        type: submitForm.type,
        title: submitForm.title.trim(),
        description: submitForm.description.trim(),
        images: submitForm.images.length > 0 ? submitForm.images : undefined,
        submitterName: submitForm.submitterName.trim() || undefined,
        submitterEmail: submitForm.submitterEmail.trim() || undefined,
      });
      const savedImageCount = result.images?.length || 0;
      if (imageCount > 0) {
        toast.success(`Feedback submitted with ${savedImageCount} image${savedImageCount !== 1 ? 's' : ''}!`);
      } else {
        toast.success("Feedback submitted successfully!");
      }
      setSubmitDialogOpen(false);
      setSubmitForm({
        type: "bug",
        title: "",
        description: "",
        images: [],
        submitterName: "",
        submitterEmail: "",
      });
      loadFeedback();
    } catch (error) {
      toast.error("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  }

  // Toggle upvote
  async function handleUpvote(item: FeedbackRequest) {
    if (!user) {
      toast.error("Please log in to upvote");
      return;
    }
    try {
      const result = await api.toggleFeedbackUpvote(item.id);
      setFeedback((prev) =>
        prev.map((f) =>
          f.id === item.id
            ? { ...f, upvotes: result.upvotes, hasUpvoted: result.upvoted }
            : f
        )
      );
    } catch (error) {
      toast.error("Failed to upvote");
    }
  }

  // Admin update
  async function handleAdminUpdate() {
    if (!adminDialog.feedback) return;

    setUpdatingAdmin(true);
    try {
      await api.updateFeedback(adminDialog.feedback.id, {
        status: adminDialog.status,
        priority: adminDialog.priority,
        adminResponse: adminDialog.adminResponse.trim() || undefined,
      });
      toast.success("Feedback updated");
      setAdminDialog({ open: false, feedback: null, status: "open", priority: "medium", adminResponse: "" });
      loadFeedback();
    } catch (error) {
      toast.error("Failed to update feedback");
    } finally {
      setUpdatingAdmin(false);
    }
  }

  // Admin delete
  async function handleDelete(item: FeedbackRequest) {
    if (!confirm(`Delete "${item.title}"?`)) return;
    try {
      await api.deleteFeedback(item.id);
      toast.success("Feedback deleted");
      loadFeedback();
    } catch (error) {
      toast.error("Failed to delete feedback");
    }
  }

  // Open admin dialog
  function openAdminDialog(item: FeedbackRequest) {
    setAdminDialog({
      open: true,
      feedback: item,
      status: item.status,
      priority: item.priority,
      adminResponse: item.adminResponse || "",
    });
  }

  // Format date
  function formatDate(ts: number) {
    return new Date(ts * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  // Open detail dialog
  function openDetailDialog(item: FeedbackRequest) {
    setDetailDialog({ open: true, feedback: item });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <Home className="w-4 h-4 mr-2" />
                Home
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              <span className="font-semibold text-lg">Feedback</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user && <NotificationBell />}
            {user ? (
              <Link href={`/profile/${user.id}`}>
                <Avatar className="w-8 h-8 cursor-pointer">
                  <AvatarImage src={user.avatar} alt={user.displayName} />
                  <AvatarFallback>{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Link href="/">
                <Button variant="outline" size="sm">Log in</Button>
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                Bug Reports & Feature Requests
              </h1>
              <p className="text-slate-600 dark:text-slate-400 mt-1">
                Help us improve by reporting bugs or suggesting new features.
              </p>
            </div>
            <Button
              onClick={() => setSubmitDialogOpen(true)}
              className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              Submit Feedback
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Type Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-slate-500" />
                <Tabs
                  value={typeFilter}
                  onValueChange={(v) => {
                    setTypeFilter(v as FeedbackType | "all");
                    setPage(1);
                  }}
                >
                  <TabsList>
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="bug" className="gap-1">
                      <Bug className="w-3.5 h-3.5" />
                      Bugs
                    </TabsTrigger>
                    <TabsTrigger value="feature" className="gap-1">
                      <Lightbulb className="w-3.5 h-3.5" />
                      Features
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v as FeedbackStatus | "all");
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="wont_fix">Won't Fix</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select
                value={sortBy}
                onValueChange={(v) => {
                  setSortBy(v as FeedbackSort);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <ArrowUpDown className="w-3.5 h-3.5 mr-2" />
                  <SelectValue placeholder="Sort" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="most_upvoted">Most Upvoted</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1" />
              <span className="text-sm text-slate-500">{total} items</span>
            </div>
          </CardContent>
        </Card>

        {/* Feedback List */}
        <div className="space-y-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="py-4">
                  <Skeleton className="h-6 w-3/4 mb-2" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-1/2" />
                </CardContent>
              </Card>
            ))
          ) : feedback.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="font-medium text-slate-700 dark:text-slate-300 mb-2">
                  No feedback found
                </h3>
                <p className="text-slate-500 text-sm mb-4">
                  Be the first to submit feedback!
                </p>
                <Button onClick={() => setSubmitDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Submit Feedback
                </Button>
              </CardContent>
            </Card>
          ) : (
            feedback.map((item) => {
              const StatusIcon = STATUS_ICONS[item.status];
              return (
                <Card key={item.id} className="hover:shadow-md transition-shadow group">
                  <CardContent className="py-4">
                    <div className="flex gap-4">
                      {/* Upvote Button */}
                      <div className="flex flex-col items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-10 w-10 p-0 ${
                            item.hasUpvoted
                              ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20"
                              : ""
                          }`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpvote(item);
                          }}
                        >
                          <ThumbsUp className={`w-5 h-5 ${item.hasUpvoted ? "fill-current" : ""}`} />
                        </Button>
                        <span className="text-sm font-medium">{item.upvotes}</span>
                      </div>

                      {/* Content - Clickable */}
                      <div
                        className="flex-1 min-w-0 cursor-pointer"
                        onClick={() => openDetailDialog(item)}
                      >
                        <div className="flex items-start gap-2 mb-2">
                          {/* Type Icon */}
                          {item.type === "bug" ? (
                            <Bug className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                          ) : (
                            <Lightbulb className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                          )}

                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-slate-900 dark:text-slate-100 line-clamp-1">
                              {item.title}
                            </h3>
                          </div>

                          {/* Status Badge */}
                          <Badge className={`shrink-0 ${STATUS_COLORS[item.status]}`}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {STATUS_LABELS[item.status]}
                          </Badge>

                          {/* Priority Badge (if not medium) */}
                          {item.priority !== "medium" && (
                            <Badge className={`shrink-0 ${PRIORITY_COLORS[item.priority]}`}>
                              {item.priority === "critical" && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                            </Badge>
                          )}

                          {/* Admin Menu */}
                          {user?.isAdmin && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => openAdminDialog(item)}>
                                  <Edit className="w-4 h-4 mr-2" />
                                  Manage
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => handleDelete(item)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </div>

                        <div className="prose prose-sm dark:prose-invert max-w-none mb-3 text-slate-600 dark:text-slate-400">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {item.description.length > 300
                              ? item.description.slice(0, 300) + "..."
                              : item.description}
                          </ReactMarkdown>
                        </div>

                        {/* Uploaded Images */}
                        {item.images && item.images.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {item.images.slice(0, 3).map((img, idx) => (
                              <button
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreviewImage(img);
                                }}
                                className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:opacity-80 transition-opacity"
                              >
                                <img
                                  src={img}
                                  alt={`Screenshot ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors">
                                  <ZoomIn className="w-4 h-4 text-white opacity-0 hover:opacity-100" />
                                </div>
                              </button>
                            ))}
                            {item.images.length > 3 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDetailDialog(item);
                                }}
                                className="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-sm text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                              >
                                +{item.images.length - 3}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Admin Response */}
                        {item.adminResponse && (
                          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 mb-3 text-sm">
                            <div className="font-medium text-indigo-700 dark:text-indigo-400 mb-1">
                              Admin Response:
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {item.adminResponse}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}

                        {/* Meta */}
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {item.submitterName}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDate(item.createdAt)}
                          </span>
                          {item.resolvedAt && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Resolved {formatDate(item.resolvedAt)}
                            </span>
                          )}
                          {item.images && item.images.length > 0 && (
                            <span className="flex items-center gap-1">
                              <ImageIcon className="w-3.5 h-3.5" />
                              {item.images.length} image{item.images.length > 1 ? "s" : ""}
                            </span>
                          )}
                          <span className="flex-1" />
                          <span className="flex items-center gap-1 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye className="w-3.5 h-3.5" />
                            View Details
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </main>

      {/* Submit Dialog */}
      <Dialog open={submitDialogOpen} onOpenChange={setSubmitDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit Feedback</DialogTitle>
            <DialogDescription>
              Report a bug or suggest a new feature. You don't need to be logged in.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Type Selection */}
            <div className="space-y-2">
              <Label>Type</Label>
              <Tabs
                value={submitForm.type}
                onValueChange={(v) => setSubmitForm((f) => ({ ...f, type: v as FeedbackType }))}
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="bug" className="gap-2">
                    <Bug className="w-4 h-4" />
                    Bug Report
                  </TabsTrigger>
                  <TabsTrigger value="feature" className="gap-2">
                    <Lightbulb className="w-4 h-4" />
                    Feature Request
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                placeholder={
                  submitForm.type === "bug"
                    ? "Brief description of the bug..."
                    : "Brief description of the feature..."
                }
                value={submitForm.title}
                onChange={(e) => setSubmitForm((f) => ({ ...f, title: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Description * (Markdown supported)</Label>
              <Textarea
                id="description"
                placeholder={
                  submitForm.type === "bug"
                    ? "Steps to reproduce, expected behavior, actual behavior...\n\n**Supports Markdown:** *italic*, **bold**, `code`, lists, etc."
                    : "Describe the feature and why it would be useful...\n\n**Supports Markdown:** *italic*, **bold**, `code`, lists, etc."
                }
                rows={6}
                value={submitForm.description}
                onChange={(e) => setSubmitForm((f) => ({ ...f, description: e.target.value }))}
              />
              <p className="text-xs text-slate-500">
                Supports Markdown: **bold**, *italic*, `code`, - lists, etc.
              </p>
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <ImagePlus className="w-4 h-4" />
                Screenshots (optional, max 5)
              </Label>
              <div className="flex flex-wrap gap-2">
                {submitForm.images.map((img, idx) => (
                  <div key={idx} className="relative w-20 h-20 group">
                    <img
                      src={img}
                      alt={`Upload ${idx + 1}`}
                      className="w-full h-full object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {submitForm.images.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-20 h-20 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex flex-col items-center justify-center text-slate-400 hover:border-indigo-500 hover:text-indigo-500 transition-colors"
                  >
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-xs mt-1">Add</span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Anonymous fields (only if not logged in) */}
            {!user && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="submitterName" className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Your Name (optional)
                  </Label>
                  <Input
                    id="submitterName"
                    placeholder="Anonymous"
                    value={submitForm.submitterName}
                    onChange={(e) => setSubmitForm((f) => ({ ...f, submitterName: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="submitterEmail" className="flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Your Email (optional)
                  </Label>
                  <Input
                    id="submitterEmail"
                    type="email"
                    placeholder="For follow-up (not displayed publicly)"
                    value={submitForm.submitterEmail}
                    onChange={(e) => setSubmitForm((f) => ({ ...f, submitterEmail: e.target.value }))}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Admin Dialog */}
      <Dialog
        open={adminDialog.open}
        onOpenChange={(open) =>
          !open &&
          setAdminDialog({ open: false, feedback: null, status: "open", priority: "medium", adminResponse: "" })
        }
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Feedback</DialogTitle>
            <DialogDescription>
              Update status, priority, or add an admin response.
            </DialogDescription>
          </DialogHeader>

          {adminDialog.feedback && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                <h4 className="font-medium mb-1">{adminDialog.feedback.title}</h4>
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                  {adminDialog.feedback.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={adminDialog.status}
                    onValueChange={(v) =>
                      setAdminDialog((d) => ({ ...d, status: v as FeedbackStatus }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="wont_fix">Won't Fix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={adminDialog.priority}
                    onValueChange={(v) =>
                      setAdminDialog((d) => ({ ...d, priority: v as FeedbackPriority }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Admin Response</Label>
                <Textarea
                  placeholder="Add a public response to this feedback..."
                  rows={4}
                  value={adminDialog.adminResponse}
                  onChange={(e) =>
                    setAdminDialog((d) => ({ ...d, adminResponse: e.target.value }))
                  }
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setAdminDialog({
                  open: false,
                  feedback: null,
                  status: "open",
                  priority: "medium",
                  adminResponse: "",
                })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleAdminUpdate} disabled={updatingAdmin}>
              {updatingAdmin ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail View Dialog */}
      <Dialog
        open={detailDialog.open}
        onOpenChange={(open) => !open && setDetailDialog({ open: false, feedback: null })}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          {detailDialog.feedback && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  {detailDialog.feedback.type === "bug" ? (
                    <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                      <Bug className="w-5 h-5 text-red-500" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Lightbulb className="w-5 h-5 text-amber-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <DialogTitle className="text-lg">
                      {detailDialog.feedback.title}
                    </DialogTitle>
                    <DialogDescription className="flex items-center gap-3 mt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        {detailDialog.feedback.submitterName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {formatDate(detailDialog.feedback.createdAt)}
                      </span>
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge className={STATUS_COLORS[detailDialog.feedback.status]}>
                      {STATUS_LABELS[detailDialog.feedback.status]}
                    </Badge>
                    {detailDialog.feedback.priority !== "medium" && (
                      <Badge className={PRIORITY_COLORS[detailDialog.feedback.priority]}>
                        {detailDialog.feedback.priority.charAt(0).toUpperCase() + detailDialog.feedback.priority.slice(1)}
                      </Badge>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="flex-1 overflow-y-auto space-y-4 py-4">
                {/* Description */}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {detailDialog.feedback.description}
                  </ReactMarkdown>
                </div>

                {/* Images */}
                {detailDialog.feedback.images && detailDialog.feedback.images.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300 flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      Attachments ({detailDialog.feedback.images.length})
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {detailDialog.feedback.images.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setPreviewImage(img)}
                          className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 hover:opacity-80 transition-opacity group"
                        >
                          <img
                            src={img}
                            alt={`Screenshot ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                            <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin Response */}
                {detailDialog.feedback.adminResponse && (
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
                    <div className="font-medium text-indigo-700 dark:text-indigo-400 mb-2 flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Admin Response
                    </div>
                    <div className="prose prose-sm dark:prose-invert max-w-none text-slate-700 dark:text-slate-300">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {detailDialog.feedback.adminResponse}
                      </ReactMarkdown>
                    </div>
                  </div>
                )}

                {detailDialog.feedback.resolvedAt && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <CheckCircle2 className="w-4 h-4" />
                    Resolved on {formatDate(detailDialog.feedback.resolvedAt)}
                  </div>
                )}
              </div>

              <DialogFooter className="border-t pt-4">
                <div className="flex items-center gap-2 mr-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`${
                      detailDialog.feedback.hasUpvoted
                        ? "text-indigo-600 bg-indigo-50 dark:bg-indigo-900/20"
                        : ""
                    }`}
                    onClick={() => {
                      handleUpvote(detailDialog.feedback!);
                      // Update local state
                      setDetailDialog((d) => ({
                        ...d,
                        feedback: d.feedback
                          ? {
                              ...d.feedback,
                              hasUpvoted: !d.feedback.hasUpvoted,
                              upvotes: d.feedback.hasUpvoted
                                ? d.feedback.upvotes - 1
                                : d.feedback.upvotes + 1,
                            }
                          : null,
                      }));
                    }}
                  >
                    <ThumbsUp
                      className={`w-4 h-4 mr-2 ${
                        detailDialog.feedback.hasUpvoted ? "fill-current" : ""
                      }`}
                    />
                    {detailDialog.feedback.upvotes} Upvotes
                  </Button>
                </div>
                {user?.isAdmin && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      openAdminDialog(detailDialog.feedback!);
                      setDetailDialog({ open: false, feedback: null });
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Manage
                  </Button>
                )}
                <Button
                  variant="default"
                  onClick={() => setDetailDialog({ open: false, feedback: null })}
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <div className="relative flex items-center justify-center">
              <img
                src={previewImage}
                alt="Preview"
                className="max-w-full max-h-[80vh] object-contain rounded-lg"
              />
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white"
                onClick={() => setPreviewImage(null)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
