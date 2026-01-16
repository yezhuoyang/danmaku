import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Eye, EyeOff, Settings } from "lucide-react";

interface DanmakuControlProps {
  enabled: boolean;
  speed: number;
  opacity: number;
  fontSize: number;
  onToggle: (enabled: boolean) => void;
  onSpeedChange: (speed: number) => void;
  onOpacityChange: (opacity: number) => void;
  onFontSizeChange: (fontSize: number) => void;
}

export function DanmakuControl({
  enabled,
  speed,
  opacity,
  fontSize,
  onToggle,
  onSpeedChange,
  onOpacityChange,
  onFontSizeChange,
}: DanmakuControlProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onToggle(!enabled)}
        className="gap-1.5"
      >
        {enabled ? (
          <>
            <Eye className="w-4 h-4" />
            <span className="hidden sm:inline">On</span>
          </>
        ) : (
          <>
            <EyeOff className="w-4 h-4" />
            <span className="hidden sm:inline">Off</span>
          </>
        )}
      </Button>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5">
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72" align="end">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="danmaku-toggle" className="text-sm font-medium">
                Enable Danmaku
              </Label>
              <Switch
                id="danmaku-toggle"
                checked={enabled}
                onCheckedChange={onToggle}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Speed</Label>
                <span className="text-xs text-muted-foreground">
                  {speed === 1 ? "Slow" : speed === 5 ? "Fast" : `Level ${speed}`}
                </span>
              </div>
              <Slider
                value={[speed]}
                onValueChange={([v]) => onSpeedChange(v)}
                min={1}
                max={5}
                step={1}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Opacity</Label>
                <span className="text-xs text-muted-foreground">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
              <Slider
                value={[opacity * 100]}
                onValueChange={([v]) => onOpacityChange(v / 100)}
                min={10}
                max={100}
                step={10}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Font Size</Label>
                <span className="text-xs text-muted-foreground">{fontSize}px</span>
              </div>
              <Slider
                value={[fontSize]}
                onValueChange={([v]) => onFontSizeChange(v)}
                min={12}
                max={24}
                step={2}
                className="w-full"
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
