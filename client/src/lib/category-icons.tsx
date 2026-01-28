import {
  Cpu,
  Atom,
  Calculator,
  Dna,
  TrendingUp,
  BarChart,
  Brain,
  Sparkles,
  Eye,
  MessageSquare,
  Binary,
  Server,
  Shield,
  Zap,
  Box,
  Sigma,
  LineChart,
  Dice5,
  Globe,
  BookOpen,
  Microscope,
  HeartPulse,
  Building2,
  Scale,
  Languages,
  Music,
  Palette,
  History,
  Network,
  Database,
  Code,
  Layers,
  Workflow,
  Lightbulb,
  CircuitBoard,
  FlaskConical,
  Orbit,
  type LucideIcon,
} from 'lucide-react';

// Map icon name strings to actual Lucide icon components
export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  // Computer Science
  Cpu,
  Brain,
  Sparkles,
  Eye,
  MessageSquare,
  Binary,
  Server,
  Shield,
  Code,
  Database,
  Network,
  Layers,
  Workflow,
  CircuitBoard,

  // Physics
  Atom,
  Zap,
  Orbit,
  Box,

  // Math
  Calculator,
  Sigma,
  LineChart,
  Dice5,

  // Biology/Medicine
  Dna,
  Microscope,
  HeartPulse,
  FlaskConical,

  // Social Sciences
  TrendingUp,
  Building2,
  Scale,
  Globe,

  // Other
  BarChart,
  BookOpen,
  Languages,
  Music,
  Palette,
  History,
  Lightbulb,
};

// Get icon component from name
export function getCategoryIcon(iconName: string | undefined | null): LucideIcon | null {
  if (!iconName) return null;
  return CATEGORY_ICON_MAP[iconName] || null;
}

// Render category icon
export function CategoryIcon({
  iconName,
  className = "w-4 h-4"
}: {
  iconName: string | undefined | null;
  className?: string;
}) {
  const IconComponent = getCategoryIcon(iconName);
  if (!IconComponent) return null;
  return <IconComponent className={className} />;
}

// Color mapping for category colors
export const CATEGORY_COLOR_MAP: Record<string, string> = {
  blue: 'text-blue-500',
  purple: 'text-purple-500',
  green: 'text-green-500',
  emerald: 'text-emerald-500',
  amber: 'text-amber-500',
  cyan: 'text-cyan-500',
  indigo: 'text-indigo-500',
  violet: 'text-violet-500',
  rose: 'text-rose-500',
  pink: 'text-pink-500',
  slate: 'text-slate-500',
  orange: 'text-orange-500',
  red: 'text-red-500',
  yellow: 'text-yellow-500',
  teal: 'text-teal-500',
  lime: 'text-lime-500',
  sky: 'text-sky-500',
};

export function getCategoryColorClass(color: string | undefined | null): string {
  if (!color) return 'text-slate-500';
  return CATEGORY_COLOR_MAP[color] || 'text-slate-500';
}
