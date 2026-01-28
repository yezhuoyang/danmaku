/**
 * Final Output Dialog
 *
 * Displays the final result of a workflow execution in a clear,
 * readable format with proper markdown rendering and syntax highlighting.
 */

import { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Copy,
  Download,
  CheckCircle,
  FileText,
  Code,
  Clock,
  Zap,
} from "lucide-react";

export interface GeneratedCode {
  blockId: string;
  blockName?: string;
  code: string;
  language: string;
  executionResult?: {
    success: boolean;
    stdout: string;
    stderr: string;
  };
}

interface FinalOutputDialogProps {
  isOpen: boolean;
  onClose: () => void;
  result: string;
  executionTime?: number;
  totalTokens?: number;
  workflowName?: string;
  /** Code blocks collected during execution (passed separately for reliability) */
  generatedCode?: GeneratedCode[];
}

interface CodeBlock {
  language: string;
  code: string;
  index: number;
  blockName?: string;
  executionResult?: {
    success: boolean;
    stdout: string;
    stderr: string;
  };
}

/**
 * Extract code blocks from markdown text.
 * Uses a more robust regex to capture code blocks.
 */
function extractCodeBlocks(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  // Match ```language\ncode``` or ```\ncode``` patterns
  const regex = /```(\w*)\r?\n([\s\S]*?)```/g;
  let match;
  let index = 0;

  while ((match = regex.exec(text)) !== null) {
    const language = match[1] || 'text';
    const code = match[2].trim();

    // Only include actual code blocks, not execution output
    // Skip if it looks like output (starts with common output patterns)
    const isLikelyOutput =
      code.startsWith('Attention Output:') ||
      code.startsWith('Output:') ||
      code.startsWith('[') && code.includes(']]\n') ||
      code.split('\n').length === 1 && !code.includes('def ') && !code.includes('function ') && !code.includes('import ');

    // If it's Python code, check for actual Python syntax
    const isPythonCode = language.toLowerCase() === 'python' || language.toLowerCase() === 'py';
    const hasPythonSyntax = code.includes('def ') || code.includes('import ') || code.includes('class ') ||
                           code.includes('for ') || code.includes('while ') || code.includes('if ') ||
                           code.includes('print(') || code.includes('return ') || code.includes('np.') ||
                           code.includes('=');

    if (!isLikelyOutput || (isPythonCode && hasPythonSyntax)) {
      blocks.push({
        language,
        code,
        index: index++,
      });
    }
  }

  return blocks;
}

/**
 * Extract ONLY Python/code blocks (not output blocks)
 */
function extractPythonCodeOnly(text: string): CodeBlock[] {
  const blocks: CodeBlock[] = [];
  const regex = /```(python|py|javascript|js|typescript|ts)\r?\n([\s\S]*?)```/gi;
  let match;
  let index = 0;

  while ((match = regex.exec(text)) !== null) {
    const language = match[1].toLowerCase();
    const code = match[2].trim();

    // Check for actual code syntax (not just output)
    const hasCodeSyntax =
      code.includes('def ') || code.includes('import ') || code.includes('class ') ||
      code.includes('function ') || code.includes('const ') || code.includes('let ') ||
      code.includes('for ') || code.includes('while ') || code.includes('if ') ||
      code.includes('return ') || code.includes('=') || code.includes('print(') ||
      code.includes('console.log(');

    if (hasCodeSyntax && code.length > 20) {
      blocks.push({
        language: language === 'py' ? 'python' : language === 'js' ? 'javascript' : language === 'ts' ? 'typescript' : language,
        code,
        index: index++,
      });
    }
  }

  return blocks;
}

/**
 * Code block component with syntax highlighting
 */
