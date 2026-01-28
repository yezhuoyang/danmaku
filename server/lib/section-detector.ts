// Server-side section detection
// Ported from client/src/lib/section-detector.ts
import type { Section, TextItem } from './types.js';

/**
 * Patterns for section headers
 */
const SECTION_PATTERNS = [
  /^(\d+(?:\.\d+)*\.?)\s+([A-Z][A-Za-z\s\-:]+)$/,
  /^([A-Z](?:\.\d+)*\.?)\s+([A-Z][A-Za-z\s\-:]+)$/,
];

/**
 * Special section names that don't need numbers
 */
const SPECIAL_SECTIONS = [
  'Abstract',
  'Introduction',
  'Conclusion',
  'Conclusions',
  'References',
  'Acknowledgments',
  'Acknowledgements',
  'Appendix',
  'Appendices',
];

/**
 * Check if a line of text looks like a section header
 */
function matchSectionHeader(text: string): { number: string; title: string } | null {
  const trimmed = text.trim();

  if (!trimmed || trimmed.length > 100) return null;

  for (const pattern of SECTION_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        number: match[1].replace(/\.$/, ''),
        title: match[2].trim(),
      };
    }
  }

  for (const specialSection of SPECIAL_SECTIONS) {
    if (trimmed.toLowerCase() === specialSection.toLowerCase()) {
      return {
        number: '',
        title: specialSection,
      };
    }
  }

  return null;
}

/**
 * Group consecutive TextItems that are on the same line
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
 * Detect section headers in PDF text items
 */
export function detectSections(textItems: TextItem[], pageNumber: number): Section[] {
  if (textItems.length === 0) return [];

  const sections: Section[] = [];
  const lines = groupByLine(textItems);

  let totalHeight = 0;
  let heightCount = 0;
  for (const item of textItems) {
    if (item.height > 0) {
      totalHeight += item.height;
      heightCount++;
    }
  }
  const avgHeight = heightCount > 0 ? totalHeight / heightCount : 12;

  let tokenIdx = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineText = line.map(item => item.str).join(' ').trim();
    const lineStartTokenIdx = tokenIdx;
    const lineEndTokenIdx = tokenIdx + line.length;

    tokenIdx = lineEndTokenIdx;

    const sectionMatch = matchSectionHeader(lineText);

    if (sectionMatch) {
      const lineAvgHeight = line.reduce((sum, item) => sum + item.height, 0) / line.length;
      const isLargerFont = lineAvgHeight >= avgHeight * 0.9;
      const isShortEnough = line.length <= 15;

      let hasGapAbove = lineIdx === 0;
      if (lineIdx > 0) {
        const prevLine = lines[lineIdx - 1];
        const prevLineMaxY = Math.max(...prevLine.map(item => item.y + item.height));
        const currentLineMinY = Math.min(...line.map(item => item.y));
        const gap = currentLineMinY - prevLineMaxY;
        hasGapAbove = gap > avgHeight * 1.2;
      }

      if (isLargerFont && isShortEnough && hasGapAbove) {
        const yPosition = Math.min(...line.map(item => item.y));

        sections.push({
          id: `page-${pageNumber}-section-${sections.length}`,
          number: sectionMatch.number,
          title: sectionMatch.title,
          fullTitle: sectionMatch.number
            ? `${sectionMatch.number} ${sectionMatch.title}`
            : sectionMatch.title,
          pageNumber,
          yPosition,
          startTokenIndex: lineStartTokenIdx,
          endTokenIndex: lineEndTokenIdx,
        });
      }
    }
  }

  return sections;
}

/**
 * Find which section a sentence belongs to based on its Y position
 */
export function findSectionForPosition(
  sections: Section[],
  pageNumber: number,
  yPosition: number,
  allPageSections?: Map<number, Section[]>
): Section | null {
  const relevantSections: Section[] = [];

  if (allPageSections) {
    for (let page = 1; page <= pageNumber; page++) {
      const pageSections = allPageSections.get(page);
      if (pageSections) {
        relevantSections.push(...pageSections);
      }
    }
  } else {
    relevantSections.push(...sections.filter(s => s.pageNumber <= pageNumber));
  }

  if (relevantSections.length === 0) return null;

  relevantSections.sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) {
      return a.pageNumber - b.pageNumber;
    }
    return a.yPosition - b.yPosition;
  });

  let currentSection: Section | null = null;

  for (const section of relevantSections) {
    if (section.pageNumber < pageNumber) {
      currentSection = section;
    } else if (section.pageNumber === pageNumber) {
      if (section.yPosition <= yPosition) {
        currentSection = section;
      } else {
        break;
      }
    }
  }

  return currentSection;
}
