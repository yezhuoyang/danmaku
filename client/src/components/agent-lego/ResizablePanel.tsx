/**
 * ResizablePanel - A draggable/resizable panel wrapper
 *
 * Allows panels to be resized by dragging the edge and hidden/shown with toggle buttons.
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
} from 'lucide-react';

interface ResizablePanelProps {
  children: React.ReactNode;
  side: 'left' | 'right';
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  isOpen: boolean;
  onToggle: () => void;
  title?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function ResizablePanel({
  children,
  side,
  defaultWidth,
  minWidth,
  maxWidth,
  isOpen,
  onToggle,
  title,
  icon,
  className,
}: ResizablePanelProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  }, [width]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const delta = side === 'left'
        ? e.clientX - startXRef.current
        : startXRef.current - e.clientX;

      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, side, minWidth, maxWidth]);

  // Collapsed state - show only toggle button
  if (!isOpen) {
    return (
      <div
        className={cn(
          "flex flex-col border-border bg-muted/30",
          side === 'left' ? "border-r" : "border-l",
          className
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="h-full w-8 rounded-none hover:bg-muted flex flex-col items-center justify-center gap-2 py-4"
          title={title ? `Show ${title}` : 'Show panel'}
        >
          {side === 'left' ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
          {icon}
          {title && (
            <span
              className="text-xs font-medium writing-mode-vertical"
              style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
            >
              {title}
            </span>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className={cn(
        "relative flex flex-col border-border bg-muted/30",
        side === 'left' ? "border-r" : "border-l",
        isDragging && "select-none",
        className
      )}
      style={{ width: `${width}px` }}
    >
      {/* Resize handle */}
      <div
        className={cn(
          "absolute top-0 bottom-0 w-1 cursor-col-resize z-10 group",
          "hover:bg-indigo-500/50 transition-colors",
          isDragging && "bg-indigo-500",
          side === 'left' ? "right-0" : "left-0"
        )}
        onMouseDown={handleMouseDown}
      >
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity",
          side === 'left' ? "-right-3" : "-left-3"
        )}>
          <GripVertical className="h-6 w-6 text-muted-foreground" />
        </div>
      </div>

      {/* Panel header with collapse button */}
      <div className={cn(
        "flex items-center justify-between px-2 py-1 border-b bg-muted/50",
        side === 'left' ? "flex-row" : "flex-row-reverse"
      )}>
        <div className="flex items-center gap-2 text-sm font-medium">
          {icon}
          {title && <span>{title}</span>}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onToggle}
          title={`Hide ${title || 'panel'}`}
        >
          {side === 'left' ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

/**
 * A horizontal resizable divider between two sections
 */
interface ResizableDividerProps {
  onDrag: (delta: number) => void;
  orientation?: 'horizontal' | 'vertical';
}

export function ResizableDivider({ onDrag, orientation = 'vertical' }: ResizableDividerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const startPosRef = useRef(0);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startPosRef.current = orientation === 'vertical' ? e.clientX : e.clientY;
  }, [orientation]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const currentPos = orientation === 'vertical' ? e.clientX : e.clientY;
      const delta = currentPos - startPosRef.current;
      startPosRef.current = currentPos;
      onDrag(delta);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = orientation === 'vertical' ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, onDrag, orientation]);

  if (orientation === 'horizontal') {
    return (
      <div
        className={cn(
          "h-1 cursor-row-resize hover:bg-indigo-500/50 transition-colors group",
          isDragging && "bg-indigo-500"
        )}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center justify-center h-full opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-4 w-4 rotate-90 text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors group",
        isDragging && "bg-indigo-500"
      )}
      onMouseDown={handleMouseDown}
    >
      <div className="flex items-center justify-center h-full opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical className="h-6 w-6 text-muted-foreground" />
      </div>
    </div>
  );
}
