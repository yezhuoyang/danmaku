import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MessageSquarePlus,
  Trash2,
  Eye,
  EyeOff,
  Users,
  Filter,
  ChevronDown,
  Image,
  Table2,
  Type,
  Sigma,
  Palette,
  X,
} from "lucide-react";
import { Annotation, ANNOTATION_COLORS, TYPE_COLORS } from "./AnnotationDanmaku";
import katex from "katex";

interface AnnotationPanelProps {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  onSelectAnnotation: (id: string | null) => void;
  onDeleteAnnotation: (id: string) => void;
  onAddAnnotation: (annotation: Omit<Annotation, "id" | "timestamp">) => void;
  currentPage: number;
  isCreatingMode: boolean;
  onToggleCreatingMode: () => void;
  pendingHighlight: {
    x: number;
    y: number;
    width: number;
    height: number;
  } | null;
  onClearPendingHighlight: () => void;
}

export function AnnotationPanel({
  annotations,
  selectedAnnotationId,
  onSelectAnnotation,
  onDeleteAnnotation,
  onAddAnnotation,
  currentPage,
  isCreatingMode,
  onToggleCreatingMode,
  pendingHighlight,
  onClearPendingHighlight,
}: AnnotationPanelProps) {
  const [filterType, setFilterType] = useState<string>("all");
  const [showAllUsers, setShowAllUsers] = useState(true);
  const [newAnnotationText, setNewAnnotationText] = useState("");
  const [newAnnotationLatex, setNewAnnotationLatex] = useState("");
  const [selectedColor, setSelectedColor] = useState(ANNOTATION_COLORS[4]);
  const [highlightType, setHighlightType] = useState<"text" | "figure" | "table" | "equation">("text");
  const [highlightLabel, setHighlightLabel] = useState("");
  const [isLatexMode, setIsLatexMode] = useState(false);
  const latexPreviewRef = useRef<HTMLDivElement>(null);

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

    onAddAnnotation({
      text: newAnnotationText,
      latex: isLatexMode ? newAnnotationLatex : undefined,
      color: selectedColor,
      userName: "You",
      pageNumber: currentPage,
      position: {
        x: pendingHighlight.x + pendingHighlight.width + 50,
        y: pendingHighlight.y,
      },
      highlightRegion: {
        ...pendingHighlight,
        type: highlightType,
        label: highlightLabel || undefined,
      },
    });

    // Reset form
    setNewAnnotationText("");
    setNewAnnotationLatex("");
    setHighlightLabel("");
    onClearPendingHighlight();
    onToggleCreatingMode();
  };

  return (
    <div className="w-80 h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
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
          </div>
        </div>

        {/* Add annotation button */}
        <Button
          onClick={onToggleCreatingMode}
          variant={isCreatingMode ? "default" : "outline"}
          className="w-full gap-2"
          size="sm"
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

        {isCreatingMode && !pendingHighlight && (
          <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
            Click and drag on the PDF to select a region
          </p>
        )}
      </div>

      {/* Creation form when highlight is selected */}
      {pendingHighlight && (
        <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
          <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 mb-3">
            New Annotation
          </h3>

          {/* Type selection */}
          <div className="flex gap-1 mb-3">
            {[
              { type: "text", icon: Type, label: "Text" },
              { type: "figure", icon: Image, label: "Figure" },
              { type: "table", icon: Table2, label: "Table" },
              { type: "equation", icon: Sigma, label: "Equation" },
            ].map(({ type, icon: Icon, label }) => (
              <Button
                key={type}
                variant={highlightType === type ? "default" : "outline"}
                size="sm"
                className="flex-1 h-8 px-2 text-xs"
                onClick={() => setHighlightType(type as typeof highlightType)}
              >
                <Icon className="w-3 h-3 mr-1" />
                {label}
              </Button>
            ))}
          </div>

          {/* Label input */}
          <Input
            placeholder="Label (e.g., Figure 1, Table 2)"
            value={highlightLabel}
            onChange={(e) => setHighlightLabel(e.target.value)}
            className="mb-3 h-8 text-sm"
          />

          {/* Color picker */}
          <div className="flex items-center gap-2 mb-3">
            <Palette className="w-4 h-4 text-slate-400" />
            <div className="flex gap-1">
              {ANNOTATION_COLORS.map((color) => (
                <button
                  key={color}
                  className={`w-5 h-5 rounded-full transition-transform ${
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
      )}

      {/* Filter tabs */}
      <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
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
      <ScrollArea className="flex-1">
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
                onSelect={() => onSelectAnnotation(annotation.id)}
                onDelete={() => onDeleteAnnotation(annotation.id)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      {/* Stats footer */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex justify-between text-xs text-slate-500">
          <span>{annotations.length} total annotations</span>
          <span>{pageAnnotations.length} on this page</span>
        </div>
      </div>
    </div>
  );
}

// Individual annotation item in the list
function AnnotationListItem({
  annotation,
  isSelected,
  onSelect,
  onDelete,
}: {
  annotation: Annotation;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

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

  return (
    <div
      className={`
        p-3 rounded-lg border cursor-pointer transition-all relative
        ${isSelected
          ? "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-300 dark:border-indigo-600"
          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
        }
      `}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Delete button - top right corner */}
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
          onDelete();
        }}
        title="Delete annotation"
      >
        <X className="w-3 h-3" />
      </button>

      <div className="flex items-start gap-2">
        {/* Color indicator */}
        <div
          className="w-3 h-3 rounded-full mt-1 flex-shrink-0"
          style={{ backgroundColor: annotation.color }}
        />

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {annotation.userName}
            </span>
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

          {/* Content */}
          {annotation.latex ? (
            <div ref={contentRef} className="text-sm text-slate-600 dark:text-slate-300" />
          ) : (
            <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-2">
              {annotation.text}
            </p>
          )}

          {/* Type badge */}
          <div className="flex items-center gap-2 mt-2">
            <span
              className="text-[10px] px-1.5 py-0.5 rounded capitalize"
              style={{
                backgroundColor: `${TYPE_COLORS[annotation.highlightRegion.type]}15`,
                color: TYPE_COLORS[annotation.highlightRegion.type],
              }}
            >
              {annotation.highlightRegion.type}
            </span>
            <span className="text-[10px] text-slate-400">
              {new Date(annotation.timestamp).toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
