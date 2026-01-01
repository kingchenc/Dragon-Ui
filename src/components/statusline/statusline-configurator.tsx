/**
 * Statusline Configurator
 * Interactive UI for configuring the statusline
 */

import React, { useState } from 'react';
import { useStatusline } from './hooks/useStatusline';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { DragonBadge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Settings,
  Eye,
  EyeOff,
  GripVertical,
  RotateCcw,
  RefreshCw,
  Upload,
  Download
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { STATUSLINE_STYLES, FONT_FAMILIES } from './types';
import StatuslineRenderer from './statusline-renderer';

const StatuslineConfigurator: React.FC = () => {
  const {
    config,
    updateConfig,
    toggleElement,
    setElementColor,
    setElementEmoji,
    reorderElements,
    resetConfig,
    applyPreset,
    toggleVisibility,
    isVisible,
    isEditing,
    toggleEditing,
    exportToCLI,
    importFromCLI
  } = useStatusline();

  const [draggedElement, setDraggedElement] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'exporting' | 'importing' | 'success' | 'error'>('idle');

  const handleExportToCLI = async () => {
    setSyncStatus('exporting');
    const success = await exportToCLI();
    setSyncStatus(success ? 'success' : 'error');
    setTimeout(() => setSyncStatus('idle'), 2000);
  };

  const handleImportFromCLI = async () => {
    setSyncStatus('importing');
    const success = await importFromCLI();
    setSyncStatus(success ? 'success' : 'error');
    setTimeout(() => setSyncStatus('idle'), 2000);
  };

  const handleStyleChange = (style: 'modern' | 'classic' | 'minimal' | 'dragon') => {
    applyPreset(style);
  };

  const handleColorChange = (elementId: string, color: string) => {
    setElementColor(elementId, color);
  };

  const handleEmojiChange = (elementId: string, emoji: string) => {
    setElementEmoji(elementId, emoji);
  };

  const handleDragStart = (elementId: string) => {
    setDraggedElement(elementId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (targetElementId: string) => {
    if (draggedElement && draggedElement !== targetElementId) {
      const fromIndex = config.elements.findIndex(el => el.id === draggedElement);
      const toIndex = config.elements.findIndex(el => el.id === targetElementId);
      if (fromIndex !== -1 && toIndex !== -1) {
        reorderElements(fromIndex, toIndex);
      }
    }
    setDraggedElement(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Settings className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Statusline Configuration</h3>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleVisibility}
          >
            {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={toggleEditing}
            className={isEditing ? 'bg-dragon-primary text-white' : ''}
          >
            <Settings className="h-4 w-4 mr-1" />
            {isEditing ? 'Editing' : 'Edit Mode'}
          </Button>
        </div>
      </div>

      {/* Live Preview Header */}
      <Card className="mb-6 border-dragon-primary/20 bg-dragon-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center space-x-2 text-dragon-primary">
            <Eye className="h-5 w-5" />
            <span>Live Preview</span>
            <DragonBadge variant="dragon" className="text-xs animate-pulse">
              LIVE
            </DragonBadge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="border-2 border-dragon-primary/20 rounded-lg overflow-hidden bg-background">
            <StatuslineRenderer />
          </div>
          <p className="text-xs text-dragon-primary mt-2 text-center">
            Changes are applied instantly as you modify settings
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="style" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="style">Style</TabsTrigger>
          <TabsTrigger value="elements">Elements</TabsTrigger>
          <TabsTrigger value="layout">Layout</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        {/* Style Configuration */}
        <TabsContent value="style" className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(STATUSLINE_STYLES).map(([key, style]) => (
              <Card
                key={key}
                className={cn(
                  'p-4 cursor-pointer transition-all duration-200 hover:shadow-md',
                  config.style === key && 'ring-2 ring-dragon-primary bg-dragon-primary/5'
                )}
                onClick={() => handleStyleChange(key as any)}
              >
                <div className="space-y-2">
                  <h4 className="font-medium">{style.name}</h4>
                  <p className="text-xs text-muted-foreground">{style.description}</p>
                  <div className="text-xs font-mono bg-muted p-2 rounded">
                    {style.preview}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Font Family</Label>
              <Select
                value={config.fontFamily}
                onValueChange={(value) => updateConfig({ fontFamily: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FONT_FAMILIES.map((font) => (
                    <SelectItem key={font.value} value={font.value}>
                      {font.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Font Size: {config.fontSize}px</Label>
              <Slider
                value={[config.fontSize]}
                onValueChange={([value]) => updateConfig({ fontSize: value })}
                min={8}
                max={16}
                step={1}
                className="w-full"
              />
            </div>
          </div>
        </TabsContent>

        {/* Elements Configuration */}
        <TabsContent value="elements" className="space-y-4">
          <div className="space-y-2">
            <Label>Statusline Elements</Label>
            <div className="space-y-2">
              {config.elements
                .sort((a, b) => a.order - b.order)
                .map((element) => (
                  <Card
                    key={element.id}
                    className={cn(
                      'p-3 transition-all duration-200',
                      !element.visible && 'opacity-50',
                      draggedElement === element.id && 'opacity-50'
                    )}
                    draggable={isEditing}
                    onDragStart={() => handleDragStart(element.id)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(element.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {isEditing && (
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />
                        )}
                        <Switch
                          checked={element.visible}
                          onCheckedChange={() => toggleElement(element.id)}
                        />
                        <span className="font-medium">{element.label}</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {isEditing && (
                          <>
                            <Input
                              type="color"
                              value={element.color}
                              onChange={(e) => handleColorChange(element.id, e.target.value)}
                              className="w-8 h-8 p-0 border-0 rounded cursor-pointer"
                            />
                            <Input
                              placeholder="Emoji"
                              value={element.emoji || ''}
                              onChange={(e) => handleEmojiChange(element.id, e.target.value)}
                              className="w-16 h-8 text-xs"
                              maxLength={2}
                            />
                          </>
                        )}
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: element.color }}
                        />
                        {element.emoji && <span>{element.emoji}</span>}
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          </div>
        </TabsContent>

        {/* Layout Configuration */}
        <TabsContent value="layout" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 space-y-4">
              <h4 className="font-medium">Display Settings</h4>

              <div className="flex items-center justify-between">
                <Label>Use Colors</Label>
                <Switch
                  checked={config.useColors}
                  onCheckedChange={(checked) => updateConfig({ useColors: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Use Emojis</Label>
                <Switch
                  checked={config.useEmojis}
                  onCheckedChange={(checked) => updateConfig({ useEmojis: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Compact Mode</Label>
                <Switch
                  checked={config.compactMode}
                  onCheckedChange={(checked) => updateConfig({ compactMode: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Animate Updates</Label>
                <Switch
                  checked={config.animateUpdates}
                  onCheckedChange={(checked) => updateConfig({ animateUpdates: checked })}
                />
              </div>
            </Card>

            <Card className="p-4 space-y-4">
              <h4 className="font-medium">Layout Settings</h4>

              <div className="space-y-2">
                <Label>Lines: {config.lines}</Label>
                <Slider
                  value={[config.lines]}
                  onValueChange={([value]) => updateConfig({ lines: value as 1 | 2 | 3 })}
                  min={1}
                  max={3}
                  step={1}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <Label>Refresh Interval: {config.refreshInterval}ms</Label>
                <Slider
                  value={[config.refreshInterval]}
                  onValueChange={([value]) => updateConfig({ refreshInterval: value })}
                  min={500}
                  max={5000}
                  step={500}
                  className="w-full"
                />
              </div>
            </Card>
          </div>

          <Card className="p-4 space-y-4">
            <h4 className="font-medium">Dragon UI Features</h4>

            <div className="flex items-center justify-between">
              <Label>Show Dragon Metrics</Label>
              <Switch
                checked={config.showDragonMetrics}
                onCheckedChange={(checked) => updateConfig({ showDragonMetrics: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Show Project Stats</Label>
              <Switch
                checked={config.showProjectStats}
                onCheckedChange={(checked) => updateConfig({ showProjectStats: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Show Session Info</Label>
              <Switch
                checked={config.showSessionInfo}
                onCheckedChange={(checked) => updateConfig({ showSessionInfo: checked })}
              />
            </div>
          </Card>
        </TabsContent>

        {/* Advanced Options */}
        <TabsContent value="advanced" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="p-4 space-y-4">
              <h4 className="font-medium">Reset Options</h4>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={resetConfig}
                  className="flex items-center space-x-2 w-full"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Reset to Default</span>
                </Button>

                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="flex items-center space-x-2 w-full"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Reload Application</span>
                </Button>
              </div>
            </Card>

            <Card className="p-4 space-y-4">
              <h4 className="font-medium">CLI Sync</h4>
              <p className="text-xs text-muted-foreground">
                Sync statusline configuration with CLI (dragon-ui-claude-cli)
              </p>

              <div className="space-y-2">
                <Button
                  variant="outline"
                  onClick={handleExportToCLI}
                  disabled={syncStatus !== 'idle'}
                  className="flex items-center space-x-2 w-full"
                >
                  <Upload className="h-4 w-4" />
                  <span>
                    {syncStatus === 'exporting' ? 'Exporting...' : 'Export to CLI'}
                  </span>
                </Button>

                <Button
                  variant="outline"
                  onClick={handleImportFromCLI}
                  disabled={syncStatus !== 'idle'}
                  className="flex items-center space-x-2 w-full"
                >
                  <Download className="h-4 w-4" />
                  <span>
                    {syncStatus === 'importing' ? 'Importing...' : 'Import from CLI'}
                  </span>
                </Button>

                {syncStatus === 'success' && (
                  <p className="text-xs text-green-500">Sync successful!</p>
                )}
                {syncStatus === 'error' && (
                  <p className="text-xs text-red-500">Sync failed. Check console for details.</p>
                )}
              </div>
            </Card>

            <Card className="p-4 space-y-4">
              <h4 className="font-medium">Quick Presets</h4>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStyleChange('modern')}
                  className="text-xs"
                >
                  Modern
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStyleChange('classic')}
                  className="text-xs"
                >
                  Classic
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStyleChange('minimal')}
                  className="text-xs"
                >
                  Minimal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleStyleChange('dragon')}
                  className="text-xs"
                >
                  Dragon
                </Button>
              </div>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default StatuslineConfigurator;