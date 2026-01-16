import { useState, useCallback } from "react";
import { DanmakuContainer, DanmakuInput, DanmakuControl } from "./danmaku";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw } from "lucide-react";
import { nanoid } from "nanoid";

interface DemoSandboxProps {
  title?: string;
  description?: string;
  showControls?: boolean;
  showInput?: boolean;
  autoPlay?: boolean;
  initialMessages?: Array<{ text: string; userName?: string }>;
}

const SAMPLE_MESSAGES = [
  { text: "This is amazing! 🎉", userName: "Alice" },
  { text: "Great architecture breakdown!", userName: "Bob" },
  { text: "弹幕功能太棒了！", userName: "小明" },
  { text: "Love the collision detection", userName: "Dev123" },
  { text: "Smooth animations!", userName: "Sarah" },
  { text: "Perfect for research papers", userName: "Prof_X" },
  { text: "Interactive documentation FTW", userName: "CodeNinja" },
  { text: "The track system is clever", userName: "Engineer" },
];

export function DemoSandbox({
  title,
  description,
  showControls = true,
  showInput = true,
  autoPlay = false,
  initialMessages = [],
}: DemoSandboxProps) {
  const [enabled, setEnabled] = useState(true);
  const [speed, setSpeed] = useState(3);
  const [opacity, setOpacity] = useState(1);
  const [fontSize, setFontSize] = useState(16);
  const [messages, setMessages] = useState<
    Array<{ id: string; text: string; userName?: string }>
  >(initialMessages.map((m) => ({ ...m, id: nanoid() })));
  const [isPlaying, setIsPlaying] = useState(autoPlay);

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

      {/* Demo Area */}
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 min-h-[320px]">
        {/* Decorative grid */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)
            `,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Demo content placeholder */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white/30">
            <div className="text-6xl mb-4">📄</div>
            <p className="text-sm">PDF Content Area</p>
          </div>
        </div>

        {/* Danmaku overlay */}
        <DanmakuContainer
          messages={messages}
          enabled={enabled}
          speed={speed}
          opacity={opacity}
          fontSize={fontSize}
        />
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
