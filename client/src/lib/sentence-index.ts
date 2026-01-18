import { Sentence } from '@/components/annotations/types';

/**
 * Spatial hash index for efficient sentence lookup by coordinates.
 * Uses a grid-based approach for O(1) average case lookup.
 */
export class SentenceIndex {
  private gridCellSize: number;
  private grid: Map<string, Sentence[]>;
  private scale: number;

  constructor(sentences: Sentence[], scale: number = 1, gridCellSize: number = 50) {
    this.gridCellSize = gridCellSize;
    this.scale = scale;
    this.grid = new Map();
    this.buildIndex(sentences);
  }

  /**
   * Get the grid cell key for a coordinate
   */
  private getCellKey(x: number, y: number): string {
    const cellX = Math.floor(x / this.gridCellSize);
    const cellY = Math.floor(y / this.gridCellSize);
    return `${cellX},${cellY}`;
  }

  /**
   * Build the spatial index from sentences
   */
  private buildIndex(sentences: Sentence[]): void {
    for (const sentence of sentences) {
      // Get all grid cells this sentence overlaps
      for (const rect of sentence.boundingRects) {
        const scaledRect = {
          x: rect.x * this.scale,
          y: rect.y * this.scale,
          width: rect.width * this.scale,
          height: rect.height * this.scale,
        };

        const startCellX = Math.floor(scaledRect.x / this.gridCellSize);
        const endCellX = Math.floor((scaledRect.x + scaledRect.width) / this.gridCellSize);
        const startCellY = Math.floor(scaledRect.y / this.gridCellSize);
        const endCellY = Math.floor((scaledRect.y + scaledRect.height) / this.gridCellSize);

        for (let cx = startCellX; cx <= endCellX; cx++) {
          for (let cy = startCellY; cy <= endCellY; cy++) {
            const key = `${cx},${cy}`;
            if (!this.grid.has(key)) {
              this.grid.set(key, []);
            }
            const cell = this.grid.get(key)!;
            // Avoid duplicate entries
            if (!cell.includes(sentence)) {
              cell.push(sentence);
            }
          }
        }
      }
    }
  }

  /**
   * Find the sentence at the given screen coordinates.
   * @param x Screen X coordinate
   * @param y Screen Y coordinate
   * @returns The sentence at this position, or null if none found
   */
  findSentenceAt(x: number, y: number): Sentence | null {
    const key = this.getCellKey(x, y);
    const candidates = this.grid.get(key) || [];

    for (const sentence of candidates) {
      for (const rect of sentence.boundingRects) {
        const scaledRect = {
          x: rect.x * this.scale,
          y: rect.y * this.scale,
          width: rect.width * this.scale,
          height: rect.height * this.scale,
        };

        if (
          x >= scaledRect.x &&
          x <= scaledRect.x + scaledRect.width &&
          y >= scaledRect.y &&
          y <= scaledRect.y + scaledRect.height
        ) {
          return sentence;
        }
      }
    }

    return null;
  }

  /**
   * Find all sentences that overlap with the given rectangle
   */
  findSentencesInRect(
    x: number,
    y: number,
    width: number,
    height: number
  ): Sentence[] {
    const found = new Set<Sentence>();

    const startCellX = Math.floor(x / this.gridCellSize);
    const endCellX = Math.floor((x + width) / this.gridCellSize);
    const startCellY = Math.floor(y / this.gridCellSize);
    const endCellY = Math.floor((y + height) / this.gridCellSize);

    for (let cx = startCellX; cx <= endCellX; cx++) {
      for (let cy = startCellY; cy <= endCellY; cy++) {
        const key = `${cx},${cy}`;
        const candidates = this.grid.get(key) || [];
        for (const sentence of candidates) {
          found.add(sentence);
        }
      }
    }

    return Array.from(found);
  }

  /**
   * Update the scale and rebuild the index
   */
  updateScale(sentences: Sentence[], newScale: number): void {
    this.scale = newScale;
    this.grid.clear();
    this.buildIndex(sentences);
  }
}
