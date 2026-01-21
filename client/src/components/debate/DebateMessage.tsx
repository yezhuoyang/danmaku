import { cn } from "@/lib/utils";
import { DebateMessage as DebateMessageType, DebateSpeaker } from "@shared/types";
import { Bot, User, Scale, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useMemo } from "react";

// Simple markdown renderer - converts markdown to React elements
function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let keyCounter = 0;

  const processInlineMarkdown = (line: string): React.ReactNode => {
    // Process inline elements: **bold**, *italic*, `code`
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let partKey = 0;

    while (remaining.length > 0) {
      // Bold: **text**
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/);
      // Italic: *text*
      const italicMatch = remaining.match(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/);
      // Code: `text`
      const codeMatch = remaining.match(/`([^`]+)`/);

      // Find the earliest match
      const matches = [
        boldMatch ? { type: 'bold', match: boldMatch, index: boldMatch.index! } : null,
        italicMatch ? { type: 'italic', match: italicMatch, index: italicMatch.index! } : null,
        codeMatch ? { type: 'code', match: codeMatch, index: codeMatch.index! } : null,
      ].filter(Boolean).sort((a, b) => a!.index - b!.index);

      if (matches.length === 0) {
        parts.push(remaining);
        break;
      }

      const first = matches[0]!;

      // Add text before the match
      if (first.index > 0) {
        parts.push(remaining.slice(0, first.index));
      }

      // Add the formatted element
      if (first.type === 'bold') {
        parts.push(<strong key={partKey++}>{first.match[1]}</strong>);
      } else if (first.type === 'italic') {
        parts.push(<em key={partKey++}>{first.match[1]}</em>);
      } else if (first.type === 'code') {
        parts.push(
          <code key={partKey++} className="px-1 py-0.5 bg-muted rounded text-xs font-mono">
            {first.match[1]}
          </code>
        );
      }

      remaining = remaining.slice(first.index + first.match[0].length);
    }

    return parts.length === 1 ? parts[0] : <>{parts}</>;
  };

  const flushList = () => {
    if (listItems.length > 0 && listType) {
      const ListTag = listType;
      elements.push(
        <ListTag key={keyCounter++} className={listType === 'ul' ? 'list-disc ml-4 space-y-1' : 'list-decimal ml-4 space-y-1'}>
          {listItems.map((item, i) => (
            <li key={i}>{processInlineMarkdown(item)}</li>
          ))}
        </ListTag>
      );
      listItems = [];
      listType = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Headers
    if (line.startsWith('### ')) {
      flushList();
      elements.push(<h4 key={keyCounter++} className="font-semibold mt-3 mb-1">{processInlineMarkdown(line.slice(4))}</h4>);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(<h3 key={keyCounter++} className="font-semibold text-base mt-3 mb-1">{processInlineMarkdown(line.slice(3))}</h3>);
      continue;
    }
    if (line.startsWith('# ')) {
      flushList();
      elements.push(<h2 key={keyCounter++} className="font-bold text-lg mt-3 mb-1">{processInlineMarkdown(line.slice(2))}</h2>);
      continue;
    }

    // Numbered list (1. 2. 3. etc)
    const numberedMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      listItems.push(numberedMatch[2]);
      continue;
    }

    // Bullet list (- or *)
    const bulletMatch = line.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      listItems.push(bulletMatch[1]);
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      flushList();
      elements.push(<div key={keyCounter++} className="h-2" />);
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(<p key={keyCounter++} className="mb-2">{processInlineMarkdown(line)}</p>);
  }

  flushList();
  return elements;
}

interface DebateMessageProps {
  message: DebateMessageType;
  className?: string;
}

const speakerConfig: Record<DebateSpeaker, {
  label: string;
  color: string;
  borderColor: string;
  tailBorderColor: string;
  avatarBg: string;
  icon: React.ReactNode;
  align: 'left' | 'right' | 'center';
}> = {
  affirmative: {
    label: "Affirmative",
    color: "text-green-700 dark:text-green-400",
    borderColor: "border-green-500 dark:border-green-400",
    tailBorderColor: "border-green-500 dark:border-green-400",
    avatarBg: "bg-green-600",
    icon: <Bot className="h-5 w-5 text-white" />,
    align: 'left',
  },
  negative: {
    label: "Negative",
    color: "text-red-700 dark:text-red-400",
    borderColor: "border-red-500 dark:border-red-400",
    tailBorderColor: "border-red-500 dark:border-red-400",
    avatarBg: "bg-red-600",
    icon: <Bot className="h-5 w-5 text-white" />,
    align: 'right',
  },
  judge: {
    label: "Judge",
    color: "text-purple-700 dark:text-purple-400",
    borderColor: "border-purple-500 dark:border-purple-400",
    tailBorderColor: "border-purple-500 dark:border-purple-400",
    avatarBg: "bg-purple-600",
    icon: <Scale className="h-5 w-5 text-white" />,
    align: 'center',
  },
  user: {
    label: "You",
    color: "text-blue-700 dark:text-blue-400",
    borderColor: "border-blue-500 dark:border-blue-400",
    tailBorderColor: "border-blue-500 dark:border-blue-400",
    avatarBg: "bg-blue-600",
    icon: <User className="h-5 w-5 text-white" />,
    align: 'right',
  },
};

export function DebateMessage({ message, className }: DebateMessageProps) {
  const config = speakerConfig[message.speaker];
  const timestamp = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  // Memoize markdown rendering for performance
  const renderedContent = useMemo(() => renderMarkdown(message.content), [message.content]);

  const isLeft = config.align === 'left';
  const isRight = config.align === 'right';
  const isCenter = config.align === 'center';

  // Center-aligned messages (Judge)
  if (isCenter) {
    return (
      <div className={cn("flex flex-col items-center my-4", className)}>
        {/* Avatar */}
        <Avatar className={cn("h-10 w-10 mb-2", config.avatarBg)}>
          <AvatarFallback className={config.avatarBg}>
            {config.icon}
          </AvatarFallback>
        </Avatar>

        {/* Speaker name and time */}
        <div className="flex items-center gap-2 mb-1">
          <span className={cn("text-sm font-medium", config.color)}>
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground">{timestamp}</span>
        </div>

        {/* Message bubble */}
        <div
          className={cn(
            "max-w-[85%] rounded-2xl px-5 py-3 border-2 bg-background",
            config.borderColor,
            message.isInterruption && "ring-2 ring-yellow-400"
          )}
        >
          <div className="text-sm leading-relaxed">
            {renderedContent}
          </div>

          {/* Citations */}
          {message.metadata?.citations && message.metadata.citations.length > 0 && (
            <div className="mt-2 pt-2 border-t border-current/20 flex items-center gap-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3" />
              <span>Citations: {message.metadata.citations.join(", ")}</span>
            </div>
          )}

          {/* Token count */}
          {message.tokenCount && (
            <div className="mt-1 text-xs text-muted-foreground">
              {message.tokenCount} tokens
            </div>
          )}
        </div>

        {/* Intervention badge */}
        {message.isInterruption && (
          <span className="mt-1 text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded-full">
            Intervention
          </span>
        )}
      </div>
    );
  }

  // Left or right aligned messages (Affirmative, Negative, User)
  return (
    <div
      className={cn(
        "flex gap-3 my-3 w-full",
        isRight && "flex-row-reverse",
        className
      )}
    >
      {/* Avatar */}
      <Avatar className={cn("h-10 w-10 flex-shrink-0", config.avatarBg)}>
        <AvatarFallback className={config.avatarBg}>
          {config.icon}
        </AvatarFallback>
      </Avatar>

      {/* Message content */}
      <div className={cn("flex flex-col max-w-[50%]", isRight && "items-end")}>
        {/* Speaker name and time */}
        <div className={cn("flex items-center gap-2 mb-1", isRight && "flex-row-reverse")}>
          <span className={cn("text-sm font-medium", config.color)}>
            {config.label}
          </span>
          <span className="text-xs text-muted-foreground">{timestamp}</span>
          {message.isInterruption && (
            <span className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-2 py-0.5 rounded-full">
              Intervention
            </span>
          )}
        </div>

        {/* Chat bubble with tail */}
        <div className="relative">
          {/* Bubble tail - using border trick for outlined style */}
          <div
            className={cn(
              "absolute top-3 w-3 h-3 rotate-45 border-2 bg-background",
              config.borderColor,
              isLeft ? "-left-1.5 border-r-0 border-t-0" : "-right-1.5 border-l-0 border-b-0"
            )}
          />

          {/* Bubble content */}
          <div
            className={cn(
              "relative rounded-2xl px-4 py-3 border-2 bg-background",
              config.borderColor,
              isLeft ? "rounded-tl-sm" : "rounded-tr-sm",
              message.isInterruption && "ring-2 ring-yellow-400"
            )}
          >
            <div className="text-sm leading-relaxed">
              {renderedContent}
            </div>

            {/* Citations */}
            {message.metadata?.citations && message.metadata.citations.length > 0 && (
              <div className="mt-2 pt-2 border-t border-current/20 flex items-center gap-1 text-xs text-muted-foreground">
                <MessageSquare className="h-3 w-3" />
                <span>Citations: {message.metadata.citations.join(", ")}</span>
              </div>
            )}

            {/* Token count */}
            {message.tokenCount && (
              <div className={cn("mt-1 text-xs text-muted-foreground", isRight && "text-right")}>
                {message.tokenCount} tokens
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
