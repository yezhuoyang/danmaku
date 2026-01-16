import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FileText,
  MessageSquare,
  Palette,
  Users,
  Sigma,
  Layers,
  Github,
  BookOpen,
  ArrowRight,
  Sparkles,
  Target,
  Zap,
} from "lucide-react";
import { PdfAnnotationViewer } from "@/components/PdfAnnotationViewer";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              Paper Danmaku
            </span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#demo" className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Demo
            </a>
            <a href="#features" className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
              How It Works
            </a>
          </div>
          <Button variant="outline" size="sm" className="gap-2">
            <Github className="w-4 h-4" />
            View Source
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 md:py-28">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 text-sm mb-6">
              <Sparkles className="w-4 h-4" />
              Collaborative Research Tool
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 dark:text-white mb-6 leading-tight">
              Read Papers Together with{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-purple-600">
                Danmaku Annotations
              </span>
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
              Add fixed annotations connected to specific text, figures, tables, and equations in research papers. 
              Support for LaTeX, custom colors, and real-time collaboration with other researchers.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" className="gap-2" asChild>
                <a href="#demo">
                  Try Live Demo
                  <ArrowRight className="w-4 h-4" />
                </a>
              </Button>
              <Button variant="outline" size="lg" className="gap-2">
                <BookOpen className="w-4 h-4" />
                Documentation
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-16 bg-slate-50 dark:bg-slate-900/50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Powerful Annotation Features
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Everything you need for collaborative paper reading and annotation
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={Target}
              title="Fixed Annotations"
              description="Annotations stay connected to specific regions in the PDF - text, figures, tables, or equations."
              color="indigo"
            />
            <FeatureCard
              icon={Sigma}
              title="LaTeX Support"
              description="Write mathematical formulas and equations using LaTeX syntax with live preview."
              color="purple"
            />
            <FeatureCard
              icon={Palette}
              title="Custom Colors"
              description="Choose from 8 vibrant colors to categorize and personalize your annotations."
              color="pink"
            />
            <FeatureCard
              icon={Layers}
              title="Region Types"
              description="Mark annotations as text, figure, table, or equation for better organization."
              color="cyan"
            />
            <FeatureCard
              icon={Users}
              title="Collaborative"
              description="See annotations from all users in real-time. Perfect for research groups and reading clubs."
              color="green"
            />
            <FeatureCard
              icon={Zap}
              title="Instant Sync"
              description="Changes sync instantly across all connected users without page refresh."
              color="amber"
            />
          </div>
        </div>
      </section>

      {/* Live Demo Section */}
      <section id="demo" className="py-16">
        <div className="container">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              Interactive Demo
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Try the annotation system with the famous "Attention Is All You Need" paper. 
              Click "Add Annotation" then drag on the PDF to create a highlight region.
            </p>
          </div>
          <PdfAnnotationViewer />
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-16 bg-slate-50 dark:bg-slate-900/50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
              How It Works
            </h2>
            <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Create annotations in three simple steps
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <StepCard
              number={1}
              title="Select Region"
              description="Click 'Add Annotation' and drag on the PDF to highlight text, figures, or tables you want to annotate."
            />
            <StepCard
              number={2}
              title="Add Content"
              description="Choose a type (text/figure/table/equation), pick a color, and write your annotation. LaTeX supported!"
            />
            <StepCard
              number={3}
              title="Collaborate"
              description="Your annotation appears instantly for all users. Click any annotation to view details or navigate to it."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-12 text-white">
            <h2 className="text-3xl font-bold mb-4">
              Ready to Annotate Together?
            </h2>
            <p className="text-indigo-100 mb-8 max-w-xl mx-auto">
              Start using Paper Danmaku for your research group, reading club, or classroom today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button size="lg" variant="secondary" className="gap-2">
                <Github className="w-4 h-4" />
                View on GitHub
              </Button>
              <Button size="lg" variant="outline" className="bg-transparent border-white text-white hover:bg-white/10 gap-2">
                <BookOpen className="w-4 h-4" />
                Read the Docs
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-slate-200 dark:border-slate-800">
        <div className="container">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center">
                <MessageSquare className="w-3 h-3 text-white" />
              </div>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Paper Danmaku - Collaborative Research Annotation
              </span>
            </div>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                GitHub
              </a>
              <a href="#" className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                Documentation
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
function FeatureCard({
  icon: Icon,
  title,
  description,
  color,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    pink: "bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400",
    cyan: "bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400",
    green: "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400",
    amber: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 hover:shadow-lg transition-shadow">
      <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center mb-4`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}

// Step Card Component
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
    <div className="text-center">
      <div className="w-12 h-12 rounded-full bg-indigo-600 text-white text-xl font-bold flex items-center justify-center mx-auto mb-4">
        {number}
      </div>
      <h3 className="font-semibold text-slate-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}
