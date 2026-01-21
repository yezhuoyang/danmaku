import { useState, useCallback, useRef, useEffect, useMemo, memo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";
import type { PDFDocumentProxy } from "pdfjs-dist";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "./pdf-styles.css";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Square,
  AlignLeft,
  Bot,
  PanelRightClose,
  PanelRightOpen,
  Maximize2,
  Minimize2,
  Sparkles,
  Loader2,
  AlertCircle,
  Bug,
  StopCircle,
  RotateCcw,
  Image,
  X,
  Trash2,
  Edit2,
  Hand,
  MousePointer2,
  Rows3,
  GalleryHorizontal,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { nanoid } from "nanoid";
import {
  AnnotationPanel,
  AnnotationDanmaku,
  Annotation,
  ANNOTATION_COLORS,
  SentenceHighlightLayer,
  SentenceDiscussionPanel,
  FigureTableHighlightLayer,
  FigureTableDiscussionPanel,
} from "./annotations";
import { Sentence, SentenceAnnotation, SentenceAnnotationReply, FigureTableAnnotation } from "./annotations/types";
import { AICompanionPanel } from "./ai";
import { AIDebugPanel, AIDebugEntry, AIDebugStats, createEmptyStats } from "./ai/AIDebugPanel";
import { PaperContent } from "@/lib/ai-service";
import { segmentSentences } from "@/lib/sentence-segmenter";
import { SentenceIndex } from "@/lib/sentence-index";
import { FigureTable } from "@/lib/figure-table-detector";
import type { FigureTableRegion, AiAgentHistory, AiSentenceAnalysisData, AiFigureTableAnalysisData } from "../../../shared/types";
import { detectSections, findSectionForPosition, Section } from "@/lib/section-detector";
import {
  aiDocumentAnnotator,
  sentencesToAIFormat,
  figureTablesToAIFormat,
  SentenceLabel,
  FigureTableLabel,
} from "@/lib/ai-document-annotator";
import { aiService } from "@/lib/ai-service";
import * as api from "@/lib/api";

// Set up the worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PdfAnnotationViewerProps {
  pdfUrl?: string;
  paperId?: string; // Paper ID for API calls
  paperTitle?: string; // Paper title for display
  initialAnnotations?: Annotation[];
  initialSentenceComments?: Map<string, SentenceAnnotation[]>; // Pre-loaded sentence comments from API
  onAnnotationAdded?: (annotation: Annotation) => void;
  onAnnotationDeleted?: (annotationId: string) => void;
  onCommentAdded?: (comment: { id: string; type: 'sentence' | 'figure' | 'reply'; targetId: string; text: string; userName: string; pageNumber: number }) => void;
  onCommentDeleted?: (commentId: string) => void;
  currentUserName?: string; // Current logged-in user's display name
  currentUserId?: string; // Current logged-in user's ID
  // Figure/Table region props
  figureTableRegions?: FigureTableRegion[]; // User-defined regions from API
  isUploader?: boolean; // Whether current user is the paper uploader
  onRegionCreated?: (region: { pageNumber: number; type: 'figure' | 'table'; label: string; caption?: string; boundingRect: { x: number; y: number; width: number; height: number } }) => void;
  onRegionUpdated?: (regionId: string, updates: { label?: string; caption?: string; boundingRect?: { x: number; y: number; width: number; height: number } }) => void;
  onRegionDeleted?: (regionId: string) => void;
  // AI Agent session props
  activeSession?: AiAgentHistory | null; // The currently active AI session for this user
  onAiAnalysisSaved?: (
    sentenceAnalysis: Record<string, AiSentenceAnalysisData>,
    figureTableAnalysis: Record<string, AiFigureTableAnalysisData>
  ) => void; // Called when AI analysis is complete
  onSessionUpdated?: (session: AiAgentHistory) => void; // Called when session is updated (e.g., after reading completes)
}

// Text item with coordinates extracted from PDF
interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  height: number;
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

type SelectionMode = "region" | "sentence" | "figure-table";

// Simple cached page component - uses react-pdf's built-in caching
// The key optimization is keeping the Page component mounted when possible
interface CachedPageProps {
  pageNumber: number;
  scale: number;
  width: number;
  height: number;
  pdfUrl: string;
  onLoadSuccess?: (page: any) => void;
}

const CachedPage = memo(function CachedPage({
  pageNumber,
  scale,
  width,
  height,
  pdfUrl,
  onLoadSuccess
}: CachedPageProps) {
  return (
    <Page
      pageNumber={pageNumber}
      scale={scale}
      renderTextLayer={true}
      renderAnnotationLayer={true}
      className="shadow-2xl pdf-page-with-text"
      loading={
        <div
          className="flex items-center justify-center bg-slate-800 rounded-lg"
          style={{ width: width * scale || 600, height: height * scale || 800 }}
        >
          <div className="text-white/50 flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Page {pageNumber}</span>
          </div>
        </div>
      }
      onLoadSuccess={onLoadSuccess}
    />
  );
}, (prevProps, nextProps) => {
  // Only re-render when these change
  return prevProps.pageNumber === nextProps.pageNumber &&
         prevProps.scale === nextProps.scale &&
         prevProps.pdfUrl === nextProps.pdfUrl;
});

// Memoized page wrapper for vertical mode - includes page + overlays
interface VerticalPageWrapperProps {
  pageNum: number;
  scale: number;
  pdfUrl: string;
  pageSize: { width: number; height: number };
  thisPageSize: { width: number; height: number };
  shouldRender: boolean;
  pageSentences: Sentence[];
  pageFigureTables: FigureTable[];
  pageAnnotations: Annotation[];
  isInteractionDisabled: boolean;
  hoveredSentenceId: string | null;
  selectedSentenceId: string | null;
  hoveredFigureTableId: string | null;
  selectedFigureTableId: string | null;
  selectedAnnotationId: string | null;
  sentenceAnnotationCounts: Map<string, number>;
  figureTableAnnotationCounts: Map<string, number>;
  isCreatingMode: boolean;
  selectionMode: SelectionMode;
  isUploader: boolean;
  currentUserName?: string;
  currentUserId?: string;
  onSentenceHover: (id: string | null) => void;
  onSentenceClick: (id: string) => void;
  onFigureTableHover: (id: string | null) => void;
  onFigureTableClick: (id: string) => void;
  onAnnotationSelect: (id: string | null) => void;
  onAnnotationDelete: (id: string) => void;
  onAnnotationHide: (id: string) => void;
  onAnnotationEdit: (id: string, newText: string, newLatex?: string) => void;
  onAnnotationPositionChange: (id: string, position: { x: number; y: number }) => void;
  onRegionDeleted?: (id: string) => void;
  onPageLoad: (pageNum: number, page: any) => void;
  containerRef: React.RefObject<HTMLElement>;
  setPageRef: (pageNum: number, el: HTMLDivElement | null) => void;
  // Figure/Table drawing mode props
  isFigureTableMode?: boolean;
  onDrawStart?: (pageNum: number, x: number, y: number) => void;
  onDrawMove?: (x: number, y: number) => void;
  onDrawEnd?: () => void;
  isDrawing?: boolean;
  drawingPageNum?: number | null;
  drawingRect?: { x: number; y: number; width: number; height: number } | null;
}

const VerticalPageWrapper = memo(function VerticalPageWrapper({
  pageNum,
  scale,
  pdfUrl,
  pageSize,
  thisPageSize,
  shouldRender,
  pageSentences,
  pageFigureTables,
  pageAnnotations,
  isInteractionDisabled,
  hoveredSentenceId,
  selectedSentenceId,
  hoveredFigureTableId,
  selectedFigureTableId,
  selectedAnnotationId,
  sentenceAnnotationCounts,
  figureTableAnnotationCounts,
  isCreatingMode,
  selectionMode,
  isUploader,
  currentUserName,
  currentUserId,
  onSentenceHover,
  onSentenceClick,
  onFigureTableHover,
  onFigureTableClick,
  onAnnotationSelect,
  onAnnotationDelete,
  onAnnotationHide,
  onAnnotationEdit,
  onAnnotationPositionChange,
  onRegionDeleted,
  onPageLoad,
  containerRef,
  setPageRef,
  // Figure/Table drawing mode props
  isFigureTableMode,
  onDrawStart,
  onDrawMove,
  onDrawEnd,
  isDrawing,
  drawingPageNum,
  drawingRect,
}: VerticalPageWrapperProps) {
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPageRef(pageNum, pageRef.current);
    return () => setPageRef(pageNum, null);
  }, [pageNum, setPageRef]);

  const handlePageLoad = useCallback((page: any) => {
    onPageLoad(pageNum, page);
  }, [pageNum, onPageLoad]);

  // Mouse handlers for figure/table drawing
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isFigureTableMode || !isUploader || !pageRef.current || !onDrawStart) return;

    // Don't start drawing if clicking on an annotation
    const target = e.target as HTMLElement;
    if (target.closest('.annotation-group') || target.closest('[data-annotation]')) return;

    const rect = pageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    onDrawStart(pageNum, x, y);
  }, [isFigureTableMode, isUploader, scale, pageNum, onDrawStart]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || drawingPageNum !== pageNum || !pageRef.current || !onDrawMove) return;

    const rect = pageRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    onDrawMove(x, y);
  }, [isDrawing, drawingPageNum, pageNum, scale, onDrawMove]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || drawingPageNum !== pageNum || !onDrawEnd) return;
    onDrawEnd();
  }, [isDrawing, drawingPageNum, pageNum, onDrawEnd]);

  // Always show interactive overlay if we have sentence data, even when page isn't fully rendered
  const hasInteractiveData = pageSentences.length > 0 || pageFigureTables.length > 0;

  // Check if this page is currently being drawn on
  const isDrawingOnThisPage = isDrawing && drawingPageNum === pageNum;

  if (!shouldRender) {
    return (
      <div
        ref={pageRef}
        className="mb-4 relative"
        data-page-number={pageNum}
        style={{
          minHeight: pageSize.height * scale || 800,
          minWidth: pageSize.width * scale || 600,
        }}
      >
        <div
          className="flex items-center justify-center bg-slate-800 rounded-lg shadow-2xl"
          style={{ width: pageSize.width * scale || 600, height: pageSize.height * scale || 800 }}
        >
          <div className="text-white/30 text-xs">Page {pageNum}</div>
        </div>

        {/* Show interactive overlay even for non-rendered pages if we have data */}
        {hasInteractiveData && thisPageSize.width > 0 && !isInteractionDisabled && (
          <svg
            className="absolute top-0 left-0"
            width={thisPageSize.width * scale}
            height={thisPageSize.height * scale}
            style={{
              overflow: "visible",
              pointerEvents: "none",
              zIndex: 10,
            }}
          >
            <SentenceHighlightLayer
              sentences={pageSentences}
              hoveredSentenceId={hoveredSentenceId}
              selectedSentenceId={selectedSentenceId}
              scale={scale}
              onSentenceHover={onSentenceHover}
              onSentenceClick={onSentenceClick}
              sentenceAnnotationCounts={sentenceAnnotationCounts}
              isAnnotationMode={isCreatingMode && selectionMode === "sentence"}
            />
            <FigureTableHighlightLayer
              figureTables={pageFigureTables}
              hoveredId={hoveredFigureTableId}
              selectedId={selectedFigureTableId}
              scale={scale}
              onHover={onFigureTableHover}
              onClick={onFigureTableClick}
              discussionCounts={figureTableAnnotationCounts}
              isAnnotationMode={isCreatingMode}
              isUploader={isUploader}
              onDelete={onRegionDeleted}
            />
          </svg>
        )}

        <div className="absolute bottom-2 right-2 bg-slate-800/80 text-white text-xs px-2 py-1 rounded z-20">
          {pageNum}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={pageRef}
      className={`mb-4 relative ${isFigureTableMode && isUploader ? 'cursor-crosshair' : ''}`}
      data-page-number={pageNum}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <CachedPage
        pageNumber={pageNum}
        scale={scale}
        pdfUrl={pdfUrl}
        width={pageSize.width}
        height={pageSize.height}
        onLoadSuccess={handlePageLoad}
      />

      {/* SVG Overlay for this page */}
      {thisPageSize.width > 0 && !isInteractionDisabled && (
        <svg
          className="absolute top-0 left-0"
          width={thisPageSize.width * scale}
          height={thisPageSize.height * scale}
          style={{
            overflow: "visible",
            pointerEvents: "none",
            zIndex: 10,
          }}
        >
          <SentenceHighlightLayer
            sentences={pageSentences}
            hoveredSentenceId={hoveredSentenceId}
            selectedSentenceId={selectedSentenceId}
            scale={scale}
            onSentenceHover={onSentenceHover}
            onSentenceClick={onSentenceClick}
            sentenceAnnotationCounts={sentenceAnnotationCounts}
            isAnnotationMode={isCreatingMode && selectionMode === "sentence"}
          />

          <FigureTableHighlightLayer
            figureTables={pageFigureTables}
            hoveredId={hoveredFigureTableId}
            selectedId={selectedFigureTableId}
            scale={scale}
            onHover={onFigureTableHover}
            onClick={onFigureTableClick}
            discussionCounts={figureTableAnnotationCounts}
            isAnnotationMode={isCreatingMode}
            isUploader={isUploader}
            onDelete={onRegionDeleted}
          />

          {/* Drawing rectangle for figure/table region */}
          {isDrawingOnThisPage && drawingRect && (
            <rect
              x={drawingRect.x}
              y={drawingRect.y}
              width={drawingRect.width}
              height={drawingRect.height}
              fill="rgba(16, 185, 129, 0.2)"
              stroke="#10B981"
              strokeWidth={2}
              strokeDasharray="4,2"
              className="pointer-events-none"
            />
          )}

          {pageAnnotations.map((annotation) => (
            <AnnotationDanmaku
              key={annotation.id}
              annotation={annotation}
              isSelected={selectedAnnotationId === annotation.id}
              onSelect={onAnnotationSelect}
              onDelete={onAnnotationDelete}
              onHide={onAnnotationHide}
              onEdit={onAnnotationEdit}
              onPositionChange={onAnnotationPositionChange}
              scale={scale}
              containerRef={containerRef}
              currentUserName={currentUserName}
              currentUserId={currentUserId}
            />
          ))}
        </svg>
      )}

      <div className="absolute bottom-2 right-2 bg-slate-800/80 text-white text-xs px-2 py-1 rounded z-20">
        {pageNum}
      </div>
    </div>
  );
});

