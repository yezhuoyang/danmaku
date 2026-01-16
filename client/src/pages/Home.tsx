import { motion } from "framer-motion";
import { DemoSandbox } from "@/components/DemoSandbox";
import { ComponentCard } from "@/components/ComponentCard";
import { CodeBlock } from "@/components/CodeBlock";
import { ArchitectureDiagram } from "@/components/ArchitectureDiagram";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Box,
  Layers,
  MessageSquare,
  Settings,
  Zap,
  Shield,
  Gauge,
  Code2,
  Github,
  BookOpen,
  Play,
  ArrowRight,
  Sparkles,
} from "lucide-react";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 },
};

const COMPONENT_DATA = [
  {
    name: "DanmakuContainer",
    description: "Main container that manages multiple danmaku messages with collision detection and track-based positioning.",
    icon: Box,
    features: ["Track-based positioning", "Collision detection", "Queue management"],
    props: [
      { name: "messages", type: "DanmakuMessage[]", description: "Array of danmaku messages to display" },
      { name: "enabled", type: "boolean", default: "true", description: "Whether danmaku display is enabled" },
      { name: "speed", type: "number", default: "3", description: "Animation speed level (1-5)" },
      { name: "opacity", type: "number", default: "1", description: "Opacity of danmaku (0-1)" },
      { name: "fontSize", type: "number", default: "16", description: "Font size in pixels" },
    ],
  },
  {
    name: "DanmakuItem",
    description: "Individual danmaku message component with smooth CSS animation for horizontal scrolling.",
    icon: MessageSquare,
    features: ["Smooth animation", "Text shadow", "User attribution"],
    props: [
      { name: "text", type: "string", description: "The danmaku message content" },
      { name: "color", type: "string", default: '"#ffffff"', description: "Text color" },
      { name: "speed", type: "number", default: "10", description: "Animation duration in seconds" },
      { name: "top", type: "number", description: "Vertical position in pixels" },
      { name: "userName", type: "string", description: "Name of the user who posted" },
    ],
  },
  {
    name: "DanmakuInput",
    description: "Input component for users to send new danmaku messages with character counter and validation.",
    icon: Code2,
    features: ["Character counter", "Enter key support", "Input validation"],
    props: [
      { name: "onSend", type: "(text: string) => void", description: "Callback when user sends a danmaku" },
      { name: "placeholder", type: "string", default: '"发送弹幕..."', description: "Input placeholder text" },
      { name: "maxLength", type: "number", default: "50", description: "Maximum length of danmaku text" },
      { name: "disabled", type: "boolean", default: "false", description: "Whether input is disabled" },
    ],
  },
  {
    name: "DanmakuControl",
    description: "Control panel for danmaku settings including toggle, speed, opacity, and font size adjustments.",
    icon: Settings,
    features: ["Toggle switch", "Speed slider", "Opacity control", "Font size"],
    props: [
      { name: "enabled", type: "boolean", description: "Whether danmaku is enabled" },
      { name: "speed", type: "number", description: "Current speed level (1-5)" },
      { name: "opacity", type: "number", description: "Current opacity (0-1)" },
      { name: "fontSize", type: "number", description: "Current font size (12-24)" },
      { name: "onToggle", type: "(enabled: boolean) => void", description: "Callback when toggle changes" },
    ],
  },
];

