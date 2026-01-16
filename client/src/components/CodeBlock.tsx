import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

interface CodeBlockProps {
  code: string;
  language?: string;
  title?: string;
  showLineNumbers?: boolean;
}

export function CodeBlock({
  code,
  language = "tsx",
  title,
  showLineNumbers = true,
}: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast.success("Code copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const escapeHtml = (text: string) => {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const highlightSyntax = (code: string) => {
    // First escape HTML
    let escaped = escapeHtml(code);
    
    // Apply syntax highlighting
    return escaped
      // Keywords
      .replace(
        /\b(import|export|from|const|let|var|function|return|if|else|for|while|class|extends|interface|type|async|await|new|this|true|false|null|undefined)\b/g,
        '<span class="text-purple-400">$1</span>'
      )
      // Strings (simplified - handles most common cases)
      .replace(
        /(&quot;[^&]*&quot;|&#039;[^&]*&#039;|`[^`]*`)/g,
        '<span class="text-green-400">$&</span>'
      )
      // Comments
      .replace(
        /(\/\/.*$)/gm,
        '<span class="text-slate-500">$1</span>'
      )
      // Numbers
      .replace(
        /\b(\d+)\b/g,
        '<span class="text-orange-400">$1</span>'
      )
      // Component/Class names (PascalCase)
      .replace(
        /\b([A-Z][a-zA-Z0-9]*)\b/g,
        '<span class="text-cyan-400">$1</span>'
      )
      // Function calls
      .replace(
        /\b([a-z][a-zA-Z0-9]*)\s*\(/g,
        '<span class="text-yellow-300">$1</span>('
      );
  };

  const lines = code.split("\n");

  return (
    <div className="relative group rounded-xl overflow-hidden bg-slate-900 shadow-lg">
      {title && (
        <div className="flex items-center justify-between px-4 py-2 bg-slate-800/50 border-b border-slate-700">
          <span className="text-sm font-medium text-slate-300">{title}</span>
          <span className="text-xs text-slate-500 uppercase">{language}</span>
        </div>
      )}
      <div className="relative">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4" />
          )}
        </Button>
        <pre className="p-4 overflow-x-auto text-sm leading-relaxed font-mono">
          <code className="text-slate-100">
            {lines.map((line, i) => (
              <div key={i} className="flex">
                {showLineNumbers && (
                  <span className="select-none text-slate-600 w-8 flex-shrink-0 text-right pr-4">
                    {i + 1}
                  </span>
                )}
                <span
                  dangerouslySetInnerHTML={{ __html: highlightSyntax(line) || "&nbsp;" }}
                />
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
}
