import { motion } from "framer-motion";

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
  return (
    <motion.div
      className="absolute whitespace-nowrap pointer-events-none select-none"
      style={{
        top: `${top}px`,
        color,
        fontSize: `${fontSize}px`,
        textShadow: "1px 1px 2px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)",
        fontWeight: 600,
        letterSpacing: "0.02em",
      }}
      initial={{ x: "100vw" }}
      animate={{ x: "-100%" }}
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