const CODE_EXAMPLES = {
  basic: `import { DanmakuContainer, DanmakuInput } from './components/danmaku';

function PdfReader() {
  const [messages, setMessages] = useState([]);

  const handleSend = (text) => {
    setMessages(prev => [...prev, {
      id: nanoid(),
      text,
      userName: 'User'
    }]);
  };

  return (
    <div className="relative">
      <PdfViewer />
      <DanmakuContainer messages={messages} />
      <DanmakuInput onSend={handleSend} />
    </div>
  );
}`,
  advanced: `// Advanced usage with all controls
const [settings, setSettings] = useState({
  enabled: true,
  speed: 3,
  opacity: 1,
  fontSize: 16
});

<DanmakuContainer
  messages={messages}
  enabled={settings.enabled}
  speed={settings.speed}
  opacity={settings.opacity}
  fontSize={settings.fontSize}
/>

<DanmakuControl
  {...settings}
  onToggle={(enabled) => setSettings(s => ({...s, enabled}))}
  onSpeedChange={(speed) => setSettings(s => ({...s, speed}))}
  onOpacityChange={(opacity) => setSettings(s => ({...s, opacity}))}
  onFontSizeChange={(fontSize) => setSettings(s => ({...s, fontSize}))}
/>`,
  api: `// Backend API Integration
// Fetch danmaku for a specific page
const fetchDanmaku = async (paperId, pageIndex) => {
  const response = await axios.get('/kanfa/getKanfasByPaperId', {
    params: { paperId, paperIndex: pageIndex }
  });
  return response.data.kanfaList;
};

// Send new danmaku
const sendDanmaku = async (paperId, pageIndex, text) => {
  await axios.post('/kanfa/addKanfa', {
    paperId,
    paperIndex: pageIndex,
    text
  });
};`,
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <span className="font-bold text-lg">Danmaku Showcase</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#demo" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Demo
            </a>
            <a href="#components" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Components
            </a>
            <a href="#architecture" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Architecture
            </a>
            <a href="#code" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Code
            </a>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Github className="w-4 h-4" />
            <span className="hidden sm:inline">View Source</span>
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5" />
        <div
          className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, rgba(99, 102, 241, 0.15) 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        <div className="container relative py-20 md:py-32">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Badge variant="secondary" className="mb-4">
              Interactive Component Showcase
            </Badge>
            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
              <span className="gradient-text">Bullet Screen</span>
              <br />
              <span className="text-foreground">Feature Architecture</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Explore the danmaku (弹幕) system for collaborative paper reading.
              Interactive demos, live code examples, and comprehensive documentation.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button size="lg" className="gap-2" asChild>
                <a href="#demo">
                  <Play className="w-4 h-4" />
                  Try Live Demo
                </a>
              </Button>
              <Button size="lg" variant="outline" className="gap-2" asChild>
                <a href="#components">
                  <BookOpen className="w-4 h-4" />
                  View Components
                </a>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 bg-muted/30">
        <div className="container">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Zap,
                title: "High Performance",
                description: "60 FPS animations with hardware-accelerated CSS transforms and efficient track-based collision detection.",
              },
              {
                icon: Shield,
                title: "Collision Detection",
                description: "Smart track-based positioning system prevents overlapping danmaku for optimal readability.",
              },
              {
                icon: Gauge,
                title: "Customizable",
                description: "Adjust speed, opacity, font size, and more. Full control over the danmaku experience.",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                className="p-6 rounded-xl bg-background border border-border hover:shadow-lg transition-shadow"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="p-3 rounded-lg bg-primary/10 w-fit mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section id="demo" className="py-20">
        <div className="container">
          <motion.div className="text-center mb-12" {...fadeInUp}>
            <Badge variant="outline" className="mb-4">
              Interactive Demo
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Try It Yourself
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Experience the danmaku system in action. Send messages, adjust settings,
              and see how the collision detection keeps everything organized.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <DemoSandbox
              title="Live Danmaku Demo"
              description="Click 'Play Demo' to see sample messages, or type your own in the input below."
              showControls={true}
              showInput={true}
            />
          </motion.div>
        </div>
      </section>

      {/* Components Section */}
      <section id="components" className="py-20 bg-muted/30">
        <div className="container">
          <motion.div className="text-center mb-12" {...fadeInUp}>
            <Badge variant="outline" className="mb-4">
              Component Library
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Four Core Components
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              The danmaku system is built from four modular, reusable React components.
              Each component has a specific responsibility and can be customized via props.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {COMPONENT_DATA.map((component) => (
              <ComponentCard key={component.name} {...component} />
            ))}
          </div>
        </div>
      </section>

      {/* Architecture Section */}
      <section id="architecture" className="py-20">
        <div className="container">
          <motion.div className="text-center mb-12" {...fadeInUp}>
            <Badge variant="outline" className="mb-4">
              System Design
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Component Architecture
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Understanding how the components work together to create a seamless
              danmaku experience integrated with the PDF reader.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <ArchitectureDiagram />
          </div>

          {/* Architecture details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
            <motion.div
              className="p-6 rounded-xl bg-card border border-border"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                State Management
              </h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  React component state for danmaku settings
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  EventProxy for page change events
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  Local queue for danmaku display management
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  Track occupancy tracking with timestamps
                </li>
              </ul>
            </motion.div>

            <motion.div
              className="p-6 rounded-xl bg-card border border-border"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                <Gauge className="w-5 h-5 text-primary" />
                Performance Optimizations
              </h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  Track-based positioning - O(n) collision detection
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  Limited concurrency - max 30 active danmaku
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  CSS transforms for hardware acceleration
                </li>
                <li className="flex items-start gap-2">
                  <ArrowRight className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  Automatic cleanup after animation completes
                </li>
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Code Examples Section */}
      <section id="code" className="py-20 bg-muted/30">
        <div className="container">
          <motion.div className="text-center mb-12" {...fadeInUp}>
            <Badge variant="outline" className="mb-4">
              Code Examples
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Implementation Guide
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Get started quickly with these code examples. From basic usage to
              advanced configurations and backend integration.
            </p>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="basic">Basic Usage</TabsTrigger>
                <TabsTrigger value="advanced">Advanced</TabsTrigger>
                <TabsTrigger value="api">API Integration</TabsTrigger>
              </TabsList>
              <TabsContent value="basic">
                <CodeBlock
                  code={CODE_EXAMPLES.basic}
                  language="tsx"
                  title="Basic Implementation"
                />
              </TabsContent>
              <TabsContent value="advanced">
                <CodeBlock
                  code={CODE_EXAMPLES.advanced}
                  language="tsx"
                  title="Advanced Configuration"
                />
              </TabsContent>
              <TabsContent value="api">
                <CodeBlock
                  code={CODE_EXAMPLES.api}
                  language="tsx"
                  title="Backend API Integration"
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </section>

      {/* Technical Details Section */}
      <section className="py-20">
        <div className="container">
          <motion.div className="text-center mb-12" {...fadeInUp}>
            <Badge variant="outline" className="mb-4">
              Technical Details
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Under the Hood
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                title: "Animation System",
                items: [
                  "CSS Keyframe Animation",
                  "Hardware-accelerated transforms",
                  "Dynamic duration based on speed",
                  "Will-change optimization",
                ],
              },
              {
                title: "Track Algorithm",
                items: [
                  "Screen divided into horizontal tracks",
                  "Each track holds one danmaku at a time",
                  "Timestamp-based occupancy tracking",
                  "Fallback to random track if full",
                ],
              },
              {
                title: "Backend Integration",
                items: [
                  "Reuses existing Kanfa API",
                  "Page-specific danmaku storage",
                  "User authentication required",
                  "No backend changes needed",
                ],
              },
            ].map((section, i) => (
              <motion.div
                key={section.title}
                className="p-6 rounded-xl bg-card border border-border"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <h3 className="font-semibold text-lg mb-4">{section.title}</h3>
                <ul className="space-y-2">
                  {section.items.map((item) => (
                    <li
                      key={item}
                      className="flex items-center gap-2 text-sm text-muted-foreground"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <span className="font-semibold">Danmaku Component Showcase</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Built for collaborative research paper reading
            </p>
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" className="gap-2">
                <Github className="w-4 h-4" />
                GitHub
              </Button>
              <Button variant="ghost" size="sm" className="gap-2">
                <BookOpen className="w-4 h-4" />
                Docs
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
