import { motion } from "framer-motion";
import { useRef, useEffect, useState } from "react";

interface DanmakuItemProps {
  text: string;
  color?: string;
  speed?: number;
  top: number;
  userName?: string;
  fontSize?: number;
  onAnimationEnd?: () => void;
}

export function DanmakuItem({
  text,
  color = "#ffffff",
  speed = 10,
  top,
  userName,
  fontSize = 16,
  onAnimationEnd,
}: DanmakuItemProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const [elementWidth, setElementWidth] = useState(0);

  // Measure element width after mount
  useEffect(() => {
    if (elementRef.current) {
      setElementWidth(elementRef.current.offsetWidth);
    }
  }, [text, userName]);

  // Calculate the total distance to travel:
  // Start: just off the right edge of viewport (100% of viewport width)
  // End: completely off the left edge (negative element width)
  // Use left: 100% to start at right edge, then translate left

  return (
    <motion.div
      ref={elementRef}
      className="absolute whitespace-nowrap pointer-events-none select-none"
      style={{
        top: `${top}px`,
        left: "100%", // Start at right edge of container
        color,
        fontSize: `${fontSize}px`,
        textShadow: "1px 1px 2px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)",
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
      initial={{ x: 0 }} // At left: 100%, x: 0 means just off the right edge
      animate={{ x: `calc(-100% - 100vw)` }} // Move left by (element width + viewport width)
      transition={{
        duration: speed,
        ease: "linear",
      }}
      onAnimationComplete={onAnimationEnd}
    >
      {userName && (
        <span className="opacity-60 mr-2 text-sm">@{userName}</span>
      )}
      {text}
    </motion.div>
  );
}
