import { TextItem } from '@/components/annotations/types';

/**
 * Represents a section header in the document
 */
export interface Section {
  /** Unique identifier */
  id: string;
  /** Section number (e.g., "1", "2.1", "A.1") */
  number: string;
  /** Section title (e.g., "Introduction", "Related Work") */
  title: string;
  /** Full text (number + title) */
  fullTitle: string;
  /** Page number where section starts */
  pageNumber: number;
  /** Y position of the section header */
  yPosition: number;
  /** Token index range */
  startTokenIndex: number;
  endTokenIndex: number;
}

/**
 * Patterns for section headers
 * Matches formats like:
 * - "1 Introduction"
 * - "2.1 Background"
 * - "A.1 Appendix Section"
 * - "1. Introduction" (with dot after number)
 * - "Abstract" (special case, no number)
 */
const SECTION_PATTERNS = [
  // Numbered sections: "1 Introduction", "2.1 Background", "A.1 Details"
  /^(\d+(?:\.\d+)*\.?)\s+([A-Z][A-Za-z\s\-:]+)$/,
  // Lettered sections: "A Introduction", "B.1 Details"
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

  // Skip empty or very long text (not a header)
  if (!trimmed || trimmed.length > 100) return null;

  // Try numbered patterns
  for (const pattern of SECTION_PATTERNS) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        number: match[1].replace(/\.$/, ''), // Remove trailing dot
        title: match[2].trim(),
      };
    }
  }

  // Check for special sections without numbers
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

  // Calculate average text height for comparison
  let totalHeight = 0;
  let heightCount = 0;
  for (const item of textItems) {
    if (item.height > 0) {
      totalHeight += item.height;
      heightCount++;
    }
  }
  const avgHeight = heightCount > 0 ? totalHeight / heightCount : 12;

  // Track token indices
  let tokenIdx = 0;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const line = lines[lineIdx];
    const lineText = line.map(item => item.str).join(' ').trim();
    const lineStartTokenIdx = tokenIdx;
    const lineEndTokenIdx = tokenIdx + line.length;

    // Update token index for next iteration
    tokenIdx = lineEndTokenIdx;

    // Check if this line matches a section header pattern
    const sectionMatch = matchSectionHeader(lineText);

    if (sectionMatch) {
      // Additional heuristics for section detection:
      // 1. Section headers often have larger font (check height)
      // 2. Section headers are usually preceded/followed by larger gaps
      // 3. Section headers are relatively short

      const lineAvgHeight = line.reduce((sum, item) => sum + item.height, 0) / line.length;
      const isLargerFont = lineAvgHeight >= avgHeight * 0.9; // Allow some tolerance
      const isShortEnough = line.length <= 15; // Not too many items

      // Check for gap above this line
      let hasGapAbove = lineIdx === 0; // First line is valid
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
 * Returns the section that starts before the sentence's Y position
 */
export function findSectionForPosition(
  sections: Section[],
  pageNumber: number,
  yPosition: number,
  allPageSections?: Map<number, Section[]>
): Section | null {
  // Get sections for this page and all previous pages
  const relevantSections: Section[] = [];

  if (allPageSections) {
    // Collect sections from all pages up to and including current page
    for (let page = 1; page <= pageNumber; page++) {
      const pageSections = allPageSections.get(page);
      if (pageSections) {
        relevantSections.push(...pageSections);
      }
    }
  } else {
    // Only use provided sections (assumed to be for current page)
    relevantSections.push(...sections.filter(s => s.pageNumber <= pageNumber));
  }

  if (relevantSections.length === 0) return null;

  // Sort by page then Y position
  relevantSections.sort((a, b) => {
    if (a.pageNumber !== b.pageNumber) {
      return a.pageNumber - b.pageNumber;
    }
    return a.yPosition - b.yPosition;
  });

  // Find the last section that starts before the given position
  let currentSection: Section | null = null;

  for (const section of relevantSections) {
    if (section.pageNumber < pageNumber) {
      // Section from earlier page - always valid
      currentSection = section;
    } else if (section.pageNumber === pageNumber) {
      // Section on same page - check Y position
      if (section.yPosition <= yPosition) {
        currentSection = section;
      } else {
        // This section starts after our position, stop looking
        break;
      }
    }
  }

  return currentSection;
}
