// Server-side sentence segmentation
// Ported from client/src/lib/sentence-segmenter.ts
import type { Sentence, TextItem, BoundingRect } from './types.js';

/**
 * Generate a deterministic ID from text and position.
 */
function generateDeterministicId(text: string, pageNumber: number, startTokenIndex: number): string {
  let hash = 0;
  const str = `${pageNumber}-${startTokenIndex}-${text.slice(0, 50)}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
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

const PARAGRAPH_GAP_MULTIPLIER = 1.8;

/**
 * Check if a punctuation mark at position `idx` in `text` is likely a sentence ending.
 */
function isSentenceEnding(text: string, idx: number): boolean {
  const char = text[idx];

  if (char !== '.' && char !== '?' && char !== '!') return false;

  const afterPunctuation = text.slice(idx + 1);

  if (afterPunctuation.trim().length === 0) {
    return true;
  }

  if (char === '?' || char === '!') {
    return /^\s+[A-Z]/.test(afterPunctuation) || afterPunctuation.trim().length === 0;
  }

  if (!/^\s+[A-Z]/.test(afterPunctuation)) {
    return false;
  }

  const beforePunctuation = text.slice(0, idx);
  const wordMatch = beforePunctuation.match(/(\w+)$/);
  if (wordMatch) {
    const word = wordMatch[1].toLowerCase();
    if (ABBREVIATIONS.has(word)) {
      return false;
    }
    if (word.length === 1 && /[A-Z]/.test(wordMatch[1])) {
      return false;
    }
  }

  if (/\d$/.test(beforePunctuation) && /^\s*\d/.test(afterPunctuation)) {
    return false;
  }

  if (text.slice(idx - 2, idx) === '..' || text.slice(idx + 1, idx + 3) === '..') {
    return false;
  }

  return true;
}

/**
 * Find paragraph break positions based on Y-coordinate gaps.
 */
function findParagraphBreaks(textItems: TextItem[]): Set<number> {
  const paragraphStarts = new Set<number>();
  paragraphStarts.add(0);

  if (textItems.length < 2) return paragraphStarts;

  let totalHeight = 0;
  let heightCount = 0;
  for (const item of textItems) {
    if (item.height > 0) {
      totalHeight += item.height;
      heightCount++;
    }
  }
  const avgLineHeight = heightCount > 0 ? totalHeight / heightCount : 12;

  const lineThreshold = avgLineHeight * 0.5;
  let lastLineY = textItems[0].y;

  for (let i = 1; i < textItems.length; i++) {
    const item = textItems[i];
    const yGap = item.y - lastLineY;

    if (Math.abs(yGap) > lineThreshold) {
      if (yGap > avgLineHeight * PARAGRAPH_GAP_MULTIPLIER) {
        paragraphStarts.add(i);
      }
      lastLineY = item.y;
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
 */
export function segmentSentences(textItems: TextItem[], pageNumber: number): Sentence[] {
  if (textItems.length === 0) return [];

  const paragraphBreaks = findParagraphBreaks(textItems);

  const charToToken: { tokenIdx: number; charInToken: number }[] = [];
  const paragraphBreakChars = new Set<number>();
  let fullText = '';

  for (let tokenIdx = 0; tokenIdx < textItems.length; tokenIdx++) {
    if (paragraphBreaks.has(tokenIdx)) {
      paragraphBreakChars.add(fullText.length);
    }

    const item = textItems[tokenIdx];
    for (let charIdx = 0; charIdx < item.str.length; charIdx++) {
      charToToken.push({ tokenIdx, charInToken: charIdx });
      fullText += item.str[charIdx];
    }
    if (tokenIdx < textItems.length - 1) {
      charToToken.push({ tokenIdx, charInToken: -1 });
      fullText += ' ';
    }
  }

  const sentenceEnds: number[] = [];

  for (let i = 0; i < fullText.length; i++) {
    if (isSentenceEnding(fullText, i)) {
      sentenceEnds.push(i);
    }
  }

  const sortedParagraphBreaks = Array.from(paragraphBreakChars).sort((a, b) => a - b);
  for (const breakChar of sortedParagraphBreaks) {
    if (breakChar > 0) {
      let endChar = breakChar - 1;
      while (endChar > 0 && /\s/.test(fullText[endChar])) {
        endChar--;
      }
      if (endChar > 0 && !sentenceEnds.includes(endChar)) {
        sentenceEnds.push(endChar);
      }
    }
  }

  sentenceEnds.sort((a, b) => a - b);

  const sentences: Sentence[] = [];
  let sentenceStart = 0;

  while (sentenceStart < fullText.length && /\s/.test(fullText[sentenceStart])) {
    sentenceStart++;
  }

  for (const endIdx of sentenceEnds) {
    if (endIdx < sentenceStart) continue;

    let actualEnd = endIdx;
    for (const breakChar of sortedParagraphBreaks) {
      if (breakChar > sentenceStart && breakChar <= endIdx) {
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

    const sentenceEndChar = actualEnd + 1;
    const sentenceText = fullText.slice(sentenceStart, sentenceEndChar).trim();

    if (sentenceText.length < 3) {
      sentenceStart = sentenceEndChar;
      while (sentenceStart < fullText.length && /\s/.test(fullText[sentenceStart])) {
        sentenceStart++;
      }
      continue;
    }

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

    sentenceStart = sentenceEndChar;
    while (sentenceStart < fullText.length && /\s/.test(fullText[sentenceStart])) {
      sentenceStart++;
    }

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
