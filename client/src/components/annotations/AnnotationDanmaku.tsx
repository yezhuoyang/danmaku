import { useState, useRef, useEffect, useCallback } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { X, GripVertical } from "lucide-react";

export interface Annotation {
  id: string;
  text: string;
  latex?: string;
  color: string;
  userName: string;
  userAvatar?: string;
  timestamp: Date;
  pageNumber: number;
  // Position of the annotation bubble
  position: { x: number; y: number };
  // The highlighted region it connects to
  highlightRegion: {
    x: number;
    y: number;
    width: number;
    height: number;
    type: "text" | "figure" | "table" | "equation";
    label?: string; // e.g., "Figure 1", "Table 2"
  };
}

interface AnnotationDanmakuProps {
  annotation: Annotation;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPositionChange?: (id: string, newPosition: { x: number; y: number }) => void;
  scale?: number;
  containerRef?: React.RefObject<HTMLElement>;
}

export function AnnotationDanmaku({
  annotation,
  isSelected = false,
  onSelect,
  onDelete,
  onPositionChange,
  scale = 1,
  containerRef,
}: AnnotationDanmakuProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Render LaTeX if present
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

  const scaledPosition = {
    x: annotation.position.x * scale,
    y: annotation.position.y * scale,
  };

  const scaledHighlight = {
    x: annotation.highlightRegion.x * scale,
    y: annotation.highlightRegion.y * scale,
    width: annotation.highlightRegion.width * scale,
    height: annotation.highlightRegion.height * scale,
  };

  // Calculate connection line from highlight center to annotation
  const highlightCenter = {
    x: scaledHighlight.x + scaledHighlight.width / 2,
    y: scaledHighlight.y + scaledHighlight.height / 2,
  };

  // Handle drag start
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    
    // Calculate offset from mouse to annotation position
    const rect = containerRef?.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset({
        x: e.clientX - rect.left - scaledPosition.x,
        y: e.clientY - rect.top - scaledPosition.y,
      });
    }
  }, [scaledPosition, containerRef]);

  // Handle drag move
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = containerRef?.current?.getBoundingClientRect();
      if (rect && onPositionChange) {
        const newX = (e.clientX - rect.left - dragOffset.x) / scale;
        const newY = (e.clientY - rect.top - dragOffset.y) / scale;
        onPositionChange(annotation.id, { x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, dragOffset, scale, annotation.id, onPositionChange, containerRef]);

  // Handle delete click
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDelete?.(annotation.id);
  }, [annotation.id, onDelete]);

  return (
    <g className="annotation-group">
      {/* Highlight region */}
      <rect
        x={scaledHighlight.x}
        y={scaledHighlight.y}
        width={scaledHighlight.width}
        height={scaledHighlight.height}
        fill={annotation.color}
        fillOpacity={isHovered || isSelected ? 0.4 : 0.25}
        stroke={annotation.color}
        strokeWidth={isSelected ? 2 : 1}
        strokeDasharray={annotation.highlightRegion.type === "figure" ? "4,2" : "none"}
        rx={2}
        ry={2}
        className="cursor-pointer transition-all duration-200 pointer-events-auto"
        onClick={() => onSelect?.(annotation.id)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      />

      {/* Connection line */}
      <line
        x1={highlightCenter.x}
        y1={highlightCenter.y}
        x2={scaledPosition.x}
        y2={scaledPosition.y}
        stroke={annotation.color}
        strokeWidth={isSelected ? 2 : 1}
        strokeOpacity={isHovered || isSelected ? 0.8 : 0.4}
        strokeDasharray="4,2"
        className="transition-all duration-200 pointer-events-none"
      />

      {/* Annotation bubble */}
      <foreignObject
        x={scaledPosition.x - 120}
        y={scaledPosition.y - 20}
        width={260}
        height={120}
        className="overflow-visible"
      >
        <div
          className={`
            bg-white dark:bg-slate-800 rounded-lg shadow-lg border-2 p-2 relative
            transition-all duration-200
            ${isSelected ? "ring-2 ring-offset-2" : ""}
            ${isDragging ? "cursor-grabbing opacity-90" : "cursor-pointer"}
          `}
          style={{
            borderColor: annotation.color,
            boxShadow: isHovered || isSelected
              ? `0 4px 20px ${annotation.color}40`
              : "0 2px 8px rgba(0,0,0,0.1)",
          }}
          onClick={() => !isDragging && onSelect?.(annotation.id)}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* Delete button - top right */}
          <button
            className={`
              absolute -top-2 -right-2 w-5 h-5 rounded-full
              bg-red-500 hover:bg-red-600 text-white
              flex items-center justify-center
              shadow-md transition-all duration-200
              ${isHovered || isSelected ? "opacity-100 scale-100" : "opacity-0 scale-75"}
            `}
            onClick={handleDelete}
            title="Delete annotation"
          >
            <X className="w-3 h-3" />
          </button>

          {/* Drag handle - top left */}
          <div
            className={`
              absolute -top-2 -left-2 w-5 h-5 rounded-full
              bg-slate-500 hover:bg-slate-600 text-white
              flex items-center justify-center cursor-grab
              shadow-md transition-all duration-200
              ${isHovered || isSelected ? "opacity-100 scale-100" : "opacity-0 scale-75"}
              ${isDragging ? "cursor-grabbing bg-slate-700" : ""}
            `}
            onMouseDown={handleDragStart}
            title="Drag to reposition"
          >
            <GripVertical className="w-3 h-3" />
          </div>

          {/* User info */}
          <div className="flex items-center gap-1.5 mb-1">
            <div
              className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white flex-shrink-0"
              style={{ backgroundColor: annotation.color }}
            >
              {annotation.userName.charAt(0).toUpperCase()}
            </div>
            <span className="text-[10px] font-medium text-slate-600 dark:text-slate-300 truncate">
              {annotation.userName}
            </span>
            {annotation.highlightRegion.label && (
              <span
                className="text-[9px] px-1 py-0.5 rounded ml-auto flex-shrink-0"
                style={{
                  backgroundColor: `${annotation.color}20`,
                  color: annotation.color,
                }}
              >
                {annotation.highlightRegion.label}
              </span>
            )}
          </div>

          {/* Content */}
          {annotation.latex ? (
            <div
              ref={contentRef}
              className="text-xs text-slate-700 dark:text-slate-200 overflow-hidden"
              style={{ maxHeight: "50px" }}
            />
          ) : (
            <p className="text-xs text-slate-700 dark:text-slate-200 line-clamp-2">
              {annotation.text}
            </p>
          )}
        </div>
      </foreignObject>
    </g>
  );
}

// Color palette for annotations
export const ANNOTATION_COLORS = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#EAB308", // Yellow
  "#22C55E", // Green
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#8B5CF6", // Purple
  "#EC4899", // Pink
];

// Type badge colors
export const TYPE_COLORS = {
  text: "#3B82F6",
  figure: "#22C55E",
  table: "#F97316",
  equation: "#8B5CF6",
};
