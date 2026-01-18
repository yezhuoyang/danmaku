import { TextItem, BoundingRect, FigureTableLabel } from '@/components/annotations/types';
import { nanoid } from 'nanoid';

/**
 * Represents a Figure or Table detected in the PDF
 */
export interface FigureTable {
  /** Unique identifier (e.g., "page-1-figure-1") */
  id: string;
  /** Type of element */
  type: 'figure' | 'table';
  /** Label (e.g., "Figure 1", "Table 2") */
  label: string;
  /** Caption text if detected */
  caption: string;
  /** Page number */
  pageNumber: number;
  /** Bounding rectangle for the entire figure/table including caption */
  boundingRect: BoundingRect;
  /** Bounds for easy access */
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  /** AI-assigned label for this figure/table */
  aiLabel?: FigureTableLabel;
}

/**
 * Pattern to detect figure/table captions
 * Matches: "Figure 1", "Fig. 2", "Table 1", "TABLE 2", etc.
 */
const FIGURE_PATTERN = /^(Figure|Fig\.?)\s*(\d+)/i;
const TABLE_PATTERN = /^(Table)\s*(\d+)/i;

/**
 * Group TextItems by approximate Y coordinate (line grouping)
 */
function groupByLine(items: TextItem[], threshold: number = 5): TextItem[][] {
  if (items.length === 0) return [];

  // Sort by Y then X
  const sorted = [...items].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > threshold) return yDiff;
    return a.x - b.x;
  });

  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [sorted[0]];
  let currentY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    const item = sorted[i];
    if (Math.abs(item.y - currentY) > threshold) {
      lines.push(currentLine);
      currentLine = [item];
      currentY = item.y;
    } else {
      currentLine.push(item);
    }
  }

  if (currentLine.length > 0) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Find caption text by concatenating text items that are close to the label
 */
function extractCaption(
  textItems: TextItem[],
  labelStartIdx: number,
  pageWidth: number
): { caption: string; endIdx: number } {
  const lines = groupByLine(textItems);

  // Find which line contains our label
  const labelItem = textItems[labelStartIdx];
  let labelLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].some(item => item === labelItem)) {
      labelLineIdx = i;
      break;
    }
  }

  if (labelLineIdx === -1) {
    return { caption: labelItem.str, endIdx: labelStartIdx };
  }

  // Collect text from the caption line(s)
  // Caption typically continues on the same line and possibly next few lines
  // until we hit a significant gap or different text style
  let captionText = '';
  let endIdx = labelStartIdx;
  const labelLine = lines[labelLineIdx];

  // Get all text from the label line starting from label
  const labelIndexInLine = labelLine.indexOf(labelItem);
  for (let i = labelIndexInLine; i < labelLine.length; i++) {
    captionText += labelLine[i].str + ' ';
    const itemIdx = textItems.indexOf(labelLine[i]);
    if (itemIdx > endIdx) endIdx = itemIdx;
  }

  // Check subsequent lines for continuation of caption
  // Caption lines are usually centered or have similar X position
  const labelLineMinX = Math.min(...labelLine.map(i => i.x));
  const labelLineMaxX = Math.max(...labelLine.map(i => i.x + i.width));
  const labelLineWidth = labelLineMaxX - labelLineMinX;

  // Look at next 2-3 lines for caption continuation
  for (let i = labelLineIdx + 1; i < Math.min(labelLineIdx + 4, lines.length); i++) {
    const line = lines[i];
    if (line.length === 0) continue;

    const lineMinX = Math.min(...line.map(item => item.x));
    const lineMaxX = Math.max(...line.map(item => item.x + item.width));
    const lineWidth = lineMaxX - lineMinX;

    // Check if this line looks like caption continuation
    // (similar width and position, not a new figure/table label)
    const lineText = line.map(item => item.str).join(' ');
    if (FIGURE_PATTERN.test(lineText) || TABLE_PATTERN.test(lineText)) {
      break; // Hit another figure/table
    }

    // Check for paragraph-style text (full width) vs caption (usually narrower)
    if (lineWidth > labelLineWidth * 1.5 && lineWidth > pageWidth * 0.7) {
      break; // Looks like regular paragraph text
    }

    // Check Y gap
    const lastCaptionLine = lines[i - 1];
    const lastY = Math.max(...lastCaptionLine.map(item => item.y + item.height));
    const currentY = Math.min(...line.map(item => item.y));
    const avgHeight = line.reduce((sum, item) => sum + item.height, 0) / line.length;

    if (currentY - lastY > avgHeight * 2) {
      break; // Too much gap
    }

    // Add this line to caption
    for (const item of line) {
      captionText += item.str + ' ';
      const itemIdx = textItems.indexOf(item);
      if (itemIdx > endIdx) endIdx = itemIdx;
    }
  }

  return { caption: captionText.trim(), endIdx };
}

