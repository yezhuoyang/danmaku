import { useState, useCallback, useRef, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
} from "lucide-react";
import { nanoid } from "nanoid";
import {
  AnnotationPanel,
  AnnotationDanmaku,
  Annotation,
  ANNOTATION_COLORS,
} from "./annotations";

// Set up the worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfAnnotationViewerProps {
  pdfUrl?: string;
  initialAnnotations?: Annotation[];
}

// Sample annotations for demo
const SAMPLE_ANNOTATIONS: Annotation[] = [
  {
    id: "1",
    text: "This is the key contribution of the paper - the Transformer architecture!",
    color: ANNOTATION_COLORS[4],
    userName: "Prof. Chen",
    timestamp: new Date(Date.now() - 3600000),
    pageNumber: 1,
    position: { x: 480, y: 120 },
    highlightRegion: {
      x: 180,
      y: 95,
      width: 250,
      height: 25,
      type: "text",
      label: "Title",
    },
  },
  {
    id: "2",
    latex: "\\text{Attention}(Q, K, V) = \\text{softmax}\\left(\\frac{QK^T}{\\sqrt{d_k}}\\right)V",
    text: "",
    color: ANNOTATION_COLORS[6],
    userName: "ML_Researcher",
    timestamp: new Date(Date.now() - 7200000),
    pageNumber: 1,
    position: { x: 450, y: 320 },
    highlightRegion: {
      x: 170,
      y: 280,
      width: 280,
      height: 80,
      type: "equation",
      label: "Eq. 1",
    },
  },
  {
    id: "3",
    text: "The authors are from Google Brain and Google Research - a collaboration between research teams.",
    color: ANNOTATION_COLORS[2],
    userName: "Student_Alice",
    timestamp: new Date(Date.now() - 1800000),
    pageNumber: 1,
    position: { x: 120, y: 200 },
    highlightRegion: {
      x: 180,
      y: 140,
      width: 250,
      height: 60,
      type: "text",
      label: "Authors",
    },
  },
  {
    id: "4",
    text: "The abstract clearly states the main achievement: 28.4 BLEU on WMT 2014 English-to-German!",
    color: ANNOTATION_COLORS[3],
    userName: "NLP_Expert",
    timestamp: new Date(Date.now() - 5400000),
    pageNumber: 1,
    position: { x: 480, y: 480 },
    highlightRegion: {
      x: 170,
      y: 420,
      width: 280,
      height: 100,
      type: "text",
      label: "Abstract",
    },
  },
];

