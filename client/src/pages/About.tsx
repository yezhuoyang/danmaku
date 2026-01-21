import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  MessageSquare,
  Users,
  Brain,
  Sparkles,
  FileText,
  Zap,
  Search,
  Share2,
  BookOpen,
  ChevronRight,
  MousePointer2,
  PenTool,
  Tag,
  Bot,
  ThumbsUp,
  ThumbsDown,
  Reply,
  Eye,
  Lightbulb,
  HelpCircle,
  AlertCircle,
  Star,
  CheckCircle,
  Play,
} from "lucide-react";

// Feature card component
function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
      <CardContent className="p-6">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center mb-4">
          <Icon className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        <p className="text-slate-600 dark:text-slate-300">{description}</p>
      </CardContent>
    </Card>
  );
}

// Step card component
function StepCard({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-10 h-10 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center">
        <span className="text-indigo-600 dark:text-indigo-400 font-bold">
          {number}
        </span>
      </div>
      <div>
        <h3 className="font-semibold mb-1">{title}</h3>
        <p className="text-slate-600 dark:text-slate-300 text-sm">
          {description}
        </p>
      </div>
    </div>
  );
}

// Tutorial step component with visual demo
function TutorialStep({
  stepNumber,
  title,
  description,
  children,
  isActive,
  onClick,
}: {
  stepNumber: number;
  title: string;
  description: string;
  children: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <div
      className={`rounded-xl border-2 transition-all cursor-pointer ${
        isActive
          ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20"
          : "border-slate-200 dark:border-slate-700 hover:border-indigo-300"
      }`}
      onClick={onClick}
    >
      <div className="p-4 flex items-start gap-4">
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            isActive
              ? "bg-indigo-500 text-white"
              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
          }`}
        >
          {stepNumber}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-slate-900 dark:text-white mb-1">
            {title}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>
      {isActive && (
        <div className="px-4 pb-4">
          <div className="mt-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden">
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

// Mock annotation badge
function MockAnnotationBadge({ type, color }: { type: string; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
      style={{ backgroundColor: color }}
    >
      {type}
    </span>
  );
}

// Interactive Tutorial Component
function InteractiveTutorial() {
  const [activeStep, setActiveStep] = useState(1);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      {/* Steps List */}
      <div className="space-y-3">
        <TutorialStep
          stepNumber={1}
          title="Select Text to Annotate"
          description="Highlight any text in the PDF to add your comments, questions, or insights."
          isActive={activeStep === 1}
          onClick={() => setActiveStep(1)}
        >
          <div className="p-4">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 font-serif text-sm leading-relaxed">
              <p className="mb-2">
                The dominant sequence transduction models are based on complex recurrent or
                convolutional neural networks...
              </p>
              <p className="relative">
                We propose a new simple network architecture,{" "}
                <span className="bg-yellow-200 dark:bg-yellow-900/50 px-1 rounded relative">
                  the Transformer
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap">
                    <span className="bg-indigo-500 text-white text-xs px-2 py-1 rounded shadow-lg flex items-center gap-1">
                      <MousePointer2 className="w-3 h-3" />
                      Click to annotate
                    </span>
                  </span>
                </span>
                , based solely on attention mechanisms.
              </p>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
              <MousePointer2 className="w-4 h-4" />
              <span>Select text → Choose label → Add comment</span>
            </div>
          </div>
        </TutorialStep>

        <TutorialStep
          stepNumber={2}
          title="Draw Figure/Table Regions"
          description="Click 'Draw Region' to annotate figures, tables, and equations by drawing rectangles."
          isActive={activeStep === 2}
          onClick={() => setActiveStep(2)}
        >
          <div className="p-4">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-4 relative">
              {/* Mock figure with drawn region */}
              <div className="bg-slate-200 dark:bg-slate-700 h-32 rounded flex items-center justify-center relative">
                <span className="text-slate-500 dark:text-slate-400 text-sm">[Figure 1: Model Architecture]</span>
                <div className="absolute inset-2 border-2 border-dashed border-green-500 rounded bg-green-500/10 flex items-center justify-center">
                  <span className="bg-green-500 text-white text-xs px-2 py-1 rounded">Figure 1</span>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button size="sm" variant="outline" className="text-xs h-7">
                  <PenTool className="w-3 h-3 mr-1" />
                  Draw Region
                </Button>
                <span className="text-xs text-slate-500">Click and drag to select area</span>
              </div>
            </div>
          </div>
        </TutorialStep>

        <TutorialStep
          stepNumber={3}
          title="Choose Annotation Labels"
          description="Categorize your annotations with semantic labels for better organization."
          isActive={activeStep === 3}
          onClick={() => setActiveStep(3)}
        >
          <div className="p-4">
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="flex items-center gap-2 p-2 rounded bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
                <Lightbulb className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Insight</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-purple-50 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-800">
                <HelpCircle className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">Question</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium">Important</span>
              </div>
              <div className="flex items-center gap-2 p-2 rounded bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-sm font-medium">Confusing</span>
              </div>
            </div>
            <div className="text-xs text-slate-500">
              Labels help you and others quickly understand the nature of each annotation.
            </div>
          </div>
        </TutorialStep>

        <TutorialStep
          stepNumber={4}
          title="Let AI Read the Paper"
          description="Use AI to analyze sentences, identify key contributions, and summarize content."
          isActive={activeStep === 4}
          onClick={() => setActiveStep(4)}
        >
          <div className="p-4">
            <div className="flex items-center gap-3 mb-3">
              <Button size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white h-8">
                <Sparkles className="w-3 h-3 mr-1" />
                Let Agent Read
              </Button>
              <span className="text-xs text-slate-500">AI analyzes the entire paper</span>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2 p-2 rounded bg-emerald-50 dark:bg-emerald-900/30">
                <Star className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Key Contribution</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    The Transformer model relies entirely on self-attention...
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-2 rounded bg-blue-50 dark:bg-blue-900/30">
                <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Method</span>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    Multi-head attention allows the model to attend to information...
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TutorialStep>

        <TutorialStep
          stepNumber={5}
          title="Interact with Annotations"
          description="Like, dislike, or reply to annotations from other readers."
          isActive={activeStep === 5}
          onClick={() => setActiveStep(5)}
        >
          <div className="p-4">
            <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
              {/* Mock annotation */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  P
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm">Prof. Chen</span>
                    <MockAnnotationBadge type="Insight" color="#3B82F6" />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    This attention mechanism is brilliant - it allows the model to focus on relevant parts of the input...
                  </p>
                  <div className="flex items-center gap-3">
                    <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-green-600">
                      <ThumbsUp className="w-3 h-3" />
                      <span>12</span>
                    </button>
                    <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600">
                      <ThumbsDown className="w-3 h-3" />
                      <span>2</span>
                    </button>
                    <button className="flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600">
                      <Reply className="w-3 h-3" />
                      <span>Reply</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TutorialStep>

        <TutorialStep
          stepNumber={6}
          title="AI Conference-Style Reviews"
          description="Generate comprehensive AI reviews with ratings on novelty, correctness, and more."
          isActive={activeStep === 6}
          onClick={() => setActiveStep(6)}
        >
          <div className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Novelty of Solution</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`w-5 h-5 rounded ${i <= 3 ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
                    />
                  ))}
                  <span className="ml-2 font-medium">3/4</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Correctness</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`w-5 h-5 rounded ${i <= 4 ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
                    />
                  ))}
                  <span className="ml-2 font-medium">4/4</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">Writing Quality</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`w-5 h-5 rounded ${i <= 3 ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"}`}
                    />
                  ))}
                  <span className="ml-2 font-medium">3/4</span>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-indigo-500" />
                  <span className="text-xs text-slate-500">Generated by GPT-4o</span>
                </div>
              </div>
            </div>
          </div>
        </TutorialStep>
      </div>

      {/* Preview Panel */}
      <div className="hidden lg:block sticky top-24 h-fit">
        <Card className="border-0 shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-4">
            <h3 className="text-white font-semibold flex items-center gap-2">
              <Play className="w-5 h-5" />
              Feature Preview
            </h3>
          </div>
          <CardContent className="p-0">
            {/* Mock PDF viewer header */}
            <div className="bg-slate-800 p-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs">Page 1 / 15</span>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-300">
                  <Eye className="w-3 h-3 mr-1" />
                  85%
                </Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-300">
                  Interactive
                </Button>
              </div>
            </div>
            {/* Mock PDF content */}
            <div className="bg-white dark:bg-slate-900 p-6 min-h-[400px]">
              <h4 className="text-lg font-bold mb-2 text-center">Attention Is All You Need</h4>
              <p className="text-xs text-center text-slate-500 mb-4">
                Ashish Vaswani, Noam Shazeer, Niki Parmar, et al.
              </p>
              <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <p>
                  <span className="font-semibold">Abstract.</span> The dominant sequence transduction models are based on complex
                  recurrent or convolutional neural networks that include an encoder and a decoder.
                </p>
                {activeStep === 1 && (
                  <p className="relative">
                    We propose a new simple network architecture,{" "}
                    <span className="bg-yellow-200 dark:bg-yellow-700/50 px-1 rounded cursor-pointer">
                      the Transformer
                    </span>
                    , based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.
                  </p>
                )}
                {activeStep === 2 && (
                  <div className="my-4">
                    <div className="border-2 border-dashed border-green-500 rounded-lg p-4 bg-green-50 dark:bg-green-900/20">
                      <div className="text-center text-slate-400 text-xs">[Figure 1 - Model Architecture]</div>
                      <div className="mt-2 h-20 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center">
                        <span className="text-xs text-slate-400">Architecture Diagram</span>
                      </div>
                    </div>
                  </div>
                )}
                {activeStep >= 3 && activeStep <= 4 && (
                  <>
                    <p>
                      Experiments on two machine translation tasks show these models to be superior in quality
                      while being more parallelizable and requiring significantly less time to train.
                    </p>
                    {activeStep === 4 && (
                      <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3 mt-3">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="w-4 h-4 text-indigo-500" />
                          <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">AI Analysis</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          This sentence highlights the key experimental results. The authors demonstrate both quality
                          improvements and efficiency gains.
                        </p>
                      </div>
                    )}
                  </>
                )}
                {activeStep === 5 && (
                  <div className="relative">
                    <p>
                      On the WMT 2014 English-to-German translation task, the big transformer model outperforms
                      the best previously reported models.
                    </p>
                    {/* Mock floating annotation */}
                    <div className="absolute -right-2 top-0 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 p-2 text-xs">
                      <div className="flex items-center gap-1 mb-1">
                        <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">R</div>
                        <span className="font-medium">Researcher</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400 mb-1">Impressive improvement!</p>
                      <div className="flex items-center gap-2 text-slate-400">
                        <ThumbsUp className="w-3 h-3" />
                        <span>5</span>
                      </div>
                    </div>
                  </div>
                )}
                {activeStep === 6 && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-4 mt-3">
                    <div className="flex items-center gap-2 mb-3">
                      <Bot className="w-5 h-5 text-indigo-500" />
                      <span className="font-medium text-sm">AI Review Summary</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      <strong>Strengths:</strong> Novel architecture that achieves state-of-the-art results.
                      Clear presentation of the attention mechanism.
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2">
                      <strong>Overall:</strong> Strong accept - significant contribution to the field.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function About() {

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
      {/* Navigation */}
      <nav className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">
              PaperPilot
            </span>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white mb-6">
            About PaperPilot
          </h1>
          <p className="text-xl text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
            A collaborative platform for reading and annotating academic papers
            with real-time danmaku-style comments and AI-powered analysis.
          </p>
        </div>
      </section>

      {/* Tutorial Section */}
      <section className="py-12 px-4 bg-slate-100 dark:bg-slate-800/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Interactive Tutorial
            </h2>
            <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Learn how to use PaperPilot's powerful features. Click on each step to see it in action.
            </p>
          </div>

          <InteractiveTutorial />

          <div className="mt-8 text-center">
            <Button size="lg" asChild>
              <Link href="/browse">
                <BookOpen className="w-5 h-5 mr-2" />
                Try It Now - Browse Papers
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Features
            </h2>
            <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Everything you need for collaborative paper reading and analysis.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={MessageSquare}
              title="Danmaku Annotations"
              description="Add floating comments that appear at specific positions in the PDF, inspired by video danmaku culture."
            />
            <FeatureCard
              icon={Users}
              title="Collaborative Reading"
              description="See annotations from other readers in real-time. Build knowledge together as a community."
            />
            <FeatureCard
              icon={Brain}
              title="AI-Powered Analysis"
              description="Let AI read through the paper and provide summaries, identify key concepts, and highlight novel contributions."
            />
            <FeatureCard
              icon={Sparkles}
              title="Smart Labeling"
              description="Categorize annotations with labels like Insight, Question, Important, Confusing, and more."
            />
            <FeatureCard
              icon={FileText}
              title="Text & Region Selection"
              description="Select text directly or draw regions to annotate figures, tables, and equations."
            />
            <FeatureCard
              icon={Zap}
              title="Real-time Sync"
              description="Your annotations sync instantly across devices. Never lose your reading progress."
            />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4 bg-slate-100 dark:bg-slate-800/50">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Get started in just a few simple steps.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <StepCard
                number={1}
                title="Find or Add a Paper"
                description="Search for papers by title, author, or arXiv ID. You can also add new papers by providing an arXiv link or uploading a PDF."
              />
              <StepCard
                number={2}
                title="Enter Reading Mode"
                description="Click 'Enter Reading Mode' to open the interactive PDF viewer with annotation capabilities."
              />
              <StepCard
                number={3}
                title="Add Annotations"
                description="Select text or draw regions, then add your comments, questions, or insights. Choose a label to categorize your annotation."
              />
            </div>
            <div className="space-y-6">
              <StepCard
                number={4}
                title="Explore AI Analysis"
                description="Use 'Let Agent Read' to have AI analyze the paper, identify key points, and summarize each section."
              />
              <StepCard
                number={5}
                title="Collaborate"
                description="See annotations from other readers. Reply to discussions and build understanding together."
              />
              <StepCard
                number={6}
                title="Track Progress"
                description="View your reading history, manage annotations, and rate papers to track your progress."
              />
            </div>
          </div>
        </div>
      </section>

      {/* About the Creator Section */}
      <section className="py-16 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              About the Creator
            </h2>
          </div>

          <Card className="border-0 shadow-lg">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-3xl text-white font-bold">YZ</span>
                </div>
                <div className="text-center md:text-left">
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                    Zhuoyang Ye
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 mb-4">
                    I'm a CS PhD student at UCLA, advised by Professor Jens Palsberg.
                    My research focuses on programming languages and software engineering.
                    PaperPilot was created to make academic paper reading more collaborative
                    and engaging, combining the power of AI with community-driven annotations.
                  </p>
                  <a
                    href="https://yezhuoyang.github.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium transition-colors"
                  >
                    Visit my personal website
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 px-4 bg-slate-100 dark:bg-slate-800/50">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-8">
            Join our community of researchers, students, and curious minds
            reading papers together.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/browse">
                <Search className="w-5 h-5 mr-2" />
                Browse Papers
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/register">
                <ChevronRight className="w-5 h-5 mr-2" />
                Create Account
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t bg-white dark:bg-slate-900">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-white">
              PaperPilot
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Read and Review Papers with Others and AI Agents
          </p>
          <div className="flex items-center justify-center gap-6 mt-4 text-sm text-slate-500">
            <Link href="/" className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
              Home
            </Link>
            <a
              href="https://github.com/yezhuoyang/danmaku"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              GitHub
            </a>
            <a
              href="#"
              className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
            >
              Documentation
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
