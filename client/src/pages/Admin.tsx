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
  FolderTree,
  Plus,
  Pencil,
  ChevronRight,
  ChevronDown,
  GripVertical,
  Tags,
  Sparkles,
  Wand2,
  Loader2,
  Check,
  AlertCircle,
  Lightbulb,
  Play,
  Trophy,
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
import type { Category, CategoryWithChildren, ChallengeCurationJob, PromotionSuggestion } from "../../../shared/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CategoryIcon, getCategoryColorClass } from "@/lib/category-icons";

// Format date
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleDateString();
}

// Category tree item component
function CategoryTreeItem({
  category,
  depth,
  expandedCategories,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddChild,
}: {
  category: CategoryWithChildren;
  depth: number;
  expandedCategories: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit: (cat: Category) => void;
  onDelete: (id: string, name: string) => void;
  onAddChild: (parentId: string) => void;
}) {
  const hasChildren = category.children && category.children.length > 0;
  const isExpanded = expandedCategories.has(category.id);

  return (
    <div>
      <div
        className={`flex items-center justify-between p-3 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
          depth > 0 ? 'ml-6' : ''
        }`}
        style={{ marginLeft: depth > 0 ? `${depth * 24}px` : undefined }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {hasChildren ? (
            <button
              onClick={() => onToggleExpand(category.id)}
              className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
            >
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>
          ) : (
            <span className="w-6" />
          )}
          {category.icon && (
            <span className={getCategoryColorClass(category.color)}>
              <CategoryIcon iconName={category.icon} className="w-5 h-5" />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{category.name}</span>
              <Badge variant="outline" className="text-xs shrink-0">
                {category.slug}
              </Badge>
              {category.paperCount !== undefined && category.paperCount > 0 && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {category.paperCount} papers
                </Badge>
              )}
            </div>
            {category.description && (
              <p className="text-xs text-slate-500 truncate">{category.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAddChild(category.id)}
            title="Add subcategory"
          >
            <Plus className="w-4 h-4 text-green-500" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(category)}
            title="Edit category"
          >
            <Pencil className="w-4 h-4 text-blue-500" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(category.id, category.name)}
            title="Delete category"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </Button>
        </div>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {category.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              depth={depth + 1}
              expandedCategories={expandedCategories}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddChild={onAddChild}
            />
          ))}
        </div>
      )}
    </div>
  );
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

  // Challenge Curation
  const [curationJobs, setCurationJobs] = useState<ChallengeCurationJob[]>([]);
  const [promotionSuggestions, setPromotionSuggestions] = useState<PromotionSuggestion[]>([]);
  const [loadingCuration, setLoadingCuration] = useState(false);
  const [triggeringCuration, setTriggeringCuration] = useState(false);

  // Categories
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [flatCategories, setFlatCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryDialog, setCategoryDialog] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    category?: Category;
    parentId?: string;
  }>({ open: false, mode: 'create' });
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    description: '',
    parentId: '',
    icon: '',
    color: '',
  });

  // Paper category assignment
  const [paperCategoryDialog, setPaperCategoryDialog] = useState<{
    open: boolean;
    paperId: string;
    paperTitle: string;
    selectedCategories: string[];
    loading: boolean;
  }>({ open: false, paperId: '', paperTitle: '', selectedCategories: [], loading: false });

  // AI auto-categorization
  const [aiCategorizeDialog, setAiCategorizeDialog] = useState<{
    open: boolean;
    mode: 'single' | 'bulk';
    paperId?: string;
    paperTitle?: string;
    paperIds?: string[];
    suggestions: Array<{
      paperId: string;
      paperTitle: string;
      categoryIds: string[];
      categoryNames: string[];
      reasoning?: string;
      status: 'pending' | 'loading' | 'success' | 'error';
      error?: string;
    }>;
    loading: boolean;
    apiKey: string;
  }>({
    open: false,
    mode: 'single',
    suggestions: [],
    loading: false,
    apiKey: '',
  });

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

  // Load curation data
  async function loadCuration() {
    setLoadingCuration(true);
    try {
      const [jobsRes, suggestionsRes] = await Promise.all([
        api.getCurationJobs({ limit: 10 }),
        api.getPromotionSuggestions({ limit: 20 }),
      ]);
      setCurationJobs(jobsRes.jobs);
      setPromotionSuggestions(suggestionsRes.suggestions);
    } catch (error) {
      toast.error("Failed to load curation data");
    } finally {
      setLoadingCuration(false);
    }
  }

  // Trigger curation job
  async function triggerCuration() {
    setTriggeringCuration(true);
    try {
      const { job } = await api.triggerCurationJob({ scope: 'all' });
      toast.success("Curation job started");
      setCurationJobs(prev => [job, ...prev]);
    } catch (error: any) {
      toast.error(error.message || "Failed to start curation job");
    } finally {
      setTriggeringCuration(false);
    }
  }

  // Promote a suggestion
  async function handlePromoteSuggestion(suggestion: PromotionSuggestion) {
    try {
      await api.promoteIdeaToChallenge({
        historyId: suggestion.historyId,
        ideaId: suggestion.ideaId,
        title: suggestion.title,
        description: suggestion.description,
      });
      toast.success("Idea promoted to challenge problem");
      // Remove from suggestions
      setPromotionSuggestions(prev => prev.filter(s => s.ideaId !== suggestion.ideaId));
    } catch (error: any) {
      toast.error(error.message || "Failed to promote idea");
    }
  }

  // Load categories
  async function loadCategories() {
    setLoadingCategories(true);
    try {
      const [treeResponse, flatResponse] = await Promise.all([
        api.getCategoryTree(),
        api.getCategoriesFlat(),
      ]);
      setCategories(treeResponse.categories);
      setFlatCategories(flatResponse.categories);
    } catch (error) {
      toast.error("Failed to load categories");
    } finally {
      setLoadingCategories(false);
    }
  }

  // Toggle category expansion
  function toggleCategoryExpand(id: string) {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  }

  // Open create category dialog
  function openCreateCategoryDialog(parentId?: string) {
    setCategoryForm({
      name: '',
      slug: '',
      description: '',
      parentId: parentId || '',
      icon: '',
      color: '',
    });
    setCategoryDialog({ open: true, mode: 'create', parentId });
  }

  // Open edit category dialog
  function openEditCategoryDialog(category: Category) {
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      parentId: category.parentId || '',
      icon: category.icon || '',
      color: category.color || '',
    });
    setCategoryDialog({ open: true, mode: 'edit', category });
  }

  // Save category
  async function handleSaveCategory() {
    try {
      if (categoryDialog.mode === 'create') {
        await api.createCategory({
          name: categoryForm.name,
          slug: categoryForm.slug || undefined,
          description: categoryForm.description || undefined,
          parentId: categoryForm.parentId || undefined,
          icon: categoryForm.icon || undefined,
          color: categoryForm.color || undefined,
        });
        toast.success("Category created");
      } else if (categoryDialog.category) {
        await api.updateCategory(categoryDialog.category.id, {
          name: categoryForm.name,
          slug: categoryForm.slug || undefined,
          description: categoryForm.description || undefined,
          parentId: categoryForm.parentId || undefined,
          icon: categoryForm.icon || undefined,
          color: categoryForm.color || undefined,
        });
        toast.success("Category updated");
      }
      setCategoryDialog({ open: false, mode: 'create' });
      loadCategories();
    } catch (error) {
      toast.error(categoryDialog.mode === 'create' ? "Failed to create category" : "Failed to update category");
    }
  }

  // Delete category
  async function handleDeleteCategory(id: string, name: string) {
    setDeleteDialog({ open: true, type: 'category', id, name });
  }

  // Open paper category assignment dialog
  async function openPaperCategoryDialog(paperId: string, paperTitle: string) {
    setPaperCategoryDialog({
      open: true,
      paperId,
      paperTitle,
      selectedCategories: [],
      loading: true,
    });
    try {
      // Load current categories for the paper
      const result = await api.getPaperCategories(paperId);
      setPaperCategoryDialog(prev => ({
        ...prev,
        selectedCategories: result.categories.map(c => c.id),
        loading: false,
      }));
      // Also load categories if not already loaded
      if (flatCategories.length === 0) {
        loadCategories();
      }
    } catch (error) {
      toast.error("Failed to load paper categories");
      setPaperCategoryDialog(prev => ({ ...prev, loading: false }));
    }
  }

  // Toggle category selection for paper
  function togglePaperCategory(categoryId: string) {
    setPaperCategoryDialog(prev => {
      const selected = new Set(prev.selectedCategories);
      if (selected.has(categoryId)) {
        selected.delete(categoryId);
      } else {
        selected.add(categoryId);
      }
      return { ...prev, selectedCategories: Array.from(selected) };
    });
  }

  // Save paper categories
  async function savePaperCategories() {
    setPaperCategoryDialog(prev => ({ ...prev, loading: true }));
    try {
      // First, get current categories to figure out what to add/remove
      const currentResult = await api.getPaperCategories(paperCategoryDialog.paperId);
      const currentIdsList = currentResult.categories.map(c => c.id);
      const currentIds = new Set(currentIdsList);
      const newIds = new Set(paperCategoryDialog.selectedCategories);

      // Remove categories that were deselected
      for (const catId of currentIdsList) {
        if (!newIds.has(catId)) {
          await api.removePaperFromCategory(paperCategoryDialog.paperId, catId);
        }
      }

      // Add new categories
      const toAdd = paperCategoryDialog.selectedCategories.filter(id => !currentIds.has(id));
      if (toAdd.length > 0) {
        await api.addPaperToCategories(paperCategoryDialog.paperId, toAdd);
      }

      toast.success("Paper categories updated");
      setPaperCategoryDialog({ open: false, paperId: '', paperTitle: '', selectedCategories: [], loading: false });
      loadCategories(); // Refresh category counts
    } catch (error) {
      toast.error("Failed to update paper categories");
      setPaperCategoryDialog(prev => ({ ...prev, loading: false }));
    }
  }

  // Open AI categorization dialog for a single paper
  function openAiCategorizeDialog(paperId: string, paperTitle: string) {
    setAiCategorizeDialog({
      open: true,
      mode: 'single',
      paperId,
      paperTitle,
      suggestions: [{
        paperId,
        paperTitle,
        categoryIds: [],
        categoryNames: [],
        status: 'pending',
      }],
      loading: false,
      apiKey: '',
    });
  }

  // Open AI categorization dialog for bulk papers
  function openBulkAiCategorizeDialog() {
    const selectedPapers = papers.slice(0, 20); // Max 20 papers at a time
    setAiCategorizeDialog({
      open: true,
      mode: 'bulk',
      paperIds: selectedPapers.map(p => p.id),
      suggestions: selectedPapers.map(p => ({
        paperId: p.id,
        paperTitle: p.title,
        categoryIds: [],
        categoryNames: [],
        status: 'pending',
      })),
      loading: false,
      apiKey: '',
    });
  }

  // Get AI suggestions for categories
  async function handleGetAiSuggestions() {
    if (!aiCategorizeDialog.apiKey.trim()) {
      toast.error("Please enter your OpenAI API key");
      return;
    }

    setAiCategorizeDialog(prev => ({ ...prev, loading: true }));

    try {
      if (aiCategorizeDialog.mode === 'single' && aiCategorizeDialog.paperId) {
        // Single paper suggestion
        setAiCategorizeDialog(prev => ({
          ...prev,
          suggestions: prev.suggestions.map(s =>
            s.paperId === aiCategorizeDialog.paperId ? { ...s, status: 'loading' as const } : s
          ),
        }));

        const result = await api.getAICategorySuggestions(
          aiCategorizeDialog.paperId,
          aiCategorizeDialog.apiKey
        );

        setAiCategorizeDialog(prev => ({
          ...prev,
          loading: false,
          suggestions: prev.suggestions.map(s =>
            s.paperId === aiCategorizeDialog.paperId
              ? {
                  ...s,
                  categoryIds: result.suggestions.map(cat => cat.id),
                  categoryNames: result.suggestions.map(cat => cat.name),
                  reasoning: result.reasoning,
                  status: 'success' as const,
                }
              : s
          ),
        }));
      } else if (aiCategorizeDialog.mode === 'bulk' && aiCategorizeDialog.paperIds) {
        // Bulk paper suggestions
        const result = await api.getBulkAICategorySuggestions(
          aiCategorizeDialog.paperIds,
          aiCategorizeDialog.apiKey
        );

        setAiCategorizeDialog(prev => ({
          ...prev,
          loading: false,
          suggestions: prev.suggestions.map(s => {
            const paperResult = result.results.find(r => r.paperId === s.paperId);
            if (paperResult) {
              const isError = paperResult.status !== 'success';
              return {
                ...s,
                categoryIds: paperResult.suggestions.map(cat => cat.id),
                categoryNames: paperResult.suggestions.map(cat => cat.name),
                reasoning: paperResult.reasoning,
                status: isError ? 'error' as const : 'success' as const,
                error: isError ? `Status: ${paperResult.status}` : undefined,
              };
            }
            return s;
          }),
        }));
      }
    } catch (error) {
      toast.error("Failed to get AI suggestions");
      setAiCategorizeDialog(prev => ({
        ...prev,
        loading: false,
        suggestions: prev.suggestions.map(s => ({ ...s, status: 'error' as const, error: 'Failed to get suggestions' })),
      }));
    }
  }

  // Apply AI suggested categories
  async function handleApplyAiCategories() {
    const successfulSuggestions = aiCategorizeDialog.suggestions.filter(
      s => s.status === 'success' && s.categoryIds.length > 0
    );

    if (successfulSuggestions.length === 0) {
      toast.error("No valid suggestions to apply");
      return;
    }

    setAiCategorizeDialog(prev => ({ ...prev, loading: true }));

    try {
      if (aiCategorizeDialog.mode === 'single' && successfulSuggestions.length === 1) {
        const suggestion = successfulSuggestions[0];
        await api.applyAICategories(suggestion.paperId, suggestion.categoryIds);
        toast.success("Categories applied successfully");
      } else {
        const assignments = successfulSuggestions.map(s => ({
          paperId: s.paperId,
          categoryIds: s.categoryIds,
        }));
        await api.applyBulkAICategories(assignments);
        toast.success(`Categories applied to ${assignments.length} papers`);
      }

      setAiCategorizeDialog({
        open: false,
        mode: 'single',
        suggestions: [],
        loading: false,
        apiKey: '',
      });
      loadPapers(papersSearch);
      loadCategories();
    } catch (error) {
      toast.error("Failed to apply categories");
      setAiCategorizeDialog(prev => ({ ...prev, loading: false }));
    }
  }

  // Toggle a category in AI suggestions
  function toggleAiSuggestionCategory(paperId: string, categoryId: string, categoryName: string) {
    setAiCategorizeDialog(prev => ({
      ...prev,
      suggestions: prev.suggestions.map(s => {
        if (s.paperId !== paperId) return s;
        const hasCategory = s.categoryIds.includes(categoryId);
        if (hasCategory) {
          return {
            ...s,
            categoryIds: s.categoryIds.filter(id => id !== categoryId),
            categoryNames: s.categoryNames.filter(name => name !== categoryName),
          };
        } else {
          return {
            ...s,
            categoryIds: [...s.categoryIds, categoryId],
            categoryNames: [...s.categoryNames, categoryName],
          };
        }
      }),
    }));
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
        case "category":
          await api.deleteCategory(id);
          loadCategories();
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
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="users" onClick={() => !users.length && loadUsers()}>
              <Users className="w-4 h-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="papers" onClick={() => !papers.length && loadPapers()}>
              <FileText className="w-4 h-4 mr-2" />
              Papers
            </TabsTrigger>
            <TabsTrigger value="categories" onClick={() => !categories.length && loadCategories()}>
              <FolderTree className="w-4 h-4 mr-2" />
              Categories
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
            <TabsTrigger value="curation" onClick={() => !curationJobs.length && loadCuration()}>
              <Lightbulb className="w-4 h-4 mr-2" />
              AI Curation
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
                    <Button
                      variant="default"
                      size="sm"
                      onClick={openBulkAiCategorizeDialog}
                      disabled={papers.length === 0}
                      className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      AI Auto-Categorize
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
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openPaperCategoryDialog(p.id, p.title)}
                            title="Manage categories"
                          >
                            <Tags className="w-4 h-4 text-indigo-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openAiCategorizeDialog(p.id, p.title)}
                            title="AI auto-categorize"
                          >
                            <Wand2 className="w-4 h-4 text-purple-500" />
                          </Button>
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

          {/* Categories Tab */}
          <TabsContent value="categories">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FolderTree className="w-5 h-5" />
                    Categories ({flatCategories.length})
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => openCreateCategoryDialog()}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Category
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={loadCategories}
                      disabled={loadingCategories}
                    >
                      <RefreshCw className={`w-4 h-4 ${loadingCategories ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {loadingCategories ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12" />)}
                  </div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8">
                    <FolderTree className="w-12 h-12 mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-500 mb-4">No categories yet</p>
                    <Button onClick={() => openCreateCategoryDialog()}>
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Category
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {/* Render category tree recursively */}
                    {categories.map((cat) => (
                      <CategoryTreeItem
                        key={cat.id}
                        category={cat}
                        depth={0}
                        expandedCategories={expandedCategories}
                        onToggleExpand={toggleCategoryExpand}
                        onEdit={openEditCategoryDialog}
                        onDelete={handleDeleteCategory}
                        onAddChild={openCreateCategoryDialog}
                      />
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

          {/* Curation Tab */}
          <TabsContent value="curation">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Curation Jobs */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="w-5 h-5" />
                      AI Curation Jobs
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={triggerCuration}
                        disabled={triggeringCuration}
                      >
                        {triggeringCuration ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4 mr-2" />
                        )}
                        Run Curation
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadCuration}
                        disabled={loadingCuration}
                      >
                        <RefreshCw className={`w-4 h-4 ${loadingCuration ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {loadingCuration ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
                    </div>
                  ) : curationJobs.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No curation jobs yet. Click "Run Curation" to analyze research ideas.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {curationJobs.map((job) => (
                        <div
                          key={job.id}
                          className="p-3 border rounded-lg flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${
                              job.status === 'completed' ? 'bg-green-500' :
                              job.status === 'running' ? 'bg-yellow-500 animate-pulse' :
                              job.status === 'failed' ? 'bg-red-500' : 'bg-gray-500'
                            }`} />
                            <div>
                              <p className="font-medium text-sm">
                                Curation Job
                                <Badge variant="outline" className="ml-2 text-xs">
                                  {job.status}
                                </Badge>
                              </p>
                              <p className="text-xs text-muted-foreground">
                                Scope: {job.scope || 'all'} • {job.ideasAnalyzed} ideas analyzed •{' '}
                                {job.suggestionsMade} suggestions
                              </p>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(job.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Promotion Suggestions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    Promotion Suggestions
                    <Badge variant="secondary">{promotionSuggestions.length}</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingCuration ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}
                    </div>
                  ) : promotionSuggestions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No promotion suggestions available. Run a curation job to analyze ideas.
                    </p>
                  ) : (
                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                      {promotionSuggestions.map((suggestion) => (
                        <div
                          key={suggestion.ideaId}
                          className="p-3 border rounded-lg space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="font-medium text-sm">{suggestion.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {suggestion.description}
                              </p>
                            </div>
                            <Badge
                              variant={suggestion.score >= 0.8 ? 'default' : 'secondary'}
                              className="shrink-0"
                            >
                              {Math.round(suggestion.score * 100)}%
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-muted-foreground">
                              From: {suggestion.paperTitle}
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handlePromoteSuggestion(suggestion)}
                            >
                              <Trophy className="w-3 h-3 mr-1" />
                              Promote
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground italic">
                            {suggestion.reasoning}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
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

      {/* Category Create/Edit Dialog */}
      <Dialog open={categoryDialog.open} onOpenChange={(open) => !open && setCategoryDialog({ ...categoryDialog, open: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {categoryDialog.mode === 'create' ? 'Create Category' : 'Edit Category'}
            </DialogTitle>
            <DialogDescription>
              {categoryDialog.mode === 'create'
                ? 'Add a new category to organize papers.'
                : 'Update the category details.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">Name *</Label>
              <Input
                id="categoryName"
                value={categoryForm.name}
                onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                placeholder="e.g., Computer Science"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categorySlug">Slug</Label>
              <Input
                id="categorySlug"
                value={categoryForm.slug}
                onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                placeholder="e.g., computer-science (auto-generated if empty)"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryDescription">Description</Label>
              <Textarea
                id="categoryDescription"
                value={categoryForm.description}
                onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                placeholder="Optional description..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryParent">Parent Category</Label>
              <Select
                value={categoryForm.parentId || '_none'}
                onValueChange={(val) => setCategoryForm({ ...categoryForm, parentId: val === '_none' ? '' : val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">None (Top-level)</SelectItem>
                  {flatCategories
                    .filter((c) => c.id !== categoryDialog.category?.id)
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {'  '.repeat(c.depth)}{c.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="categoryIcon">Icon (emoji)</Label>
                <Input
                  id="categoryIcon"
                  value={categoryForm.icon}
                  onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                  placeholder="e.g., 💻"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="categoryColor">Color</Label>
                <Input
                  id="categoryColor"
                  value={categoryForm.color}
                  onChange={(e) => setCategoryForm({ ...categoryForm, color: e.target.value })}
                  placeholder="e.g., #3b82f6"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCategoryDialog({ ...categoryDialog, open: false })}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveCategory} disabled={!categoryForm.name.trim()}>
              {categoryDialog.mode === 'create' ? 'Create' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Paper Category Assignment Dialog */}
      <Dialog
        open={paperCategoryDialog.open}
        onOpenChange={(open) => !open && setPaperCategoryDialog({ ...paperCategoryDialog, open: false })}
      >
        <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="w-5 h-5 text-indigo-500" />
              Assign Categories
            </DialogTitle>
            <DialogDescription className="truncate">
              {paperCategoryDialog.paperTitle}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto py-4">
            {paperCategoryDialog.loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-8" />)}
              </div>
            ) : flatCategories.length === 0 ? (
              <p className="text-center text-slate-500 py-8">No categories available</p>
            ) : (
              <div className="space-y-1">
                {flatCategories.map((cat) => {
                  const isSelected = paperCategoryDialog.selectedCategories.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => togglePaperCategory(cat.id)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                        isSelected
                          ? 'bg-indigo-100 dark:bg-indigo-900/30 border border-indigo-500'
                          : 'hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent'
                      }`}
                      style={{ paddingLeft: `${cat.depth * 16 + 12}px` }}
                    >
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-indigo-500 border-indigo-500'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={getCategoryColorClass(cat.color)}>
                        <CategoryIcon iconName={cat.icon} className="w-4 h-4" />
                      </span>
                      <span className={`flex-1 truncate ${isSelected ? 'font-medium' : ''}`}>
                        {cat.name}
                      </span>
                      {cat.paperCount !== undefined && cat.paperCount > 0 && (
                        <span className="text-xs text-slate-400">{cat.paperCount}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <DialogFooter className="border-t pt-4">
            <div className="flex-1 text-sm text-slate-500">
              {paperCategoryDialog.selectedCategories.length} selected
            </div>
            <Button
              variant="outline"
              onClick={() => setPaperCategoryDialog({ ...paperCategoryDialog, open: false })}
            >
              Cancel
            </Button>
            <Button
              onClick={savePaperCategories}
              disabled={paperCategoryDialog.loading}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AI Auto-Categorization Dialog */}
      <Dialog
        open={aiCategorizeDialog.open}
        onOpenChange={(open) => !open && setAiCategorizeDialog({ ...aiCategorizeDialog, open: false })}
      >
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              AI Auto-Categorization
            </DialogTitle>
            <DialogDescription>
              {aiCategorizeDialog.mode === 'single'
                ? `Use AI to suggest categories for "${aiCategorizeDialog.paperTitle}"`
                : `Use AI to suggest categories for ${aiCategorizeDialog.suggestions.length} papers`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {/* API Key Input */}
            <div className="space-y-2">
              <Label htmlFor="aiApiKey" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                OpenAI API Key
              </Label>
              <Input
                id="aiApiKey"
                type="password"
                value={aiCategorizeDialog.apiKey}
                onChange={(e) => setAiCategorizeDialog(prev => ({ ...prev, apiKey: e.target.value }))}
                placeholder="sk-..."
                disabled={aiCategorizeDialog.loading}
              />
              <p className="text-xs text-slate-500">
                Your API key is used only for this request and is not stored.
              </p>
            </div>

            {/* Get Suggestions Button */}
            {aiCategorizeDialog.suggestions.every(s => s.status === 'pending') && (
              <Button
                onClick={handleGetAiSuggestions}
                disabled={aiCategorizeDialog.loading || !aiCategorizeDialog.apiKey.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                {aiCategorizeDialog.loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Getting AI Suggestions...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4 mr-2" />
                    Get AI Suggestions
                  </>
                )}
              </Button>
            )}

            {/* Suggestions List */}
            <div className="space-y-4">
              {aiCategorizeDialog.suggestions.map((suggestion) => (
                <div
                  key={suggestion.paperId}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate" title={suggestion.paperTitle}>
                        {suggestion.paperTitle}
                      </h4>
                    </div>
                    <div className="shrink-0">
                      {suggestion.status === 'loading' && (
                        <Badge variant="secondary" className="animate-pulse">
                          <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                          Analyzing...
                        </Badge>
                      )}
                      {suggestion.status === 'success' && (
                        <Badge className="bg-green-500">
                          <Check className="w-3 h-3 mr-1" />
                          Done
                        </Badge>
                      )}
                      {suggestion.status === 'error' && (
                        <Badge variant="destructive">
                          <AlertCircle className="w-3 h-3 mr-1" />
                          Error
                        </Badge>
                      )}
                    </div>
                  </div>

                  {suggestion.status === 'success' && (
                    <>
                      {/* Reasoning */}
                      {suggestion.reasoning && (
                        <div className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800 p-2 rounded">
                          <strong>AI Reasoning:</strong> {suggestion.reasoning}
                        </div>
                      )}

                      {/* Suggested Categories */}
                      <div className="space-y-2">
                        <Label className="text-xs">Suggested Categories (click to toggle):</Label>
                        <div className="flex flex-wrap gap-2">
                          {flatCategories.map((cat) => {
                            const isSelected = suggestion.categoryIds.includes(cat.id);
                            return (
                              <button
                                key={cat.id}
                                onClick={() => toggleAiSuggestionCategory(suggestion.paperId, cat.id, cat.name)}
                                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-colors ${
                                  isSelected
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-500'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 border border-transparent hover:bg-slate-200 dark:hover:bg-slate-600'
                                }`}
                              >
                                <CategoryIcon iconName={cat.icon} className="w-3 h-3" />
                                {cat.name}
                                {isSelected && <Check className="w-3 h-3 ml-1" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {suggestion.status === 'error' && suggestion.error && (
                    <p className="text-sm text-red-500">{suggestion.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="border-t pt-4">
            <div className="flex-1 text-sm text-slate-500">
              {aiCategorizeDialog.suggestions.filter(s => s.status === 'success').length} of{' '}
              {aiCategorizeDialog.suggestions.length} ready
            </div>
            <Button
              variant="outline"
              onClick={() => setAiCategorizeDialog({
                open: false,
                mode: 'single',
                suggestions: [],
                loading: false,
                apiKey: '',
              })}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApplyAiCategories}
              disabled={
                aiCategorizeDialog.loading ||
                aiCategorizeDialog.suggestions.filter(s => s.status === 'success' && s.categoryIds.length > 0).length === 0
              }
              className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
            >
              <Check className="w-4 h-4 mr-2" />
              Apply Categories
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
