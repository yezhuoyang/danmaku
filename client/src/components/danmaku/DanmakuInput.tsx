import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send } from "lucide-react";

interface DanmakuInputProps {
  onSend: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
}

export function DanmakuInput({
  onSend,
  placeholder = "发送弹幕...",
  maxLength = 50,
  disabled = false,
}: DanmakuInputProps) {
  const [text, setText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (text.trim() && text.length <= maxLength) {
      onSend(text.trim());
      setText("");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <Input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          className="pr-16 bg-white/90 backdrop-blur-sm border-slate-200 focus:border-primary focus:ring-primary/20"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          {text.length}/{maxLength}
        </span>
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={disabled || !text.trim()}
        className="gap-1.5"
      >
        <Send className="w-4 h-4" />
        Send
      </Button>
    </form>
  );
}
