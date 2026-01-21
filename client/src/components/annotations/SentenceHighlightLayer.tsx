import React, { useCallback, memo } from 'react';
import { Sentence } from './types';
import { MessageCircle } from 'lucide-react';

interface SentenceHighlightProps {
  sentence: Sentence;
  isHovered: boolean;
  isSelected: boolean;
  scale: number;
  hasDiscussions: boolean;
  isAnnotationMode: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
}

/**
 * Memoized component for rendering a single sentence highlight
 */
const SentenceHighlight = memo(function SentenceHighlight({
  sentence,
  isHovered,
  isSelected,
  scale,
  hasDiscussions,
  isAnnotationMode,
  onMouseEnter,
  onMouseLeave,
  onClick,
}: SentenceHighlightProps) {
  const showHighlight = isHovered || isSelected;

  // In annotation mode, use different colors (amber/orange) to distinguish from discussion mode
  const highlightColor = isAnnotationMode
    ? (isSelected ? '#F59E0B' : '#FBBF24') // amber colors
    : (isSelected ? '#3B82F6' : '#6366F1'); // blue/indigo colors

  return (
    <g className="sentence-group">
      {/* Invisible hit areas for hover/click detection */}
      {sentence.boundingRects.map((rect, idx) => (
        <rect
          key={`hit-${idx}`}
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
      ))}

      {/* Visual highlight when hovered or selected */}
      {showHighlight && sentence.boundingRects.map((rect, idx) => (
        <g key={`highlight-${idx}`}>
          {/* Subtle background highlight */}
          <rect
            x={rect.x * scale}
            y={rect.y * scale}
            width={rect.width * scale}
            height={rect.height * scale}
            fill={highlightColor}
            fillOpacity={isSelected ? 0.2 : 0.1}
            rx={2}
            style={{ pointerEvents: 'none' }}
          />

          {/* Dashed underline */}
          <line
            x1={rect.x * scale}
            y1={(rect.y + rect.height) * scale}
            x2={(rect.x + rect.width) * scale}
            y2={(rect.y + rect.height) * scale}
            stroke={highlightColor}
            strokeWidth={2}
            strokeDasharray={isSelected ? 'none' : '4,2'}
            strokeOpacity={0.8}
            style={{ pointerEvents: 'none' }}
          />
        </g>
      ))}

      {/* Discussion indicator badge (when has discussions and not active) - hide in annotation mode */}
      {hasDiscussions && !showHighlight && !isAnnotationMode && sentence.boundingRects.length > 0 && (
        <g
          transform={`translate(${(sentence.boundingRects[0].x + sentence.boundingRects[0].width) * scale + 4}, ${sentence.boundingRects[0].y * scale - 2})`}
          style={{ pointerEvents: 'none' }}
        >
          <circle
            r={8}
            fill="#3B82F6"
          />
          <foreignObject x={-6} y={-6} width={12} height={12}>
            <div className="flex items-center justify-center w-full h-full">
              <MessageCircle className="w-3 h-3 text-white" />
            </div>
          </foreignObject>
        </g>
      )}
    </g>
  );
});

interface SentenceHighlightLayerProps {
  sentences: Sentence[];
  hoveredSentenceId: string | null;
  selectedSentenceId: string | null;
  scale: number;
  onSentenceHover: (sentenceId: string | null) => void;
  onSentenceClick: (sentenceId: string) => void;
  sentenceAnnotationCounts: Map<string, number>;
  isAnnotationMode?: boolean;
}

/**
 * SVG layer that renders sentence highlights with hover/click interactions.
 * Positioned below the regular annotation layer.
 * Memoized to prevent unnecessary re-renders when parent re-renders.
 */
export const SentenceHighlightLayer = memo(function SentenceHighlightLayer({
  sentences,
  hoveredSentenceId,
  selectedSentenceId,
  scale,
  onSentenceHover,
  onSentenceClick,
  sentenceAnnotationCounts,
  isAnnotationMode = false,
}: SentenceHighlightLayerProps) {
  const handleMouseEnter = useCallback(
    (sentenceId: string) => () => {
      onSentenceHover(sentenceId);
    },
    [onSentenceHover]
  );

  const handleMouseLeave = useCallback(() => {
    onSentenceHover(null);
  }, [onSentenceHover]);

  const handleClick = useCallback(
    (sentenceId: string) => () => {
      onSentenceClick(sentenceId);
    },
    [onSentenceClick]
  );

  return (
    <g className="sentence-highlight-layer">
      {sentences.map((sentence) => {
        const isHovered = sentence.id === hoveredSentenceId;
        const isSelected = sentence.id === selectedSentenceId;
        const discussionCount = sentenceAnnotationCounts.get(sentence.id) || 0;

        return (
          <SentenceHighlight
            key={sentence.id}
            sentence={sentence}
            isHovered={isHovered}
            isSelected={isSelected}
            scale={scale}
            hasDiscussions={discussionCount > 0}
            isAnnotationMode={isAnnotationMode}
            onMouseEnter={handleMouseEnter(sentence.id)}
            onMouseLeave={handleMouseLeave}
            onClick={handleClick(sentence.id)}
          />
        );
      })}
    </g>
  );
});
