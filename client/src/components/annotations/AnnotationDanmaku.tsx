import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { X, ChevronDown, ChevronUp, Minus, AlertCircle, User, UserPlus, UserMinus, Pencil, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { LikeButtons } from "@/components/ui/LikeButtons";
import { useLocation } from "wouter";
import * as api from "@/lib/api";
import { toast } from "sonner";

const WORD_LIMIT = 150;
const CHAR_LIMIT = 80; // Limit by character count - fits ~3 lines in the box

export interface Annotation {
  id: string;
  text: string;
  latex?: string;
  color: string;
  userId?: string;
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
  // Optional sentence data for sentence-based annotations
  sentenceData?: {
    sentenceId: string;
    sentenceText: string;
    boundingRects: Array<{ x: number; y: number; width: number; height: number }>;
  };
  // Optional figure/table data for figure/table-based annotations
  figureTableData?: {
    figureTableId: string;
    type: 'figure' | 'table';
    label: string;
    caption: string;
    boundingRect: { x: number; y: number; width: number; height: number };
  };
}

interface AnnotationDanmakuProps {
  annotation: Annotation;
  isSelected?: boolean;
  onSelect?: (id: string) => void;
  onDelete?: (id: string) => void;
  onHide?: (id: string) => void;
  onEdit?: (id: string, newText: string, newLatex?: string) => void;
  onPositionChange?: (id: string, newPosition: { x: number; y: number }) => void;
  scale?: number;
  containerRef?: React.RefObject<HTMLElement>;
  currentUserName?: string; // Current logged-in user's display name
  currentUserId?: string; // Current logged-in user's ID
}

export function AnnotationDanmaku({
  annotation,
  isSelected = false,
  onSelect,
  onDelete,
  onHide,
  onEdit,
  onPositionChange,
  scale = 1,
  currentUserName,
  currentUserId,
}: AnnotationDanmakuProps) {
  const [, setLocation] = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [avatarPopoverOpen, setAvatarPopoverOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(annotation.text);
  const [editLatex, setEditLatex] = useState(annotation.latex || '');

  // Check if current user owns this annotation
  const isOwnAnnotation = currentUserName && annotation.userName === currentUserName;
  const isOwnProfile = currentUserId && annotation.userId === currentUserId;

  const handleProfileClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (annotation.userId) {
      setAvatarPopoverOpen(false);
      setLocation(`/profile/${annotation.userId}`);
    }
  };

  const handleFollow = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUserId) {
      toast.error('Please log in to follow users');
      return;
    }
    if (!annotation.userId) return;

    setIsFollowLoading(true);
    try {
      if (isFollowing) {
        await api.unfollowUser(annotation.userId);
        setIsFollowing(false);
        toast.success(`Unfollowed ${annotation.userName}`);
      } else {
        await api.followUser(annotation.userId);
        setIsFollowing(true);
        toast.success(`Following ${annotation.userName}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update follow status');
    } finally {
      setIsFollowLoading(false);
    }
  };

  // Store drag state in refs to avoid stale closure issues
  const dragStateRef = useRef<{
    startX: number;
    startY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  // Calculate truncated text and whether truncation is needed
  // Consider both word count AND character count for long strings without spaces
  const { displayText, isTruncated, wordCount, charCount } = useMemo(() => {
    const text = annotation.text || '';
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const wCount = words.length;
    const cCount = text.length;

    // Check if truncation is needed by word count
    if (wCount > WORD_LIMIT) {
      const truncated = words.slice(0, WORD_LIMIT).join(' ') + '...';
      return { displayText: truncated, isTruncated: true, wordCount: wCount, charCount: cCount };
    }

    // Check if truncation is needed by character count (for long strings without spaces)
    if (cCount > CHAR_LIMIT) {
      const truncated = text.slice(0, CHAR_LIMIT) + '...';
      return { displayText: truncated, isTruncated: true, wordCount: wCount, charCount: cCount };
    }

    return { displayText: text, isTruncated: false, wordCount: wCount, charCount: cCount };
  }, [annotation.text]);

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

      // Allow free movement - no artificial boundaries
      // The user should be able to position the annotation anywhere they want
      const newX = dragStateRef.current.startPosX + deltaX;
      const newY = dragStateRef.current.startPosY + deltaY;

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

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onDelete) {
      onDelete(annotation.id);
    }
    setShowDeleteConfirm(false);
  }, [annotation.id, onDelete]);

  const handleCancelDelete = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowDeleteConfirm(false);
  }, []);

  const handleHide = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onHide) {
      onHide(annotation.id);
    }
  }, [annotation.id, onHide]);

  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditText(annotation.text);
    setEditLatex(annotation.latex || '');
    setIsEditing(true);
    // Focus the textarea after render
    setTimeout(() => {
      editTextareaRef.current?.focus();
      editTextareaRef.current?.select();
    }, 0);
  }, [annotation.text, annotation.latex]);

  const handleEditSave = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // For LaTeX annotations, use edited latex; for text, use edited text
    if (onEdit) {
      if (annotation.latex) {
        // LaTeX annotation - save edited LaTeX
        if (editLatex.trim()) {
          onEdit(annotation.id, editText.trim() || editLatex.trim(), editLatex.trim());
        }
      } else {
        // Text annotation
        if (editText.trim()) {
          onEdit(annotation.id, editText.trim(), undefined);
        }
      }
    }
    setIsEditing(false);
  }, [annotation.id, annotation.latex, editText, editLatex, onEdit]);

  const handleEditCancel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEditText(annotation.text);
    setEditLatex(annotation.latex || '');
    setIsEditing(false);
  }, [annotation.text, annotation.latex]);

  const handleEditKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setEditText(annotation.text);
      setEditLatex(annotation.latex || '');
      setIsEditing(false);
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      // For LaTeX annotations, use edited latex; for text, use edited text
      if (onEdit) {
        if (annotation.latex) {
          if (editLatex.trim()) {
            onEdit(annotation.id, editText.trim() || editLatex.trim(), editLatex.trim());
          }
        } else {
          if (editText.trim()) {
            onEdit(annotation.id, editText.trim(), undefined);
          }
        }
      }
      setIsEditing(false);
    }
  }, [annotation.id, annotation.latex, annotation.text, editText, editLatex, onEdit]);

  const handleSelect = useCallback(() => {
    if (!isDragging && onSelect) {
      onSelect(annotation.id);
    }
  }, [isDragging, onSelect, annotation.id]);

  const showControls = isHovered || isSelected || isDragging;

  // Check if this is a sentence-based annotation
  const isSentenceAnnotation = !!annotation.sentenceData;

  // Check if this is a figure/table-based annotation
  const isFigureTableAnnotation = !!annotation.figureTableData;

  // For sentence annotations, compute center from all bounding rects
  const sentenceCenter = useMemo(() => {
    if (!annotation.sentenceData) return null;
    const rects = annotation.sentenceData.boundingRects;
    if (rects.length === 0) return null;

    // Use the center of the last rect for connection point
    const lastRect = rects[rects.length - 1];
    return {
      x: (lastRect.x + lastRect.width) * scale,
      y: (lastRect.y + lastRect.height / 2) * scale,
    };
  }, [annotation.sentenceData, scale]);

  // For figure/table annotations, compute center from bounding rect
  const figureTableCenter = useMemo(() => {
    if (!annotation.figureTableData) return null;
    const rect = annotation.figureTableData.boundingRect;
    return {
      x: (rect.x + rect.width) * scale,
      y: (rect.y + rect.height / 2) * scale,
    };
  }, [annotation.figureTableData, scale]);

  return (
    <g className="annotation-group" data-annotation={annotation.id}>
      {/* Highlight - only render for regular annotations (not sentence or figure/table) */}
      {/* Sentence and figure/table annotations rely on their respective highlight layers */}
      {/* This allows their discussion to still work even after annotation is created */}
      {!isSentenceAnnotation && !isFigureTableAnnotation && (
        // Regular rectangle highlight
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
      )}

      {/* Connection line */}
      <line
        x1={sentenceCenter ? sentenceCenter.x : figureTableCenter ? figureTableCenter.x : highlightCenter.x}
        y1={sentenceCenter ? sentenceCenter.y : figureTableCenter ? figureTableCenter.y : highlightCenter.y}
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
        width={320}
        height={isExpanded ? 600 : 180}
        style={{ overflow: "visible" }}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            padding: "12px",
            pointerEvents: "auto",
            position: "relative",
          }}
        >
          {/* Delete/Hide buttons - positioned outside the main box */}
          {showDeleteConfirm ? (
            /* Delete confirmation UI */
            <div
              className={`
                absolute flex items-center gap-1 px-2 py-1 rounded-lg
                bg-slate-800 shadow-lg z-20
                transition-all duration-200
              `}
              style={{
                top: "2px",
                right: "2px",
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[10px] text-white font-medium">Delete?</span>
              <button
                className="w-5 h-5 rounded bg-red-500 hover:bg-red-600 text-white flex items-center justify-center"
                onClick={handleConfirmDelete}
                title="Confirm delete"
              >
                <X className="w-3 h-3" />
              </button>
              <button
                className="w-5 h-5 rounded bg-slate-600 hover:bg-slate-500 text-white flex items-center justify-center"
                onClick={handleCancelDelete}
                title="Cancel"
              >
                <span className="text-[10px] font-bold">✕</span>
              </button>
            </div>
          ) : isEditing ? (
            /* Edit mode save/cancel buttons */
            <div
              className="absolute flex items-center gap-1 z-20"
              style={{
                top: "2px",
                right: "2px",
              }}
            >
              <button
                className="w-6 h-6 rounded-full bg-green-500 hover:bg-green-600 text-white flex items-center justify-center shadow-md"
                onClick={handleEditSave}
                onMouseDown={(e) => e.stopPropagation()}
                title="Save (Ctrl+Enter)"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                className="w-6 h-6 rounded-full bg-slate-500 hover:bg-slate-600 text-white flex items-center justify-center shadow-md"
                onClick={handleEditCancel}
                onMouseDown={(e) => e.stopPropagation()}
                title="Cancel (Esc)"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : isOwnAnnotation ? (
            /* Hide, Edit and Delete buttons for own annotations */
            <div
              className={`
                absolute flex items-center gap-1 z-20
                transition-all duration-200
                ${showControls ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"}
              `}
              style={{
                top: "2px",
                right: "2px",
              }}
            >
              {/* Hide button */}
              <button
                className="w-6 h-6 rounded-full bg-slate-500 hover:bg-slate-600 text-white flex items-center justify-center shadow-md"
                onClick={handleHide}
                onMouseDown={(e) => e.stopPropagation()}
                title="Hide annotation"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              {/* Edit button */}
              {onEdit && (
                <button
                  className="w-6 h-6 rounded-full bg-blue-500 hover:bg-blue-600 text-white flex items-center justify-center shadow-md"
                  onClick={handleEditClick}
                  onMouseDown={(e) => e.stopPropagation()}
                  title="Edit annotation"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              )}
              {/* Delete button */}
              <button
                className="w-6 h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-md"
                onClick={handleDeleteClick}
                onMouseDown={(e) => e.stopPropagation()}
                title="Delete annotation"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            /* Hide button for others' annotations */
            <button
              className={`
                absolute w-6 h-6 rounded-full
                bg-slate-500 hover:bg-slate-600 text-white
                flex items-center justify-center
                shadow-md transition-all duration-200 z-20
                ${showControls ? "opacity-100 scale-100" : "opacity-0 scale-75 pointer-events-none"}
              `}
              style={{
                top: "2px",
                right: "2px",
              }}
              onClick={handleHide}
              onMouseDown={(e) => e.stopPropagation()}
              title="Hide annotation"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Main container with avatar on left and content box on right */}
          <div className="flex items-stretch gap-2">
            {/* Large Avatar with Popover */}
            <Popover open={avatarPopoverOpen} onOpenChange={setAvatarPopoverOpen}>
              <PopoverTrigger asChild>
                <button
                  className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-lg font-bold text-white shadow-lg hover:scale-105 transition-transform cursor-pointer overflow-hidden"
                  style={{ backgroundColor: annotation.color }}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onMouseDown={(e) => e.stopPropagation()}
                  title={`${annotation.userName} - Click for profile`}
                >
                  {annotation.userAvatar ? (
                    <img src={annotation.userAvatar} alt="" className="w-full h-full object-cover" />
                  ) : (
                    annotation.userName.charAt(0).toUpperCase()
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent
                className="w-56 p-3"
                align="start"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center overflow-hidden"
                    style={{ backgroundColor: annotation.color }}
                  >
                    {annotation.userAvatar ? (
                      <img src={annotation.userAvatar} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold">
                        {annotation.userName.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{annotation.userName}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={handleProfileClick}
                    disabled={!annotation.userId}
                  >
                    <User className="w-3 h-3 mr-1" />
                    Profile
                  </Button>
                  {!isOwnProfile && currentUserId && annotation.userId && (
                    <Button
                      variant={isFollowing ? "outline" : "default"}
                      size="sm"
                      className="flex-1"
                      onClick={handleFollow}
                      disabled={isFollowLoading}
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

            {/* Annotation content box */}
            <div
              className={`
                bg-white dark:bg-slate-800 rounded-lg shadow-lg border-2 p-2 flex-1
                transition-all duration-200
                ${isSelected ? "ring-2 ring-offset-2 ring-indigo-500" : ""}
                ${isDragging ? "opacity-90 scale-[1.02]" : ""}
                ${isHovered && !isDragging ? "ring-2 ring-indigo-300 dark:ring-indigo-500" : ""}
              `}
              style={{
                borderColor: annotation.color,
                boxShadow: showControls
                  ? `0 4px 20px ${annotation.color}40`
                  : "0 2px 8px rgba(0,0,0,0.1)",
                userSelect: "none",
                width: "220px",
                maxWidth: "220px",
                boxSizing: "border-box",
                overflow: "hidden",
                cursor: isDragging ? "grabbing" : "grab",
              }}
              onClick={handleSelect}
              onMouseDown={handleDragStart}
              onMouseEnter={() => setIsHovered(true)}
              onMouseLeave={() => {
                if (!isDragging) {
                  setIsHovered(false);
                }
              }}
            >
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
                {/* Like/Dislike buttons */}
                <LikeButtons
                  targetType="annotation"
                  targetId={annotation.id}
                  currentUserId={currentUserId}
                  size="sm"
                />
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
              <div style={{ width: "100%", overflow: "hidden" }}>
                {isEditing ? (
                  /* Edit mode - show appropriate textarea */
                  annotation.latex ? (
                    /* LaTeX edit mode */
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 text-[9px] text-slate-500 dark:text-slate-400">
                        <span className="font-medium">LaTeX:</span>
                        <span className="text-slate-400">Ctrl+Enter to save, Esc to cancel</span>
                      </div>
                      <textarea
                        ref={editTextareaRef}
                        value={editLatex}
                        onChange={(e) => setEditLatex(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 font-mono"
                        style={{
                          minHeight: '60px',
                          maxHeight: '120px',
                        }}
                        placeholder="Enter LaTeX formula..."
                      />
                    </div>
                  ) : (
                    /* Text edit mode */
                    <textarea
                      ref={editTextareaRef}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full text-xs text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded p-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{
                        minHeight: '60px',
                        maxHeight: '120px',
                      }}
                      placeholder="Enter your annotation text..."
                    />
                  )
                ) : annotation.latex ? (
                  <>
                    <div
                      ref={contentRef}
                      className="text-xs text-slate-700 dark:text-slate-200"
                      style={{
                        maxHeight: isExpanded ? "none" : "50px",
                        overflow: "hidden",
                        overflowWrap: "break-word",
                        wordBreak: "break-all",
                      }}
                    />
                    {/* Show more/less for LaTeX - always show since we can't easily measure rendered LaTeX */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded(!isExpanded);
                      }}
                      className="mt-1.5 flex items-center gap-1 text-[10px] font-medium transition-colors"
                      style={{ color: annotation.color }}
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
                      className="text-xs text-slate-700 dark:text-slate-200"
                      style={{
                        wordBreak: 'break-all',
                        overflowWrap: 'anywhere',
                        whiteSpace: 'pre-wrap',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: isExpanded ? 'unset' : 3,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {isExpanded ? annotation.text : displayText}
                    </p>

                    {/* Expand/Collapse button for text */}
                    {isTruncated && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsExpanded(!isExpanded);
                        }}
                        className="mt-1.5 flex items-center gap-1 text-[10px] font-medium transition-colors"
                        style={{ color: annotation.color }}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown className="w-3 h-3" />
                            Show more ({wordCount > WORD_LIMIT ? `${wordCount} words` : `${charCount} chars`})
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
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
