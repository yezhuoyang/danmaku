import { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Type, Pilcrow, FileText, X, RotateCcw } from 'lucide-react';
import type { AnalysisLevel, LevelPromptConfig } from '@shared/types';

interface LevelConfigPanelProps {
  level: AnalysisLevel;
  config: LevelPromptConfig;
  onChange: (config: LevelPromptConfig) => void;
}

const LEVEL_INFO: Record<AnalysisLevel, {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  sentence: {
    name: 'Sentence',
    description: 'Analyze each sentence individually',
    icon: Type,
  },
  paragraph: {
    name: 'Paragraph',
    description: 'Analyze paragraphs for main points and connections',
    icon: Pilcrow,
  },
  section: {
    name: 'Section',
    description: 'Analyze entire sections for key contributions',
    icon: FileText,
  },
};

const DEFAULT_PROMPTS: Record<AnalysisLevel, { system: string; user: string }> = {
  sentence: {
    system: 'You are a research paper analysis assistant. Analyze each sentence and categorize it.',
    user: `Analyze this sentence from a research paper:
{{content}}

Context: {{context}}

Categorize as one of: Introduction, Background, Methodology, Result, Discussion, Conclusion, Related Work.
Also identify if it contains: Novelty, Key Finding, Limitation, Future Work.`,
  },
  paragraph: {
    system: 'You are a research paper analysis assistant. Analyze the given paragraph and provide structured analysis.',
    user: `Analyze this paragraph:
{{content}}

Context: {{context}}

Provide JSON with: summary, mainPoint, connectionToPrevious, label, flags (isKeyParagraph, containsNovelty).`,
  },
  section: {
    system: 'You are a research paper analysis assistant. Analyze the given section and provide structured analysis.',
    user: `Analyze this section titled "{{sectionTitle}}":
{{content}}

Provide JSON with: summary, keyContributions[], relationshipToGoals, label, flags (isCoreSection, containsMainResults).`,
  },
};

export function LevelConfigPanel({ level, config, onChange }: LevelConfigPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const info = LEVEL_INFO[level];
  const Icon = info.icon;

  function handleResetPrompts() {
    onChange({
      ...config,
      systemPrompt: DEFAULT_PROMPTS[level].system,
      userPromptTemplate: DEFAULT_PROMPTS[level].user,
    });
  }

  function handleAddLabel() {
    if (newLabel.trim() && !config.labels.includes(newLabel.trim())) {
      onChange({
        ...config,
        labels: [...config.labels, newLabel.trim()],
      });
      setNewLabel('');
    }
  }

  function handleRemoveLabel(label: string) {
    onChange({
      ...config,
      labels: config.labels.filter((l) => l !== label),
    });
  }

  return (
    <div className={`border rounded-lg ${config.enabled ? 'border-primary/50' : 'border-muted'}`}>
      <div className="flex items-center justify-between p-3">
        <div className="flex items-center gap-3">
          <Switch
            id={`enable-${level}`}
            checked={config.enabled}
            onCheckedChange={(enabled) => onChange({ ...config, enabled })}
          />
          <Label htmlFor={`enable-${level}`} className="flex items-center gap-2 cursor-pointer">
            <Icon className="w-4 h-4" />
            <span className="font-medium">{info.name}</span>
            <span className="text-xs text-muted-foreground">- {info.description}</span>
          </Label>
        </div>

        {config.enabled && (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                Configure
                <ChevronDown className={`w-4 h-4 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
        )}
      </div>

      {config.enabled && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleContent className="px-3 pb-3 space-y-4">
            {/* System Prompt */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor={`system-${level}`}>System Prompt</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetPrompts}
                  className="h-6 text-xs"
                >
                  <RotateCcw className="w-3 h-3 mr-1" />
                  Reset to Default
                </Button>
              </div>
              <Textarea
                id={`system-${level}`}
                value={config.systemPrompt}
                onChange={(e) => onChange({ ...config, systemPrompt: e.target.value })}
                rows={2}
                className="text-sm font-mono"
              />
            </div>

            {/* User Prompt Template */}
            <div>
              <Label htmlFor={`user-${level}`}>User Prompt Template</Label>
              <p className="text-xs text-muted-foreground mb-1">
                Available placeholders: {'{{content}}'}, {'{{context}}'}, {'{{sectionTitle}}'}
              </p>
              <Textarea
                id={`user-${level}`}
                value={config.userPromptTemplate}
                onChange={(e) => onChange({ ...config, userPromptTemplate: e.target.value })}
                rows={6}
                className="text-sm font-mono"
              />
            </div>

            {/* Labels */}
            <div>
              <Label>Labels</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Categories the AI will use to classify content
              </p>
              <div className="flex flex-wrap gap-1 mb-2">
                {config.labels.map((label) => (
                  <Badge key={label} variant="secondary" className="gap-1">
                    {label}
                    <button
                      onClick={() => handleRemoveLabel(label)}
                      className="hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Add new label..."
                  className="h-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddLabel();
                    }
                  }}
                />
                <Button size="sm" variant="outline" onClick={handleAddLabel}>
                  Add
                </Button>
              </div>
            </div>

            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Temperature: {config.temperature?.toFixed(1) ?? 0.3}</Label>
              </div>
              <Slider
                value={[config.temperature ?? 0.3]}
                onValueChange={([v]) => onChange({ ...config, temperature: v })}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <Label htmlFor={`maxTokens-${level}`}>Max Response Tokens</Label>
              <Input
                id={`maxTokens-${level}`}
                type="number"
                value={config.maxTokens ?? 1000}
                onChange={(e) => onChange({ ...config, maxTokens: parseInt(e.target.value) || 1000 })}
                min={100}
                max={4000}
                className="w-32 h-8"
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
