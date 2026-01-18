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

// Active danmaku with display info
interface ActiveDanmaku extends DanmakuMessage {
  instanceId: string; // Unique ID per animation instance (allows same message to appear multiple times)
  top: number;
  color: string;
}

export function DanmakuContainer({
  messages,
  enabled = true,
  speed = 3,
  opacity = 1,
  fontSize = 16,
  maxTracks = 8,
  className = "",
}: DanmakuContainerProps) {
  // Active danmaku currently animating on screen
  const [activeDanmaku, setActiveDanmaku] = useState<ActiveDanmaku[]>([]);

  // Queue of messages waiting to be displayed (for cycling)
  const queueRef = useRef<DanmakuMessage[]>([]);

  // Track when each track will be available (timestamp)
  const trackOccupancy = useRef<number[]>(new Array(maxTracks).fill(0));

  // Store assigned colors for each message ID (to maintain consistent colors across cycles)
  const messageColors = useRef<Map<string, string>>(new Map());

  // Counter for unique instance IDs
  const instanceCounter = useRef(0);

  // Ref to track if we've initialized the queue
  const initializedRef = useRef(false);

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

  // Get or assign a color for a message
  const getMessageColor = useCallback((msg: DanmakuMessage) => {
    if (msg.color) return msg.color;

    let color = messageColors.current.get(msg.id);
    if (!color) {
      color = DANMAKU_COLORS[Math.floor(Math.random() * DANMAKU_COLORS.length)];
      messageColors.current.set(msg.id, color);
    }
    return color;
  }, []);

  // Find an available track
  const getAvailableTrack = useCallback(() => {
    const now = Date.now();
    for (let i = 0; i < maxTracks; i++) {
      if (trackOccupancy.current[i] < now) {
        return i;
      }
    }
    return -1; // No track available
  }, [maxTracks]);

  // Process the queue and launch danmaku
  const processQueue = useCallback(() => {
    if (!enabled || queueRef.current.length === 0) return;

    const track = getAvailableTrack();
    if (track === -1) return; // No track available

    const msg = queueRef.current.shift();
    if (!msg) return;

    const duration = speedToSeconds(speed);
    // Mark track as occupied until the danmaku has moved enough for the next one to start
    // Use 40% of duration to allow some overlap
    trackOccupancy.current[track] = Date.now() + duration * 400;

    const color = getMessageColor(msg);
    const instanceId = `${msg.id}-${instanceCounter.current++}`;

    setActiveDanmaku((prev) => [
      ...prev,
      {
        ...msg,
        instanceId,
        top: track * TRACK_HEIGHT + 10,
        color,
      },
    ]);
  }, [enabled, speed, getAvailableTrack, speedToSeconds, getMessageColor]);

  // Initialize queue when messages change
  useEffect(() => {
    if (!enabled) return;

    // Check for new messages and add them to the queue
    const currentIds = new Set(queueRef.current.map(m => m.id));
    const activeIds = new Set(activeDanmaku.map(d => d.id));

    messages.forEach((msg) => {
      // Add message to queue if it's not already queued or active
      if (!currentIds.has(msg.id) && !activeIds.has(msg.id)) {
        queueRef.current.push(msg);
      }
    });

    // Remove messages from queue that are no longer in the messages array
    const messageIds = new Set(messages.map(m => m.id));
    queueRef.current = queueRef.current.filter(m => messageIds.has(m.id));

    // Clean up colors for removed messages
    messageColors.current.forEach((_, id) => {
      if (!messageIds.has(id)) {
        messageColors.current.delete(id);
      }
    });

    initializedRef.current = true;
  }, [messages, enabled, activeDanmaku]);

  // Process queue periodically to launch new danmaku
  useEffect(() => {
    if (!enabled) return;

    // Process immediately
    processQueue();

    // Set up interval to check for available tracks
    const interval = setInterval(() => {
      processQueue();
    }, 500); // Check every 500ms

    return () => clearInterval(interval);
  }, [enabled, processQueue]);

  // Handle animation end - add the message back to queue for cycling
  const handleAnimationEnd = useCallback((instanceId: string, originalId: string) => {
    setActiveDanmaku((prev) => {
      const filtered = prev.filter((d) => d.instanceId !== instanceId);

      // Add the message back to queue if it still exists in messages
      // and there are no other instances of the same message waiting
      const isStillInMessages = messages.some(m => m.id === originalId);
      const isAlreadyQueued = queueRef.current.some(m => m.id === originalId);
      const isStillActive = filtered.some(d => d.id === originalId);

      if (isStillInMessages && !isAlreadyQueued && !isStillActive) {
        const msg = messages.find(m => m.id === originalId);
        if (msg) {
          queueRef.current.push(msg);
        }
      }

      return filtered;
    });
  }, [messages]);

  if (!enabled) return null;

  return (
    <div
      className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}
      style={{ opacity }}
    >
      {activeDanmaku.map((danmaku) => (
        <DanmakuItem
          key={danmaku.instanceId}
          text={danmaku.text}
          color={danmaku.color}
          top={danmaku.top}
          userName={danmaku.userName}
          fontSize={fontSize}
          speed={speedToSeconds(speed)}
          onAnimationEnd={() => handleAnimationEnd(danmaku.instanceId, danmaku.id)}
        />
      ))}
    </div>
  );
}
