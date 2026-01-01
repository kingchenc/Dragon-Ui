/**
 * Terminal Settings Component
 * Configuration panel for terminal appearance and behavior
 */

import React from 'react';
import { X, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTerminalStore } from './useTerminal';
import { DEFAULT_TERMINAL_CONFIG, TerminalThemeName, TERMINAL_THEMES } from './types';
import { cn } from '@/lib/utils';

interface TerminalSettingsProps {
  onClose?: () => void;
}

const CURSOR_STYLES = [
  { value: 'block', label: 'Block' },
  { value: 'underline', label: 'Underline' },
  { value: 'bar', label: 'Bar' }
];

const FONT_FAMILIES = [
  { value: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace', label: 'JetBrains Mono' },
  { value: '"Fira Code", "Cascadia Code", Consolas, monospace', label: 'Fira Code' },
  { value: '"Cascadia Code", Consolas, monospace', label: 'Cascadia Code' },
  { value: 'Consolas, monospace', label: 'Consolas' },
  { value: '"Source Code Pro", monospace', label: 'Source Code Pro' },
  { value: '"SF Mono", monospace', label: 'SF Mono' },
  { value: 'monospace', label: 'System Mono' }
];

const TerminalSettings: React.FC<TerminalSettingsProps> = ({ onClose }) => {
  const { config, updateConfig, availableShells } = useTerminalStore();

  const handleReset = () => {
    updateConfig(DEFAULT_TERMINAL_CONFIG);
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Terminal Settings</h3>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-zinc-800"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Theme */}
      <div className="space-y-2">
        <Label>Theme</Label>
        <Select
          value={config.theme}
          onValueChange={(value: TerminalThemeName) => updateConfig({ theme: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dragon">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ background: TERMINAL_THEMES.dragon.background }} />
                <span>Dragon (Dark Red)</span>
              </div>
            </SelectItem>
            <SelectItem value="dark">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded" style={{ background: TERMINAL_THEMES.dark.background }} />
                <span>Dark</span>
              </div>
            </SelectItem>
            <SelectItem value="light">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded border" style={{ background: TERMINAL_THEMES.light.background }} />
                <span>Light</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Default Shell */}
      <div className="space-y-2">
        <Label>Default Shell</Label>
        <Select
          value={config.defaultShell}
          onValueChange={(value) => updateConfig({ defaultShell: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableShells.map((shell) => (
              <SelectItem key={shell.id} value={shell.id}>
                {shell.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Font Size */}
      <div className="space-y-2">
        <Label>Font Size: {config.fontSize}px</Label>
        <Slider
          value={[config.fontSize]}
          onValueChange={([value]) => updateConfig({ fontSize: value })}
          min={10}
          max={24}
          step={1}
          className="w-full"
        />
      </div>

      {/* Font Family */}
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
                <span style={{ fontFamily: font.value }}>{font.label}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cursor Style */}
      <div className="space-y-2">
        <Label>Cursor Style</Label>
        <Select
          value={config.cursorStyle}
          onValueChange={(value: 'block' | 'underline' | 'bar') => updateConfig({ cursorStyle: value })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURSOR_STYLES.map((style) => (
              <SelectItem key={style.value} value={style.value}>
                {style.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cursor Blink */}
      <div className="flex items-center justify-between">
        <Label>Cursor Blink</Label>
        <Switch
          checked={config.cursorBlink}
          onCheckedChange={(checked) => updateConfig({ cursorBlink: checked })}
        />
      </div>

      {/* Scrollback */}
      <div className="space-y-2">
        <Label>Scrollback Lines: {config.scrollback.toLocaleString()}</Label>
        <Slider
          value={[config.scrollback]}
          onValueChange={([value]) => updateConfig({ scrollback: value })}
          min={1000}
          max={100000}
          step={1000}
          className="w-full"
        />
      </div>

      {/* Reset Button */}
      <Button
        variant="outline"
        onClick={handleReset}
        className="w-full flex items-center gap-2"
      >
        <RotateCcw className="h-4 w-4" />
        Reset to Defaults
      </Button>

      {/* Theme Preview */}
      <div className="space-y-2">
        <Label>Theme Preview</Label>
        <div
          className="p-3 rounded-md font-mono text-sm"
          style={{
            backgroundColor: TERMINAL_THEMES[config.theme].background,
            color: TERMINAL_THEMES[config.theme].foreground
          }}
        >
          <div>
            <span style={{ color: TERMINAL_THEMES[config.theme].green }}>user@dragon-ui</span>
            <span style={{ color: TERMINAL_THEMES[config.theme].cyan }}>:</span>
            <span style={{ color: TERMINAL_THEMES[config.theme].blue }}>~/projects</span>
            <span style={{ color: TERMINAL_THEMES[config.theme].magenta }}>$</span>
            <span> npm run dev</span>
          </div>
          <div style={{ color: TERMINAL_THEMES[config.theme].yellow }}>
            Starting development server...
          </div>
          <div style={{ color: TERMINAL_THEMES[config.theme].green }}>
            Server running on http://localhost:3000
          </div>
          <div style={{ color: TERMINAL_THEMES[config.theme].red }}>
            Error: Something went wrong!
          </div>
        </div>
      </div>
    </div>
  );
};

export default TerminalSettings;