/**
 * Estimate the bounding box for a figure/table
 * This looks at the caption position and tries to find the visual block above/below
 */
function estimateFigureTableBounds(
  textItems: TextItem[],
  captionItems: TextItem[],
  type: 'figure' | 'table',
  pageWidth: number,
  pageHeight: number
): BoundingRect {
  if (captionItems.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }

  // Get caption bounds
  let captionMinX = Infinity, captionMinY = Infinity;
  let captionMaxX = -Infinity, captionMaxY = -Infinity;

  for (const item of captionItems) {
    captionMinX = Math.min(captionMinX, item.x);
    captionMinY = Math.min(captionMinY, item.y);
    captionMaxX = Math.max(captionMaxX, item.x + item.width);
    captionMaxY = Math.max(captionMaxY, item.y + item.height);
  }

  // Find text items that might be part of the figure/table
  // Look for a gap in text above or below the caption
  const lines = groupByLine(textItems);

  // Find caption line index and also find the end of caption (multi-line captions)
  let captionStartLineIdx = -1;
  let captionEndLineIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].some(item => captionItems.includes(item))) {
      if (captionStartLineIdx === -1) {
        captionStartLineIdx = i;
      }
      captionEndLineIdx = i;
    }
  }

  if (captionStartLineIdx === -1) {
    // Fallback: just use caption bounds with some padding
    return {
      x: captionMinX - 10,
      y: captionMinY - 50,
      width: captionMaxX - captionMinX + 20,
      height: captionMaxY - captionMinY + 60,
    };
  }

  // Calculate average line height for gap detection
  const avgLineHeight = calculateAverageLineHeight(lines);

  // Gap thresholds - use multiples of average line height for better detection
  const smallGap = avgLineHeight * 1.5;  // Normal line spacing
  const mediumGap = avgLineHeight * 2.5; // Section break
  const largeGap = avgLineHeight * 4;    // Major content separation

  // Look for gaps above and below caption
  let topBound = captionMinY;
  let bottomBound = captionMaxY;

  // For FIGURES: The image is usually ABOVE the caption (as empty space with no text)
  // We need to find the gap between caption and the text ABOVE the figure
  if (type === 'figure') {
    // Strategy: Find the nearest text line above the caption.
    // The figure occupies the space between that text and the caption.
    // If there's a large gap, that's where the figure image is.

    if (captionStartLineIdx > 0) {
      // Get the line immediately before caption
      const prevLine = lines[captionStartLineIdx - 1];
      const prevLineMaxY = Math.max(...prevLine.map(item => item.y + item.height));
      const gapToCaption = captionMinY - prevLineMaxY;

      // If there's a significant gap, the figure is in that gap
      // But we need to find where the figure STARTS (where text above it ends)
      if (gapToCaption > avgLineHeight * 2) {
        // There's a gap - this IS the figure area
        // Now find where regular text ends above this gap

        // Scan upward from prevLine to find continuous text
        let figureTop = prevLineMaxY; // Start assumption: figure starts right after prevLine

        for (let i = captionStartLineIdx - 1; i >= 0; i--) {
          const line = lines[i];
          const lineMaxY = Math.max(...line.map(item => item.y + item.height));
          const lineMinY = Math.min(...line.map(item => item.y));

          // Check gap to the line below (toward caption)
          let gapBelow: number;
          if (i === captionStartLineIdx - 1) {
            gapBelow = captionMinY - lineMaxY;
          } else {
            const belowLine = lines[i + 1];
            const belowMinY = Math.min(...belowLine.map(item => item.y));
            gapBelow = belowMinY - lineMaxY;
          }

          // If this line has a large gap below it, this is text above the figure
          // The figure starts after this line
          if (gapBelow > avgLineHeight * 3) {
            figureTop = lineMaxY + 5; // Figure starts just below this text
            topBound = figureTop;
            break;
          }

          // Check gap to line above
          if (i > 0) {
            const aboveLine = lines[i - 1];
            const aboveMaxY = Math.max(...aboveLine.map(item => item.y + item.height));
            const gapAbove = lineMinY - aboveMaxY;

            // If small gap above, this line is part of continuous text
            // Keep scanning up
            if (gapAbove < mediumGap) {
              figureTop = lineMaxY + 5;
              topBound = figureTop;
            } else {
              // Large gap above this line - this line might be part of the figure area
              // or isolated text within the figure
              // Stop here, figure starts above this line
              topBound = lineMinY - gapAbove + 5;
              break;
            }
          } else {
            // Reached top of page
            topBound = lineMaxY + 5;
          }
        }
      } else {
        // Small gap - maybe figure content has text labels within it
        // Scan upward looking for a large gap that indicates start of figure
        for (let i = captionStartLineIdx - 1; i >= 0; i--) {
          const line = lines[i];
          const lineMinY = Math.min(...line.map(item => item.y));

          if (i > 0) {
            const aboveLine = lines[i - 1];
            const aboveMaxY = Math.max(...aboveLine.map(item => item.y + item.height));
            const gapAbove = lineMinY - aboveMaxY;

            // Found the start of the figure area
            if (gapAbove > avgLineHeight * 3) {
              topBound = aboveMaxY + 5;
              break;
            }
          } else {
            // Reached first line - use some reasonable top bound
            topBound = lineMinY - avgLineHeight * 2;
          }
        }
      }
    } else {
      // Caption is the first text on page - figure is above it
      topBound = Math.max(10, captionMinY - avgLineHeight * 10);
    }

    // Ensure topBound is above caption
    if (topBound >= captionMinY - 10) {
      topBound = captionMinY - Math.max(50, avgLineHeight * 5);
    }
  }

  // For TABLES: The table content is usually ABOVE the caption "Table X: description"
  // The caption describes the table, so the actual table data is ABOVE it
  if (type === 'table') {
    // Tables typically have their data ABOVE the caption
    // Scan upward from caption to find the table content
    if (captionStartLineIdx > 0) {
      let tableTopFound = false;
      let lastTableLineIdx = captionStartLineIdx - 1;

      // First, verify that lines above look like table content
      // Table rows typically have: multiple items, numbers, short text segments
      for (let i = captionStartLineIdx - 1; i >= 0; i--) {
        const line = lines[i];
        const lineText = line.map(item => item.str).join(' ');
        const lineMinY = Math.min(...line.map(item => item.y));
        const lineMaxY = Math.max(...line.map(item => item.y + item.height));

        // Check if this line looks like table content
        const hasNumbers = /\d/.test(lineText);
        const hasMultipleItems = line.length >= 2;
        const hasShortSegments = line.every(item => item.str.length < 30);
        const looksLikeTableRow = (hasNumbers || hasMultipleItems) && hasShortSegments;

        // Check gap to next line (below, toward caption)
        let gapBelow: number;
        if (i === captionStartLineIdx - 1) {
          gapBelow = captionMinY - lineMaxY;
        } else {
          const belowLine = lines[i + 1];
          const belowMinY = Math.min(...belowLine.map(item => item.y));
          gapBelow = belowMinY - lineMaxY;
        }

        // Check gap to line above
        if (i > 0) {
          const aboveLine = lines[i - 1];
          const aboveMaxY = Math.max(...aboveLine.map(item => item.y + item.height));
          const gapAbove = lineMinY - aboveMaxY;

          // If there's a large gap above, this might be where the table starts
          // or it could be the table caption/header row
          if (gapAbove > mediumGap) {
            // Check if the line above looks like regular paragraph text
            const aboveLineText = aboveLine.map(item => item.str).join(' ');
            const aboveHasLongText = aboveLine.some(item => item.str.length > 40);
            const aboveLooksLikeParagraph = aboveHasLongText || aboveLine.length < 3;

            if (aboveLooksLikeParagraph || !looksLikeTableRow) {
              // Found the top of the table
              topBound = lineMinY - 5;
              tableTopFound = true;
              break;
            }
          }
        } else {
          // Reached top of page
          topBound = lineMinY - 5;
          tableTopFound = true;
        }

        // Stop if this line doesn't look like table content
        if (!looksLikeTableRow && i < captionStartLineIdx - 1) {
          // Use the next line as table start
          const nextLine = lines[i + 1];
          topBound = Math.min(...nextLine.map(item => item.y)) - 5;
          tableTopFound = true;
          break;
        }
      }

      if (!tableTopFound) {
        // Default: some reasonable distance above caption
        topBound = captionMinY - avgLineHeight * 10;
      }
    }

    // For tables, the bottom is typically at the caption (not below it)
    // The caption "Table X: description" marks the END of the table visual
    bottomBound = captionMaxY;
  }

  // Calculate X bounds - use wider bounds for better coverage
  const margin = pageWidth * 0.05; // 5% margin

  // For figures: Use most of the page width (figures are often centered and wide)
  // For tables: Calculate based on actual table content width
  let xMin: number, xMax: number;

  if (type === 'figure') {
    // Figures typically span most of the content area
    // Use caption position as a guide but expand significantly
    const captionCenterX = (captionMinX + captionMaxX) / 2;
    const pageCenterX = pageWidth / 2;

    // Use the center that's closer to page center
    const centerX = Math.abs(captionCenterX - pageCenterX) < pageWidth * 0.2
                    ? pageCenterX
                    : captionCenterX;

    // Figure width: at least 70% of page width, or caption width + padding
    const figureWidth = Math.max(pageWidth * 0.7, captionMaxX - captionMinX + 40);

    xMin = Math.max(margin, centerX - figureWidth / 2);
    xMax = Math.min(pageWidth - margin, centerX + figureWidth / 2);
  } else {
    // For tables: Scan the content rows to find actual table width
    let tableMinX = captionMinX;
    let tableMaxX = captionMaxX;

    // Check rows above and below caption
    const startIdx = Math.max(0, captionStartLineIdx - 5);
    const endIdx = Math.min(lines.length, captionEndLineIdx + 20);

    for (let i = startIdx; i < endIdx; i++) {
      const line = lines[i];
      // Skip if this line looks like regular paragraph text
      if (line.length < 3) continue;

      const lineMinX = Math.min(...line.map(item => item.x));
      const lineMaxX = Math.max(...line.map(item => item.x + item.width));

      tableMinX = Math.min(tableMinX, lineMinX);
      tableMaxX = Math.max(tableMaxX, lineMaxX);
    }

    xMin = Math.max(margin, tableMinX - 10);
    xMax = Math.min(pageWidth - margin, tableMaxX + 10);
  }

  return {
    x: xMin,
    y: topBound - 5,
    width: xMax - xMin,
    height: Math.max(bottomBound - topBound + 10, 50),
  };
}

