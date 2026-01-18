import { Sentence, TextItem, BoundingRect } from '@/components/annotations/types';

/**
 * Generate a deterministic ID from text and position.
 * This ensures the same sentence always gets the same ID.
 */
function generateDeterministicId(text: string, pageNumber: number, startTokenIndex: number): string {
  // Simple hash function for strings
  let hash = 0;
  const str = `${pageNumber}-${startTokenIndex}-${text.slice(0, 50)}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  // Convert to positive hex string
  const hexHash = Math.abs(hash).toString(16).slice(0, 8).padStart(8, '0');
  return `page-${pageNumber}-sentence-${hexHash}`;
}

/**
 * Common abbreviations that should not be treated as sentence endings
 */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'vs', 'etc', 'al', 'fig', 'eq',
  'vol', 'no', 'pp', 'ed', 'eds', 'rev', 'est', 'approx', 'dept', 'univ',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec',
  'inc', 'ltd', 'corp', 'co', 'st', 'ave', 'blvd', 'rd',
]);

/**
 * Threshold for detecting paragraph breaks (in PDF units).
 * If the Y gap between consecutive lines is greater than this multiplier
 * of the average line height, it's considered a paragraph break.
 */
const PARAGRAPH_GAP_MULTIPLIER = 1.8;

/**
 * Check if a period at position `idx` in `text` is likely a sentence ending.
 */
function isSentenceEndingPeriod(text: string, idx: number): boolean {
  if (text[idx] !== '.') return false;

  const afterPeriod = text.slice(idx + 1);

  // If at end of text, it's a sentence ending
  if (afterPeriod.trim().length === 0) {
    return true;
  }

  // Must be followed by whitespace then capital letter
  if (!/^\s+[A-Z]/.test(afterPeriod)) {
    return false;
  }

  // Check for abbreviations
  const beforePeriod = text.slice(0, idx);
  const wordMatch = beforePeriod.match(/(\w+)$/);
  if (wordMatch) {
    const word = wordMatch[1].toLowerCase();
    if (ABBREVIATIONS.has(word)) {
      return false;
    }
    // Single capital letter is usually initials
    if (word.length === 1 && /[A-Z]/.test(wordMatch[1])) {
      return false;
    }
  }

  // Check for decimal numbers
  if (/\d$/.test(beforePeriod) && /^\s*\d/.test(afterPeriod)) {
    return false;
  }

  // Check for ellipsis
  if (text.slice(idx - 2, idx) === '..' || text.slice(idx + 1, idx + 3) === '..') {
    return false;
  }

  return true;
}

/**
 * Find paragraph break positions based on Y-coordinate gaps between TextItems.
 * Returns a Set of token indices where a new paragraph starts.
 */
function findParagraphBreaks(textItems: TextItem[]): Set<number> {
  const paragraphStarts = new Set<number>();
  paragraphStarts.add(0); // First token always starts a paragraph

  if (textItems.length < 2) return paragraphStarts;

  // Calculate average line height
  let totalHeight = 0;
  let heightCount = 0;
  for (const item of textItems) {
    if (item.height > 0) {
      totalHeight += item.height;
      heightCount++;
    }
  }
  const avgLineHeight = heightCount > 0 ? totalHeight / heightCount : 12;

  // Group items by approximate Y position to find line breaks
  const lineThreshold = avgLineHeight * 0.5;
  let lastLineY = textItems[0].y;
  let lastLineEndIdx = 0;

  for (let i = 1; i < textItems.length; i++) {
    const item = textItems[i];
    const yGap = item.y - lastLineY;

    // Check if this is a new line
    if (Math.abs(yGap) > lineThreshold) {
      // Check if the gap is large enough to be a paragraph break
      // This handles section titles and paragraph breaks
      if (yGap > avgLineHeight * PARAGRAPH_GAP_MULTIPLIER) {
        paragraphStarts.add(i);
      }
      lastLineY = item.y;
      lastLineEndIdx = i;
    }
  }

  return paragraphStarts;
}

/**
 * Group TextItems by line based on Y coordinate similarity
 */
function groupByLine(items: TextItem[], lineThreshold: number = 5): TextItem[][] {
  if (items.length === 0) return [];

  const lines: TextItem[][] = [];
  let currentLine: TextItem[] = [items[0]];
  let lastY = items[0].y;

  for (let i = 1; i < items.length; i++) {
    const item = items[i];
    if (Math.abs(item.y - lastY) > lineThreshold) {
      lines.push(currentLine);
      currentLine = [item];
      lastY = item.y;
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
 * Compute bounding rectangles for a range of TextItems.
 */
function computeBoundingRects(
  textItems: TextItem[],
  startIdx: number,
  endIdx: number,
  startCharOffset: number = 0,
  endCharOffset?: number
): BoundingRect[] {
  if (startIdx >= endIdx || startIdx >= textItems.length) {
    return [];
  }

  const items = textItems.slice(startIdx, endIdx);
  if (items.length === 0) return [];

  const lines = groupByLine(items);
  const rects: BoundingRect[] = [];

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const lineItems = lines[lineIdx];
    if (lineItems.length === 0) continue;

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (let i = 0; i < lineItems.length; i++) {
      const item = lineItems[i];
      let itemStartX = item.x;
      let itemEndX = item.x + item.width;

      if (lineIdx === 0 && i === 0 && startCharOffset > 0 && item.str.length > 0) {
        const charWidth = item.width / item.str.length;
        itemStartX = item.x + charWidth * startCharOffset;
      }

      const isLastLine = lineIdx === lines.length - 1;
      const isLastItem = i === lineItems.length - 1;
      if (isLastLine && isLastItem && endCharOffset !== undefined && endCharOffset < item.str.length) {
        const charWidth = item.width / item.str.length;
        itemEndX = item.x + charWidth * (endCharOffset + 1);
      }

      minX = Math.min(minX, itemStartX);
      maxX = Math.max(maxX, itemEndX);
      minY = Math.min(minY, item.y);
      maxY = Math.max(maxY, item.y + item.height);
    }

    if (minX !== Infinity && maxX !== -Infinity) {
      rects.push({
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      });
    }
  }

  return rects;
}

/**
 * Segment TextItems into sentences with bounding rectangles.
 *
 * Sentence boundaries:
 * - A sentence ENDS at:
 *   1. A period (.) followed by whitespace and a capital letter
 *   2. The end of a paragraph (before a section title or large gap)
 * - A sentence STARTS at:
 *   1. The beginning of a paragraph
 *   2. Right after the previous sentence's period
 */
export function segmentSentences(textItems: TextItem[], pageNumber: number): Sentence[] {
  if (textItems.length === 0) return [];

  // Find paragraph breaks based on Y-coordinate gaps
  const paragraphBreaks = findParagraphBreaks(textItems);

  // Build concatenated text with character-to-token mapping
  // Also track where paragraph breaks occur in the character stream
  const charToToken: { tokenIdx: number; charInToken: number }[] = [];
  const paragraphBreakChars = new Set<number>(); // Character indices where paragraphs start
  let fullText = '';

  for (let tokenIdx = 0; tokenIdx < textItems.length; tokenIdx++) {
    // Mark paragraph break at the start of this token
    if (paragraphBreaks.has(tokenIdx)) {
      paragraphBreakChars.add(fullText.length);
    }

    const item = textItems[tokenIdx];
    for (let charIdx = 0; charIdx < item.str.length; charIdx++) {
      charToToken.push({ tokenIdx, charInToken: charIdx });
      fullText += item.str[charIdx];
    }
    // Add space between tokens
    if (tokenIdx < textItems.length - 1) {
      charToToken.push({ tokenIdx, charInToken: -1 });
      fullText += ' ';
    }
  }

  // Find all sentence-ending positions
  // A sentence ends at:
  // 1. A period that marks a sentence end
  // 2. Just before a paragraph break (even without a period)
  const sentenceEnds: number[] = [];

  for (let i = 0; i < fullText.length; i++) {
    if (isSentenceEndingPeriod(fullText, i)) {
      sentenceEnds.push(i);
    }
  }

  // Also add implicit sentence ends before paragraph breaks
  // (for text that doesn't end with a period, like before a section title)
  const sortedParagraphBreaks = Array.from(paragraphBreakChars).sort((a, b) => a - b);
  for (const breakChar of sortedParagraphBreaks) {
    if (breakChar > 0) {
      // Find the last non-whitespace character before this paragraph break
      let endChar = breakChar - 1;
      while (endChar > 0 && /\s/.test(fullText[endChar])) {
        endChar--;
      }
      // Only add if it's not already a period-based sentence end
      if (endChar > 0 && !sentenceEnds.includes(endChar)) {
        sentenceEnds.push(endChar);
      }
    }
  }

  // Sort all sentence ends
  sentenceEnds.sort((a, b) => a - b);

  // Create sentences
  const sentences: Sentence[] = [];
  let sentenceStart = 0;

  // Skip leading whitespace
  while (sentenceStart < fullText.length && /\s/.test(fullText[sentenceStart])) {
    sentenceStart++;
  }

  for (const endIdx of sentenceEnds) {
    if (endIdx < sentenceStart) continue;

    // Check if there's a paragraph break between sentenceStart and endIdx
    // If so, we should split at the paragraph break first
    let actualEnd = endIdx;
    for (const breakChar of sortedParagraphBreaks) {
      if (breakChar > sentenceStart && breakChar <= endIdx) {
        // There's a paragraph break in the middle - end the sentence before it
        let preBreakEnd = breakChar - 1;
        while (preBreakEnd > sentenceStart && /\s/.test(fullText[preBreakEnd])) {
          preBreakEnd--;
        }
        if (preBreakEnd > sentenceStart) {
          actualEnd = preBreakEnd;
          break;
        }
      }
    }

    // The sentence includes the end character
    const sentenceEndChar = actualEnd + 1;
    const sentenceText = fullText.slice(sentenceStart, sentenceEndChar).trim();

    if (sentenceText.length < 3) {
      sentenceStart = sentenceEndChar;
      while (sentenceStart < fullText.length && /\s/.test(fullText[sentenceStart])) {
        sentenceStart++;
      }
      continue;
    }

    // Find the token range
    const startMapping = charToToken[sentenceStart];
    const endMapping = charToToken[actualEnd];

    if (!startMapping || !endMapping) {
      sentenceStart = sentenceEndChar;
      while (sentenceStart < fullText.length && /\s/.test(fullText[sentenceStart])) {
        sentenceStart++;
      }
      continue;
    }

    const startTokenIdx = startMapping.tokenIdx;
    const endTokenIdx = endMapping.tokenIdx + 1;

    // Compute bounding rectangles
    const boundingRects = computeBoundingRects(
      textItems,
      startTokenIdx,
      endTokenIdx,
      startMapping.charInToken >= 0 ? startMapping.charInToken : 0,
      endMapping.charInToken >= 0 ? endMapping.charInToken : undefined
    );

    if (boundingRects.length > 0) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const rect of boundingRects) {
        minX = Math.min(minX, rect.x);
        minY = Math.min(minY, rect.y);
        maxX = Math.max(maxX, rect.x + rect.width);
        maxY = Math.max(maxY, rect.y + rect.height);
      }

      sentences.push({
        id: generateDeterministicId(sentenceText, pageNumber, startTokenIdx),
        text: sentenceText,
        pageNumber,
        startTokenIndex: startTokenIdx,
        endTokenIndex: endTokenIdx,
        boundingRects,
        bounds: { minX, minY, maxX, maxY },
      });
    }

    // Move to next sentence
    sentenceStart = sentenceEndChar;
    while (sentenceStart < fullText.length && /\s/.test(fullText[sentenceStart])) {
      sentenceStart++;
    }

    // If we hit a paragraph break, jump to it
    for (const breakChar of sortedParagraphBreaks) {
      if (breakChar > actualEnd && breakChar <= sentenceStart + 1) {
        sentenceStart = breakChar;
        while (sentenceStart < fullText.length && /\s/.test(fullText[sentenceStart])) {
          sentenceStart++;
        }
        break;
      }
    }
  }

  // Handle remaining text
  if (sentenceStart < fullText.length) {
    const remainingText = fullText.slice(sentenceStart).trim();
    if (remainingText.length >= 3) {
      const startMapping = charToToken[sentenceStart];
      if (startMapping) {
        const startTokenIdx = startMapping.tokenIdx;
        const endTokenIdx = textItems.length;

        const boundingRects = computeBoundingRects(
          textItems,
          startTokenIdx,
          endTokenIdx,
          startMapping.charInToken >= 0 ? startMapping.charInToken : 0
        );

        if (boundingRects.length > 0) {
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
          for (const rect of boundingRects) {
            minX = Math.min(minX, rect.x);
            minY = Math.min(minY, rect.y);
            maxX = Math.max(maxX, rect.x + rect.width);
            maxY = Math.max(maxY, rect.y + rect.height);
          }

          sentences.push({
            id: generateDeterministicId(remainingText, pageNumber, startTokenIdx),
            text: remainingText,
            pageNumber,
            startTokenIndex: startTokenIdx,
            endTokenIndex: endTokenIdx,
            boundingRects,
            bounds: { minX, minY, maxX, maxY },
          });
        }
      }
    }
  }

  return sentences;
}
