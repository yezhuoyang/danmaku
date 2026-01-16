import { useState, useEffect, useCallback, useRef } from "react";
import { DanmakuItem } from "./DanmakuItem";

interface DanmakuMessage {
  id: string;
  text: string;
  color?: string;
  userName?: string;
  timestamp?: number;
}

interface DanmakuContainerProps {
  messages: DanmakuMessage[];
  enabled?: boolean;
  speed?: number;
  opacity?: number;
  fontSize?: number;
  maxTracks?: number;
  className?: string;
}

const TRACK_HEIGHT = 36;
const DANMAKU_COLORS = [
  "#ffffff",
  "#00ffff",
  "#ff6b9d",
  "#7cff7c",
  "#ffb347",
  "#b19cd9",
  "#ff6b6b",
  "#4ecdc4",
];

export function DanmakuContainer({
  messages,
  enabled = true,
  speed = 3,
  opacity = 1,
  fontSize = 16,
  maxTracks = 8,
  className = "",
}: DanmakuContainerProps) {
  const [activeDanmaku, setActiveDanmaku] = useState<
    Array<DanmakuMessage & { top: number; color: string }>
  >([]);
  const trackOccupancy = useRef<number[]>(new Array(maxTracks).fill(0));
  const processedIds = useRef<Set<string>>(new Set());

  const getAvailableTrack = useCallback(() => {
    const now = Date.now();
    for (let i = 0; i < maxTracks; i++) {
      if (trackOccupancy.current[i] < now) {
        return i;
      }
    }
    return Math.floor(Math.random() * maxTracks);
  }, [maxTracks]);

  const speedToSeconds = useCallback((speedLevel: number) => {
    const speeds: Record<number, number> = {
      1: 15,
      2: 12,
      3: 10,
      4: 8,
      5: 6,
    };
    return speeds[speedLevel] || 10;
  }, []);

  useEffect(() => {
    if (!enabled) return;

    messages.forEach((msg) => {
      if (processedIds.current.has(msg.id)) return;
      processedIds.current.add(msg.id);

      const track = getAvailableTrack();
      const duration = speedToSeconds(speed);
      trackOccupancy.current[track] = Date.now() + duration * 300;

      const color =
        msg.color || DANMAKU_COLORS[Math.floor(Math.random() * DANMAKU_COLORS.length)];

      setActiveDanmaku((prev) => [
        ...prev,
        {
          ...msg,
          top: track * TRACK_HEIGHT + 10,
          color,
        },
      ]);
    });
  }, [messages, enabled, speed, getAvailableTrack, speedToSeconds]);

  const handleAnimationEnd = useCallback((id: string) => {
    setActiveDanmaku((prev) => prev.filter((d) => d.id !== id));
  }, []);

  if (!enabled) return null;

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ opacity }}
    >
      {activeDanmaku.map((danmaku) => (
        <DanmakuItem
          key={danmaku.id}
          text={danmaku.text}
          color={danmaku.color}
          top={danmaku.top}
          userName={danmaku.userName}
          fontSize={fontSize}
          speed={speedToSeconds(speed)}
          onAnimationEnd={() => handleAnimationEnd(danmaku.id)}
        />
      ))}
    </div>
  );
}