/**
 * Calculate average line height from text items
 */
function calculateAverageLineHeight(lines: TextItem[][]): number {
  if (lines.length === 0) return 12; // Default fallback

  let totalHeight = 0;
  let count = 0;

  for (const line of lines) {
    for (const item of line) {
      totalHeight += item.height;
      count++;
    }
  }

  return count > 0 ? totalHeight / count : 12;
}

/**
 * Detect figures and tables in the PDF page based on text items
 */
export function detectFiguresAndTables(
  textItems: TextItem[],
  pageNumber: number,
  pageWidth: number = 612,
  pageHeight: number = 792
): FigureTable[] {
  const results: FigureTable[] = [];
  const processedIndices = new Set<number>();

  for (let i = 0; i < textItems.length; i++) {
    if (processedIndices.has(i)) continue;

    const item = textItems[i];
    const text = item.str.trim();

    // Check for figure or table label
    let match = text.match(FIGURE_PATTERN);
    let type: 'figure' | 'table' = 'figure';

    if (!match) {
      match = text.match(TABLE_PATTERN);
      type = 'table';
    }

    if (match) {
      // IMPORTANT: Filter out inline references like "in Table 2" or "Table 2 shows..."
      // Real captions typically:
      // 1. Start at or near the beginning of a line (low X position)
      // 2. Are followed by a colon or period and description
      // 3. Are not preceded by words like "in", "see", "from", etc. on the same line

      // Check if this is likely an inline reference (not a real caption)
      const isInlineReference = (() => {
        // Check if there's text immediately before this item on the same line
        // that would indicate it's part of a sentence
        if (i > 0) {
          const prevItem = textItems[i - 1];
          const sameLineThreshold = item.height * 0.5;
          const isOnSameLine = Math.abs(prevItem.y - item.y) < sameLineThreshold;

          if (isOnSameLine) {
            // Check the gap between previous item and this one
            const gap = item.x - (prevItem.x + prevItem.width);

            // If small gap, they're part of the same sentence
            if (gap < item.height * 2) {
              // Check if previous text ends with common prepositions/articles
              const prevText = prevItem.str.trim().toLowerCase();
              const endsWithConnector = /\b(in|see|from|to|the|a|and|or|as|of|per|\()$/.test(prevText);

              // If previous word is a connector, this is an inline reference
              if (endsWithConnector) {
                return true;
              }

              // Also check if there's substantial text before on this line
              // Real captions usually start near the left margin
              // If the caption is far from the left edge and there's text before it, it's inline
              const leftMargin = pageWidth * 0.15;
              if (item.x > leftMargin && gap < item.height * 3) {
                return true;
              }
            }
          }
        }

        // Check what comes after "Table X" / "Figure X"
        // Real captions have ":" or a descriptive sentence
        // Inline references continue with verbs like "shows", "summarizes", "outperforms"
        const afterMatch = text.slice(match[0].length).trim();
        if (afterMatch) {
          // If the text continues with a verb (common in inline references)
          const startsWithVerb = /^(shows?|summarizes?|presents?|lists?|contains?|outperforms?|achieves?|compares?|describes?|illustrates?|displays?|depicts?|demonstrates?)\b/i.test(afterMatch);
          if (startsWithVerb) {
            return true;
          }
        }

        // Check if the next text item starts with a verb
        if (i < textItems.length - 1) {
          const nextItem = textItems[i + 1];
          const sameLineThreshold = item.height * 0.5;
          const isOnSameLine = Math.abs(nextItem.y - item.y) < sameLineThreshold;

          if (isOnSameLine) {
            const nextText = nextItem.str.trim().toLowerCase();
            const startsWithVerb = /^(shows?|summarizes?|presents?|lists?|contains?|outperforms?|achieves?|compares?|describes?|illustrates?|displays?|depicts?|demonstrates?)\b/.test(nextText);
            if (startsWithVerb) {
              return true;
            }
          }
        }

        return false;
      })();

      // Skip inline references
      if (isInlineReference) {
        continue;
      }

      // Extract caption
      const { caption, endIdx } = extractCaption(textItems, i, pageWidth);

      // Mark processed items
      for (let j = i; j <= endIdx; j++) {
        processedIndices.add(j);
      }

      // Get caption items for bounds calculation
      const captionItems = textItems.slice(i, endIdx + 1);

      // Estimate bounds
      const boundingRect = estimateFigureTableBounds(
        textItems,
        captionItems,
        type,
        pageWidth,
        pageHeight
      );

      if (boundingRect.width > 0 && boundingRect.height > 0) {
        const label = `${type === 'figure' ? 'Figure' : 'Table'} ${match[2]}`;

        results.push({
          id: `page-${pageNumber}-${type}-${match[2]}-${nanoid(4)}`,
          type,
          label,
          caption,
          pageNumber,
          boundingRect,
          bounds: {
            minX: boundingRect.x,
            minY: boundingRect.y,
            maxX: boundingRect.x + boundingRect.width,
            maxY: boundingRect.y + boundingRect.height,
          },
        });
      }
    }
  }

  return results;
}
