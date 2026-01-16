import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  Key,
  Cpu,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
} from "lucide-react";
import { AIProviderConfig, aiService, DEFAULT_CONFIG } from "@/lib/ai-service";

interface AISettingsPanelProps {
  onConfigChange?: (config: AIProviderConfig) => void;
  trigger?: React.ReactNode;
}

const PROVIDERS = [
  { value: 'openai', label: 'OpenAI', models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'] },
  { value: 'anthropic', label: 'Anthropic', models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'] },
  { value: 'custom', label: 'Custom Endpoint', models: [] },
];

const STORAGE_KEY = 'ai-companion-config';

export function AISettingsPanel({ onConfigChange, trigger }: AISettingsPanelProps) {
  const [open, setOpen] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const [config, setConfig] = useState<AIProviderConfig>({
    provider: 'openai',
    apiKey: '',
    model: 'gpt-4o-mini',
    baseUrl: '',
    maxTokens: 4096,
    temperature: 0.3,
  });

  // Load saved config on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(prev => ({ ...prev, ...parsed }));
        if (parsed.apiKey) {
          aiService.configure(parsed);
        }
      } catch {
        // Ignore parse errors
      }
    }
  }, []);

  const handleProviderChange = (provider: string) => {
    const providerConfig = PROVIDERS.find(p => p.value === provider);
    const defaultModel = providerConfig?.models[0] || '';
    setConfig(prev => ({
      ...prev,
      provider: provider as AIProviderConfig['provider'],
      model: defaultModel,
      baseUrl: provider === 'openai' ? '' : prev.baseUrl,
    }));
    setTestResult(null);
  };

  const handleSave = () => {
    // Save to localStorage (excluding sensitive data in production)
    const toSave = { ...config };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    
    // Configure the service
    aiService.configure(config);
    
    // Notify parent
    onConfigChange?.(config);
    
    setOpen(false);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    // Temporarily configure for testing
    aiService.configure(config);
    
    const result = await aiService.testConnection();
    setTestResult(result);
    setTesting(false);
  };

  const currentProvider = PROVIDERS.find(p => p.value === config.provider);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <Settings className="w-4 h-4" />
            AI Settings
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Cpu className="w-5 h-5 text-indigo-500" />
            AI Companion Settings
          </DialogTitle>
          <DialogDescription>
            Configure your AI provider to enable automatic annotation generation.
            Your API key is stored locally in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 overflow-y-auto flex-1 max-h-[50vh]">
          {/* Provider Selection */}
          <div className="space-y-2">
            <Label>AI Provider</Label>
            <Select value={config.provider} onValueChange={handleProviderChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(provider => (
                  <SelectItem key={provider.value} value={provider.value}>
                    {provider.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* API Key */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Key className="w-4 h-4" />
              API Key
            </Label>
            <div className="relative">
              <Input
                type={showApiKey ? "text" : "password"}
                value={config.apiKey}
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, apiKey: e.target.value }));
                  setTestResult(null);
                }}
                placeholder={config.provider === 'openai' ? "sk-..." : "Enter your API key"}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              {config.provider === 'openai' && "Get your API key from platform.openai.com"}
              {config.provider === 'anthropic' && "Get your API key from console.anthropic.com"}
              {config.provider === 'custom' && "Enter your custom API key"}
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label>Model</Label>
            {config.provider === 'custom' ? (
              <Input
                value={config.model}
                onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value }))}
                placeholder="Enter model name"
              />
            ) : (
              <Select
                value={config.model}
                onValueChange={(model) => setConfig(prev => ({ ...prev, model }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {currentProvider?.models.map(model => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Custom Base URL (for custom provider) */}
          {config.provider === 'custom' && (
            <div className="space-y-2">
              <Label>Base URL</Label>
              <Input
                value={config.baseUrl || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                placeholder="https://api.example.com/v1"
              />
            </div>
          )}

          {/* Advanced Settings */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Advanced Settings
            </h4>

            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Temperature</Label>
                <span className="text-sm text-slate-500">{config.temperature}</span>
              </div>
              <Slider
                value={[config.temperature || 0.3]}
                onValueChange={([value]) => setConfig(prev => ({ ...prev, temperature: value }))}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
              <p className="text-xs text-slate-500">
                Lower = more focused, Higher = more creative
              </p>
            </div>

            {/* Max Tokens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Max Tokens</Label>
                <span className="text-sm text-slate-500">{config.maxTokens}</span>
              </div>
              <Slider
                value={[config.maxTokens || 4096]}
                onValueChange={([value]) => setConfig(prev => ({ ...prev, maxTokens: value }))}
                min={256}
                max={8192}
                step={256}
                className="w-full"
              />
            </div>
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleTest}
              disabled={!config.apiKey || testing}
              className="gap-2"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Cpu className="w-4 h-4" />
              )}
              Test Connection
            </Button>
            
            {testResult && (
              <div className={`flex items-center gap-2 text-sm ${
                testResult.success ? 'text-green-600' : 'text-red-600'
              }`}>
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {testResult.message}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t mt-4 flex-shrink-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!config.apiKey}>
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
