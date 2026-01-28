// Server-side PDF parsing using pdf-parse v2
// @ts-ignore - pdf-parse doesn't have type definitions
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse, VerbosityLevel } = require('pdf-parse');
import type { TextItem, ParsedPage, ParsedPdf } from './types.js';

/**
 * Fetch PDF from ArXiv by arxiv_id
 */
export async function fetchPdfFromArxiv(arxivId: string): Promise<Buffer> {
  const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

  const response = await fetch(pdfUrl, {
    headers: {
      'User-Agent': 'PaperPilot/1.0 (Academic paper annotation tool)',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF from ArXiv: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Parse PDF and extract text with position data
 *
 * Uses pdf-parse v2 API to extract text items with positions for sentence segmentation.
 */
export async function parsePdf(buffer: Buffer): Promise<ParsedPdf> {
  const pages: ParsedPage[] = [];

  // Create PDFParse instance with the buffer
  const parser = new PDFParse({
    data: new Uint8Array(buffer),
    verbosity: VerbosityLevel.ERRORS,
  });

  try {
    // Load the document
    const doc = await parser.load();
    const numPages = doc.numPages;

    // Process each page
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.0 });
      const textContent = await page.getTextContent();

      const textItems: TextItem[] = [];

      for (const item of textContent.items) {
        if (!item.str || !item.str.trim()) continue;

        const tx = item.transform;
        // transform is [scaleX, skewY, skewX, scaleY, translateX, translateY]
        // We need to convert to page coordinates
        const x = tx[4];
        const y = viewport.height - tx[5] - Math.abs(tx[3]); // Flip Y coordinate
        const width = item.width || (item.str.length * 6); // Approximate width
        const height = Math.abs(tx[3]) || 12; // Font height

        textItems.push({
          str: item.str,
          x,
          y,
          width,
          height,
        });
      }

      pages.push({
        pageNumber: pageNum,
        textItems,
        width: viewport.width,
        height: viewport.height,
      });
    }

    // Clean up
    await parser.destroy();
  } catch (error: any) {
    throw new Error(`Failed to parse PDF: ${error.message}`);
  }

  return {
    numPages: pages.length,
    pages,
  };
}

/**
 * Simplified PDF parsing that just extracts text per page
 * Useful for quick summaries without position data
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<{ pageTexts: string[]; fullText: string }> {
  const parser = new PDFParse({
    data: new Uint8Array(buffer),
    verbosity: VerbosityLevel.ERRORS,
  });

  try {
    const doc = await parser.load();
    const numPages = doc.numPages;
    const pageTexts: string[] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await doc.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Concatenate all text items
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      pageTexts.push(pageText);
    }

    await parser.destroy();

    return {
      pageTexts,
      fullText: pageTexts.join('\n\n'),
    };
  } catch (error: any) {
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
}
