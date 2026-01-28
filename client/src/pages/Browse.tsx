import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  MessageSquare,
  User,
  LogOut,
  Eye,
  FileText,
  ChevronDown,
  ChevronRight,
  Info,
  Bot,
  Swords,
  Lightbulb,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  Users,
  Clock,
  Trophy,
  Sparkles,
  Plus,
  Upload,
  FolderTree,
  X,
  Library,
  Lock,
  Globe,
  BookOpen,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { AddPaperDialog } from "@/components/AddPaperDialog";
import { Link, useLocation, useSearch } from "wouter";
import * as api from "../lib/api";
import type { PaperWithStats, CategoryWithChildren, Category } from "../../../shared/types";
import { CategoryIcon, getCategoryColorClass } from "@/lib/category-icons";
import type {
  UnifiedSearchResponse,
  UnifiedPaperResult,
  UnifiedDebateResult,
  UnifiedChallengeResult,
  UnifiedPaperGroupResult,
  UnifiedInsightResult,
} from "../lib/api";
import { ScrollArea } from "@/components/ui/scroll-area";

type SortOption = "recent" | "popular" | "discussed";
type ResultTab = "all" | "papers" | "debates" | "challenges" | "groups" | "insights";

// Category tree item component for sidebar
function CategoryTreeItem({
  category,
  depth,
  expandedCategories,
  selectedCategory,
  onToggleExpand,
  onSelect,
}: {
  category: CategoryWithChildren;
  depth: number;
  expandedCategories: Set<string>;
  selectedCategory: Category | null;
  onToggleExpand: (id: string) => void;
  onSelect: (cat: Category) => void;
}) {
  const hasChildren = category.children && category.children.length > 0;
  const isExpanded = expandedCategories.has(category.id);
  const isSelected = selectedCategory?.id === category.id;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
          isSelected
            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
        }`}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onSelect(category)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(category.id);
            }}
            className="p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded shrink-0"
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}
        {category.icon && (
          <span className={`shrink-0 ${getCategoryColorClass(category.color)}`}>
            <CategoryIcon iconName={category.icon} className="w-4 h-4" />
          </span>
        )}
        <span className="text-sm truncate flex-1">{category.name}</span>
        {category.paperCount !== undefined && category.paperCount > 0 && (
          <span className="text-xs text-slate-400 shrink-0">{category.paperCount}</span>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {category.children.map((child) => (
            <CategoryTreeItem
              key={child.id}
              category={child}
              depth={depth + 1}
              expandedCategories={expandedCategories}
              selectedCategory={selectedCategory}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Paper result item
function PaperResultItem({ paper }: { paper: UnifiedPaperResult | PaperWithStats }) {
  const authors = Array.isArray(paper.authors) ? paper.authors : [];
  const authorText = authors.length > 0
    ? authors.slice(0, 3).join(", ") + (authors.length > 3 ? " et al." : "")
    : "Unknown authors";

  // Check if paper has an avatar
  const avatarUrl = 'activeAvatarUrl' in paper ? paper.activeAvatarUrl : undefined;

  return (
    <Link href={`/paper/${paper.id}`}>
      <div className="group py-4 cursor-pointer flex gap-4">
        {/* Paper Avatar Thumbnail */}
        {avatarUrl && (
          <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
            <img
              src={avatarUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Paper Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mb-1">
            <FileText className="w-4 h-4" />
            <span>paper</span>
            <span>›</span>
            <span className="truncate max-w-[200px]">
              {'arxivId' in paper && paper.arxivId ? paper.arxivId : paper.id.slice(0, 8)}
            </span>
          </div>
          <h3 className="text-xl text-indigo-700 dark:text-indigo-400 group-hover:underline font-medium mb-1 line-clamp-1">
            {paper.title}
          </h3>
          <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 mb-2">
            <span>{authorText}</span>
            {'arxivId' in paper && paper.arxivId && (
              <Badge variant="outline" className="text-xs">arXiv:{paper.arxivId}</Badge>
            )}
          </div>
          {/* Categories */}
          {'categories' in paper && paper.categories && paper.categories.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {paper.categories.slice(0, 4).map((cat) => (
                <span
                  key={cat.id}
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800`}
                >
                  {cat.icon && (
                    <span className={getCategoryColorClass(cat.color)}>
                      <CategoryIcon iconName={cat.icon} className="w-3 h-3" />
                    </span>
                  )}
                  {cat.name}
                </span>
              ))}
              {paper.categories.length > 4 && (
                <span className="text-xs text-slate-400">+{paper.categories.length - 4}</span>
              )}
            </div>
          )}
          {'tags' in paper && paper.tags && paper.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {paper.tags.slice(0, 5).map((tag, index) => (
                <span key={index} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                  {tag}
                </span>
              ))}
            </div>
          )}
          {'abstract' in paper && paper.abstract && (
            <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">{paper.abstract}</p>
          )}
          <div className="flex items-center gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {paper.viewCount} views
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {'annotationCount' in paper ? paper.annotationCount : 0} annotations
            </span>
            {'aiReviewCount' in paper && paper.aiReviewCount > 0 && (
              <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
                paper.aiReviewAvgScore && paper.aiReviewAvgScore >= 3
                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                  : 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
              }`}>
                <Bot className="w-3 h-3" />
                {paper.aiReviewAvgScore?.toFixed(1)}/4
              </span>
            )}
            {/* Uploader info */}
            {'uploaderName' in paper && paper.uploaderName && 'addedBy' in paper && paper.addedBy && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.location.href = `/profile/${paper.addedBy}`;
                }}
                className="flex items-center gap-1.5 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >
                <Upload className="w-3 h-3" />
                <span>by</span>
                <Avatar className="w-4 h-4">
                  <AvatarImage src={paper.uploaderAvatar} alt={paper.uploaderName} />
                  <AvatarFallback className="text-[8px]">{paper.uploaderName.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="font-medium">{paper.uploaderName}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

// Debate result item
function DebateResultItem({ debate }: { debate: UnifiedDebateResult }) {
  const statusColors = {
    setup: 'bg-slate-100 text-slate-700',
    active: 'bg-green-100 text-green-700',
    paused: 'bg-amber-100 text-amber-700',
    concluded: 'bg-indigo-100 text-indigo-700',
  };

  return (
    <Link href={`/debates/${debate.id}`}>
      <div className="group py-4 cursor-pointer">
        <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mb-1">
          <Swords className="w-4 h-4" />
          <span>debate</span>
          <span>›</span>
          <Badge className={`text-xs ${statusColors[debate.status]}`}>
            {debate.status}
          </Badge>
        </div>
        <h3 className="text-xl text-indigo-700 dark:text-indigo-400 group-hover:underline font-medium mb-1 line-clamp-1">
          {debate.title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
          {debate.topic}
        </p>
        {debate.conclusion && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-1 italic">
            "{debate.conclusion}"
          </p>
        )}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {debate.userName}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {debate.turnCount}/{debate.maxTurns} turns
          </span>
          {debate.winner && (
            <span className="flex items-center gap-1">
              <Trophy className="w-3 h-3 text-amber-500" />
              {debate.winner === 'draw' ? 'Draw' : debate.winner}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(debate.updatedAt * 1000).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  );
}

// Challenge problem result item
function ChallengeResultItem({ challenge }: { challenge: UnifiedChallengeResult }) {
  const statusColors = {
    unsolved: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    investigating: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    solved: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };

  const TypeIcon = challenge.problemType === 'open_question' ? HelpCircle : Lightbulb;

  return (
    <Link href={`/challenge/${challenge.id}`}>
      <div className="group py-4 cursor-pointer">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
          <TypeIcon className="w-4 h-4" />
          <span>{challenge.problemType === 'open_question' ? 'question' : 'idea'}</span>
          <span>›</span>
          <Badge className={`text-xs ${statusColors[challenge.status]}`}>
            {challenge.status}
          </Badge>
          {challenge.importance && (
            <Badge variant="outline" className="text-xs">
              {challenge.importance} priority
            </Badge>
          )}
        </div>
        <h3 className="text-xl text-indigo-700 dark:text-indigo-400 group-hover:underline font-medium mb-1 line-clamp-1">
          {challenge.title}
        </h3>
        {challenge.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
            {challenge.description}
          </p>
        )}
        {challenge.paperTitle && (
          <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
            <FileText className="w-3 h-3" />
            <span className="truncate max-w-[300px]">From: {challenge.paperTitle}</span>
          </div>
        )}
        {challenge.tags && challenge.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {challenge.tags.slice(0, 5).map((tag, index) => (
              <span key={index} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                {tag}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {challenge.userName}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsUp className="w-3 h-3" />
            {challenge.upvotes}
          </span>
          <span className="flex items-center gap-1">
            <ThumbsDown className="w-3 h-3" />
            {challenge.downvotes}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {challenge.commentCount} comments
          </span>
          {challenge.childCount > 0 && (
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {challenge.childCount} sub-problems
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

// Paper group result item
function PaperGroupResultItem({ group }: { group: UnifiedPaperGroupResult }) {
  return (
    <Link href={`/paper-groups/${group.id}`}>
      <div className="group py-4 cursor-pointer">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
          <Library className="w-4 h-4" />
          <span>paper group</span>
          <span>›</span>
          {group.visibility === 'public' ? (
            <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
              <Globe className="w-3 h-3" />
              public
            </span>
          ) : (
            <span className="flex items-center gap-1 text-slate-500">
              <Lock className="w-3 h-3" />
              private
            </span>
          )}
        </div>
        <h3 className="text-xl text-indigo-700 dark:text-indigo-400 group-hover:underline font-medium mb-1 line-clamp-1">
          {group.name}
        </h3>
        {group.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
            {group.description}
          </p>
        )}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {group.userName}
          </span>
          <span className="flex items-center gap-1">
            <FileText className="w-3 h-3" />
            {group.paperCount} papers
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(group.createdAt * 1000).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  );
}

// Insight (open question / research idea) result item
function InsightResultItem({ insight }: { insight: UnifiedInsightResult }) {
  const TypeIcon = insight.type === 'open_question' ? HelpCircle : Lightbulb;
  const typeLabel = insight.type === 'open_question' ? 'open question' : 'research idea';
  const importanceColors = {
    high: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    low: 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
  };

  return (
    <Link href={insight.paperId ? `/paper/${insight.paperId}?insights=true` : '#'}>
      <div className="group py-4 cursor-pointer">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-1">
          <TypeIcon className="w-4 h-4 text-purple-500" />
          <span>{typeLabel}</span>
          <span>›</span>
          <Badge variant="secondary" className="text-xs">
            AI-generated
          </Badge>
          {insight.importance && (
            <Badge className={`text-xs ${importanceColors[insight.importance]}`}>
              {insight.importance}
            </Badge>
          )}
          {insight.novelty && (
            <Badge variant="outline" className="text-xs">
              {insight.novelty}
            </Badge>
          )}
        </div>
        <h3 className="text-xl text-purple-700 dark:text-purple-400 group-hover:underline font-medium mb-1 line-clamp-2">
          {insight.title}
        </h3>
        {insight.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2 line-clamp-2">
            {insight.description}
          </p>
        )}
        {insight.paperTitle && (
          <div className="flex items-center gap-1 text-xs text-slate-500 mb-2">
            <FileText className="w-3 h-3" />
            <span className="truncate max-w-[300px]">From paper: {insight.paperTitle}</span>
          </div>
        )}
        {insight.relatedTopics && insight.relatedTopics.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {insight.relatedTopics.slice(0, 5).map((topic, index) => (
              <span key={index} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-700/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-600">
                {topic}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {insight.userName}
          </span>
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            via {insight.modelUsed}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {new Date(insight.updatedAt * 1000).toLocaleDateString()}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Browse() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const searchParams = useSearch();
  const urlQuery = new URLSearchParams(searchParams).get("q") || "";
  const urlTab = new URLSearchParams(searchParams).get("tab") as ResultTab || "all";

  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [activeTab, setActiveTab] = useState<ResultTab>(urlTab);
  const [papers, setPapers] = useState<PaperWithStats[]>([]);
  const [unifiedResults, setUnifiedResults] = useState<UnifiedSearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("popular");

  // Category state
  const [categories, setCategories] = useState<CategoryWithChildren[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryPapers, setCategoryPapers] = useState<PaperWithStats[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [loadingCategoryPapers, setLoadingCategoryPapers] = useState(false);

  // Fetch papers (default browse - no search query)
  const fetchPapers = async (sort?: SortOption) => {
    setIsLoading(true);
    try {
      const result = await api.listPapers({
        sort: sort || sortBy,
        limit: 20,
      });
      setPapers(result.papers);
      setUnifiedResults(null);
    } catch (error) {
      console.error("Failed to fetch papers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Unified search (when there's a search query)
  const fetchUnifiedSearch = async (query: string, sort?: SortOption) => {
    setIsLoading(true);
    try {
      const result = await api.unifiedSearch({
        q: query,
        sort: sort || sortBy,
        limit: 15,
      });
      setUnifiedResults(result);
      setPapers([]);
    } catch (error) {
      console.error("Failed to perform unified search:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSearchQuery(urlQuery);
    if (urlQuery) {
      fetchUnifiedSearch(urlQuery, sortBy);
    } else {
      fetchPapers(sortBy);
    }
  }, [urlQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    }
    if (activeTab !== "all") {
      params.set("tab", activeTab);
    }
    const queryString = params.toString();
    setLocation(`/browse${queryString ? `?${queryString}` : ""}`);
  };

  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    if (urlQuery) {
      fetchUnifiedSearch(urlQuery, sort);
    } else {
      fetchPapers(sort);
    }
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab as ResultTab);
    const params = new URLSearchParams();
    if (searchQuery.trim()) {
      params.set("q", searchQuery.trim());
    }
    if (tab !== "all") {
      params.set("tab", tab);
    }
    const queryString = params.toString();
    setLocation(`/browse${queryString ? `?${queryString}` : ""}`);
  };

  const handlePaperAdded = (paper: PaperWithStats) => {
    setPapers((prev) => [paper, ...prev]);
  };

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      setLoadingCategories(true);
      try {
        const result = await api.getCategoryTree();
        setCategories(result.categories);
        // Keep categories collapsed by default
        setExpandedCategories(new Set<string>());
      } catch (error) {
        console.error("Failed to load categories:", error);
      } finally {
        setLoadingCategories(false);
      }
    };
    loadCategories();
  }, []);

  // Toggle category expansion
  const toggleCategoryExpand = (id: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedCategories(newExpanded);
  };

  // Select a category and load its papers
  const handleSelectCategory = async (category: Category) => {
    if (selectedCategory?.id === category.id) {
      // Deselect if clicking the same category
      setSelectedCategory(null);
      setCategoryPapers([]);
      return;
    }

    setSelectedCategory(category);
    setLoadingCategoryPapers(true);
    try {
      const result = await api.getCategoryPapers(category.id, { includeSubcategories: true, limit: 50 });
      setCategoryPapers(result.papers);
    } catch (error) {
      console.error("Failed to load category papers:", error);
    } finally {
      setLoadingCategoryPapers(false);
    }
  };

  // Clear category selection
  const clearCategorySelection = () => {
    setSelectedCategory(null);
    setCategoryPapers([]);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  // Calculate totals for tabs
  const totals = unifiedResults
    ? {
        all: unifiedResults.papers.total + unifiedResults.debates.total + unifiedResults.challenges.total + unifiedResults.paperGroups.total + (unifiedResults.insights?.total || 0),
        papers: unifiedResults.papers.total,
        debates: unifiedResults.debates.total,
        challenges: unifiedResults.challenges.total,
        groups: unifiedResults.paperGroups.total,
        insights: unifiedResults.insights?.total || 0,
      }
    : { all: papers.length, papers: papers.length, debates: 0, challenges: 0, groups: 0, insights: 0 };

  // Get visible results based on active tab
  const getVisibleResults = () => {
    if (!unifiedResults) {
      return { papers: papers as (PaperWithStats | UnifiedPaperResult)[], debates: [], challenges: [], paperGroups: [], insights: [] };
    }

    if (activeTab === "papers") {
      return { papers: unifiedResults.papers.items, debates: [], challenges: [], paperGroups: [], insights: [] };
    }
    if (activeTab === "debates") {
      return { papers: [], debates: unifiedResults.debates.items, challenges: [], paperGroups: [], insights: [] };
    }
    if (activeTab === "challenges") {
      return { papers: [], debates: [], challenges: unifiedResults.challenges.items, paperGroups: [], insights: [] };
    }
    if (activeTab === "groups") {
      return { papers: [], debates: [], challenges: [], paperGroups: unifiedResults.paperGroups.items, insights: [] };
    }
    if (activeTab === "insights") {
      return { papers: [], debates: [], challenges: [], paperGroups: [], insights: unifiedResults.insights?.items || [] };
    }
    // "all" tab - show all results
    return {
      papers: unifiedResults.papers.items,
      debates: unifiedResults.debates.items,
      challenges: unifiedResults.challenges.items,
      paperGroups: unifiedResults.paperGroups.items,
      insights: unifiedResults.insights?.items || [],
    };
  };

  const visibleResults = getVisibleResults();
  const hasAnyResults = visibleResults.papers.length > 0 || visibleResults.debates.length > 0 || visibleResults.challenges.length > 0 || visibleResults.paperGroups.length > 0 || visibleResults.insights.length > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/60 dark:bg-slate-900/80 backdrop-blur-md border-b border-indigo-200/50 dark:border-slate-800">
        <div className="container flex items-center gap-6 h-16">
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
          </Link>
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search papers, debates, challenges, paper groups..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 h-10 rounded-full border-slate-300 dark:border-slate-700 shadow-sm"
              />
            </div>
          </form>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link href="/paper-groups" className="text-sm text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center gap-1">
              <FolderTree className="w-4 h-4" />
              Paper Groups
            </Link>
            <Link href="/feedback" className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              Feedback
            </Link>
            <Link href="/about" className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1">
              <Info className="w-4 h-4" />
              About
            </Link>
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
                    <Link href="/my-background-jobs">
                      <DropdownMenuItem>
                        <BookOpen className="h-4 w-4 mr-2" />
                        Background Reading
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

      {/* Main Content */}
      <main className="container py-6">
        <div className="flex gap-6">
          {/* Category Sidebar */}
          <aside className="w-64 shrink-0 hidden lg:block">
            <div className="sticky top-24 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="p-3 border-b border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <FolderTree className="w-4 h-4 text-indigo-500" />
                  <h2 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Categories</h2>
                </div>
              </div>
              <ScrollArea className="h-[calc(100vh-200px)]">
                <div className="p-2">
                  {loadingCategories ? (
                    <div className="space-y-2 p-2">
                      {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-6 w-full" />
                      ))}
                    </div>
                  ) : categories.length === 0 ? (
                    <p className="text-sm text-slate-500 text-center py-4">No categories</p>
                  ) : (
                    <>
                      {/* Show "All Papers" option */}
                      <div
                        className={`flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer transition-colors ${
                          !selectedCategory
                            ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                        }`}
                        onClick={clearCategorySelection}
                      >
                        <FileText className="w-4 h-4" />
                        <span className="text-sm font-medium">All Papers</span>
                      </div>
                      <div className="border-t border-slate-200 dark:border-slate-700 my-2" />
                      {categories.map((cat) => (
                        <CategoryTreeItem
                          key={cat.id}
                          category={cat}
                          depth={0}
                          expandedCategories={expandedCategories}
                          selectedCategory={selectedCategory}
                          onToggleExpand={toggleCategoryExpand}
                          onSelect={handleSelectCategory}
                        />
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            </div>
          </aside>

          {/* Main Results */}
          <div className="flex-1 min-w-0 max-w-4xl">
          {/* Results header */}
          <div className="mb-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="text-sm text-slate-500">
                {isLoading || loadingCategoryPapers ? (
                  "Loading..."
                ) : selectedCategory ? (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1.5">
                      {selectedCategory.icon && (
                        <span className={getCategoryColorClass(selectedCategory.color)}>
                          <CategoryIcon iconName={selectedCategory.icon} className="w-4 h-4" />
                        </span>
                      )}
                      <span className="font-medium text-slate-700 dark:text-slate-300">{selectedCategory.name}</span>
                    </span>
                    <span>- {categoryPapers.length} papers</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={clearCategorySelection}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <>
                    About {totals.all} results
                    {searchQuery && <span> for "{searchQuery}"</span>}
                  </>
                )}
              </div>
              <div className="flex items-center gap-3">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-slate-600 gap-1">
                      Sort: {sortBy === "popular" ? "Popular" : sortBy === "discussed" ? "Discussed" : "Recent"}
                      <ChevronDown className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleSortChange("popular")}>Popular</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSortChange("recent")}>Recent</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleSortChange("discussed")}>Most Discussed</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <AddPaperDialog onPaperAdded={handlePaperAdded} />
              </div>
            </div>

            {/* Tabs - only show when searching */}
            {searchQuery && unifiedResults && (
              <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="all" className="gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    All ({totals.all})
                  </TabsTrigger>
                  <TabsTrigger value="papers" className="gap-1.5">
                    <FileText className="w-4 h-4" />
                    Papers ({totals.papers})
                  </TabsTrigger>
                  <TabsTrigger value="debates" className="gap-1.5">
                    <Swords className="w-4 h-4" />
                    Debates ({totals.debates})
                  </TabsTrigger>
                  <TabsTrigger value="challenges" className="gap-1.5">
                    <Lightbulb className="w-4 h-4" />
                    Challenges ({totals.challenges})
                  </TabsTrigger>
                  <TabsTrigger value="groups" className="gap-1.5">
                    <Library className="w-4 h-4" />
                    Groups ({totals.groups})
                  </TabsTrigger>
                  <TabsTrigger value="insights" className="gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    Insights ({totals.insights})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>

          {/* Results list */}
          {isLoading || loadingCategoryPapers ? (
            <div className="space-y-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2 py-4">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ))}
            </div>
          ) : selectedCategory ? (
            /* Show category papers */
            categoryPapers.length === 0 ? (
              <div className="text-center py-16">
                <FolderTree className="w-12 h-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-600 dark:text-slate-400 mb-2">
                  No papers in "{selectedCategory.name}" yet
                </p>
                <p className="text-sm text-slate-500 mb-6">
                  Papers can be added to categories by administrators
                </p>
                <Button variant="outline" onClick={clearCategorySelection}>
                  Browse All Papers
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {categoryPapers.map((paper) => (
                  <PaperResultItem key={paper.id} paper={paper} />
                ))}
              </div>
            )
          ) : !hasAnyResults ? (
            <div className="text-center py-16">
              <Search className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-600 dark:text-slate-400 mb-2">
                {searchQuery ? `No results found for "${searchQuery}"` : "No content yet"}
              </p>
              <p className="text-sm text-slate-500 mb-6">
                {searchQuery ? "Try different keywords" : "Be the first to contribute!"}
              </p>
              <AddPaperDialog onPaperAdded={handlePaperAdded} />
            </div>
          ) : (
            <div className="space-y-2">
              {/* Papers Section */}
              {visibleResults.papers.length > 0 && (
                <div>
                  {activeTab === "all" && unifiedResults && (
                    <div className="flex items-center gap-2 pt-4 pb-2">
                      <FileText className="w-4 h-4 text-indigo-500" />
                      <h2 className="font-semibold text-slate-700 dark:text-slate-300">Papers</h2>
                      <span className="text-xs text-slate-500">({totals.papers})</span>
                    </div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleResults.papers.map((paper) => (
                      <PaperResultItem key={paper.id} paper={paper} />
                    ))}
                  </div>
                </div>
              )}

              {/* Debates Section */}
              {visibleResults.debates.length > 0 && (
                <div>
                  {activeTab === "all" && (
                    <div className="flex items-center gap-2 pt-4 pb-2 border-t border-slate-200 dark:border-slate-800 mt-4">
                      <Swords className="w-4 h-4 text-purple-500" />
                      <h2 className="font-semibold text-slate-700 dark:text-slate-300">Debates</h2>
                      <span className="text-xs text-slate-500">({totals.debates})</span>
                    </div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleResults.debates.map((debate) => (
                      <DebateResultItem key={debate.id} debate={debate} />
                    ))}
                  </div>
                </div>
              )}

              {/* Challenges Section */}
              {visibleResults.challenges.length > 0 && (
                <div>
                  {activeTab === "all" && (
                    <div className="flex items-center gap-2 pt-4 pb-2 border-t border-slate-200 dark:border-slate-800 mt-4">
                      <Lightbulb className="w-4 h-4 text-amber-500" />
                      <h2 className="font-semibold text-slate-700 dark:text-slate-300">Research Challenges</h2>
                      <span className="text-xs text-slate-500">({totals.challenges})</span>
                    </div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleResults.challenges.map((challenge) => (
                      <ChallengeResultItem key={challenge.id} challenge={challenge} />
                    ))}
                  </div>
                </div>
              )}

              {/* Paper Groups Section */}
              {visibleResults.paperGroups.length > 0 && (
                <div>
                  {activeTab === "all" && (
                    <div className="flex items-center gap-2 pt-4 pb-2 border-t border-slate-200 dark:border-slate-800 mt-4">
                      <Library className="w-4 h-4 text-blue-500" />
                      <h2 className="font-semibold text-slate-700 dark:text-slate-300">Paper Groups</h2>
                      <span className="text-xs text-slate-500">({totals.groups})</span>
                    </div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleResults.paperGroups.map((group) => (
                      <PaperGroupResultItem key={group.id} group={group} />
                    ))}
                  </div>
                </div>
              )}

              {/* AI Insights Section (Open Questions & Research Ideas) */}
              {visibleResults.insights.length > 0 && (
                <div>
                  {activeTab === "all" && (
                    <div className="flex items-center gap-2 pt-4 pb-2 border-t border-slate-200 dark:border-slate-800 mt-4">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      <h2 className="font-semibold text-slate-700 dark:text-slate-300">AI Insights</h2>
                      <span className="text-xs text-slate-500">({totals.insights})</span>
                    </div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleResults.insights.map((insight) => (
                      <InsightResultItem key={insight.id} insight={insight} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </main>
    </div>
  );
}
