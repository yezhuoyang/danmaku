import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  MessageSquarePlus,
  Trash2,
  Eye,
  EyeOff,
  Users,
  Filter,
  ChevronDown,
  ChevronUp,
  Image,
  Table2,
  Type,
  Sigma,
  Palette,
  X,
  Bot,
  Quote,
  BookOpen,
  LogIn,
  User,
  UserPlus,
  UserMinus,
} from "lucide-react";
import { Link } from "wouter";
import { Annotation, ANNOTATION_COLORS, TYPE_COLORS } from "./AnnotationDanmaku";
import katex from "katex";
import * as api from "@/lib/api";
import { toast } from "sonner";

/**
 * UserLink component - displays username with popover for profile/follow actions
 */
interface UserLinkProps {
  userId?: string;
  userName: string;
  userAvatar?: string;
  currentUserId?: string;
  className?: string;
}

function UserLink({ userId, userName, userAvatar, currentUserId, className }: UserLinkProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Don't show popover if no userId
  if (!userId) {
    return (
      <span className={`${className} inline-flex items-center gap-1.5`}>
        <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center flex-shrink-0">
          <User className="w-2.5 h-2.5 text-slate-400" />
        </span>
        {userName}
      </span>
    );
  }

  const isOwnProfile = currentUserId === userId;

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUserId) {
      toast.error('Please log in to follow users');
      return;
    }

    setIsLoading(true);
    try {
      if (isFollowing) {
        await api.unfollowUser(userId);
        setIsFollowing(false);
        toast.success(`Unfollowed ${userName}`);
      } else {
        await api.followUser(userId);
        setIsFollowing(true);
        toast.success(`Following ${userName}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update follow status');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`${className} inline-flex items-center gap-1.5 hover:underline cursor-pointer`}
          onClick={(e) => e.stopPropagation()}
        >
          <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center overflow-hidden flex-shrink-0">
            {userAvatar ? (
              <img src={userAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-2.5 h-2.5 text-slate-400" />
            )}
          </span>
          {userName}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden">
            {userAvatar ? (
              <img src={userAvatar} alt="" className="w-full h-full object-cover" />
            ) : (
              <User className="w-5 h-5 text-slate-500" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{userName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/profile/${userId}`} className="flex-1">
            <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(false)}>
              <User className="w-3 h-3 mr-1" />
              Profile
            </Button>
          </Link>
          {!isOwnProfile && currentUserId && (
            <Button
              variant={isFollowing ? "outline" : "default"}
              size="sm"
              className="flex-1"
              onClick={handleFollow}
              disabled={isLoading}
            >
              {isFollowing ? (
                <>
                  <UserMinus className="w-3 h-3 mr-1" />
                  Unfollow
                </>
              ) : (
                <>
                  <UserPlus className="w-3 h-3 mr-1" />
                  Follow
                </>
              )}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface AnnotationPanelProps {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onDeleteAnnotation: (id: string) => void;
  onHideAnnotation?: (id: string) => void;
  onUnhideAnnotation?: (id: string) => void;
  hiddenAnnotationIds?: Set<string>;
  onAddAnnotation: (annotation: Omit<Annotation, "id" | "timestamp">) => void;
  currentPage: number;
  isCreatingMode: boolean;
  onToggleCreatingMode: () => void;
  pendingHighlight: {
    x: number;
    y: number;
    width: number;
    height: number;
    selectedText?: string;
    sentenceData?: {
      sentenceId: string;
      sentenceText: string;
      boundingRects: Array<{ x: number; y: number; width: number; height: number }>;
      section?: {
        number: string;
        title: string;
        fullTitle: string;
      };
    };
    figureTableData?: {
      figureTableId: string;
      type: 'figure' | 'table';
      label: string;
      caption: string;
      boundingRect: { x: number; y: number; width: number; height: number };
    };
  } | null;
  onClearPendingHighlight: () => void;
  showAIPanel?: boolean;
  onToggleAIPanel?: () => void;
  currentUserName?: string;
  currentUserId?: string;
  // Figure/Table region props (for uploaders)
  isUploader?: boolean;
  isFigureTableMode?: boolean;
  onToggleFigureTableMode?: () => void;
}

export function AnnotationPanel({
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onDeleteAnnotation,
  onHideAnnotation,
  onUnhideAnnotation,
  hiddenAnnotationIds,
  onAddAnnotation,
  currentPage,
  isCreatingMode,
  onToggleCreatingMode,
  pendingHighlight,
  onClearPendingHighlight,
  showAIPanel,
  onToggleAIPanel,
  currentUserName,
  currentUserId,
  isUploader = false,
  isFigureTableMode = false,
  onToggleFigureTableMode,
}: AnnotationPanelProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const [showAllUsers, setShowAllUsers] = useState(true);
  const [newAnnotationText, setNewAnnotationText] = useState("");
  const [newAnnotationLatex, setNewAnnotationLatex] = useState("");
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[4]);
  const [highlightType, setHighlightType] = useState<"text" | "figure" | "table" | "equation">("text");
  const [highlightLabel, setHighlightLabel] = useState("");
  const [isLatexMode, setIsLatexMode] = useState(false);
  const [isSentencePreviewExpanded, setIsSentencePreviewExpanded] = useState(false);
  const [isFigureTablePreviewExpanded, setIsFigureTablePreviewExpanded] = useState(false);
  const latexPreviewRef = useRef<HTMLDivElement>(null);

  // Preview character limits
  const SENTENCE_PREVIEW_CHAR_LIMIT = 100;
  const FIGURE_TABLE_PREVIEW_CHAR_LIMIT = 100;

  // Filter annotations for current page
  const pageAnnotations = annotations.filter((a) => a.pageNumber === currentPage);
  const filteredAnnotations =
    filterType === "all"
      ? pageAnnotations
      : pageAnnotations.filter((a) => a.highlightRegion.type === filterType);

  // Preview LaTeX
  useEffect(() => {
    if (isLatexMode && newAnnotationLatex && latexPreviewRef.current) {
      try {
        katex.render(newAnnotationLatex, latexPreviewRef.current, {
          throwOnError: false,
          displayMode: true,
        });
      } catch (e) {
        if (latexPreviewRef.current) {
          latexPreviewRef.current.textContent = "Invalid LaTeX";
        }
      }
    }
  }, [newAnnotationLatex, isLatexMode]);

  const handleCreateAnnotation = () => {
    if (!pendingHighlight) return;
    if (!newAnnotationText && !newAnnotationLatex) return;

    // Determine annotation position - for sentence annotations, position to the right of the last bounding rect
    let positionX = pendingHighlight.x + pendingHighlight.width + 50;
    let positionY = pendingHighlight.y;

    if (pendingHighlight.sentenceData && pendingHighlight.sentenceData.boundingRects.length > 0) {
      const lastRect = pendingHighlight.sentenceData.boundingRects[pendingHighlight.sentenceData.boundingRects.length - 1];
      positionX = lastRect.x + lastRect.width + 50;
      positionY = lastRect.y;
    }

    // For figure/table annotations, position to the right of the bounding rect
    if (pendingHighlight.figureTableData) {
      const rect = pendingHighlight.figureTableData.boundingRect;
      positionX = rect.x + rect.width + 50;
      positionY = rect.y;
    }

    // Determine highlightType based on data
    let effectiveHighlightType = highlightType;
    let effectiveLabel = highlightLabel;
    if (pendingHighlight.figureTableData) {
      effectiveHighlightType = pendingHighlight.figureTableData.type;
      effectiveLabel = pendingHighlight.figureTableData.label;
    }

    onAddAnnotation({
      text: newAnnotationText,
      latex: isLatexMode ? newAnnotationLatex : undefined,
      color: selectedColor,
      userName: "You",
      pageNumber: currentPage,
      position: {
        x: positionX,
        y: positionY,
      },
      highlightRegion: {
        x: pendingHighlight.x,
        y: pendingHighlight.y,
        width: pendingHighlight.width,
        height: pendingHighlight.height,
        type: effectiveHighlightType,
        label: effectiveLabel || undefined,
      },
      // Include sentence data if available
      sentenceData: pendingHighlight.sentenceData,
      // Include figure/table data if available
      figureTableData: pendingHighlight.figureTableData,
    });

    // Reset form
    setNewAnnotationText("");
    setNewAnnotationLatex("");
    setHighlightLabel("");
    setIsSentencePreviewExpanded(false);
    setIsFigureTablePreviewExpanded(false);
    onClearPendingHighlight();
    onToggleCreatingMode();
  };

  return (
    <div className="w-72 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <MessageSquarePlus className="w-5 h-5 text-indigo-500" />
            Annotations
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAllUsers(!showAllUsers)}
              className="h-8 w-8 p-0"
              title={showAllUsers ? "Show only my annotations" : "Show all annotations"}
            >
              {showAllUsers ? (
                <Users className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
            {onToggleAIPanel && (
              <Button
                variant={showAIPanel ? "default" : "ghost"}
                size="sm"
                onClick={onToggleAIPanel}
                className={`h-8 w-8 p-0 ${showAIPanel ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : ''}`}
                title={showAIPanel ? "Hide AI Assistant" : "Show AI Assistant"}
              >
                <Bot className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Add annotation button */}
        {currentUserName ? (
          <Button
            onClick={onToggleCreatingMode}
            variant={isCreatingMode ? "default" : "outline"}
            className="w-full gap-2"
            size="sm"
            disabled={isFigureTableMode}
          >
            {isCreatingMode ? (
              <>
                <EyeOff className="w-4 h-4" />
                Cancel Selection
              </>
            ) : (
              <>
                <MessageSquarePlus className="w-4 h-4" />
                Add Annotation
              </>
            )}
          </Button>
        ) : (
          <Link href="/login">
            <Button
              variant="outline"
              className="w-full gap-2"
              size="sm"
            >
              <LogIn className="w-4 h-4" />
              Login to Annotate
            </Button>
          </Link>
        )}

        {/* Add Figure/Table button - only for uploaders */}
        {isUploader && onToggleFigureTableMode && (
          <Button
            onClick={onToggleFigureTableMode}
            variant={isFigureTableMode ? "default" : "outline"}
            className={`w-full gap-2 mt-2 ${isFigureTableMode ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-0' : ''}`}
            size="sm"
            disabled={isCreatingMode}
          >
            {isFigureTableMode ? (
              <>
                <X className="w-4 h-4" />
                Cancel Fig/Table
              </>
            ) : (
              <>
                <Image className="w-4 h-4" />
                Add Figure/Table
              </>
            )}
          </Button>
        )}

        {/* AI Assistant Button */}
        <Button
          onClick={onToggleAIPanel}
          variant={showAIPanel ? "default" : "outline"}
          className={`w-full gap-2 mt-2 ${showAIPanel ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white border-0' : ''}`}
          size="sm"
        >
          <Bot className="w-4 h-4" />
          {showAIPanel ? 'Hide AI Assistant' : 'AI Assistant'}
        </Button>

        {isCreatingMode && !pendingHighlight && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
            Click and drag on the PDF to select a region
          </p>
        )}
      </div>

      {/* Creation form when highlight is selected */}
      {pendingHighlight && (
        <div className="flex-shrink-0 max-h-[50vh] overflow-y-auto border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <div className="p-4">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">
            New Annotation
          </h3>

          {/* Selected sentence preview - shown when creating annotation from sentence */}
          {pendingHighlight.sentenceData && (
            <div className="mb-3 p-2.5 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-600">
              {/* Section info badge */}
              {pendingHighlight.sentenceData.section && (
                <div className="mb-2 flex items-center gap-1.5 pb-2 border-b border-slate-100 dark:border-slate-700">
                  <BookOpen className="w-3 h-3 text-indigo-500" />
                  <span className="text-[10px] font-medium text-indigo-600 dark:text-indigo-400">
                    In section {pendingHighlight.sentenceData.section.fullTitle}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-1.5 mb-1.5">
                <Quote className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  Selected sentence
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                "{isSentencePreviewExpanded || pendingHighlight.sentenceData.sentenceText.length <= SENTENCE_PREVIEW_CHAR_LIMIT
                  ? pendingHighlight.sentenceData.sentenceText
                  : pendingHighlight.sentenceData.sentenceText.slice(0, SENTENCE_PREVIEW_CHAR_LIMIT) + '...'
                }"
              </p>
              {pendingHighlight.sentenceData.sentenceText.length > SENTENCE_PREVIEW_CHAR_LIMIT && (
                <button
                  onClick={() => setIsSentencePreviewExpanded(!isSentencePreviewExpanded)}
                  className="mt-1.5 flex items-center gap-1 text-[10px] font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
                >
                  {isSentencePreviewExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      Show full ({pendingHighlight.sentenceData.sentenceText.length} chars)
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Selected figure/table preview - shown when creating annotation from figure/table */}
          {pendingHighlight.figureTableData && (
            <div className={`mb-3 p-2.5 rounded-lg border ${
              pendingHighlight.figureTableData.type === 'figure'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
            }`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                {pendingHighlight.figureTableData.type === 'figure' ? (
                  <Image className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Table2 className="w-3.5 h-3.5 text-orange-500" />
                )}
                <span className={`text-[10px] font-medium ${
                  pendingHighlight.figureTableData.type === 'figure'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-orange-600 dark:text-orange-400'
                }`}>
                  {pendingHighlight.figureTableData.label}
                </span>
              </div>
              {pendingHighlight.figureTableData.caption && (
                <>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                    {isFigureTablePreviewExpanded || pendingHighlight.figureTableData.caption.length <= FIGURE_TABLE_PREVIEW_CHAR_LIMIT
                      ? pendingHighlight.figureTableData.caption
                      : pendingHighlight.figureTableData.caption.slice(0, FIGURE_TABLE_PREVIEW_CHAR_LIMIT) + '...'
                    }
                  </p>
                  {pendingHighlight.figureTableData.caption.length > FIGURE_TABLE_PREVIEW_CHAR_LIMIT && (
                    <button
                      onClick={() => setIsFigureTablePreviewExpanded(!isFigureTablePreviewExpanded)}
                      className={`mt-1.5 flex items-center gap-1 text-[10px] font-medium transition-colors ${
                        pendingHighlight.figureTableData.type === 'figure'
                          ? 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300'
                          : 'text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300'
                      }`}
                    >
                      {isFigureTablePreviewExpanded ? (
                        <>
                          <ChevronUp className="w-3 h-3" />
                          Show less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-3 h-3" />
                          Show full ({pendingHighlight.figureTableData.caption.length} chars)
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Type selection - hide when figure/table is selected (auto-determined) */}
          {!pendingHighlight.figureTableData && (
          <div className="grid grid-cols-4 gap-1 mb-3">
            {[
              { type: "text", icon: Type, label: "Text" },
              { type: "figure", icon: Image, label: "Figure" },
              { type: "table", icon: Table2, label: "Table" },
              { type: "equation", icon: Sigma, label: "Eq" },
            ].map(({ type, icon: Icon, label }) => (
              <Button
                key={type}
                variant={highlightType === type ? "default" : "outline"}
                size="sm"
                className="h-8 px-1 text-[10px]"
                onClick={() => setHighlightType(type as typeof highlightType)}
              >
                <Icon className="w-3 h-3 mr-0.5" />
                {label}
              </Button>
            ))}
          </div>
          )}

          {/* Label input - hide when figure/table is selected (auto-determined) */}
          {!pendingHighlight.figureTableData && (
          <Input
            placeholder="Label (e.g., Figure 1, Table 2)"
            value={highlightLabel}
            onChange={(e) => setHighlightLabel(e.target.value)}
            className="mb-3 h-8 text-sm"
          />
          )}

          {/* Color picker */}
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <div className="flex flex-wrap gap-1">
              {ANNOTATION_COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-5 h-5 rounded-full transition-transform flex-shrink-0 ${
                    selectedColor === color ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : ""
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>
          </div>

          {/* Text/LaTeX toggle */}
          <Tabs value={isLatexMode ? "latex" : "text"} onValueChange={(v) => setIsLatexMode(v === "latex")} className="mb-3">
            <TabsList className="grid w-full grid-cols-2 h-8">
              <TabsTrigger value="text" className="text-xs">Plain Text</TabsTrigger>
              <TabsTrigger value="latex" className="text-xs">LaTeX</TabsTrigger>
            </TabsList>
            <TabsContent value="text" className="mt-2">
              <textarea
                placeholder="Enter your annotation..."
                value={newAnnotationText}
                onChange={(e) => setNewAnnotationText(e.target.value)}
                className="w-full h-20 p-2 text-sm border rounded-md resize-none bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600"
              />
            </TabsContent>
            <TabsContent value="latex" className="mt-2">
              <textarea
                placeholder="Enter LaTeX (e.g., E = mc^2)"
                value={newAnnotationLatex}
                onChange={(e) => setNewAnnotationLatex(e.target.value)}
                className="w-full h-16 p-2 text-sm font-mono border rounded-md resize-none bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600"
              />
              {newAnnotationLatex && (
                <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-600">
                  <p className="text-[10px] text-slate-400 mb-1">Preview:</p>
                  <div ref={latexPreviewRef} className="text-sm" />
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                onClearPendingHighlight();
                setNewAnnotationText("");
                setNewAnnotationLatex("");
                setIsSentencePreviewExpanded(false);
              }}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1"
              onClick={handleCreateAnnotation}
              disabled={!newAnnotationText && !newAnnotationLatex}
            >
              Create
            </Button>
          </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex-shrink-0 px-4 py-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="flex-1 text-sm bg-transparent border-none outline-none cursor-pointer text-slate-600 dark:text-slate-300"
          >
            <option value="all">All Types</option>
            <option value="text">Text</option>
            <option value="figure">Figures</option>
            <option value="table">Tables</option>
            <option value="equation">Equations</option>
          </select>
          <span className="text-xs text-slate-400">
            Page {currentPage}
          </span>
        </div>
      </div>

      {/* Annotations list */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-2 space-y-2">
          {filteredAnnotations.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <MessageSquarePlus className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No annotations on this page</p>
              <p className="text-xs mt-1">Click "Add Annotation" to create one</p>
            </div>
          ) : (
            filteredAnnotations.map((annotation) => (
              <AnnotationListItem
                key={annotation.id}
                annotation={annotation}
                isSelected={selectedAnnotationId === annotation.id}
                isHidden={hiddenAnnotationIds?.has(annotation.id) ?? false}
                onSelect={() => onSelectAnnotation(annotation.id)}
                onDelete={() => onDeleteAnnotation(annotation.id)}
                onHide={onHideAnnotation ? () => onHideAnnotation(annotation.id) : undefined}
                onUnhide={onUnhideAnnotation ? () => onUnhideAnnotation(annotation.id) : undefined}
                currentUserName={currentUserName}
                currentUserId={currentUserId}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Stats footer */}
      <div className="flex-shrink-0 p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex justify-between text-xs text-slate-500">
          <span>{annotations.length} total annotations</span>
          <span>{pageAnnotations.length} on this page</span>
        </div>
      </div>
    </div>
  );
}

// Character limit for truncation in the panel list - fits ~2 lines
const PANEL_TEXT_CHAR_LIMIT = 60;
const SENTENCE_TEXT_CHAR_LIMIT = 80;
const FIGURE_TABLE_CAPTION_CHAR_LIMIT = 80;

// Individual annotation item in the list
function AnnotationListItem({
  annotation,
  isSelected,
  isHidden,
  onSelect,
  onDelete,
  onHide,
  onUnhide,
  currentUserName,
  currentUserId,
}: {
  annotation: Annotation;
  isSelected: boolean;
  isHidden: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onHide?: () => void;
  onUnhide?: () => void;
  currentUserName?: string;
  currentUserId?: string;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSentenceExpanded, setIsSentenceExpanded] = useState(false);
  const [isFigureTableExpanded, setIsFigureTableExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check if current user owns this annotation
  const isOwnAnnotation = currentUserName && annotation.userName === currentUserName;

  // Check if text needs truncation
  const text = annotation.text || '';
  const needsTruncation = text.length > PANEL_TEXT_CHAR_LIMIT;
  const displayText = needsTruncation && !isExpanded
    ? text.slice(0, PANEL_TEXT_CHAR_LIMIT) + '...'
    : text;

  // Check if sentence text needs truncation
  const sentenceText = annotation.sentenceData?.sentenceText || '';

  // Check if figure/table caption needs truncation
  const figureTableCaption = annotation.figureTableData?.caption || '';
  const needsFigureTableTruncation = figureTableCaption.length > FIGURE_TABLE_CAPTION_CHAR_LIMIT;
  const displayFigureTableCaption = needsFigureTableTruncation && !isFigureTableExpanded
    ? figureTableCaption.slice(0, FIGURE_TABLE_CAPTION_CHAR_LIMIT) + '...'
    : figureTableCaption;
  const needsSentenceTruncation = sentenceText.length > SENTENCE_TEXT_CHAR_LIMIT;
  const displaySentenceText = needsSentenceTruncation && !isSentenceExpanded
    ? sentenceText.slice(0, SENTENCE_TEXT_CHAR_LIMIT) + '...'
    : sentenceText;

  useEffect(() => {
    if (annotation.latex && contentRef.current) {
      try {
        katex.render(annotation.latex, contentRef.current, {
          throwOnError: false,
          displayMode: false,
        });
      } catch (e) {
        console.error("LaTeX render error:", e);
      }
    }
  }, [annotation.latex]);

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={`
        p-3 rounded-lg border cursor-pointer transition-all relative
        ${isHidden
          ? "bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600 opacity-60"
          : isSelected
            ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-600"
            : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
        }
      `}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Delete/Hide/Unhide button - top right corner */}
      {showDeleteConfirm ? (
        /* Delete confirmation UI */
        <div
          className="absolute -top-2 right-0 flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-800 shadow-lg z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[9px] text-white font-medium">Delete?</span>
          <button
            className="w-4 h-4 rounded bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
              setShowDeleteConfirm(false);
            }}
            title="Confirm delete"
          >
            <X className="w-2.5 h-2.5" />
          </button>
          <button
            className="w-4 h-4 rounded bg-slate-600 hover:bg-slate-500 text-white flex items-center justify-center text-[9px] font-bold"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteConfirm(false);
            }}
            title="Cancel"
          >
            ✕
          </button>
        </div>
      ) : isHidden ? (
        /* Unhide button for hidden annotations */
        <button
          className={`
            absolute -top-2 -right-2 w-5 h-5 rounded-full
            bg-emerald-500 hover:bg-emerald-600 text-white
            flex items-center justify-center
            shadow-md transition-all duration-200 z-10
            ${isHovered || isSelected ? "opacity-100 scale-100" : "opacity-0 scale-75"}
          `}
          onClick={(e) => {
            e.stopPropagation();
            onUnhide?.();
          }}
          title="Show annotation"
        >
          <Eye className="w-3 h-3" />
        </button>
      ) : isOwnAnnotation ? (
        /* Delete button for own annotations */
        <button
          className={`
            absolute -top-2 -right-2 w-5 h-5 rounded-full
            bg-red-500 hover:bg-red-600 text-white
            flex items-center justify-center
            shadow-md transition-all duration-200 z-10
            ${isHovered || isSelected ? "opacity-100 scale-100" : "opacity-0 scale-75"}
          `}
          onClick={(e) => {
            e.stopPropagation();
            setShowDeleteConfirm(true);
          }}
          title="Delete annotation"
        >
          <X className="w-3 h-3" />
        </button>
      ) : (
        /* Hide button for others' annotations */
        <button
          className={`
            absolute -top-2 -right-2 w-5 h-5 rounded-full
            bg-slate-500 hover:bg-slate-600 text-white
            flex items-center justify-center
            shadow-md transition-all duration-200 z-10
            ${isHovered || isSelected ? "opacity-100 scale-100" : "opacity-0 scale-75"}
          `}
          onClick={(e) => {
            e.stopPropagation();
            onHide?.();
          }}
          title="Hide annotation"
        >
          <EyeOff className="w-3 h-3" />
        </button>
      )}

      <div className="flex items-start gap-2 overflow-hidden">
        {/* Color indicator */}
        <div
          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
          style={{ backgroundColor: annotation.color }}
        />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <UserLink
              userId={annotation.userId}
              userName={annotation.userName}
              currentUserId={currentUserId}
              className="text-xs font-medium text-slate-700 dark:text-slate-200"
            />
            <div className="flex items-center gap-1">
              {annotation.highlightRegion.label && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${TYPE_COLORS[annotation.highlightRegion.type]}20`,
                    color: TYPE_COLORS[annotation.highlightRegion.type],
                  }}
                >
                  {annotation.highlightRegion.label}
                </span>
              )}
            </div>
          </div>

          {/* Sentence preview - shown for sentence-based annotations */}
          {annotation.sentenceData && (
            <div className="mb-2 p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-1 mb-0.5">
                <Quote className="w-2.5 h-2.5 text-amber-500" />
                <span className="text-[9px] font-medium text-amber-600 dark:text-amber-400">
                  Sentence
                </span>
              </div>
              <p className="text-[10px] text-slate-600 dark:text-slate-400 italic leading-relaxed">
                "{displaySentenceText}"
              </p>
              {needsSentenceTruncation && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSentenceExpanded(!isSentenceExpanded);
                  }}
                  className="mt-1 flex items-center gap-0.5 text-[9px] font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 transition-colors"
                >
                  {isSentenceExpanded ? (
                    <>
                      <ChevronUp className="w-2.5 h-2.5" />
                      Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-2.5 h-2.5" />
                      More
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Figure/Table preview - shown for figure/table-based annotations */}
          {annotation.figureTableData && (
            <div className={`mb-2 p-1.5 rounded border ${
              annotation.figureTableData.type === 'figure'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
            }`}>
              <div className="flex items-center gap-1 mb-0.5">
                {annotation.figureTableData.type === 'figure' ? (
                  <Image className="w-2.5 h-2.5 text-green-500" />
                ) : (
                  <Table2 className="w-2.5 h-2.5 text-orange-500" />
                )}
                <span className={`text-[9px] font-medium ${
                  annotation.figureTableData.type === 'figure'
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-orange-600 dark:text-orange-400'
                }`}>
                  {annotation.figureTableData.label}
                </span>
              </div>
              {figureTableCaption && (
                <>
                  <p className="text-[10px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {displayFigureTableCaption}
                  </p>
                  {needsFigureTableTruncation && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsFigureTableExpanded(!isFigureTableExpanded);
                      }}
                      className={`mt-1 flex items-center gap-0.5 text-[9px] font-medium transition-colors ${
                        annotation.figureTableData.type === 'figure'
                          ? 'text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300'
                          : 'text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300'
                      }`}
                    >
                      {isFigureTableExpanded ? (
                        <>
                          <ChevronUp className="w-2.5 h-2.5" />
                          Less
                        </>
                      ) : (
                        <>
                          <ChevronDown className="w-2.5 h-2.5" />
                          More
                        </>
                      )}
                    </button>
                  )}
                </>
              )}
            </div>
          )}

          {/* Content - fixed width container to prevent overflow */}
          <div style={{ width: "100%", overflow: "hidden" }}>
            {annotation.latex ? (
              <>
                <div
                  ref={contentRef}
                  className="text-sm text-slate-600 dark:text-slate-300"
                  style={{
                    maxHeight: isExpanded ? "none" : "40px",
                    overflow: "hidden"
                  }}
                />
                {/* Show more/less for LaTeX */}
                <button
                  onClick={handleExpandToggle}
                  className="mt-1 flex items-center gap-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="w-3 h-3" />
                      Show less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-3 h-3" />
                      Show more
                    </>
                  )}
                </button>
              </>
            ) : (
              <>
                <p
                  className="text-sm text-slate-600 dark:text-slate-300"
                  style={{
                    wordBreak: 'break-all',
                    overflowWrap: 'anywhere',
                    whiteSpace: 'pre-wrap',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: isExpanded ? 'unset' : 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {displayText}
                </p>
                {needsTruncation && (
                  <button
                    onClick={handleExpandToggle}
                    className="mt-1 flex items-center gap-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="w-3 h-3" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3 h-3" />
                        Show more ({text.length} chars)
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>

          {/* Type badge */}
          <div className="flex items-center gap-2 mt-2">
            {annotation.highlightRegion?.type && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded capitalize"
                style={{
                  backgroundColor: `${TYPE_COLORS[annotation.highlightRegion.type] || '#6366f1'}15`,
                  color: TYPE_COLORS[annotation.highlightRegion.type] || '#6366f1',
                }}
              >
                {annotation.highlightRegion.type}
              </span>
            )}
            <span className="text-[10px] text-slate-400">
              {new Date(annotation.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
