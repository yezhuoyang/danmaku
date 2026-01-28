// Shared types for server-side PDF parsing and background reading

/**
 * Represents a bounding box in PDF coordinates
 */
export interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Text item extracted from PDF with position information
 */
export interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Section information for a sentence
 */
export interface SectionInfo {
  number: string;
  title: string;
  fullTitle: string;
}

/**
 * A sentence extracted from PDF
 */
export interface Sentence {
  id: string;
  text: string;
  pageNumber: number;
  startTokenIndex: number;
  endTokenIndex: number;
  boundingRects: BoundingRect[];
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  section?: SectionInfo;
}

/**
 * A section header in the document
 */
export interface Section {
  id: string;
  number: string;
  title: string;
  fullTitle: string;
  pageNumber: number;
  yPosition: number;
  startTokenIndex: number;
  endTokenIndex: number;
}

/**
 * Parsed page data
 */
export interface ParsedPage {
  pageNumber: number;
  textItems: TextItem[];
  width: number;
  height: number;
}

/**
 * Complete parsed PDF data
 */
export interface ParsedPdf {
  numPages: number;
  pages: ParsedPage[];
}

/**
 * Processed page with sentences and sections
 */
export interface ProcessedPage {
  pageNumber: number;
  sentences: Sentence[];
  sections: Section[];
}

/**
 * Background job status
 */
export type BackgroundJobStatus = 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
