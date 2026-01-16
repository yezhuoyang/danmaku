import { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { DanmakuContainer, DanmakuInput, DanmakuControl } from "./danmaku";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from "lucide-react";
import { nanoid } from "nanoid";


// Set up the worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DemoSandboxProps {
  title?: string;
  description?: string;
  showControls?: boolean;
  showInput?: boolean;
  autoPlay?: boolean;
  initialMessages?: Array<{ text: string; userName?: string }>;
  pdfUrl?: string;
}

const SAMPLE_MESSAGES = [
  { text: "Attention mechanism is revolutionary! 🔥", userName: "MLResearcher" },
  { text: "Great architecture breakdown!", userName: "Bob" },
  { text: "Transformer改变了NLP领域！", userName: "小明" },
  { text: "Self-attention is the key insight", userName: "DeepLearner" },
  { text: "This paper started the LLM era", userName: "AIEnthusiast" },
  { text: "Multi-head attention is brilliant", userName: "Prof_Chen" },
  { text: "The positional encoding is clever", userName: "CodeNinja" },
  { text: "Parallelization > RNNs", userName: "Engineer" },
];

export function DemoSandbox({
  title,
  description,
  showControls = true,
  showInput = true,
  autoPlay = false,
  initialMessages = [],
  pdfUrl = "/papers/attention-paper.pdf",
}: DemoSandboxProps) {
  const [enabled, setEnabled] = useState(true);
  const [speed, setSpeed] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [fontSize, setFontSize] = useState(16);
  const [messages, setMessages] = useState<
    Array<{ id: string; text: string; userName?: string }>
  >(initialMessages.map((m) => ({ ...m, id: nanoid() })));
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  
  // PDF state
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(0.8);
  const [pdfLoading, setPdfLoading] = useState<boolean>(true);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfLoading(false);
  }, []);

  const changePage = useCallback((offset: number) => {
    setPageNumber((prevPage) => Math.max(1, Math.min(prevPage + offset, numPages)));
  }, [numPages]);

  const changeScale = useCallback((delta: number) => {
    setScale((prevScale) => Math.max(0.5, Math.min(prevScale + delta, 1.5)));
  }, []);

  const handleSendDanmaku = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: nanoid(), text, userName: "You" },
    ]);
  }, []);

  const handlePlayDemo = useCallback(() => {
    setIsPlaying(true);
    let index = 0;
    const interval = setInterval(() => {
      if (index >= SAMPLE_MESSAGES.length) {
        clearInterval(interval);
        setIsPlaying(false);
        return;
      }
      setMessages((prev) => [
        ...prev,
        { id: nanoid(), ...SAMPLE_MESSAGES[index] },
      ]);
      index++;
    }, 800);
  }, []);

  const handleReset = useCallback(() => {
    setMessages([]);
    setIsPlaying(false);
  }, []);

  return (
    <div className="rounded-2xl overflow-hidden border border-border bg-card shadow-soft">
      {(title || description) && (
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          {title && (
            <h3 className="font-semibold text-foreground">{title}</h3>
          )}
          {description && (
            <p className="text-sm text-muted-foreground mt-1">{description}</p>
          )}
        </div>
      )}

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

      {/* Demo Area with PDF */}
      <div className="relative bg-slate-900 h-[450px] overflow-hidden">
        {/* PDF Content */}
        <div className="absolute inset-0 overflow-auto flex items-start justify-center pt-4">
          {pdfLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-white/50 flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Loading PDF...</span>
              </div>
            </div>
          )}
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={null}
            error={
              <div className="flex items-center justify-center h-64">
                <div className="text-red-400 text-center">
                  <p>Failed to load PDF</p>
                  <p className="text-xs text-slate-500 mt-2">Please check your connection</p>
                </div>
              </div>
            }
            className="flex justify-center"
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={false}
              className="shadow-2xl"
              loading={null}
            />
          </Document>
        </div>

        {/* Danmaku overlay - positioned above PDF */}
        <div className="absolute inset-0 pointer-events-none">
          <DanmakuContainer
            messages={messages}
            enabled={enabled}
            speed={speed}
            opacity={opacity}
            fontSize={fontSize}
          />
        </div>
      </div>

      {/* Controls */}
      <div className="px-5 py-4 border-t border-border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePlayDemo}
              disabled={isPlaying}
              className="gap-1.5"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  Playing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Play Demo
                </>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="gap-1.5"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
          </div>

          {showControls && (
            <DanmakuControl
              enabled={enabled}
              speed={speed}
              opacity={opacity}
              fontSize={fontSize}
              onToggle={setEnabled}
              onSpeedChange={setSpeed}
              onOpacityChange={setOpacity}
              onFontSizeChange={setFontSize}
            />
          )}
        </div>

        {showInput && (
          <div className="mt-4 pt-4 border-t border-border">
            <DanmakuInput
              onSend={handleSendDanmaku}
              placeholder="Type your danmaku message..."
              disabled={!enabled}
            />
          </div>
        )}
      </div>
    </div>
  );
}
