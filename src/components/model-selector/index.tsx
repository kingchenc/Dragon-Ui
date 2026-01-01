/**
 * Model Selector Component
 * Displays available models with pricing info
 */

import React, { useState, useEffect } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DragonBadge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// Model categories with pricing
const MODEL_CATEGORIES = {
  anthropic: {
    name: 'Anthropic Claude',
    models: [
      { id: 'claude-opus-4.5', name: 'Claude Opus 4.5', input: 5.0, output: 25.0, tier: 'flagship' },
      { id: 'claude-sonnet-4.5', name: 'Claude Sonnet 4.5', input: 3.0, output: 15.0, tier: 'balanced' },
      { id: 'claude-haiku-4.5', name: 'Claude Haiku 4.5', input: 1.0, output: 5.0, tier: 'fast' },
      { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', input: 3.0, output: 15.0, tier: 'balanced' },
      { id: 'claude-opus-4', name: 'Claude Opus 4', input: 15.0, output: 75.0, tier: 'flagship' },
      { id: 'claude-3.5-sonnet', name: 'Claude 3.5 Sonnet', input: 3.0, output: 15.0, tier: 'balanced' },
      { id: 'claude-3.5-haiku', name: 'Claude 3.5 Haiku', input: 0.25, output: 1.25, tier: 'fast' },
      { id: 'claude-3-opus', name: 'Claude 3 Opus (Legacy)', input: 15.0, output: 75.0, tier: 'legacy' },
    ]
  },
  openai: {
    name: 'OpenAI',
    models: [
      { id: 'gpt-5', name: 'GPT-5', input: 1.25, output: 10.0, tier: 'flagship' },
      { id: 'gpt-5-codex', name: 'GPT-5 Codex', input: 1.50, output: 6.0, tier: 'coding' },
      { id: 'gpt-4.5-preview', name: 'GPT-4.5 Preview', input: 2.0, output: 8.0, tier: 'balanced' },
      { id: 'gpt-4o', name: 'GPT-4o', input: 2.50, output: 10.0, tier: 'balanced' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', input: 0.15, output: 0.60, tier: 'fast' },
    ]
  },
  zhipu: {
    name: 'Zhipu AI (GLM)',
    models: [
      { id: 'glm-4.7', name: 'GLM-4.7', input: 0.60, output: 2.20, tier: 'flagship' },
      { id: 'glm-4.6v', name: 'GLM-4.6V (Vision)', input: 0.30, output: 0.90, tier: 'vision' },
      { id: 'glm-4.6', name: 'GLM-4.6', input: 0.50, output: 2.0, tier: 'balanced' },
      { id: 'glm-4', name: 'GLM-4', input: 0.30, output: 1.20, tier: 'fast' },
    ]
  }
};

interface ModelSelectorProps {
  value?: string;
  onChange?: (modelId: string) => void;
  showPricing?: boolean;
  className?: string;
  compact?: boolean;
}

const getTierColor = (tier: string) => {
  switch (tier) {
    case 'flagship': return 'text-purple-500';
    case 'balanced': return 'text-blue-500';
    case 'fast': return 'text-green-500';
    case 'coding': return 'text-orange-500';
    case 'vision': return 'text-cyan-500';
    case 'legacy': return 'text-gray-500';
    default: return 'text-gray-400';
  }
};

const getTierBadge = (tier: string) => {
  switch (tier) {
    case 'flagship': return 'dragon';
    case 'balanced': return 'default';
    case 'fast': return 'secondary';
    case 'coding': return 'outline';
    case 'vision': return 'secondary';
    case 'legacy': return 'outline';
    default: return 'outline';
  }
};

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  value = 'claude-sonnet-4.5',
  onChange,
  showPricing = true,
  className,
  compact = false
}) => {
  const [selectedModel, setSelectedModel] = useState(value);

  useEffect(() => {
    setSelectedModel(value);
  }, [value]);

  const handleChange = (newValue: string) => {
    setSelectedModel(newValue);
    onChange?.(newValue);
  };

  // Find current model info
  const findModel = (id: string) => {
    for (const category of Object.values(MODEL_CATEGORIES)) {
      const found = category.models.find(m => m.id === id);
      if (found) return found;
    }
    return null;
  };

  const currentModel = findModel(selectedModel);

  return (
    <div className={cn('space-y-2', className)}>
      <Select value={selectedModel} onValueChange={handleChange}>
        <SelectTrigger className={cn(compact ? 'w-48' : 'w-full')}>
          <SelectValue placeholder="Select model...">
            {currentModel && (
              <span className="flex items-center gap-2">
                <span className={getTierColor(currentModel.tier)}>●</span>
                <span>{currentModel.name}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="max-h-80">
          {Object.entries(MODEL_CATEGORIES).map(([providerId, category]) => (
            <div key={providerId} className="py-1">
              <div className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {category.name}
              </div>
              {category.models.map((model) => (
                <SelectItem
                  key={model.id}
                  value={model.id}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2 flex-1">
                    <span className={getTierColor(model.tier)}>●</span>
                    <span>{model.name}</span>
                    {showPricing && !compact && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        ${model.input}/${model.output}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </div>
          ))}
        </SelectContent>
      </Select>

      {showPricing && currentModel && !compact && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <DragonBadge variant={getTierBadge(currentModel.tier) as any} className="text-xs">
            {currentModel.tier}
          </DragonBadge>
          <span>Input: ${currentModel.input}/1M</span>
          <span>•</span>
          <span>Output: ${currentModel.output}/1M</span>
        </div>
      )}
    </div>
  );
};

export default ModelSelector;
