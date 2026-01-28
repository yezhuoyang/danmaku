import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { ChevronDown, Brain, MessageSquareMore, RefreshCw, Layers } from 'lucide-react';
import { useState } from 'react';
import type { ReadingStrategyType, AnalysisLevel, ReadingWorkflowConfig } from '@shared/types';

interface StrategySelectorProps {
  value: ReadingStrategyType;
  onChange: (strategy: ReadingStrategyType) => void;
  strategyConfig?: ReadingWorkflowConfig['strategyConfig'];
  onConfigChange: (config: ReadingWorkflowConfig['strategyConfig']) => void;
}

const STRATEGY_INFO: Record<ReadingStrategyType, {
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}> = {
  standard: {
    name: 'Standard',
    description: 'Analyze content sequentially at enabled levels',
    icon: Brain,
  },
  rethink: {
    name: 'Rethink',
    description: 'AI reflects after each unit to deepen understanding',
    icon: RefreshCw,
  },
  question_guided: {
    name: 'Question-Guided',
    description: 'Read with specific questions in mind',
    icon: MessageSquareMore,
  },
  multi_pass: {
    name: 'Multi-Pass',
    description: 'Multiple reading passes with different focuses',
    icon: Layers,
  },
};

export function StrategySelector({
  value,
  onChange,
  strategyConfig,
  onConfigChange,
}: StrategySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-3">
      <Label className="text-base font-semibold">Reading Strategy</Label>

      <RadioGroup
        value={value}
        onValueChange={(v) => onChange(v as ReadingStrategyType)}
        className="grid grid-cols-2 gap-3"
      >
        {(Object.keys(STRATEGY_INFO) as ReadingStrategyType[]).map((strategy) => {
          const info = STRATEGY_INFO[strategy];
          const Icon = info.icon;
          return (
            <div key={strategy} className="relative">
              <RadioGroupItem
                value={strategy}
                id={strategy}
                className="peer sr-only"
              />
              <Label
                htmlFor={strategy}
                className="flex flex-col items-start gap-2 rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{info.name}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {info.description}
                </span>
              </Label>
            </div>
          );
        })}
      </RadioGroup>

      {/* Strategy-specific configuration */}
      {value !== 'standard' && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              Strategy Settings
              <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-2">
            {value === 'rethink' && (
              <>
                <div>
                  <Label htmlFor="reflectAfter">Reflect After</Label>
                  <Select
                    value={strategyConfig?.reflectAfter || 'paragraph'}
                    onValueChange={(v) =>
                      onConfigChange({ ...strategyConfig, reflectAfter: v as AnalysisLevel })
                    }
                  >
                    <SelectTrigger id="reflectAfter">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sentence">Each Sentence</SelectItem>
                      <SelectItem value="paragraph">Each Paragraph</SelectItem>
                      <SelectItem value="section">Each Section</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="reflectionPrompt">Reflection Prompt</Label>
                  <Textarea
                    id="reflectionPrompt"
                    value={strategyConfig?.reflectionPrompt || ''}
                    onChange={(e) =>
                      onConfigChange({ ...strategyConfig, reflectionPrompt: e.target.value })
                    }
                    placeholder="What should the AI reflect on? Leave empty for default."
                    rows={3}
                  />
                </div>
              </>
            )}

            {value === 'question_guided' && (
              <div className="text-sm text-muted-foreground">
                Add your questions in the "Select Workflow" tab. The AI will keep these questions in mind while analyzing the paper.
              </div>
            )}

            {value === 'multi_pass' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Configure multiple reading passes with different focuses.
                </p>
                {(strategyConfig?.passes || [
                  { name: 'Overview', focus: 'overview' as const, levelsEnabled: ['section' as const] },
                  { name: 'Detailed', focus: 'detailed' as const, levelsEnabled: ['paragraph' as const, 'sentence' as const] },
                  { name: 'Critical', focus: 'critical' as const, levelsEnabled: ['sentence' as const] },
                ]).map((pass, index) => (
                  <div key={index} className="p-3 border rounded-lg space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Pass {index + 1}:</span>
                      <Input
                        value={pass.name}
                        onChange={(e) => {
                          const passes = [...(strategyConfig?.passes || [])];
                          passes[index] = { ...pass, name: e.target.value };
                          onConfigChange({ ...strategyConfig, passes });
                        }}
                        className="h-8"
                        placeholder="Pass name"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm">Focus:</Label>
                      <Select
                        value={pass.focus}
                        onValueChange={(v) => {
                          const passes = [...(strategyConfig?.passes || [])];
                          passes[index] = { ...pass, focus: v as 'overview' | 'detailed' | 'critical' };
                          onConfigChange({ ...strategyConfig, passes });
                        }}
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="overview">Overview</SelectItem>
                          <SelectItem value="detailed">Detailed</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