export function PdfAnnotationViewer({
  pdfUrl = "/papers/attention-paper.pdf",
  initialAnnotations = SAMPLE_ANNOTATIONS,
}: PdfAnnotationViewerProps) {
  // PDF state
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(0.85);
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });

  // Annotation state
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [isCreatingMode, setIsCreatingMode] = useState(false);
  const [pendingHighlight, setPendingHighlight] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Selection state for drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setNumPages(numPages);
      setPdfLoading(false);
    },
    []
  );

  const onPageLoadSuccess = useCallback(
    ({ width, height }: { width: number; height: number }) => {
      setPageSize({ width, height });
    },
    []
  );

  const changePage = useCallback(
    (offset: number) => {
      setPageNumber((prevPage) =>
        Math.max(1, Math.min(prevPage + offset, numPages))
      );
      setSelectedAnnotationId(null);
    },
    [numPages]
  );

  const changeScale = useCallback((delta: number) => {
    setScale((prevScale) => Math.max(0.5, Math.min(prevScale + delta, 1.5)));
  }, []);

  // Handle mouse events for drawing selection
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isCreatingMode || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      setIsDrawing(true);
      setDrawStart({ x, y });
      setDrawCurrent({ x, y });
    },
    [isCreatingMode, scale]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDrawing || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      setDrawCurrent({ x, y });
    },
    [isDrawing, scale]
  );

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !drawStart || !drawCurrent) {
      setIsDrawing(false);
      return;
    }

    const minX = Math.min(drawStart.x, drawCurrent.x);
    const minY = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);

    // Only create highlight if it's big enough
    if (width > 20 && height > 10) {
      setPendingHighlight({
        x: minX,
        y: minY,
        width,
        height,
      });
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
  }, [isDrawing, drawStart, drawCurrent]);

  // Add annotation handler
  const handleAddAnnotation = useCallback(
    (newAnnotation: Omit<Annotation, "id" | "timestamp">) => {
      const annotation: Annotation = {
        ...newAnnotation,
        id: nanoid(),
        timestamp: new Date(),
      };
      setAnnotations((prev) => [...prev, annotation]);
      setSelectedAnnotationId(annotation.id);
    },
    []
  );

  // Delete annotation handler
  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setSelectedAnnotationId(null);
  }, []);

  // Get current drawing rectangle
  const getDrawingRect = () => {
    if (!drawStart || !drawCurrent) return null;
    return {
      x: Math.min(drawStart.x, drawCurrent.x) * scale,
      y: Math.min(drawStart.y, drawCurrent.y) * scale,
      width: Math.abs(drawCurrent.x - drawStart.x) * scale,
      height: Math.abs(drawCurrent.y - drawStart.y) * scale,
    };
  };

  const drawingRect = getDrawingRect();

  // Filter annotations for current page
  const pageAnnotations = annotations.filter((a) => a.pageNumber === pageNumber);

  return (
    <div className="flex h-[700px] bg-slate-100 dark:bg-slate-950 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-800">
      {/* Left Panel */}
      <AnnotationPanel
        annotations={annotations}
        selectedAnnotationId={selectedAnnotationId}
        onSelectAnnotation={setSelectedAnnotationId}
        onDeleteAnnotation={handleDeleteAnnotation}
        onAddAnnotation={handleAddAnnotation}
        currentPage={pageNumber}
        isCreatingMode={isCreatingMode}
        onToggleCreatingMode={() => {
          setIsCreatingMode(!isCreatingMode);
          setPendingHighlight(null);
        }}
        pendingHighlight={pendingHighlight}
        onClearPendingHighlight={() => setPendingHighlight(null)}
      />

      {/* Main PDF Area */}
      <div className="flex-1 flex flex-col">
        {/* PDF Controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => changePage(-1)}
              disabled={pageNumber <= 1}
              className="text-white hover:bg-slate-700 h-8 px-2"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-white min-w-[100px] text-center font-mono">
              Page {pageNumber} / {numPages || "..."}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => changePage(1)}
              disabled={pageNumber >= numPages}
              className="text-white hover:bg-slate-700 h-8 px-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-400 mr-2">
              "Attention Is All You Need" (2017)
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => changeScale(-0.1)}
              disabled={scale <= 0.5}
              className="text-white hover:bg-slate-700 h-8 px-2"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-xs text-white min-w-[45px] text-center font-mono">
              {Math.round(scale * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => changeScale(0.1)}
              disabled={scale >= 1.5}
              className="text-white hover:bg-slate-700 h-8 px-2"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* PDF Content with Annotations */}
        <div className="flex-1 overflow-auto bg-slate-900 flex justify-center p-4">
          {pdfLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-white/50 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading PDF...</span>
              </div>
            </div>
          )}

          <div
            ref={containerRef}
            className={`relative ${isCreatingMode ? "cursor-crosshair" : ""}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <Document
              file={pdfUrl}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={null}
              error={
                <div className="flex items-center justify-center h-64">
                  <div className="text-red-400 text-center">
                    <p>Failed to load PDF</p>
                    <p className="text-xs text-slate-500 mt-2">
                      Please check your connection
                    </p>
                  </div>
                </div>
              }
              className="flex justify-center"
            >
              <Page
                pageNumber={pageNumber}
                scale={scale}
                renderTextLayer={false}
                renderAnnotationLayer={false}
                className="shadow-2xl"
                loading={null}
                onLoadSuccess={onPageLoadSuccess}
              />
            </Document>

            {/* SVG Overlay for Annotations */}
            {pageSize.width > 0 && (
              <svg
                className="absolute top-0 left-0 pointer-events-none"
                width={pageSize.width * scale}
                height={pageSize.height * scale}
                style={{ overflow: "visible" }}
              >
                {/* Render existing annotations */}
                {pageAnnotations.map((annotation) => (
                  <AnnotationDanmaku
                    key={annotation.id}
                    annotation={annotation}
                    isSelected={selectedAnnotationId === annotation.id}
                    onSelect={setSelectedAnnotationId}
                    scale={scale}
                  />
                ))}

                {/* Drawing rectangle */}
                {isDrawing && drawingRect && (
                  <rect
                    x={drawingRect.x}
                    y={drawingRect.y}
                    width={drawingRect.width}
                    height={drawingRect.height}
                    fill="rgba(59, 130, 246, 0.2)"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    strokeDasharray="4,2"
                    className="pointer-events-none"
                  />
                )}

                {/* Pending highlight preview */}
                {pendingHighlight && (
                  <rect
                    x={pendingHighlight.x * scale}
                    y={pendingHighlight.y * scale}
                    width={pendingHighlight.width * scale}
                    height={pendingHighlight.height * scale}
                    fill="rgba(59, 130, 246, 0.3)"
                    stroke="#3B82F6"
                    strokeWidth={2}
                    className="pointer-events-none animate-pulse"
                  />
                )}
              </svg>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div className="px-4 py-2 bg-slate-800 border-t border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>{pageAnnotations.length} annotations on this page</span>
            {isCreatingMode && (
              <span className="text-amber-400">
                Selection mode active - drag to highlight
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {selectedAnnotationId && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-slate-400 hover:text-white"
                onClick={() => setSelectedAnnotationId(null)}
              >
                Clear selection
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
