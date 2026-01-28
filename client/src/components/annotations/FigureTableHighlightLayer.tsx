import React, { useCallback, memo } from 'react';
import { FigureTable } from '@/lib/figure-table-detector';
import { Image, Table2, MessageCircle, Trash2 } from 'lucide-react';

interface FigureTableHighlightProps {
  figureTable: FigureTable;
  isHovered: boolean;
  isSelected: boolean;
  isHighlightedFromNav: boolean; // Highlighted from navigation (e.g., jumping from paper detail page)
  scale: number;
  hasDiscussions: boolean;
  isAnnotationMode: boolean;
  isUploader: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onDelete?: () => void;
}

/**
 * Memoized component for rendering a single figure/table highlight
 */
const FigureTableHighlight = memo(function FigureTableHighlight({
  figureTable,
  isHovered,
  isSelected,
  isHighlightedFromNav,
  scale,
  hasDiscussions,
  isAnnotationMode,
  isUploader,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onDelete,
}: FigureTableHighlightProps) {
  const showHighlight = isHovered || isSelected || isHighlightedFromNav;

  // Use different colors for figures vs tables, and annotation mode vs discussion mode
  const getHighlightColor = () => {
    if (isAnnotationMode) {
      return figureTable.type === 'figure' ? '#10B981' : '#F97316'; // green for figures, orange for tables
    }
    return figureTable.type === 'figure' ? '#22C55E' : '#F59E0B'; // lighter green/amber for discussion
  };

  const highlightColor = getHighlightColor();
  const rect = figureTable.boundingRect;

  return (
    <g className="figure-table-group">
      {/* Invisible hit area for hover/click detection */}
      <rect
        x={rect.x * scale}
        y={rect.y * scale}
        width={rect.width * scale}
        height={rect.height * scale}
        fill="transparent"
        style={{ pointerEvents: 'auto', cursor: 'pointer' }}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={onClick}
      />

      {/* Visual highlight when hovered or selected */}
      {showHighlight && (
        <g>
          {/* Background highlight */}
          <rect
            x={rect.x * scale}
            y={rect.y * scale}
            width={rect.width * scale}
            height={rect.height * scale}
            fill={highlightColor}
            fillOpacity={isHighlightedFromNav ? 0.25 : isSelected ? 0.15 : 0.08}
            stroke={isHighlightedFromNav ? '#8B5CF6' : highlightColor}
            strokeWidth={isHighlightedFromNav ? 4 : isSelected ? 3 : 2}
            strokeDasharray={isSelected || isHighlightedFromNav ? 'none' : '8,4'}
            strokeOpacity={isSelected || isHighlightedFromNav ? 1 : 0.7}
            rx={4}
            style={{ pointerEvents: 'none' }}
            className={isHighlightedFromNav ? 'animate-pulse' : ''}
          />

          {/* Label badge */}
          <g
            transform={`translate(${rect.x * scale + 8}, ${rect.y * scale + 8})`}
            style={{ pointerEvents: 'none' }}
          >
            <rect
              x={0}
              y={0}
              width={figureTable.label.length * 7 + 24}
              height={22}
              fill={highlightColor}
              rx={4}
            />
            <foreignObject x={4} y={3} width={16} height={16}>
              <div className="flex items-center justify-center w-full h-full">
                {figureTable.type === 'figure' ? (
                  <Image className="w-3.5 h-3.5 text-white" />
                ) : (
                  <Table2 className="w-3.5 h-3.5 text-white" />
                )}
              </div>
            </foreignObject>
            <text
              x={22}
              y={15}
              fill="white"
              fontSize={11}
              fontWeight={600}
              fontFamily="system-ui, -apple-system, sans-serif"
            >
              {figureTable.label}
            </text>
          </g>

          {/* Delete button for uploader */}
          {isUploader && onDelete && (
            <g
              transform={`translate(${(rect.x + rect.width) * scale - 28}, ${rect.y * scale + 8})`}
              style={{ pointerEvents: 'auto', cursor: 'pointer' }}
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <rect
                x={0}
                y={0}
                width={22}
                height={22}
                fill="#EF4444"
                rx={4}
                className="hover:fill-red-600 transition-colors"
              />
              <foreignObject x={3} y={3} width={16} height={16}>
                <div className="flex items-center justify-center w-full h-full">
                  <Trash2 className="w-3.5 h-3.5 text-white" />
                </div>
              </foreignObject>
            </g>
          )}
        </g>
      )}

      {/* Discussion indicator badge (when has discussions and not active) - hide in annotation mode */}
      {hasDiscussions && !showHighlight && !isAnnotationMode && (
        <g
          transform={`translate(${(rect.x + rect.width) * scale - 12}, ${rect.y * scale - 4})`}
          style={{ pointerEvents: 'none' }}
        >
          <circle
            r={10}
            fill={figureTable.type === 'figure' ? '#22C55E' : '#F59E0B'}
          />
          <foreignObject x={-7} y={-7} width={14} height={14}>
            <div className="flex items-center justify-center w-full h-full">
              <MessageCircle className="w-3.5 h-3.5 text-white" />
            </div>
          </foreignObject>
        </g>
      )}

      {/* Non-hover indicator for figures/tables */}
      {!showHighlight && (
        <g
          transform={`translate(${rect.x * scale + 4}, ${rect.y * scale + 4})`}
          style={{ pointerEvents: 'none' }}
        >
          <rect
            x={0}
            y={0}
            width={20}
            height={20}
            fill={highlightColor}
            fillOpacity={0.6}
            rx={4}
          />
          <foreignObject x={2} y={2} width={16} height={16}>
            <div className="flex items-center justify-center w-full h-full">
              {figureTable.type === 'figure' ? (
                <Image className="w-3 h-3 text-white" />
              ) : (
                <Table2 className="w-3 h-3 text-white" />
              )}
            </div>
          </foreignObject>
        </g>
      )}
    </g>
  );
});