function CodeBlockDisplay({ code, language }: { code: string; language: string }) {
  const lines = code.split('\n');

  return (
    <pre className="text-sm font-mono bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto">
      {lines.map((line, i) => (
        <div key={i} className="flex hover:bg-slate-800/50">
          <span className="text-slate-500 w-8 text-right mr-4 select-none text-xs">
            {i + 1}
          </span>
          <code className="flex-1 whitespace-pre">{line || ' '}</code>
        </div>
      ))}
    </pre>
  );
}

/**
 * Custom markdown components for proper rendering
 */
const markdownComponents = {
  h1: ({ children }: { children?: React.ReactNode }) => (
    <h1 className="text-2xl font-bold mt-6 mb-3 text-foreground">{children}</h1>
  ),
  h2: ({ children }: { children?: React.ReactNode }) => (
    <h2 className="text-xl font-bold mt-5 mb-2 text-foreground">{children}</h2>
  ),
  h3: ({ children }: { children?: React.ReactNode }) => (
    <h3 className="text-lg font-semibold mt-4 mb-2 text-foreground">{children}</h3>
  ),
  h4: ({ children }: { children?: React.ReactNode }) => (
    <h4 className="text-base font-semibold mt-3 mb-1 text-foreground">{children}</h4>
  ),
  p: ({ children }: { children?: React.ReactNode }) => (
    <p className="text-sm leading-relaxed mb-3 text-foreground">{children}</p>
  ),
  ul: ({ children }: { children?: React.ReactNode }) => (
    <ul className="list-disc list-inside mb-3 space-y-1">{children}</ul>
  ),
  ol: ({ children }: { children?: React.ReactNode }) => (
    <ol className="list-decimal list-inside mb-3 space-y-1">{children}</ol>
  ),
  li: ({ children }: { children?: React.ReactNode }) => (
    <li className="text-sm text-foreground">{children}</li>
  ),
  strong: ({ children }: { children?: React.ReactNode }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
  em: ({ children }: { children?: React.ReactNode }) => (
    <em className="italic">{children}</em>
  ),
  code: ({ children, className }: { children?: React.ReactNode; className?: string }) => {
    // Check if this is a code block (has language class) or inline code
    const isBlock = className?.includes('language-');
    if (isBlock) {
      return (
        <code className="block bg-slate-900 text-slate-100 p-4 rounded-lg my-3 overflow-x-auto text-sm font-mono whitespace-pre-wrap">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-foreground">
        {children}
      </code>
    );
  },
  pre: ({ children }: { children?: React.ReactNode }) => (
    <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg my-3 overflow-x-auto text-sm font-mono whitespace-pre-wrap">
      {children}
    </pre>
  ),
  blockquote: ({ children }: { children?: React.ReactNode }) => (
    <blockquote className="border-l-4 border-muted-foreground/30 pl-4 my-3 italic text-muted-foreground">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-4 border-muted" />,
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) => (
    <a href={href} className="text-blue-500 hover:underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

export function FinalOutputDialog({
  isOpen,
  onClose,
  result,
  executionTime,
  totalTokens,
  workflowName = 'Workflow',
  generatedCode = [],
}: FinalOutputDialogProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'code' | 'raw'>('summary');

  // Use generated code if provided, otherwise extract from result
  const codeBlocks = useMemo(() => {
    // If we have generated code passed separately, use that (more reliable)
    if (generatedCode.length > 0) {
      return generatedCode.map((gc, i) => ({
        language: gc.language || 'python',
        code: gc.code,
        index: i,
        blockName: gc.blockName,
        executionResult: gc.executionResult,
      }));
    }
    // Fallback: Extract from the result text
    const pythonBlocks = extractPythonCodeOnly(result);
    if (pythonBlocks.length > 0) return pythonBlocks;
    return extractCodeBlocks(result);
  }, [result, generatedCode]);

  const hasCode = codeBlocks.length > 0;

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, []);

  const handleDownload = useCallback(() => {
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.replace(/[^a-z0-9]/gi, '_')}_output.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded output file');
  }, [result, workflowName]);

  const handleDownloadCode = useCallback(() => {
    if (codeBlocks.length === 0) return;

    // Download all code blocks as a single file
    const allCode = codeBlocks.map((block, i) =>
      `# --- Code Block ${i + 1} (${block.language}) ---\n${block.code}`
    ).join('\n\n');

    const ext = codeBlocks[0].language === 'python' ? 'py' :
                codeBlocks[0].language === 'javascript' ? 'js' :
                codeBlocks[0].language === 'typescript' ? 'ts' : 'txt';

    const blob = new Blob([allCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.replace(/[^a-z0-9]/gi, '_')}_code.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded code file');
  }, [codeBlocks, workflowName]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Workflow Complete: {workflowName}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-4">
            {executionTime && (
              <Badge variant="secondary" className="gap-1">
                <Clock className="h-3 w-3" />
                {(executionTime / 1000).toFixed(1)}s
              </Badge>
            )}
            {totalTokens !== undefined && totalTokens > 0 && (
              <Badge variant="secondary" className="gap-1">
                <Zap className="h-3 w-3" />
                {totalTokens.toLocaleString()} tokens
              </Badge>
            )}
            {hasCode && (
              <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300">
                <Code className="h-3 w-3" />
                {codeBlocks.length} code block{codeBlocks.length > 1 ? 's' : ''}
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="summary" className="gap-1">
              <FileText className="h-4 w-4" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="code" className="gap-1" disabled={!hasCode}>
              <Code className="h-4 w-4" />
              Code {hasCode && `(${codeBlocks.length})`}
            </TabsTrigger>
            <TabsTrigger value="raw" className="gap-1">
              Raw Output
            </TabsTrigger>
          </TabsList>

          <TabsContent value="summary" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[50vh]">
              <div className="p-4">
                <ReactMarkdown components={markdownComponents}>
                  {result}
                </ReactMarkdown>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="code" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[50vh]">
              <div className="p-4 space-y-6">
                {codeBlocks.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No code blocks found in the output.</p>
                ) : (
                  codeBlocks.map((block, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {block.language.charAt(0).toUpperCase() + block.language.slice(1)} Block {i + 1}
                          </Badge>
                          {block.blockName && (
                            <span className="text-xs text-muted-foreground">from {block.blockName}</span>
                          )}
                          {block.executionResult && (
                            <Badge
                              variant={block.executionResult.success ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {block.executionResult.success ? "✓ Executed" : "✗ Failed"}
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopy(block.code)}
                          className="h-7 text-xs"
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                      </div>
                      <CodeBlockDisplay code={block.code} language={block.language} />

                      {/* Show execution output if available */}
                      {block.executionResult && (
                        <div className="mt-2 space-y-2">
                          {block.executionResult.stdout && (
                            <div className="bg-green-950/30 border border-green-800/50 rounded-lg p-3">
                              <p className="text-xs font-semibold text-green-400 mb-1">Output:</p>
                              <pre className="text-xs font-mono text-green-300 whitespace-pre-wrap">
                                {block.executionResult.stdout}
                              </pre>
                            </div>
                          )}
                          {block.executionResult.stderr && (
                            <div className="bg-red-950/30 border border-red-800/50 rounded-lg p-3">
                              <p className="text-xs font-semibold text-red-400 mb-1">Error:</p>
                              <pre className="text-xs font-mono text-red-300 whitespace-pre-wrap">
                                {block.executionResult.stderr}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="raw" className="flex-1 overflow-hidden">
            <ScrollArea className="h-[50vh]">
              <pre className="p-4 text-sm font-mono bg-muted rounded-lg whitespace-pre-wrap">
                {result}
              </pre>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => handleCopy(result)}>
            {copied ? <CheckCircle className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
            {copied ? 'Copied!' : 'Copy All'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
          {hasCode && (
            <Button variant="outline" size="sm" onClick={handleDownloadCode}>
              <Code className="h-4 w-4 mr-1" />
              Download Code
            </Button>
          )}
          <Button size="sm" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
