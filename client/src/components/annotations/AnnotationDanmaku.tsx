import { useState, useRef, useEffect, useCallback } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { X, Move } from "lucide-react";

export interface Annotation {
  id: string;
  text: string;
  latex?: string;
  color: string;
  userName: string;
  userAvatar?: string;
  timestamp: Date;
  pageNumber: number;
  position: { x: number; y: number };
  highlightRegion: {
    x: number;
    y: number;
    width: number;
    height: number;
    type: "text" | "figure" | "table" | "equation";
    label?: string;
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
}: AnnotationDanmakuProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Store drag state in refs to avoid stale closure issues
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

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

  const highlightCenter = {
    x: scaledHighlight.x + scaledHighlight.width / 2,
    y: scaledHighlight.y + scaledHighlight.height / 2,
  };

  // Start drag - store initial position
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    dragStateRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPosX: annotation.position.x,
      startPosY: annotation.position.y,
    };
    setIsDragging(true);
  }, [annotation.position.x, annotation.position.y]);

  // Global mouse move and up handlers
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStateRef.current || !onPositionChange) return;
      
      const deltaX = (e.clientX - dragStateRef.current.startX) / scale;
      const deltaY = (e.clientY - dragStateRef.current.startY) / scale;
      
      const newX = Math.max(0, dragStateRef.current.startPosX + deltaX);
      const newY = Math.max(0, dragStateRef.current.startPosY + deltaY);
      
      onPositionChange(annotation.id, { x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStateRef.current = null;
    };

    // Use capture phase and attach to window for reliability
    window.addEventListener("mousemove", handleMouseMove, { capture: true });
    window.addEventListener("mouseup", handleMouseUp, { capture: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove, { capture: true });
      window.removeEventListener("mouseup", handleMouseUp, { capture: true });
    };
  }, [isDragging, scale, annotation.id, onPositionChange]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete(annotation.id);
    }
  }, [annotation.id, onDelete]);

  const handleSelect = useCallback(() => {
    if (!isDragging && onSelect) {
      onSelect(annotation.id);
    }
  }, [isDragging, onSelect, annotation.id]);

  const showControls = isHovered || isSelected || isDragging;

  return (
    <g className="annotation-group" data-annotation={annotation.id}>
      {/* Highlight rectangle */}
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
        className="cursor-pointer transition-all duration-200"
        style={{ pointerEvents: "auto" }}
        onClick={handleSelect}
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
        className="transition-all duration-200"
        style={{ pointerEvents: "none" }}
      />

      {/* Annotation box using foreignObject */}
      <foreignObject
        x={scaledPosition.x - 120}
        y={scaledPosition.y - 20}
        width={260}
        height={140}
        style={{ overflow: "visible" }}
      >
        <div
          className={`
            bg-white dark:bg-slate-800 rounded-lg shadow-lg border-2 p-2 relative
            transition-all duration-200
            ${isSelected ? "ring-2 ring-offset-2 ring-indigo-500" : ""}
            ${isDragging ? "opacity-90 scale-[1.02]" : "cursor-pointer"}
          `}
          style={{
            borderColor: annotation.color,
            boxShadow: showControls
              ? `0 4px 20px ${annotation.color}40`
              : "0 2px 8px rgba(0,0,0,0.1)",
            pointerEvents: "auto",
            userSelect: "none",
          }}
          onClick={handleSelect}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            if (!isDragging) {
              setIsHovered(false);
            }
          }}
        >
          {/* Delete button */}
          <button
            className={`
              absolute -top-2 -right-2 w-6 h-6 rounded-full
              bg-red-500 hover:bg-red-600 text-white
              flex items-center justify-center
              shadow-md transition-all duration-200 z-20
              ${showControls ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"}
            `}
            onClick={handleDelete}
            onMouseDown={(e) => e.stopPropagation()}
            title="Delete annotation"
          >
            <X className="w-3.5 h-3.5" />
          </button>

          {/* Drag handle */}
          <div
            className={`
              absolute -top-2 -left-2 w-6 h-6 rounded-full
              bg-indigo-500 hover:bg-indigo-600 text-white
              flex items-center justify-center
              shadow-md transition-all duration-200 z-20
              ${showControls ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"}
              ${isDragging ? "bg-indigo-700 scale-110" : ""}
            `}
            onMouseDown={handleDragStart}
            title="Drag to reposition"
            style={{ 
              cursor: isDragging ? "grabbing" : "grab",
            }}
          >
            <Move className="w-3.5 h-3.5" />
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

export const ANNOTATION_COLORS = [
  "#EF4444",
  "#F97316",
  "#EAB308",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
];

export const TYPE_COLORS = {
  text: "#3B82F6",
  figure: "#22C55E",
  table: "#F97316",
  equation: "#8B5CF6",
};