interface FigureTableHighlightLayerProps {
  figureTables: FigureTable[];
  hoveredId: string | null;
  selectedId: string | null;
  highlightedId?: string | null; // ID of region to highlight from navigation
  scale: number;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
  discussionCounts: Map<string, number>;
  isAnnotationMode?: boolean;
  isUploader?: boolean;
  onDelete?: (id: string) => void;
}

/**
 * SVG layer that renders figure/table highlights with hover/click interactions.
 * Memoized to prevent unnecessary re-renders when parent re-renders.
 */
export const FigureTableHighlightLayer = memo(function FigureTableHighlightLayer({
  figureTables,
  hoveredId,
  selectedId,
  highlightedId,
  scale,
  onHover,
  onClick,
  discussionCounts,
  isAnnotationMode = false,
  isUploader = false,
  onDelete,
}: FigureTableHighlightLayerProps) {
  const handleMouseEnter = useCallback(
    (id: string) => () => {
      onHover(id);
    },
    [onHover]
  );

  const handleMouseLeave = useCallback(() => {
    onHover(null);
  }, [onHover]);

  const handleClick = useCallback(
    (id: string) => () => {
      onClick(id);
    },
    [onClick]
  );

  const handleDelete = useCallback(
    (id: string) => () => {
      onDelete?.(id);
    },
    [onDelete]
  );

  return (
    <g className="figure-table-highlight-layer">
      {figureTables.map((ft) => {
        const isHovered = ft.id === hoveredId;
        const isSelected = ft.id === selectedId;
        const isHighlightedFromNav = ft.id === highlightedId;
        const discussionCount = discussionCounts.get(ft.id) || 0;

        return (
          <FigureTableHighlight
            key={ft.id}
            figureTable={ft}
            isHovered={isHovered}
            isSelected={isSelected}
            isHighlightedFromNav={isHighlightedFromNav}
            scale={scale}
            hasDiscussions={discussionCount > 0}
            isAnnotationMode={isAnnotationMode}
            isUploader={isUploader}
            onMouseEnter={handleMouseEnter(ft.id)}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick(ft.id)}
            onDelete={handleDelete(ft.id)}
          />
        );
      })}
    </g>
  );
});
