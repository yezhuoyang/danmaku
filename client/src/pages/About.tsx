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
} from "lucide-react";
import { PdfAnnotationViewer } from "@/components/PdfAnnotationViewer";

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

export default function About() {
  const [demoPdfUrl] = useState("/attention.pdf");

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-slate-950 dark:via-indigo-950/40 dark:to-purple-950/40">
      {/* Navigation */}
      <nav className="border-b bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/">
            <a className="flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </a>
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

      {/* Demo Section */}
      <section className="py-12 px-4 bg-slate-100 dark:bg-slate-800/50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Interactive Demo
            </h2>
            <p className="text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              Try it yourself! This is a live demo of the PaperPilot reader.
              Select text, draw regions, and add annotations.
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden">
            <div className="h-[600px]">
              <PdfAnnotationViewer
                pdfUrl={demoPdfUrl}
                paperId="demo"
                isDemo={true}
              />
            </div>
          </div>

          <p className="text-center text-sm text-slate-500 mt-4">
            Demo paper: "Attention Is All You Need" - Vaswani et al.
          </p>
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
            <Link href="/">
              <a className="hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                Home
              </a>
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
