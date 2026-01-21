import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  Star,
  Eye,
  FileText,
  ChevronDown,
  Info,
  Bot,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { AddPaperDialog } from "@/components/AddPaperDialog";
import { Link, useLocation, useSearch } from "wouter";
import * as api from "../lib/api";
import type { PaperWithStats } from "../../../shared/types";

type SortOption = "recent" | "popular";

// Google-style search result item
function SearchResultItem({ paper }: { paper: PaperWithStats }) {
  // Handle authors - could be JSON array or plain string
  let authorText = "Unknown authors";
  if (paper.authors) {
    try {
      const authors = JSON.parse(paper.authors);
      if (Array.isArray(authors) && authors.length > 0) {
        authorText = authors.slice(0, 3).join(", ") + (authors.length > 3 ? " et al." : "");
      }
    } catch {
      // If JSON parse fails, use as plain string
      authorText = paper.authors;
    }
  }

  return (
    <Link href={`/paper/${paper.id}`}>
      <div className="group py-4 cursor-pointer">
        {/* URL breadcrumb style */}
        <div className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 mb-1">
          <FileText className="w-4 h-4" />
          <span>paper-danmaku.com</span>
          <span>›</span>
          <span>paper</span>
          <span>›</span>
          <span className="truncate max-w-[200px]">{paper.arxivId || paper.id.slice(0, 8)}</span>
        </div>

        {/* Title */}
        <h3 className="text-xl text-indigo-700 dark:text-indigo-400 group-hover:underline font-medium mb-1 line-clamp-1">
          {paper.title}
        </h3>

        {/* Meta info */}
        <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-400 mb-2">
          <span>{authorText}</span>
          {paper.arxivId && (
            <Badge variant="outline" className="text-xs">
              arXiv:{paper.arxivId}
            </Badge>
          )}
        </div>

        {/* Tags */}
        {paper.tags && paper.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {paper.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Abstract snippet */}
        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
          {paper.abstract || "No abstract available."}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <Eye className="w-3 h-3" />
            {paper.viewCount} views
          </span>
          <span className="flex items-center gap-1">
            <Star className="w-3 h-3" />
            {paper.avgRating ? paper.avgRating.toFixed(1) : "—"}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            {paper.annotationCount} annotations
          </span>
          {/* AI Review Stats - only show if there are AI reviews */}
          {paper.aiReviewCount && paper.aiReviewCount > 0 && (
            <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
              paper.aiReviewAvgScore && paper.aiReviewAvgScore >= 3
                ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : paper.aiReviewAvgScore && paper.aiReviewAvgScore >= 2.5
                ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'
            }`}>
              <Bot className="w-3 h-3" />
              {paper.aiReviewAvgScore?.toFixed(1)}/4
              <span className="text-slate-400 dark:text-slate-500">
                ({paper.aiReviewCount} {paper.aiReviewCount === 1 ? 'review' : 'reviews'})
              </span>
            </span>
          )}
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

  const [searchQuery, setSearchQuery] = useState(urlQuery);
  const [papers, setPapers] = useState<PaperWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortOption>("popular");

  const fetchPapers = async (query?: string, sort?: SortOption) => {
    setIsLoading(true);
    try {
      const result = await api.listPapers({
        q: query || undefined,
        sort: sort || sortBy,
        limit: 20,
      });
      setPapers(result.papers);
    } catch (error) {
      console.error("Failed to fetch papers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setSearchQuery(urlQuery);
    fetchPapers(urlQuery, sortBy);
  }, [urlQuery]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setLocation(`/browse?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      setLocation("/browse");
    }
  };

  const handleSortChange = (sort: SortOption) => {
    setSortBy(sort);
    fetchPapers(searchQuery, sort);
  };

  const handlePaperAdded = (paper: PaperWithStats) => {
    setPapers((prev) => [paper, ...prev]);
  };

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/60 dark:bg-slate-900/80 backdrop-blur-md border-b border-indigo-200/50 dark:border-slate-800">
        <div className="container flex items-center gap-6 h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
          </Link>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Search papers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 h-10 rounded-full border-slate-300 dark:border-slate-700 shadow-sm"
              />
            </div>
          </form>

          {/* Right side */}
          <div className="flex items-center gap-3 flex-shrink-0">
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
        <div className="max-w-3xl">
          {/* Results header */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div className="text-sm text-slate-500">
              {isLoading ? (
                "Searching..."
              ) : (
                <>
                  About {papers.length} results
                  {searchQuery && <span> for "{searchQuery}"</span>}
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-slate-600 gap-1">
                    Sort: {sortBy === "popular" ? "Popular" : "Recent"}
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onClick={() => handleSortChange("popular")}>
                    Popular
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSortChange("recent")}>
                    Recent
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <AddPaperDialog onPaperAdded={handlePaperAdded} />
            </div>
          </div>

          {/* Results list */}
          {isLoading ? (
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
          ) : papers.length === 0 ? (
            <div className="text-center py-16">
              <Search className="w-12 h-12 mx-auto text-slate-300 mb-4" />
              <p className="text-slate-600 dark:text-slate-400 mb-2">
                {searchQuery
                  ? `No papers found for "${searchQuery}"`
                  : "No papers yet"}
              </p>
              <p className="text-sm text-slate-500 mb-6">
                {searchQuery
                  ? "Try different keywords or add a new paper"
                  : "Be the first to add a paper!"}
              </p>
              <AddPaperDialog onPaperAdded={handlePaperAdded} />
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {papers.map((paper) => (
                <SearchResultItem key={paper.id} paper={paper} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