export function PdfAnnotationViewer({
  pdfUrl = "/papers/attention-paper.pdf",
  paperId,
  paperTitle,
  initialAnnotations = SAMPLE_ANNOTATIONS,
  initialSentenceComments,
  onAnnotationAdded,
  onAnnotationDeleted,
  onCommentAdded,
  onCommentDeleted,
  currentUserName,
  currentUserId,
  figureTableRegions = [],
  isUploader = false,
  onRegionCreated,
  onRegionUpdated,
  onRegionDeleted,
  activeSession,
  onAiAnalysisSaved,
  onSessionUpdated,
}: PdfAnnotationViewerProps) {
  // PDF state
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(0.85);
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 });
  const [pageText, setPageText] = useState<string>("");
  // Store PDF document reference for resolving destinations
  const pdfDocRef = useRef<any>(null);

  // View mode state: 'horizontal' (single page) or 'vertical' (continuous scroll)
  const [viewMode, setViewMode] = useState<'horizontal' | 'vertical'>('horizontal');
  // Ref for scroll container in vertical mode
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Refs for each page in vertical mode to track visibility
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  // Store page sizes for each page in vertical mode
  const [pageSizes, setPageSizes] = useState<Map<number, { width: number; height: number }>>(new Map());
  // Track which pages have been rendered - once rendered, stays cached (never unloaded)
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set([1, 2, 3]));
  // Track visited pages in horizontal mode to keep them cached (rendered but hidden)
  const [visitedPages, setVisitedPages] = useState<Set<number>>(new Set([1]));

  // Store text items with their positions for accurate text search
  const [textItems, setTextItems] = useState<TextItem[]>([]);
  // Store text items per page for vertical mode
  const [textItemsPerPage, setTextItemsPerPage] = useState<Map<number, TextItem[]>>(new Map());
  // Store sentences per page for vertical mode
  const [sentencesPerPage, setSentencesPerPage] = useState<Map<number, Sentence[]>>(new Map());
  // Store figure/tables per page for vertical mode
  const [figureTablesPerPage, setFigureTablesPerPage] = useState<Map<number, FigureTable[]>>(new Map());
  // Track pages being extracted to prevent duplicate extractions (ref to avoid stale closure issues)
  const extractingPagesRef = useRef<Set<number>>(new Set());

  // Annotation state
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);
  const [hiddenAnnotationIds, setHiddenAnnotationIds] = useState<Set<string>>(new Set());
  const [isCreatingMode, setIsCreatingMode] = useState(false);
  const [isFigureTableMode, setIsFigureTableMode] = useState(false); // Separate mode for Figure/Table creation
  const [isInteractionDisabled, setIsInteractionDisabled] = useState(false); // Disable all overlays for pure reading
  const [selectionMode, setSelectionMode] = useState<SelectionMode>("sentence");
  const [pendingHighlight, setPendingHighlight] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    selectedText?: string;
    // Sentence data for sentence-based annotations
    sentenceData?: {
      sentenceId: string;
      sentenceText: string;
      boundingRects: Array<{ x: number; y: number; width: number; height: number }>;
      section?: {
        number: string;
        title: string;
        fullTitle: string;
      };
    };
    // Figure/Table data for figure/table-based annotations
    figureTableData?: {
      figureTableId: string;
      type: 'figure' | 'table';
      label: string;
      caption: string;
      boundingRect: { x: number; y: number; width: number; height: number };
    };
  } | null>(null);

  // AI Panel state
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);

  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const viewerRef = useRef<HTMLDivElement>(null);

  // Sentence-level annotation state
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [sentenceIndex, setSentenceIndex] = useState<SentenceIndex | null>(null);
  const [hoveredSentenceId, setHoveredSentenceId] = useState<string | null>(null);
  const [selectedSentenceId, setSelectedSentenceId] = useState<string | null>(null);
  const [showDiscussionPanel, setShowDiscussionPanel] = useState(false);
  const [sentenceAnnotations, setSentenceAnnotations] = useState<Map<string, SentenceAnnotation[]>>(
    initialSentenceComments || new Map()
  );

  // Section detection state - tracks sections across all pages
  const [allPageSections, setAllPageSections] = useState<Map<number, Section[]>>(new Map());

  // Figure/Table annotation state
  const [figureTables, setFigureTables] = useState<FigureTable[]>([]);
  const [hoveredFigureTableId, setHoveredFigureTableId] = useState<string | null>(null);
  const [selectedFigureTableId, setSelectedFigureTableId] = useState<string | null>(null);
  const [showFigureTableDiscussionPanel, setShowFigureTableDiscussionPanel] = useState(false);
  const [figureTableAnnotations, setFigureTableAnnotations] = useState<Map<string, FigureTableAnnotation[]>>(new Map());

  // Pending figure/table region creation state (for uploader)
  const [pendingRegion, setPendingRegion] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    type: 'figure' | 'table';
    label: string;
    caption: string;
    pageNumber?: number; // For vertical mode, track which page the region is on
  } | null>(null);

  // AI Document Analysis state (for "Let Agent Read" feature)
  const [isAgentReading, setIsAgentReading] = useState(false);
  const [agentHasRead, setAgentHasRead] = useState(false); // Track if agent has read entire paper

  // AI Follow-up prompt template (user can customize this)
  const [aiFollowUpPromptTemplate, setAiFollowUpPromptTemplate] = useState<string>(
`The user has a question "{{QUESTION}}" in Section "{{SECTION}}", for sentence: "{{SENTENCE}}"

{{ANALYSIS_CONTEXT}}

Please answer the user's question about this sentence in the context of the paper.
Be concise but thorough (2-4 sentences typically).
If you don't know or the question is outside the paper's scope, say so honestly.`
  );
  const [aiAnalysisProgress, setAiAnalysisProgress] = useState<{ current: number; total: number } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null); // Error message for AI analysis
  // Store AI analysis results per sentence/figure-table (keyed by ID)
  const [aiSentenceAnalysis, setAiSentenceAnalysis] = useState<Map<string, { label: string; comment?: string; flags?: { correctnessIssue?: boolean; novelty?: boolean; consistencyIssue?: boolean } }>>(new Map());
  const [aiFigureTableAnalysis, setAiFigureTableAnalysis] = useState<Map<string, { label: string; comment?: string; flags?: { correctnessIssue?: boolean; novelty?: boolean; consistencyIssue?: boolean } }>>(new Map());

  // AI Debug state
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [debugEntries, setDebugEntries] = useState<AIDebugEntry[]>([]);
  const [debugStats, setDebugStats] = useState<AIDebugStats>(createEmptyStats());

  // Abort controller for stopping AI reading
  const abortReadingRef = useRef<boolean>(false);

  // Load AI analysis from active session when it changes
  useEffect(() => {
    if (activeSession) {
      // If the session has AI analysis data, load it
      if (activeSession.sentenceAnalysis) {
        const sentenceMap = new Map<string, { label: string; comment?: string; flags?: { correctnessIssue?: boolean; novelty?: boolean; consistencyIssue?: boolean } }>();
        Object.entries(activeSession.sentenceAnalysis).forEach(([id, data]) => {
          sentenceMap.set(id, data);
        });
        setAiSentenceAnalysis(sentenceMap);
        setAgentHasRead(true);
        console.log(`Loaded ${sentenceMap.size} sentence analyses from session`);
      }

      if (activeSession.figureTableAnalysis) {
        const figureTableMap = new Map<string, { label: string; comment?: string; flags?: { correctnessIssue?: boolean; novelty?: boolean; consistencyIssue?: boolean } }>();
        Object.entries(activeSession.figureTableAnalysis).forEach(([id, data]) => {
          figureTableMap.set(id, data);
        });
        setAiFigureTableAnalysis(figureTableMap);
        console.log(`Loaded ${figureTableMap.size} figure/table analyses from session`);
      }
    } else {
      // No active session - reset AI analysis state
      setAiSentenceAnalysis(new Map());
      setAiFigureTableAnalysis(new Map());
      setAgentHasRead(false);
    }
  }, [activeSession]);

  // Selection state for drawing
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState<{ x: number; y: number } | null>(null);
  const [drawCurrent, setDrawCurrent] = useState<{ x: number; y: number } | null>(null);
  const [drawingPageNum, setDrawingPageNum] = useState<number | null>(null); // Track which page is being drawn on in vertical mode
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(
    ({ numPages, _pdfInfo }: { numPages: number; _pdfInfo?: any }) => {
      setNumPages(numPages);
      setPdfLoading(false);
      // Load PDF document for destination resolution
      const loadPdfForDestinations = async () => {
        try {
          const loadingTask = pdfjs.getDocument(pdfUrl);
          const pdf = await loadingTask.promise;
          pdfDocRef.current = pdf;
        } catch (error) {
          console.error('Failed to load PDF for destinations:', error);
        }
      };
      loadPdfForDestinations();
    },
    [pdfUrl]
  );

  const onPageLoadSuccess = useCallback(
    ({ width, height }: { width: number; height: number }) => {
      setPageSize({ width, height });
    },
    []
  );

  // Resolve a named destination to a page number using pdfjs
  const resolveDestination = useCallback(async (dest: string | any[]): Promise<number | null> => {
    if (!pdfDocRef.current) return null;

    try {
      let destArray = dest;

      // If dest is a string, resolve it to an explicit destination array
      if (typeof dest === 'string') {
        destArray = await pdfDocRef.current.getDestination(dest);
        if (!destArray) return null;
      }

      // destArray format: [pageRef, {name: 'XYZ'}, left, top, zoom]
      // pageRef is a reference object that we need to resolve to a page index
      if (Array.isArray(destArray) && destArray.length > 0) {
        const pageRef = destArray[0];
        if (pageRef && typeof pageRef === 'object') {
          // Use getPageIndex to convert page reference to 0-based index
          const pageIndex = await pdfDocRef.current.getPageIndex(pageRef);
          return pageIndex + 1; // Convert to 1-based page number
        }
      }
    } catch (error) {
      console.error('Failed to resolve destination:', error);
    }
    return null;
  }, []);

  // Use capture phase to intercept PDF internal link clicks before react-pdf processes them
  useEffect(() => {
    const container = pageRef.current;
    if (!container) return;

    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Find the anchor element or its parent linkAnnotation section
      const anchor = target.closest('a') || target.closest('.linkAnnotation')?.querySelector('a');

      if (anchor) {
        const href = anchor.getAttribute('href');
        const title = anchor.getAttribute('title');

        // react-pdf stores target page number in the title attribute for internal links
        // Internal links have href="#" and title contains the page number
        if (href === '#' && title) {
          const targetPage = parseInt(title, 10);
          if (!isNaN(targetPage) && targetPage >= 1 && targetPage <= numPages) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Prevent react-pdf's handler from running
            if (targetPage !== pageNumber) {
              console.log(`Navigating to page ${targetPage}`);
              setPageNumber(targetPage);
            }
          }
        }
      }
    };

    // Use capture phase to intercept before react-pdf's internal handlers
    container.addEventListener('click', handleLinkClick, true);

    return () => {
      container.removeEventListener('click', handleLinkClick, true);
    };
  }, [pageNumber, numPages]);

  // Extract text from the current page for AI analysis - with coordinates
  useEffect(() => {
    const extractText = async () => {
      try {
        const loadingTask = pdfjs.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1 });

        // Extract text items with their coordinates
        const items: TextItem[] = [];
        for (const item of textContent.items) {
          const textItem = item as any;
          if (textItem.str && textItem.str.trim()) {
            // PDF.js gives transform matrix [scaleX, skewX, skewY, scaleY, x, y]
            // We need to convert from PDF coordinates to screen coordinates
            const tx = textItem.transform;
            const x = tx[4];
            // PDF coordinates have origin at bottom-left, convert to top-left
            const y = viewport.height - tx[5];
            const width = textItem.width || (textItem.str.length * 6);
            const height = Math.abs(tx[3]) || 12; // scaleY as height estimate

            items.push({
              str: textItem.str,
              x,
              y: y - height, // Adjust y to be top of text
              width,
              height,
            });
          }
        }

        setTextItems(items);

        // Also create concatenated text for basic search
        const text = items.map(item => item.str).join(" ");
        setPageText(text);
      } catch (error) {
        console.error("Failed to extract text:", error);
        setPageText("");
        setTextItems([]);
      }
    };
    extractText();
  }, [pdfUrl, pageNumber]);

  // Ref to track all page sections without causing re-renders
  const allPageSectionsRef = useRef<Map<number, Section[]>>(new Map());

  // Segment sentences and detect sections when textItems change
  useEffect(() => {
    if (textItems.length > 0) {
      // First, detect sections on this page
      const pageSections = detectSections(textItems, pageNumber);

      // Update the ref (not state, to avoid re-render loop)
      allPageSectionsRef.current.set(pageNumber, pageSections);

      // Also update state for any components that need it
      setAllPageSections(new Map(allPageSectionsRef.current));

      // Segment sentences
      const segmented = segmentSentences(textItems, pageNumber);

      // Associate each sentence with its section
      // Use the ref to access all sections without causing dependency issues
      const sentencesWithSections = segmented.map(sentence => {
        // Use the sentence's minY as its position
        const sentenceY = sentence.bounds.minY;
        const section = findSectionForPosition(pageSections, pageNumber, sentenceY, allPageSectionsRef.current);

        if (section) {
          return {
            ...sentence,
            section: {
              number: section.number,
              title: section.title,
              fullTitle: section.fullTitle,
            },
          };
        }
        return sentence;
      });

      setSentences(sentencesWithSections);
      // Reset sentence selection when page changes
      setHoveredSentenceId(null);
      setSelectedSentenceId(null);
      setShowDiscussionPanel(false);
    } else {
      setSentences([]);
    }
  }, [textItems, pageNumber]);

  // Convert user-defined regions to FigureTable format for the current page
  useEffect(() => {
    // Filter regions for current page and convert to FigureTable format
    const pageRegions = figureTableRegions.filter(r => r.pageNumber === pageNumber);
    const converted: FigureTable[] = pageRegions.map(r => ({
      id: r.id,
      type: r.type,
      label: r.label,
      caption: r.caption || '',
      pageNumber: r.pageNumber,
      boundingRect: r.boundingRect,
      bounds: {
        minX: r.boundingRect.x,
        minY: r.boundingRect.y,
        maxX: r.boundingRect.x + r.boundingRect.width,
        maxY: r.boundingRect.y + r.boundingRect.height,
      },
    }));
    setFigureTables(converted);
    // Reset figure/table selection when page changes
    setHoveredFigureTableId(null);
    setSelectedFigureTableId(null);
    setShowFigureTableDiscussionPanel(false);
  }, [figureTableRegions, pageNumber]);

  // Update sentence index when sentences or scale change
  useEffect(() => {
    if (sentences.length > 0) {
      setSentenceIndex(new SentenceIndex(sentences, scale));
    } else {
      setSentenceIndex(null);
    }
  }, [sentences, scale]);

  // Extract text and sentences for a specific page (used in vertical mode)
  const extractPageData = useCallback(async (targetPageNumber: number) => {
    // Use ref to track extraction status to avoid race conditions with React state batching
    if (!pdfUrl || extractingPagesRef.current.has(targetPageNumber)) return;

    // Mark as extracting immediately
    extractingPagesRef.current.add(targetPageNumber);

    try {
      const loadingTask = pdfjs.getDocument(pdfUrl);
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(targetPageNumber);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });

      // Extract text items
      const items: TextItem[] = [];
      for (const item of textContent.items) {
        const textItem = item as any;
        if (textItem.str && textItem.str.trim()) {
          const tx = textItem.transform;
          const x = tx[4];
          const y = viewport.height - tx[5];
          const width = textItem.width || (textItem.str.length * 6);
          const height = Math.abs(tx[3]) || 12;

          items.push({
            str: textItem.str,
            x,
            y: y - height,
            width,
            height,
          });
        }
      }

      // Store text items for this page
      setTextItemsPerPage(prev => new Map(prev).set(targetPageNumber, items));

      // Detect sections and segment sentences
      const pageSections = detectSections(items, targetPageNumber);
      allPageSectionsRef.current.set(targetPageNumber, pageSections);

      const segmented = segmentSentences(items, targetPageNumber);
      const sentencesWithSections = segmented.map(sentence => {
        const sentenceY = sentence.bounds.minY;
        const section = findSectionForPosition(pageSections, targetPageNumber, sentenceY, allPageSectionsRef.current);
        if (section) {
          return {
            ...sentence,
            section: {
              number: section.number,
              title: section.title,
              fullTitle: section.fullTitle,
            },
          };
        }
        return sentence;
      });

      setSentencesPerPage(prev => new Map(prev).set(targetPageNumber, sentencesWithSections));

      // Convert figure/table regions for this page
      const pageRegions = figureTableRegions.filter(r => r.pageNumber === targetPageNumber);
      const converted: FigureTable[] = pageRegions.map(r => ({
        id: r.id,
        type: r.type,
        label: r.label,
        caption: r.caption || '',
        pageNumber: r.pageNumber,
        boundingRect: r.boundingRect,
        bounds: {
          minX: r.boundingRect.x,
          minY: r.boundingRect.y,
          maxX: r.boundingRect.x + r.boundingRect.width,
          maxY: r.boundingRect.y + r.boundingRect.height,
        },
      }));
      setFigureTablesPerPage(prev => new Map(prev).set(targetPageNumber, converted));
    } catch (error) {
      console.error(`Failed to extract text for page ${targetPageNumber}:`, error);
      // Remove from extracting set on error so it can be retried
      extractingPagesRef.current.delete(targetPageNumber);
    }
  }, [pdfUrl, figureTableRegions]);

  // Reset extracting pages ref when PDF changes
  useEffect(() => {
    extractingPagesRef.current = new Set();
  }, [pdfUrl]);

  // In vertical mode, extract data for all pages in parallel
  useEffect(() => {
    if (viewMode !== 'vertical' || numPages === 0) return;

    // Extract data for all pages in parallel for faster loading
    const extractAllPages = async () => {
      // Create array of page numbers
      const pages = Array.from({ length: numPages }, (_, i) => i + 1);
      // Run all extractions in parallel (with a reasonable concurrency limit)
      const batchSize = 5; // Process 5 pages at a time to avoid overwhelming the browser
      for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);
        await Promise.all(batch.map(pageNum => extractPageData(pageNum)));
      }
    };
    extractAllPages();
  }, [viewMode, numPages, extractPageData]);

  // Update figureTablesPerPage when figureTableRegions change
  useEffect(() => {
    if (viewMode !== 'vertical') return;

    const newMap = new Map<number, FigureTable[]>();
    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const pageRegions = figureTableRegions.filter(r => r.pageNumber === pageNum);
      const converted: FigureTable[] = pageRegions.map(r => ({
        id: r.id,
        type: r.type,
        label: r.label,
        caption: r.caption || '',
        pageNumber: r.pageNumber,
        boundingRect: r.boundingRect,
        bounds: {
          minX: r.boundingRect.x,
          minY: r.boundingRect.y,
          maxX: r.boundingRect.x + r.boundingRect.width,
          maxY: r.boundingRect.y + r.boundingRect.height,
        },
      }));
      newMap.set(pageNum, converted);
    }
    setFigureTablesPerPage(newMap);
  }, [viewMode, figureTableRegions, numPages]);

  // Search for text in the PDF and return its bounding box coordinates
  const searchTextInPdf = useCallback((searchText: string): { x: number; y: number; width: number; height: number } | null => {
    if (!textItems.length || !searchText.trim()) return null;

    // Normalize the search text
    const normalizedSearch = searchText.replace(/\s+/g, ' ').toLowerCase().trim();

    // Build a concatenated string with position mappings
    // Each character maps to the text item it came from
    const charToItem: { itemIndex: number; charInItem: number }[] = [];
    let concatenated = '';

    for (let i = 0; i < textItems.length; i++) {
      const item = textItems[i];
      for (let j = 0; j < item.str.length; j++) {
        charToItem.push({ itemIndex: i, charInItem: j });
        concatenated += item.str[j];
      }
      // Add space between items
      if (i < textItems.length - 1) {
        charToItem.push({ itemIndex: i, charInItem: -1 }); // -1 indicates space
        concatenated += ' ';
      }
    }

    // Normalize concatenated text for searching
    const normalizedConcat = concatenated.replace(/\s+/g, ' ').toLowerCase();

    // Find the search text
    const index = normalizedConcat.indexOf(normalizedSearch);
    if (index === -1) {
      // Try partial matching - find the longest matching substring (at least 3 words)
      const words = normalizedSearch.split(/\s+/);
      for (let len = words.length; len >= Math.min(3, words.length); len--) {
        for (let start = 0; start <= words.length - len; start++) {
          const partial = words.slice(start, start + len).join(' ');
          const partialIndex = normalizedConcat.indexOf(partial);
          if (partialIndex !== -1) {
            return getBoundingBoxForRange(partialIndex, partialIndex + partial.length);
          }
        }
      }
      return null;
    }

    return getBoundingBoxForRange(index, index + normalizedSearch.length);

    // Helper function to compute bounding box for a character range
    function getBoundingBoxForRange(startIdx: number, endIdx: number): { x: number; y: number; width: number; height: number } | null {
      // Map character indices back to original positions accounting for whitespace normalization
      // Since we normalized spaces, we need to map back carefully
      let origIdx = 0;
      let normIdx = 0;
      let startOrig = -1;
      let endOrig = -1;

      while (origIdx < charToItem.length && normIdx <= endIdx) {
        const char = concatenated[origIdx];
        if (char && /\s/.test(char)) {
          // Skip extra whitespace in original
          while (origIdx < charToItem.length - 1 && /\s/.test(concatenated[origIdx + 1])) {
            origIdx++;
          }
        }
        if (normIdx === startIdx) startOrig = origIdx;
        if (normIdx === endIdx - 1) endOrig = origIdx;
        origIdx++;
        normIdx++;
      }

      if (startOrig === -1 || endOrig === -1) {
        // Fallback: use normalized indices directly if mapping fails
        startOrig = Math.min(startIdx, charToItem.length - 1);
        endOrig = Math.min(endIdx - 1, charToItem.length - 1);
      }

      // Get all text items in this range
      const startMapping = charToItem[startOrig];
      const endMapping = charToItem[endOrig];

      if (!startMapping || !endMapping) return null;

      // Calculate bounding box across all items in range
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

      for (let i = startMapping.itemIndex; i <= endMapping.itemIndex; i++) {
        const item = textItems[i];
        minX = Math.min(minX, item.x);
        minY = Math.min(minY, item.y);
        maxX = Math.max(maxX, item.x + item.width);
        maxY = Math.max(maxY, item.y + item.height);
      }

      if (minX === Infinity) return null;

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    }
  }, [textItems]);

  const changePage = useCallback(
    (offset: number) => {
      setPageNumber((prevPage) =>
        Math.max(1, Math.min(prevPage + offset, numPages))
      );
      setSelectedAnnotationId(null);
    },
    [numPages]
  );

  // Handle scroll in vertical mode to track current page and add pages to render cache
  const handleVerticalScroll = useCallback(() => {
    if (viewMode !== 'vertical' || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const containerRect = container.getBoundingClientRect();
    const containerMiddle = containerRect.top + containerRect.height / 3; // Check top third for better UX

    let currentVisiblePage = 1;
    let minDistance = Infinity;
    const pagesToAdd: number[] = [];

    // Find the page closest to the top third of the viewport and track pages to render
    pageRefs.current.forEach((element, pageNum) => {
      const rect = element.getBoundingClientRect();
      const pageMiddle = rect.top + rect.height / 2;
      const distance = Math.abs(pageMiddle - containerMiddle);

      // Check if page is in view (with buffer for preloading)
      const bufferHeight = containerRect.height * 2; // Preload pages within two viewport heights
      const isNearView = rect.bottom > containerRect.top - bufferHeight &&
                         rect.top < containerRect.bottom + bufferHeight;

      if (isNearView) {
        pagesToAdd.push(pageNum);
      }

      // Also check if page is actually in view for current page detection
      const isInView = rect.bottom > containerRect.top && rect.top < containerRect.bottom;

      if (isInView && distance < minDistance) {
        minDistance = distance;
        currentVisiblePage = pageNum;
      }
    });

    // Add newly visible pages to render cache (never remove - pages stay rendered once loaded)
    if (pagesToAdd.length > 0) {
      setRenderedPages(prev => {
        const hasNewPages = pagesToAdd.some(p => !prev.has(p));
        if (!hasNewPages) return prev; // No change needed
        const newSet = new Set(prev);
        pagesToAdd.forEach(p => newSet.add(p));
        return newSet;
      });
    }

    if (currentVisiblePage !== pageNumber) {
      setPageNumber(currentVisiblePage);
    }
  }, [viewMode, pageNumber]);

  // Initialize rendered pages and scroll when switching to vertical mode
  useEffect(() => {
    if (viewMode === 'vertical') {
      // Initialize rendered pages around current page (wider range for smooth initial experience)
      const initialRendered = new Set<number>();
      for (let i = Math.max(1, pageNumber - 3); i <= Math.min(numPages, pageNumber + 5); i++) {
        initialRendered.add(i);
      }
      setRenderedPages(initialRendered);

      // Small delay to ensure pages are rendered, then scroll to current page
      const timer = setTimeout(() => {
        const element = pageRefs.current.get(pageNumber);
        if (element && scrollContainerRef.current) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [viewMode, numPages]); // Only trigger when viewMode changes, not pageNumber

  const changeScale = useCallback((delta: number) => {
    setScale((prevScale) => Math.max(0.5, Math.min(prevScale + delta, 1.5)));
  }, []);

  // Track visited pages for caching in horizontal mode - all visited pages stay cached
  useEffect(() => {
    if (viewMode === 'horizontal' && pageNumber > 0) {
      setVisitedPages(prev => {
        if (prev.has(pageNumber)) return prev;
        const newSet = new Set(prev);
        newSet.add(pageNumber);
        return newSet;
      });
    }
  }, [pageNumber, viewMode]);

  // Callback for setting page refs in vertical mode (used by VerticalPageWrapper)
  const setPageRefCallback = useCallback((pageNum: number, el: HTMLDivElement | null) => {
    if (el) {
      pageRefs.current.set(pageNum, el);
    } else {
      pageRefs.current.delete(pageNum);
    }
  }, []);

  // Callback for page load in vertical mode (used by VerticalPageWrapper)
  const handleVerticalPageLoad = useCallback((pageNum: number, page: any) => {
    setPageSizes(prev => new Map(prev).set(pageNum, {
      width: page.originalWidth,
      height: page.originalHeight,
    }));
  }, []);

  // Handle mouse events for drawing selection (region mode or figure-table mode)
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Support region mode (in creating mode) and figure-table mode (separate mode for uploader)
      const isRegionDrawingMode = isCreatingMode && selectionMode === "region";
      const isFigureTableDrawingMode = isFigureTableMode && isUploader;
      if ((!isRegionDrawingMode && !isFigureTableDrawingMode) || !containerRef.current) return;

      // Don't start drawing if clicking on an annotation
      const target = e.target as HTMLElement;
      if (target.closest('.annotation-group') || target.closest('[data-annotation]')) return;

      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      setIsDrawing(true);
      setDrawStart({ x, y });
      setDrawCurrent({ x, y });
    },
    [isCreatingMode, selectionMode, scale, isUploader, isFigureTableMode]
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
      if (isFigureTableMode && isUploader) {
        // Create pending figure/table region for uploader (using separate Figure/Table mode)
        setPendingRegion({
          x: minX,
          y: minY,
          width,
          height,
          type: 'figure', // Default to figure, user can change
          label: '',
          caption: '',
        });
      } else {
        // Standard annotation mode
        setPendingHighlight({
          x: minX,
          y: minY,
          width,
          height,
        });
      }
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
    setDrawingPageNum(null);
  }, [isDrawing, drawStart, drawCurrent, isFigureTableMode, isUploader]);

  // Vertical mode drawing callbacks (for figure/table region creation)
  const handleVerticalDrawStart = useCallback((pageNum: number, x: number, y: number) => {
    setIsDrawing(true);
    setDrawStart({ x, y });
    setDrawCurrent({ x, y });
    setDrawingPageNum(pageNum);
  }, []);

  const handleVerticalDrawMove = useCallback((x: number, y: number) => {
    if (!isDrawing) return;
    setDrawCurrent({ x, y });
  }, [isDrawing]);

  const handleVerticalDrawEnd = useCallback(() => {
    if (!isDrawing || !drawStart || !drawCurrent || drawingPageNum === null) {
      setIsDrawing(false);
      setDrawStart(null);
      setDrawCurrent(null);
      setDrawingPageNum(null);
      return;
    }

    const minX = Math.min(drawStart.x, drawCurrent.x);
    const minY = Math.min(drawStart.y, drawCurrent.y);
    const width = Math.abs(drawCurrent.x - drawStart.x);
    const height = Math.abs(drawCurrent.y - drawStart.y);

    // Only create region if it's big enough
    if (width > 20 && height > 10) {
      if (isFigureTableMode && isUploader) {
        setPendingRegion({
          x: minX,
          y: minY,
          width,
          height,
          type: 'figure',
          label: '',
          caption: '',
          pageNumber: drawingPageNum,
        });
      }
    }

    setIsDrawing(false);
    setDrawStart(null);
    setDrawCurrent(null);
    setDrawingPageNum(null);
  }, [isDrawing, drawStart, drawCurrent, drawingPageNum, isFigureTableMode, isUploader]);

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
      // Clear text selection after adding annotation
      window.getSelection()?.removeAllRanges();
      // Call the callback if provided
      onAnnotationAdded?.(annotation);
    },
    [onAnnotationAdded]
  );

  // Delete annotation handler - stable reference
  const handleDeleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
    setSelectedAnnotationId((prevSelected) => prevSelected === id ? null : prevSelected);
    // Call the callback if provided
    onAnnotationDeleted?.(id);
  }, [onAnnotationDeleted]);

  // Edit annotation handler
  const handleEditAnnotation = useCallback(async (id: string, newText: string, newLatex?: string) => {
    // Update local state
    setAnnotations((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, text: newText, latex: newLatex } : a
      )
    );
    // If we have a paper ID, save to server
    if (paperId) {
      try {
        await api.updateAnnotation(paperId, id, { text: newText, latex: newLatex });
      } catch (error) {
        console.error('Failed to save annotation edit:', error);
        toast.error('Failed to save changes');
      }
    }
  }, [paperId]);

  // Hide annotation handler (for others' annotations)
  const handleHideAnnotation = useCallback((id: string) => {
    setHiddenAnnotationIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
    setSelectedAnnotationId((prevSelected) => prevSelected === id ? null : prevSelected);
  }, []);

  // Unhide annotation handler
  const handleUnhideAnnotation = useCallback((id: string) => {
    setHiddenAnnotationIds((prev) => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });
  }, []);

  // Update annotation position handler (for drag) - stable reference with functional update
  const handlePositionChange = useCallback(
    (id: string, newPosition: { x: number; y: number }) => {
      setAnnotations((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, position: { ...newPosition } } : a
        )
      );
    },
    []
  );

  // Fullscreen toggle handler
  const toggleFullscreen = useCallback(async () => {
    if (!viewerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await viewerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      console.error("Fullscreen error:", error);
    }
  }, []);

  // Listen for fullscreen changes (e.g., user presses Escape)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
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

  // Filter annotations for current page (excluding hidden ones)
  const pageAnnotations = annotations.filter(
    (a) => a.pageNumber === pageNumber && !hiddenAnnotationIds.has(a.id)
  );

  // Sentence annotation handlers
  const handleSentenceClick = useCallback((sentenceId: string) => {
    // Find sentence - in vertical mode, search all pages; in horizontal mode, search current page
    let sentence: Sentence | undefined;
    if (viewMode === 'vertical') {
      // Search across all pages
      for (const pageSentences of Array.from(sentencesPerPage.values())) {
        sentence = pageSentences.find((s: Sentence) => s.id === sentenceId);
        if (sentence) break;
      }
    } else {
      sentence = sentences.find(s => s.id === sentenceId);
    }

    // If in annotation creation mode with sentence selection, create pending highlight from sentence
    if (isCreatingMode && selectionMode === "sentence") {
      if (sentence && sentence.bounds) {
        // Create pending highlight from sentence bounds with full sentence data
        setPendingHighlight({
          x: sentence.bounds.minX,
          y: sentence.bounds.minY,
          width: sentence.bounds.maxX - sentence.bounds.minX,
          height: sentence.bounds.maxY - sentence.bounds.minY,
          selectedText: sentence.text,
          // Include sentence data for sentence-style rendering
          sentenceData: {
            sentenceId: sentence.id,
            sentenceText: sentence.text,
            boundingRects: sentence.boundingRects,
            // Include section info if available
            section: sentence.section,
          },
        });
        // Select the sentence visually but don't open discussion panel
        setSelectedSentenceId(sentenceId);
      }
      return;
    }

    // Normal mode: open discussion panel
    setSelectedSentenceId(sentenceId);
    setShowDiscussionPanel(true);
  }, [isCreatingMode, selectionMode, sentences, viewMode, sentencesPerPage]);

  const handleAddSentenceAnnotation = useCallback(
    (annotation: Omit<SentenceAnnotation, 'id' | 'timestamp'>) => {
      const annotationId = nanoid();
      const newAnnotation: SentenceAnnotation = {
        ...annotation,
        id: annotationId,
        timestamp: new Date(),
      };
      setSentenceAnnotations((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(annotation.sentenceId) || [];
        newMap.set(annotation.sentenceId, [...existing, newAnnotation]);
        return newMap;
      });
      // Call the callback if provided - include the ID for backend sync
      onCommentAdded?.({
        id: annotationId,
        type: 'sentence',
        targetId: annotation.sentenceId,
        text: annotation.text,
        userName: annotation.userName,
        pageNumber: pageNumber,
      });
    },
    [onCommentAdded, pageNumber]
  );

  const handleAddSentenceReply = useCallback(
    (annotationId: string, reply: Omit<SentenceAnnotationReply, 'id' | 'timestamp'>) => {
      const replyId = nanoid();
      const newReply: SentenceAnnotationReply = {
        ...reply,
        id: replyId,
        timestamp: new Date(),
      };
      setSentenceAnnotations((prev) => {
        const newMap = new Map(prev);
        for (const [sentenceId, annotations] of Array.from(newMap.entries())) {
          const updated = annotations.map((a: SentenceAnnotation) => {
            if (a.id === annotationId) {
              return { ...a, replies: [...a.replies, newReply] };
            }
            return a;
          });
          newMap.set(sentenceId, updated);
        }
        return newMap;
      });
      // Call the callback if provided - include the ID for backend sync
      onCommentAdded?.({
        id: replyId,
        type: 'reply',
        targetId: annotationId,
        text: reply.text,
        userName: reply.userName,
        pageNumber: pageNumber,
      });
    },
    [onCommentAdded, pageNumber]
  );

  // Delete sentence annotation handler
  const handleDeleteSentenceAnnotation = useCallback((annotationId: string) => {
    setSentenceAnnotations((prev) => {
      const newMap = new Map(prev);
      for (const [sentenceId, annotations] of Array.from(newMap.entries())) {
        const filtered = annotations.filter((a: SentenceAnnotation) => a.id !== annotationId);
        if (filtered.length !== annotations.length) {
          newMap.set(sentenceId, filtered);
        }
      }
      return newMap;
    });
    // Call API to delete from backend
    onCommentDeleted?.(annotationId);
  }, [onCommentDeleted]);

  // Delete sentence reply handler
  const handleDeleteSentenceReply = useCallback((annotationId: string, replyId: string) => {
    setSentenceAnnotations((prev) => {
      const newMap = new Map(prev);
      for (const [sentenceId, annotations] of Array.from(newMap.entries())) {
        const updated = annotations.map((a: SentenceAnnotation) => {
          if (a.id === annotationId) {
            return { ...a, replies: a.replies.filter((r: SentenceAnnotationReply) => r.id !== replyId) };
          }
          return a;
        });
        newMap.set(sentenceId, updated);
      }
      return newMap;
    });
    // Call API to delete reply from backend
    onCommentDeleted?.(replyId);
  }, [onCommentDeleted]);

  // Edit sentence annotation handler
  const handleEditSentenceAnnotation = useCallback(async (annotationId: string, newText: string) => {
    setSentenceAnnotations((prev) => {
      const newMap = new Map(prev);
      for (const [sentenceId, annotations] of Array.from(newMap.entries())) {
        const updated = annotations.map((a: SentenceAnnotation) => {
          if (a.id === annotationId) {
            return { ...a, text: newText };
          }
          return a;
        });
        newMap.set(sentenceId, updated);
      }
      return newMap;
    });
    // Call API to update on backend
    if (paperId) {
      try {
        await api.updateAnnotation(paperId, annotationId, { text: newText });
      } catch (error) {
        console.error('Failed to save comment edit:', error);
        toast.error('Failed to save changes');
      }
    }
  }, [paperId]);

  // Edit sentence reply handler
  const handleEditSentenceReply = useCallback(async (annotationId: string, replyId: string, newText: string) => {
    setSentenceAnnotations((prev) => {
      const newMap = new Map(prev);
      for (const [sentenceId, annotations] of Array.from(newMap.entries())) {
        const updated = annotations.map((a: SentenceAnnotation) => {
          if (a.id === annotationId) {
            return {
              ...a,
              replies: a.replies.map((r: SentenceAnnotationReply) =>
                r.id === replyId ? { ...r, text: newText } : r
              ),
            };
          }
          return a;
        });
        newMap.set(sentenceId, updated);
      }
      return newMap;
    });
    // Call API to update on backend
    if (paperId) {
      try {
        await api.updateAnnotation(paperId, replyId, { text: newText });
      } catch (error) {
        console.error('Failed to save reply edit:', error);
        toast.error('Failed to save changes');
      }
    }
  }, [paperId]);

  // Compute annotation counts per sentence
  const sentenceAnnotationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    sentenceAnnotations.forEach((annotations, sentenceId) => {
      counts.set(sentenceId, annotations.length);
    });
    return counts;
  }, [sentenceAnnotations]);

  // Get selected sentence object with AI analysis data
  const selectedSentence = useMemo(() => {
    if (!selectedSentenceId) return null;

    // In vertical mode, search across all pages; in horizontal mode, search current page
    let sentence: Sentence | undefined;
    if (viewMode === 'vertical') {
      for (const pageSentences of Array.from(sentencesPerPage.values())) {
        sentence = pageSentences.find((s: Sentence) => s.id === selectedSentenceId);
        if (sentence) break;
      }
    } else {
      sentence = sentences.find((s) => s.id === selectedSentenceId);
    }

    if (!sentence) return null;

    // Add AI label from analysis if available
    const aiAnalysis = aiSentenceAnalysis.get(selectedSentenceId);
    if (aiAnalysis) {
      return {
        ...sentence,
        aiLabel: aiAnalysis.label as SentenceLabel,
      };
    }
    return sentence;
  }, [selectedSentenceId, sentences, aiSentenceAnalysis, viewMode, sentencesPerPage]);

  // Get annotations for selected sentence, including AI analysis as first annotation
  const selectedSentenceAnnotations = useMemo(() => {
    if (!selectedSentenceId) return [];
    const userAnnotations = sentenceAnnotations.get(selectedSentenceId) || [];

    // If agent has read and there's AI analysis, add it as first annotation
    // Always show AI analysis when available, even without a specific comment
    const aiAnalysis = aiSentenceAnalysis.get(selectedSentenceId);
    if (aiAnalysis) {
      // Create AI annotation - if there's a comment use it, otherwise show label description
      // Use a very early timestamp (epoch start) so the initial AI analysis always appears first
      // This distinguishes it from @AI follow-up responses which get current timestamps
      const aiAnnotation: SentenceAnnotation = {
        id: `ai-${selectedSentenceId}`,
        sentenceId: selectedSentenceId,
        text: aiAnalysis.comment || `This sentence has been classified as "${aiAnalysis.label}".`,
        userName: 'AI Reviewer',
        timestamp: new Date(0), // Epoch start - ensures this appears first in chronological sort
        replies: [],
        isAI: true,
        aiSentenceLabel: aiAnalysis.label as SentenceLabel,
        aiFlags: aiAnalysis.flags,
      };
      return [aiAnnotation, ...userAnnotations];
    }
    return userAnnotations;
  }, [selectedSentenceId, sentenceAnnotations, aiSentenceAnalysis]);

  // Figure/Table annotation handlers
  const handleFigureTableClick = useCallback((figureTableId: string) => {
    // Find figure/table - in vertical mode, search all pages; in horizontal mode, search current page
    let ft: FigureTable | undefined;
    if (viewMode === 'vertical') {
      for (const pageFTs of Array.from(figureTablesPerPage.values())) {
        ft = pageFTs.find((f: FigureTable) => f.id === figureTableId);
        if (ft) break;
      }
    } else {
      ft = figureTables.find(f => f.id === figureTableId);
    }

    // If in annotation creation mode, create pending highlight from figure/table
    if (isCreatingMode) {
      if (ft) {
        // Create pending highlight from figure/table bounds
        setPendingHighlight({
          x: ft.boundingRect.x,
          y: ft.boundingRect.y,
          width: ft.boundingRect.width,
          height: ft.boundingRect.height,
          selectedText: ft.caption,
          // Include figure/table data
          figureTableData: {
            figureTableId: ft.id,
            type: ft.type,
            label: ft.label,
            caption: ft.caption,
            boundingRect: ft.boundingRect,
          },
        });
        // Select visually but don't open discussion panel
        setSelectedFigureTableId(figureTableId);
      }
      return;
    }

    // Normal mode: open discussion panel
    setSelectedFigureTableId(figureTableId);
    setShowFigureTableDiscussionPanel(true);
  }, [isCreatingMode, figureTables, viewMode, figureTablesPerPage]);

  const handleAddFigureTableAnnotation = useCallback(
    (annotation: Omit<FigureTableAnnotation, 'id' | 'timestamp'>) => {
      const annotationId = nanoid();
      const newAnnotation: FigureTableAnnotation = {
        ...annotation,
        id: annotationId,
        timestamp: new Date(),
      };
      setFigureTableAnnotations((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(annotation.figureTableId) || [];
        newMap.set(annotation.figureTableId, [...existing, newAnnotation]);
        return newMap;
      });
      // Call the callback if provided - include the ID for backend sync
      onCommentAdded?.({
        id: annotationId,
        type: 'figure',
        targetId: annotation.figureTableId,
        text: annotation.text,
        userName: annotation.userName,
        pageNumber: pageNumber,
      });
    },
    [onCommentAdded, pageNumber]
  );

  const handleAddFigureTableReply = useCallback(
    (annotationId: string, reply: Omit<SentenceAnnotationReply, 'id' | 'timestamp'>) => {
      const replyId = nanoid();
      const newReply: SentenceAnnotationReply = {
        ...reply,
        id: replyId,
        timestamp: new Date(),
      };
      setFigureTableAnnotations((prev) => {
        const newMap = new Map(prev);
        for (const [ftId, annotations] of Array.from(newMap.entries())) {
          const updated = annotations.map((a: FigureTableAnnotation) => {
            if (a.id === annotationId) {
              return { ...a, replies: [...a.replies, newReply] };
            }
            return a;
          });
          newMap.set(ftId, updated);
        }
        return newMap;
      });
      // Call the callback if provided - include the ID for backend sync
      onCommentAdded?.({
        id: replyId,
        type: 'reply',
        targetId: annotationId,
        text: reply.text,
        userName: reply.userName,
        pageNumber: pageNumber,
      });
    },
    [onCommentAdded, pageNumber]
  );

  // Delete figure/table annotation handler
  const handleDeleteFigureTableAnnotation = useCallback((annotationId: string) => {
    setFigureTableAnnotations((prev) => {
      const newMap = new Map(prev);
      for (const [ftId, annotations] of Array.from(newMap.entries())) {
        const filtered = annotations.filter((a: FigureTableAnnotation) => a.id !== annotationId);
        if (filtered.length !== annotations.length) {
          newMap.set(ftId, filtered);
        }
      }
      return newMap;
    });
    // Call API to delete from backend
    onCommentDeleted?.(annotationId);
  }, [onCommentDeleted]);

  // Delete figure/table reply handler
  const handleDeleteFigureTableReply = useCallback((annotationId: string, replyId: string) => {
    setFigureTableAnnotations((prev) => {
      const newMap = new Map(prev);
      for (const [ftId, annotations] of Array.from(newMap.entries())) {
        const updated = annotations.map((a: FigureTableAnnotation) => {
          if (a.id === annotationId) {
            return { ...a, replies: a.replies.filter((r: SentenceAnnotationReply) => r.id !== replyId) };
          }
          return a;
        });
        newMap.set(ftId, updated);
      }
      return newMap;
    });
    // Call API to delete reply from backend
    onCommentDeleted?.(replyId);
  }, [onCommentDeleted]);

  // Edit figure/table annotation handler
  const handleEditFigureTableAnnotation = useCallback(async (annotationId: string, newText: string) => {
    setFigureTableAnnotations((prev) => {
      const newMap = new Map(prev);
      for (const [ftId, annotations] of Array.from(newMap.entries())) {
        const updated = annotations.map((a: FigureTableAnnotation) => {
          if (a.id === annotationId) {
            return { ...a, text: newText };
          }
          return a;
        });
        newMap.set(ftId, updated);
      }
      return newMap;
    });
    // Call API to update on backend
    if (paperId) {
      try {
        await api.updateAnnotation(paperId, annotationId, { text: newText });
      } catch (error) {
        console.error('Failed to save comment edit:', error);
        toast.error('Failed to save changes');
      }
    }
  }, [paperId]);

  // Edit figure/table reply handler
  const handleEditFigureTableReply = useCallback(async (annotationId: string, replyId: string, newText: string) => {
    setFigureTableAnnotations((prev) => {
      const newMap = new Map(prev);
      for (const [ftId, annotations] of Array.from(newMap.entries())) {
        const updated = annotations.map((a: FigureTableAnnotation) => {
          if (a.id === annotationId) {
            return {
              ...a,
              replies: a.replies.map((r: SentenceAnnotationReply) =>
                r.id === replyId ? { ...r, text: newText } : r
              ),
            };
          }
          return a;
        });
        newMap.set(ftId, updated);
      }
      return newMap;
    });
    // Call API to update on backend
    if (paperId) {
      try {
        await api.updateAnnotation(paperId, replyId, { text: newText });
      } catch (error) {
        console.error('Failed to save reply edit:', error);
        toast.error('Failed to save changes');
      }
    }
  }, [paperId]);

  // Compute annotation counts per figure/table
  const figureTableAnnotationCounts = useMemo(() => {
    const counts = new Map<string, number>();
    figureTableAnnotations.forEach((annotations, ftId) => {
      counts.set(ftId, annotations.length);
    });
    return counts;
  }, [figureTableAnnotations]);

  // Stop AI reading handler
  const handleStopReading = useCallback(() => {
    abortReadingRef.current = true;
  }, []);

  // Re-run AI reading handler (clears previous results and starts fresh)
  const handleRerunReading = useCallback(() => {
    // Clear previous results
    setAiSentenceAnalysis(new Map());
    setAiFigureTableAnalysis(new Map());
    setAgentHasRead(false);
    setAiError(null);
    setDebugEntries([]);
    setDebugStats(createEmptyStats());
    abortReadingRef.current = false;
  }, []);

  // Handle AI follow-up questions when user types @AI in comments
  const handleAIFollowUp = useCallback(async (
    sentenceId: string,
    question: string,
    sentenceText: string,
    sectionInfo?: string
  ): Promise<string> => {
    // Check if we have an active session with API key
    if (!paperId || !activeSession || !activeSession.apiKeySet) {
      throw new Error('API key not configured. Please configure your API key first.');
    }

    // Get the AI analysis for this sentence if available
    const sentenceAnalysis = aiSentenceAnalysis.get(sentenceId);
    const analysisContext = sentenceAnalysis
      ? `AI's previous analysis of this sentence:\n- Label: ${sentenceAnalysis.label}\n- Comment: ${sentenceAnalysis.comment || 'No specific comment'}\n- Flags: ${JSON.stringify(sentenceAnalysis.flags || {})}`
      : 'No previous AI analysis for this sentence.';

    // Build the context using the user's template
    // Replace placeholders with actual values
    const context = aiFollowUpPromptTemplate
      .replace('{{QUESTION}}', question)
      .replace('{{SECTION}}', sectionInfo || 'Unknown Section')
      .replace('{{SENTENCE}}', sentenceText)
      .replace('{{ANALYSIS_CONTEXT}}', analysisContext);

    console.log('[AI Follow-up] Using prompt template:\n', context);

    // Use server-side chat API which uses the session's encrypted API key
    const result = await api.chatWithAgent(
      paperId,
      activeSession.id,
      question,
      context
    );

    // Update session if callback provided (for token usage tracking)
    if (onSessionUpdated && result.updatedHistory) {
      onSessionUpdated(result.updatedHistory);
    }

    return result.response.trim();
  }, [paperId, activeSession, aiSentenceAnalysis, onSessionUpdated, aiFollowUpPromptTemplate]);

  // "Let Agent Read" handler - analyzes ENTIRE paper page by page using the active session's API key
  const handleLetAgentRead = useCallback(async () => {
    // Clear any previous error and debug data
    setAiError(null);
    setDebugEntries([]);
    setDebugStats(createEmptyStats());
    abortReadingRef.current = false;

    // Check for active session with API key
    if (!activeSession) {
      setAiError('Please create and activate an AI session first. Go to the Paper Details page and create a new AI session.');
      return;
    }

    if (!activeSession.apiKeySet) {
      setAiError('Please set an API key in your active session first. Go to the Paper Details page and click "Set API Key" on your active session.');
      return;
    }

    if (!paperId) {
      setAiError('Paper ID is required for AI analysis.');
      return;
    }

    // Don't re-read if already done
    if (agentHasRead) {
      return;
    }

    setIsAgentReading(true);
    setAiAnalysisProgress({ current: 0, total: numPages });

    // Load PDF once at the start
    const loadingTask = pdfjs.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;

    let pagesAnalyzed = 0;
    let totalErrors = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalDuration = 0;
    const startTime = Date.now();

    // Collect all analysis results for final save
    const allSentenceAnalysis: Record<string, AiSentenceAnalysisData> = {};
    const allFigureTableAnalysis: Record<string, AiFigureTableAnalysisData> = {};

    for (let page = 1; page <= numPages; page++) {
      // Check if reading was aborted
      if (abortReadingRef.current) {
        console.log('AI reading aborted by user');
        setAiError(`Reading stopped at page ${page - 1}. ${pagesAnalyzed} pages analyzed.`);
        break;
      }

      setAiAnalysisProgress({ current: page, total: numPages });

      try {
        // Extract text items for this page
        const pdfPage = await pdf.getPage(page);
        const textContent = await pdfPage.getTextContent();
        const viewport = pdfPage.getViewport({ scale: 1 });

        // Extract text items with their coordinates
        const pageTextItems: TextItem[] = [];
        for (const item of textContent.items) {
          const textItem = item as any;
          if (textItem.str && textItem.str.trim()) {
            const tx = textItem.transform;
            const x = tx[4];
            const y = viewport.height - tx[5];
            const width = textItem.width || (textItem.str.length * 6);
            const height = Math.abs(tx[3]) || 12;

            pageTextItems.push({
              str: textItem.str,
              x,
              y: y - height,
              width,
              height,
            });
          }
        }

        if (pageTextItems.length === 0) continue;

        // Segment sentences for this page
        const pageSentences = segmentSentences(pageTextItems, page);

        // Detect sections and assign to sentences
        const pageSections = detectSections(pageTextItems, page);
        const sentencesWithSections = pageSentences.map(sentence => {
          const sentenceY = sentence.bounds.minY;
          const section = findSectionForPosition(pageSections, page, sentenceY, allPageSectionsRef.current);
          if (section) {
            return {
              ...sentence,
              section: {
                number: section.number,
                title: section.title,
                fullTitle: section.fullTitle,
              },
            };
          }
          return sentence;
        });

        // Get user-defined figure/table regions for this page (convert from API format)
        const pageRegions = figureTableRegions.filter(r => r.pageNumber === page);
        const pageFigureTables: FigureTable[] = pageRegions.map(r => ({
          id: r.id,
          type: r.type,
          label: r.label,
          caption: r.caption || '',
          pageNumber: r.pageNumber,
          boundingRect: r.boundingRect,
          bounds: {
            minX: r.boundingRect.x,
            minY: r.boundingRect.y,
            maxX: r.boundingRect.x + r.boundingRect.width,
            maxY: r.boundingRect.y + r.boundingRect.height,
          },
        }));

        if (sentencesWithSections.length === 0 && pageFigureTables.length === 0) continue;

        // Track timing for this request
        const requestStartTime = Date.now();

        // Prepare data for server-side API call
        const sentencesForApi = sentencesWithSections.map((s, idx) => ({
          id: s.id,
          text: s.text,
          section: s.section,
        }));

        const figureTablesForApi = pageFigureTables.map(ft => ({
          id: ft.id,
          type: ft.type,
          label: ft.label,
          caption: ft.caption,
        }));

        // Call server-side API (uses session's encrypted API key)
        const response = await api.analyzePageWithSession(paperId, activeSession.id, {
          sentences: sentencesForApi,
          figureTables: figureTablesForApi,
          pageNumber: page,
          totalPages: numPages,
        });

        const requestDuration = Date.now() - requestStartTime;
        totalDuration += requestDuration;

        // Track tokens
        if (response.usage) {
          totalPromptTokens += response.usage.promptTokens;
          totalCompletionTokens += response.usage.completionTokens;
        }

        // Add debug entries for request and response
        const requestEntry: AIDebugEntry = {
          id: `req-${page}-${Date.now()}`,
          timestamp: new Date(requestStartTime),
          type: 'request',
          pageNumber: page,
          prompt: `[Page ${page}] Analyzing ${sentencesForApi.length} sentences, ${figureTablesForApi.length} figures/tables`,
        };

        const responseEntry: AIDebugEntry = {
          id: `res-${page}-${Date.now()}`,
          timestamp: new Date(),
          type: 'response',
          pageNumber: page,
          response: JSON.stringify(response.analysis, null, 2),
          tokens: response.usage ? {
            prompt: response.usage.promptTokens,
            completion: response.usage.completionTokens,
            total: response.usage.promptTokens + response.usage.completionTokens,
          } : undefined,
          duration: requestDuration,
          sentenceCount: Object.keys(response.analysis.sentences || {}).length,
          figureTableCount: Object.keys(response.analysis.figureTables || {}).length,
        };

        setDebugEntries(prev => [...prev, requestEntry, responseEntry]);

        // Update stats
        setDebugStats(prev => ({
          totalTokensUsed: totalPromptTokens + totalCompletionTokens,
          promptTokens: totalPromptTokens,
          completionTokens: totalCompletionTokens,
          totalRounds: prev.totalRounds + 1,
          successfulRounds: prev.successfulRounds + 1,
          failedRounds: prev.failedRounds,
          totalDuration: totalDuration,
          averageRoundDuration: totalDuration / (prev.totalRounds + 1),
        }));

        // Map the response to sentence IDs (response uses array indices, we need actual IDs)
        const sentenceAnalysisResults = response.analysis.sentences || {};
        const figureTableAnalysisResults = response.analysis.figureTables || {};

        // Immediately update state with this page's results (so user sees progress)
        setAiSentenceAnalysis(prev => {
          const newMap = new Map(prev);
          // Map index-based results to actual sentence IDs
          Object.entries(sentenceAnalysisResults).forEach(([indexStr, data]) => {
            const index = parseInt(indexStr) - 1; // API uses 1-based indexing
            if (index >= 0 && index < sentencesWithSections.length) {
              const sentenceId = sentencesWithSections[index].id;
              const analysisData = {
                label: (data as any).label || 'Background',
                comment: (data as any).comment,
                flags: (data as any).flags || {},
              };
              newMap.set(sentenceId, analysisData);
              allSentenceAnalysis[sentenceId] = analysisData;
            }
          });
          return newMap;
        });

        setAiFigureTableAnalysis(prev => {
          const newMap = new Map(prev);
          // Map label-based results to actual figure/table IDs
          Object.entries(figureTableAnalysisResults).forEach(([label, data]) => {
            // Find matching figure/table by label
            const ft = pageFigureTables.find(f => f.label === label || f.id === label);
            if (ft) {
              const analysisData = {
                label: (data as any).label || 'Result',
                comment: (data as any).comment,
                flags: (data as any).flags || {},
              };
              newMap.set(ft.id, analysisData);
              allFigureTableAnalysis[ft.id] = analysisData;
            }
          });
          return newMap;
        });

        pagesAnalyzed++;
        console.log(`Page ${page}/${numPages}: ${Object.keys(sentenceAnalysisResults).length} sentences, ${Object.keys(figureTableAnalysisResults).length} figures/tables analyzed`);
      } catch (error) {
        // Log error but continue with next page
        console.error(`Error analyzing page ${page}:`, error);
        totalErrors++;

        // Add error debug entry
        const errorEntry: AIDebugEntry = {
          id: `err-${page}-${Date.now()}`,
          timestamp: new Date(),
          type: 'error',
          pageNumber: page,
          error: error instanceof Error ? error.message : String(error),
        };
        setDebugEntries(prev => [...prev, errorEntry]);

        // Update stats for error
        setDebugStats(prev => ({
          ...prev,
          totalRounds: prev.totalRounds + 1,
          failedRounds: prev.failedRounds + 1,
        }));
      }
    }

    // Mark as complete (only if not aborted, or if some pages were analyzed)
    const wasAborted = abortReadingRef.current;
    if (!wasAborted) {
      setAgentHasRead(true);
    } else if (pagesAnalyzed > 0) {
      // Partial read - still mark as read so user can see results
      setAgentHasRead(true);
    }
    setIsAgentReading(false);
    setAiAnalysisProgress(null);

    // Final stats update
    const finalDuration = Date.now() - startTime;
    setDebugStats(prev => ({
      ...prev,
      totalDuration: finalDuration,
      averageRoundDuration: prev.totalRounds > 0 ? finalDuration / prev.totalRounds : 0,
    }));

    if (!wasAborted && totalErrors > 0) {
      setAiError(`Completed with ${totalErrors} page(s) failed. ${pagesAnalyzed} pages analyzed successfully.`);
    }

    console.log(`Agent finished reading${wasAborted ? ' (aborted)' : ''}:`);
    console.log(`  - Pages analyzed: ${pagesAnalyzed}/${numPages}`);
    console.log(`  - Errors: ${totalErrors}`);
    console.log(`  - Total tokens: ${totalPromptTokens + totalCompletionTokens}`);
    console.log(`  - Total time: ${finalDuration}ms`);

    // Save AI analysis to session via complete-reading endpoint
    if (pagesAnalyzed > 0 && paperId && activeSession) {
      try {
        const result = await api.completeReading(paperId, activeSession.id, {
          sentenceAnalysis: allSentenceAnalysis,
          figureTableAnalysis: allFigureTableAnalysis,
        });
        console.log('AI analysis saved to session');
        // Notify parent about session update
        if (onSessionUpdated) {
          onSessionUpdated(result.history);
        }
        // Also call the legacy callback if provided
        if (onAiAnalysisSaved) {
          onAiAnalysisSaved(allSentenceAnalysis, allFigureTableAnalysis);
        }
      } catch (error) {
        console.error('Failed to save AI analysis to session:', error);
        // Still call onAiAnalysisSaved if available for backward compatibility
        if (onAiAnalysisSaved) {
          onAiAnalysisSaved(allSentenceAnalysis, allFigureTableAnalysis);
        }
      }
    }
  }, [pdfUrl, paperId, numPages, agentHasRead, activeSession, onAiAnalysisSaved, onSessionUpdated, figureTableRegions]);

  // Get selected figure/table object with AI analysis data
  const selectedFigureTable = useMemo(() => {
    if (!selectedFigureTableId) return null;

    // In vertical mode, search across all pages; in horizontal mode, search current page
    let ft: FigureTable | undefined;
    if (viewMode === 'vertical') {
      for (const pageFTs of Array.from(figureTablesPerPage.values())) {
        ft = pageFTs.find((f: FigureTable) => f.id === selectedFigureTableId);
        if (ft) break;
      }
    } else {
      ft = figureTables.find((f) => f.id === selectedFigureTableId);
    }

    if (!ft) return null;

    // Add AI label from analysis if available
    const aiAnalysis = aiFigureTableAnalysis.get(selectedFigureTableId);
    if (aiAnalysis) {
      return {
        ...ft,
        aiLabel: aiAnalysis.label as FigureTableLabel,
      };
    }
    return ft;
  }, [selectedFigureTableId, figureTables, aiFigureTableAnalysis, viewMode, figureTablesPerPage]);

  // Get annotations for selected figure/table, including AI analysis as first annotation
  const selectedFigureTableAnnotations = useMemo(() => {
    if (!selectedFigureTableId) return [];
    const userAnnotations = figureTableAnnotations.get(selectedFigureTableId) || [];

    // If agent has read and there's AI analysis, add it as first annotation
    // Always show AI analysis when available, even without a specific comment
    const aiAnalysis = aiFigureTableAnalysis.get(selectedFigureTableId);
    if (aiAnalysis) {
      // Create AI annotation - if there's a comment use it, otherwise show label description
      const aiAnnotation: FigureTableAnnotation = {
        id: `ai-${selectedFigureTableId}`,
        figureTableId: selectedFigureTableId,
        text: aiAnalysis.comment || `This has been classified as "${aiAnalysis.label}".`,
        userName: 'AI Reviewer',
        timestamp: new Date(),
        replies: [],
        isAI: true,
        aiFigureTableLabel: aiAnalysis.label as FigureTableLabel,
        aiFlags: aiAnalysis.flags,
      };
      return [aiAnnotation, ...userAnnotations];
    }
    return userAnnotations;
  }, [selectedFigureTableId, figureTableAnnotations, aiFigureTableAnalysis]);

  // Prepare paper content for AI
  const paperContent: PaperContent = {
    title: paperTitle || "Untitled Paper",
    authors: [], // Authors not available from props
    abstract: "", // Abstract not available from props
    pageText,
    pageNumber,
    totalPages: numPages,
  };

  return (
    <div
      ref={viewerRef}
      className={`relative flex bg-slate-100 dark:bg-slate-950 overflow-hidden border border-slate-200 dark:border-slate-800 ${
        isFullscreen
          ? 'h-screen w-screen rounded-none'
          : 'h-[750px] rounded-xl'
      }`}
    >
      {/* Left Panel - Annotations */}
      <AnnotationPanel
        annotations={annotations}
        selectedAnnotationId={selectedAnnotationId}
        onSelectAnnotation={setSelectedAnnotationId}
        onDeleteAnnotation={handleDeleteAnnotation}
        onEditAnnotation={handleEditAnnotation}
        onHideAnnotation={handleHideAnnotation}
        onUnhideAnnotation={handleUnhideAnnotation}
        hiddenAnnotationIds={hiddenAnnotationIds}
        onAddAnnotation={handleAddAnnotation}
        currentPage={pageNumber}
        isCreatingMode={isCreatingMode}
        onToggleCreatingMode={() => {
          setIsCreatingMode(!isCreatingMode);
          setPendingHighlight(null);
          setSelectedSentenceId(null);
          window.getSelection()?.removeAllRanges();
        }}
        isInteractionDisabled={isInteractionDisabled}
        onEnableInteraction={() => setIsInteractionDisabled(false)}
        pendingHighlight={pendingHighlight}
        onClearPendingHighlight={() => {
          setPendingHighlight(null);
          setSelectedSentenceId(null);
          window.getSelection()?.removeAllRanges();
        }}
        showAIPanel={showAIPanel}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
        onToggleAIPanel={() => setShowAIPanel(!showAIPanel)}
        isUploader={isUploader}
        isFigureTableMode={isFigureTableMode}
        onToggleFigureTableMode={() => {
          setIsFigureTableMode(!isFigureTableMode);
          setPendingRegion(null);
        }}
      />

      {/* Main PDF Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* PDF Controls */}
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => changePage(-1)}
              disabled={viewMode === 'vertical' || pageNumber <= 1}
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
              disabled={viewMode === 'vertical' || pageNumber >= numPages}
              className="text-white hover:bg-slate-700 h-8 px-2"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            {/* View mode toggle */}
            <div className="w-px h-6 bg-slate-600 mx-1" />
            <div className="flex items-center gap-0.5 bg-slate-700 rounded-lg p-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('horizontal')}
                className={`h-7 px-2 ${
                  viewMode === 'horizontal'
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'text-slate-300 hover:bg-slate-600'
                }`}
                title="Single page view"
              >
                <GalleryHorizontal className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode('vertical')}
                className={`h-7 px-2 ${
                  viewMode === 'vertical'
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'text-slate-300 hover:bg-slate-600'
                }`}
                title="Continuous scroll view"
              >
                <Rows3 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Selection mode toggle - only shown in annotation creating mode */}
          {isCreatingMode && (
            <div className="flex items-center gap-1 bg-slate-700 rounded-lg p-1">
              <Button
                variant={selectionMode === "sentence" ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectionMode("sentence")}
                className={`h-7 px-3 text-xs ${
                  selectionMode === "sentence"
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "text-slate-300 hover:bg-slate-600"
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5 mr-1.5" />
                Sentence
              </Button>
              <Button
                variant={selectionMode === "region" ? "default" : "ghost"}
                size="sm"
                onClick={() => setSelectionMode("region")}
                className={`h-7 px-3 text-xs ${
                  selectionMode === "region"
                    ? "bg-indigo-600 hover:bg-indigo-700"
                    : "text-slate-300 hover:bg-slate-600"
                }`}
              >
                <Square className="w-3.5 h-3.5 mr-1.5" />
                Region
              </Button>
            </div>
          )}

          {/* Figure/Table mode indicator - shown when isFigureTableMode is active */}
          {isFigureTableMode && (
            <div className="flex items-center gap-1 bg-emerald-700 rounded-lg px-3 py-1">
              <Image className="w-3.5 h-3.5 text-white" />
              <span className="text-xs text-white font-medium">Drawing Figure/Table Region</span>
            </div>
          )}
          
          <div className="flex items-center gap-1">
            {paperTitle && (
              <span className="text-xs text-slate-400 mr-2 hidden lg:inline truncate max-w-[250px]" title={paperTitle}>
                {paperTitle}
              </span>
            )}
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

            {/* Disable Interaction Toggle */}
            <div className="w-px h-6 bg-slate-600 mx-2" />
            <Button
              variant={isInteractionDisabled ? "default" : "ghost"}
              size="sm"
              onClick={() => setIsInteractionDisabled(!isInteractionDisabled)}
              className={`h-8 px-3 gap-1.5 ${
                isInteractionDisabled
                  ? "bg-amber-600 hover:bg-amber-700 text-white"
                  : "text-white hover:bg-slate-700"
              }`}
              title={isInteractionDisabled ? "Enable interactions (highlights, comments)" : "Disable interactions for pure reading"}
            >
              {isInteractionDisabled ? (
                <>
                  <Hand className="w-4 h-4" />
                  <span className="text-xs font-medium hidden sm:inline">Reading Mode</span>
                </>
              ) : (
                <>
                  <MousePointer2 className="w-4 h-4" />
                  <span className="text-xs font-medium hidden sm:inline">Interactive</span>
                </>
              )}
            </Button>

            {/* Let Agent Read Button */}
            <div className="w-px h-6 bg-slate-600 mx-2" />
            {isAgentReading ? (
              /* Stop button when reading */
              <Button
                variant="default"
                size="sm"
                onClick={handleStopReading}
                className="h-8 px-3 gap-1.5 bg-red-600 hover:bg-red-700 text-white"
                title="Stop AI reading"
              >
                <StopCircle className="w-4 h-4" />
                <span className="text-xs font-medium">
                  Stop ({aiAnalysisProgress?.current || 0}/{aiAnalysisProgress?.total || numPages})
                </span>
              </Button>
            ) : agentHasRead ? (
              /* Re-run button after reading is complete */
              <Button
                variant="default"
                size="sm"
                onClick={handleRerunReading}
                className="h-8 px-3 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                title="Re-run AI analysis (clears previous results)"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-xs font-medium">Re-run</span>
              </Button>
            ) : (
              /* Start reading button */
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLetAgentRead}
                disabled={numPages === 0}
                className="h-8 px-3 gap-1.5 text-white hover:bg-slate-700"
                title="Let AI agent read and analyze the entire paper sentence by sentence"
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-xs font-medium">Let Agent Read</span>
              </Button>
            )}

            {/* Debug Panel Toggle */}
            <Button
              variant={showDebugPanel ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              className={`h-8 w-8 p-0 ${
                showDebugPanel
                  ? 'bg-amber-600 hover:bg-amber-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              }`}
              title={showDebugPanel ? "Hide debug panel" : "Show debug panel (tokens, prompts, responses)"}
            >
              <Bug className="w-4 h-4" />
            </Button>

            {/* AI Panel Toggle */}
            <div className="w-px h-6 bg-slate-600 mx-2" />
            <Button
              variant={showAIPanel ? "default" : "ghost"}
              size="sm"
              onClick={() => setShowAIPanel(!showAIPanel)}
              className={`h-8 px-3 gap-1.5 ${showAIPanel ? 'bg-indigo-600 hover:bg-indigo-700 text-white' : 'text-white hover:bg-slate-700'}`}
              title={showAIPanel ? "Hide AI Companion" : "Show AI Companion"}
            >
              <Bot className="w-4 h-4" />
              <span className="text-xs font-medium">AI</span>
              {showAIPanel ? (
                <PanelRightClose className="w-4 h-4" />
              ) : (
                <PanelRightOpen className="w-4 h-4" />
              )}
            </Button>

            {/* Fullscreen Toggle */}
            <div className="w-px h-6 bg-slate-600 mx-2" />
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleFullscreen}
              className="text-white hover:bg-slate-700 h-8 px-2"
              title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* PDF Content with Annotations */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-auto bg-slate-900 flex justify-center p-4"
          onScroll={viewMode === 'vertical' ? handleVerticalScroll : undefined}
        >
          {pdfLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-white/50 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading PDF...</span>
              </div>
            </div>
          )}

          {/* Single Document component for both modes to avoid worker conflicts */}
          <div
            ref={containerRef}
            className={`relative ${viewMode === 'vertical' ? 'flex flex-col items-center gap-4' : ''} ${(isCreatingMode && selectionMode === "region") || isFigureTableMode ? "cursor-crosshair" : ""}`}
            onMouseDown={viewMode === 'horizontal' ? handleMouseDown : undefined}
            onMouseMove={viewMode === 'horizontal' ? handleMouseMove : undefined}
            onMouseUp={viewMode === 'horizontal' ? handleMouseUp : undefined}
            onMouseLeave={viewMode === 'horizontal' ? () => {
              if (isDrawing) {
                setIsDrawing(false);
                setDrawStart(null);
                setDrawCurrent(null);
              }
            } : undefined}
          >
            <div ref={pageRef} className={viewMode === 'horizontal' ? "pdf-container" : ""}>
              {/* Single Document component for both modes to avoid worker conflicts */}
              <Document
                file={pdfUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onItemClick={({ pageNumber: targetPage }) => {
                  if (targetPage && targetPage !== pageNumber) {
                    setPageNumber(targetPage);
                  }
                }}
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
                className={viewMode === 'horizontal' ? "flex justify-center" : ""}
              >
                {/* Horizontal mode: render all visited pages, show only current */}
                {viewMode === 'horizontal' && Array.from(visitedPages).map((visitedPageNum) => (
                  <div
                    key={visitedPageNum}
                    style={{
                      display: visitedPageNum === pageNumber ? 'block' : 'none',
                      position: visitedPageNum === pageNumber ? 'relative' : 'absolute',
                      visibility: visitedPageNum === pageNumber ? 'visible' : 'hidden',
                    }}
                  >
                    <CachedPage
                      pageNumber={visitedPageNum}
                      scale={scale}
                      pdfUrl={pdfUrl}
                      width={pageSize.width}
                      height={pageSize.height}
                      onLoadSuccess={visitedPageNum === pageNumber ? onPageLoadSuccess : undefined}
                    />
                  </div>
                ))}

                {/* Vertical mode: all pages with lazy loading */}
                {viewMode === 'vertical' && Array.from({ length: numPages }, (_, i) => i + 1).map((pageNum) => (
                  <VerticalPageWrapper
                    key={pageNum}
                    pageNum={pageNum}
                    scale={scale}
                    pdfUrl={pdfUrl}
                    pageSize={pageSize}
                    thisPageSize={pageSizes.get(pageNum) || pageSize}
                    shouldRender={renderedPages.has(pageNum)}
                    pageSentences={sentencesPerPage.get(pageNum) || []}
                    pageFigureTables={figureTablesPerPage.get(pageNum) || []}
                    pageAnnotations={annotations.filter(
                      (a) => a.pageNumber === pageNum && !hiddenAnnotationIds.has(a.id)
                    )}
                    isInteractionDisabled={isInteractionDisabled}
                    hoveredSentenceId={hoveredSentenceId}
                    selectedSentenceId={selectedSentenceId}
                    hoveredFigureTableId={hoveredFigureTableId}
                    selectedFigureTableId={selectedFigureTableId}
                    selectedAnnotationId={selectedAnnotationId}
                    sentenceAnnotationCounts={sentenceAnnotationCounts}
                    figureTableAnnotationCounts={figureTableAnnotationCounts}
                    isCreatingMode={isCreatingMode}
                    selectionMode={selectionMode}
                    isUploader={isUploader}
                    currentUserName={currentUserName}
                    currentUserId={currentUserId}
                    onSentenceHover={setHoveredSentenceId}
                    onSentenceClick={handleSentenceClick}
                    onFigureTableHover={setHoveredFigureTableId}
                    onFigureTableClick={handleFigureTableClick}
                    onAnnotationSelect={setSelectedAnnotationId}
                    onAnnotationDelete={handleDeleteAnnotation}
                    onAnnotationHide={handleHideAnnotation}
                    onAnnotationEdit={handleEditAnnotation}
                    onAnnotationPositionChange={handlePositionChange}
                    onRegionDeleted={onRegionDeleted}
                    onPageLoad={handleVerticalPageLoad}
                    containerRef={containerRef as React.RefObject<HTMLElement>}
                    setPageRef={setPageRefCallback}
                    // Figure/Table drawing mode props
                    isFigureTableMode={isFigureTableMode}
                    onDrawStart={handleVerticalDrawStart}
                    onDrawMove={handleVerticalDrawMove}
                    onDrawEnd={handleVerticalDrawEnd}
                    isDrawing={isDrawing}
                    drawingPageNum={drawingPageNum}
                    drawingRect={drawingRect}
                  />
                ))}
              </Document>

              {/* SVG Overlay for Annotations - horizontal mode only */}
              {viewMode === 'horizontal' && pageSize.width > 0 && !isInteractionDisabled && (
                <svg
                  className="absolute top-0 left-0"
                  width={pageSize.width * scale}
                  height={pageSize.height * scale}
                  style={{
                    overflow: "visible",
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                >
                  {/* Sentence highlight layer */}
                  <SentenceHighlightLayer
                    sentences={sentences}
                    hoveredSentenceId={hoveredSentenceId}
                    selectedSentenceId={selectedSentenceId}
                    scale={scale}
                    onSentenceHover={setHoveredSentenceId}
                    onSentenceClick={handleSentenceClick}
                    sentenceAnnotationCounts={sentenceAnnotationCounts}
                    isAnnotationMode={isCreatingMode && selectionMode === "sentence"}
                  />

                  {/* Figure/Table highlight layer */}
                  <FigureTableHighlightLayer
                    figureTables={figureTables}
                    hoveredId={hoveredFigureTableId}
                    selectedId={selectedFigureTableId}
                    scale={scale}
                    onHover={setHoveredFigureTableId}
                    onClick={handleFigureTableClick}
                    discussionCounts={figureTableAnnotationCounts}
                    isAnnotationMode={isCreatingMode}
                    isUploader={isUploader}
                    onDelete={onRegionDeleted}
                  />

                  {/* Render existing annotations */}
                  {pageAnnotations.map((annotation) => (
                    <AnnotationDanmaku
                      key={annotation.id}
                      annotation={annotation}
                      isSelected={selectedAnnotationId === annotation.id}
                      onSelect={setSelectedAnnotationId}
                      onDelete={handleDeleteAnnotation}
                      onHide={handleHideAnnotation}
                      onEdit={handleEditAnnotation}
                      onPositionChange={handlePositionChange}
                      scale={scale}
                      containerRef={containerRef as React.RefObject<HTMLElement>}
                      currentUserName={currentUserName}
                      currentUserId={currentUserId}
                    />
                  ))}

                  {/* Drawing rectangle */}
                  {isDrawing && drawingRect && (
                    <rect
                      x={drawingRect.x}
                      y={drawingRect.y}
                      width={drawingRect.width}
                      height={drawingRect.height}
                      fill={isFigureTableMode ? "rgba(16, 185, 129, 0.2)" : "rgba(59, 130, 246, 0.2)"}
                      stroke={isFigureTableMode ? "#10B981" : "#3B82F6"}
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
        </div>

        {/* AI Error Banner */}
        {aiError && (
          <div className="px-4 py-2 bg-red-900/90 border-t border-red-700 flex items-center justify-between">
            <div className="flex items-center gap-2 text-red-200">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm">{aiError}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAiError(null)}
              className="text-red-200 hover:text-white hover:bg-red-800 h-6 px-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        {/* Status bar */}
        <div className="px-4 py-2 bg-slate-800 border-t border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>{pageAnnotations.length} annotations on this page</span>
            {isFigureTableMode && (
              <span className="text-emerald-400">
                Figure/Table mode - drag to draw a region around a figure or table
              </span>
            )}
            {isCreatingMode && !isFigureTableMode && (
              <span className="text-amber-400">
                {selectionMode === "sentence"
                  ? "Sentence mode - click on a sentence to select it"
                  : "Region mode - drag to draw a rectangle"
                }
              </span>
            )}
            {pendingHighlight?.selectedText && (
              <span className="text-indigo-400 truncate max-w-[200px]">
                Selected: "{pendingHighlight.selectedText}"
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

      {/* Right Panel - AI Companion (Overlay/Drawer) */}
      <AICompanionPanel
        paperContent={paperContent}
        onAddAnnotation={handleAddAnnotation}
        existingAnnotations={annotations}
        pageTextContent={pageText}
        onSearchTextInPdf={searchTextInPdf}
        dialogContainer={viewerRef.current}
        activeSession={activeSession}
        paperId={paperId}
        currentUserId={currentUserId}
        onSessionUpdated={onSessionUpdated}
        isOpen={showAIPanel}
        onClose={() => setShowAIPanel(false)}
      />

      {/* Sentence Discussion Panel */}
      <SentenceDiscussionPanel
        sentence={selectedSentence}
        annotations={selectedSentenceAnnotations}
        onAddAnnotation={handleAddSentenceAnnotation}
        onAddReply={handleAddSentenceReply}
        onDeleteAnnotation={handleDeleteSentenceAnnotation}
        onDeleteReply={handleDeleteSentenceReply}
        onEditAnnotation={handleEditSentenceAnnotation}
        onEditReply={handleEditSentenceReply}
        onClose={() => {
          setShowDiscussionPanel(false);
          setSelectedSentenceId(null);
        }}
        isOpen={showDiscussionPanel}
        agentHasRead={agentHasRead}
        onAIFollowUp={handleAIFollowUp}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
        aiPromptTemplate={aiFollowUpPromptTemplate}
        onAiPromptTemplateChange={setAiFollowUpPromptTemplate}
      />

      {/* Figure/Table Discussion Panel */}
      <FigureTableDiscussionPanel
        figureTable={selectedFigureTable}
        annotations={selectedFigureTableAnnotations}
        onAddAnnotation={handleAddFigureTableAnnotation}
        onAddReply={handleAddFigureTableReply}
        onDeleteAnnotation={handleDeleteFigureTableAnnotation}
        onDeleteReply={handleDeleteFigureTableReply}
        onEditAnnotation={handleEditFigureTableAnnotation}
        onEditReply={handleEditFigureTableReply}
        onClose={() => {
          setShowFigureTableDiscussionPanel(false);
          setSelectedFigureTableId(null);
        }}
        isOpen={showFigureTableDiscussionPanel}
        currentUserName={currentUserName}
        currentUserId={currentUserId}
      />

      {/* Pending Figure/Table Region Creation Form (for uploader) */}
      {pendingRegion && isUploader && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setPendingRegion(null)}
          />
          {/* Form Dialog */}
          <div className="relative bg-white dark:bg-slate-800 rounded-lg shadow-xl w-[400px] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                Create Figure/Table Region
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingRegion(null)}
                className="h-8 w-8 p-0"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              {/* Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="region-type">Type</Label>
                <Select
                  value={pendingRegion.type}
                  onValueChange={(value: 'figure' | 'table') =>
                    setPendingRegion(prev => prev ? { ...prev, type: value } : null)
                  }
                >
                  <SelectTrigger id="region-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="figure">Figure</SelectItem>
                    <SelectItem value="table">Table</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Label Input */}
              <div className="space-y-2">
                <Label htmlFor="region-label">Label (e.g., Figure 1, Table 2)</Label>
                <Input
                  id="region-label"
                  placeholder={pendingRegion.type === 'figure' ? 'Figure 1' : 'Table 1'}
                  value={pendingRegion.label}
                  onChange={(e) =>
                    setPendingRegion(prev => prev ? { ...prev, label: e.target.value } : null)
                  }
                />
              </div>

              {/* Caption Input */}
              <div className="space-y-2">
                <Label htmlFor="region-caption">Caption (optional)</Label>
                <Input
                  id="region-caption"
                  placeholder="Enter caption..."
                  value={pendingRegion.caption}
                  onChange={(e) =>
                    setPendingRegion(prev => prev ? { ...prev, caption: e.target.value } : null)
                  }
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button
                variant="outline"
                onClick={() => setPendingRegion(null)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (pendingRegion.label.trim()) {
                    onRegionCreated?.({
                      // Use the stored page number if available (vertical mode), otherwise use current page (horizontal mode)
                      pageNumber: pendingRegion.pageNumber ?? pageNumber,
                      type: pendingRegion.type,
                      label: pendingRegion.label.trim(),
                      caption: pendingRegion.caption.trim() || undefined,
                      boundingRect: {
                        x: pendingRegion.x,
                        y: pendingRegion.y,
                        width: pendingRegion.width,
                        height: pendingRegion.height,
                      },
                    });
                    setPendingRegion(null);
                  }
                }}
                disabled={!pendingRegion.label.trim()}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Create Region
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* AI Debug Panel */}
      {showDebugPanel && (
        <AIDebugPanel
          entries={debugEntries}
          stats={debugStats}
          isReading={isAgentReading}
          progress={aiAnalysisProgress}
          onClose={() => setShowDebugPanel(false)}
        />
      )}
    </div>
  );
}
