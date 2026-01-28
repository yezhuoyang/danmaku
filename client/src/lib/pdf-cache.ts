/**
 * PDF Cache Service using IndexedDB
 *
 * Stores PDF files locally in the browser for offline access.
 * PDFs are keyed by their contentHash (SHA-256 of first 100KB).
 */

const DB_NAME = 'paperpilot-pdf-cache';
const DB_VERSION = 1;
const STORE_NAME = 'pdfs';

interface CachedPdf {
  contentHash: string;
  data: ArrayBuffer;
  filename: string;
  size: number;
  cachedAt: number;
}

/**
 * Open the IndexedDB database
 */
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open PDF cache database:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'contentHash' });
        store.createIndex('cachedAt', 'cachedAt', { unique: false });
      }
    };
  });
}

/**
 * Calculate SHA-256 hash of the first 100KB of a file
 * This matches the server-side hash calculation
 */
export async function calculatePdfHash(file: File | Blob): Promise<string> {
  const slice = file.slice(0, 100 * 1024); // First 100KB
  const buffer = await slice.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Cache a PDF file in IndexedDB
 * @param contentHash - The SHA-256 hash of the PDF (first 100KB)
 * @param file - The PDF file or blob to cache
 * @param filename - Optional filename for display purposes
 */
export async function cachePdf(
  contentHash: string,
  file: File | Blob,
  filename?: string
): Promise<void> {
  try {
    const db = await openDatabase();
    const data = await file.arrayBuffer();

    const cachedPdf: CachedPdf = {
      contentHash,
      data,
      filename: filename || 'document.pdf',
      size: file.size,
      cachedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(cachedPdf);

      request.onerror = () => {
        console.error('Failed to cache PDF:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log(`PDF cached successfully: ${contentHash.slice(0, 16)}...`);
        resolve();
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error caching PDF:', error);
    // Don't throw - caching is best-effort
  }
}

/**
 * Retrieve a cached PDF from IndexedDB
 * @param contentHash - The SHA-256 hash to look up
 * @returns The PDF as a Blob, or null if not found
 */
export async function getCachedPdf(contentHash: string): Promise<Blob | null> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(contentHash);

      request.onerror = () => {
        console.error('Failed to retrieve cached PDF:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        const result = request.result as CachedPdf | undefined;
        if (result) {
          console.log(`PDF found in cache: ${contentHash.slice(0, 16)}...`);
          resolve(new Blob([result.data], { type: 'application/pdf' }));
        } else {
          resolve(null);
        }
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error retrieving cached PDF:', error);
    return null;
  }
}

/**
 * Check if a PDF is cached without loading the full data
 * @param contentHash - The SHA-256 hash to look up
 * @returns True if the PDF is cached
 */
export async function isPdfCached(contentHash: string): Promise<boolean> {
  try {
    const db = await openDatabase();

    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count(IDBKeyRange.only(contentHash));

      request.onerror = () => {
        resolve(false);
      };

      request.onsuccess = () => {
        resolve(request.result > 0);
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    return false;
  }
}

/**
 * Delete a cached PDF
 * @param contentHash - The SHA-256 hash of the PDF to delete
 */
export async function deleteCachedPdf(contentHash: string): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(contentHash);

      request.onerror = () => {
        console.error('Failed to delete cached PDF:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log(`PDF deleted from cache: ${contentHash.slice(0, 16)}...`);
        resolve();
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error deleting cached PDF:', error);
  }
}

/**
 * Clear all cached PDFs
 */
export async function clearPdfCache(): Promise<void> {
  try {
    const db = await openDatabase();

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => {
        console.error('Failed to clear PDF cache:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('PDF cache cleared');
        resolve();
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    console.error('Error clearing PDF cache:', error);
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  count: number;
  totalSize: number;
  entries: Array<{ contentHash: string; filename: string; size: number; cachedAt: number }>;
}> {
  try {
    const db = await openDatabase();

    return new Promise((resolve) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => {
        resolve({ count: 0, totalSize: 0, entries: [] });
      };

      request.onsuccess = () => {
        const results = request.result as CachedPdf[];
        const entries = results.map(r => ({
          contentHash: r.contentHash,
          filename: r.filename,
          size: r.size,
          cachedAt: r.cachedAt,
        }));
        const totalSize = results.reduce((sum, r) => sum + r.size, 0);
        resolve({ count: results.length, totalSize, entries });
      };

      transaction.oncomplete = () => {
        db.close();
      };
    });
  } catch (error) {
    return { count: 0, totalSize: 0, entries: [] };
  }
}

/**
 * Verify that a file matches the expected hash
 * @param file - The file to verify
 * @param expectedHash - The expected contentHash
 * @returns True if the file matches the expected hash
 */
export async function verifyPdfHash(file: File | Blob, expectedHash: string): Promise<boolean> {
  const actualHash = await calculatePdfHash(file);
  return actualHash === expectedHash;
}
