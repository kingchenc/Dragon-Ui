/**
 * Statusline Renderer
 * Renders the configurable statusline component
 */

import React, { useMemo } from 'react';
import { useStatusline, useStatuslineData, useStatuslineDataProvider } from './hooks/useStatusline';
import { cn } from '@/lib/utils';

const StatuslineRenderer: React.FC = () => {
  const { config, isVisible } = useStatusline();
  const data = useStatuslineData();

  // Initialize data provider to sync real data from AppStore
  useStatuslineDataProvider();

  if (!isVisible) return null;

  const renderElement = (elementId: string, label: string, value: string, emoji?: string) => {
    const element = config.elements.find(el => el.id === elementId);
    if (!element || !element.visible) return null;

    const style: React.CSSProperties = {
      color: config.useColors ? element.color : undefined,
      backgroundColor: element.bgColor,
      fontFamily: config.fontFamily,
      fontSize: `${config.fontSize}px`
    };

    return (
      <div
        key={elementId}
        className={cn(
          'px-2 py-1 flex items-center space-x-1',
          config.style === 'dragon' && 'dragon-element',
          config.style === 'modern' && 'modern-element',
          config.style === 'classic' && 'classic-element',
          config.style === 'minimal' && 'minimal-element',
          config.animateUpdates && 'transition-all duration-300'
        )}
        style={style}
      >
        {config.useEmojis && emoji && <span>{emoji}</span>}
        <span className={cn(config.compactMode && 'text-xs')}>{label}:</span>
        <span className={cn('font-medium', config.compactMode && 'text-xs')}>{value}</span>
      </div>
    );
  };

  const line1Elements = useMemo(() => {
    const elements = [];

    if (data.model) {
      elements.push(renderElement('model', 'Model', data.model, config.style === 'dragon' ? '🐲' : ''));
    }

    if (data.branch) {
      const branchValue = `${data.branch} ${data.version ? `| v${data.version}` : ''}`;
      elements.push(renderElement('branch', 'Branch', branchValue, config.style === 'dragon' ? '⚡' : '⎇'));
    }

    if (data.cwd) {
      elements.push(renderElement('cwd', 'cwd', data.cwd, config.style === 'dragon' ? '📁' : ''));
    }

    return elements.filter(Boolean);
  }, [data, config]);

  const line2Elements = useMemo(() => {
    const elements = [];

    if (data.tokensIn && data.tokensOut && data.tokensCached && data.tokensTotal) {
      const tokensValue = `In: ${data.formattedTokens.in} | Out: ${data.formattedTokens.out} | Cached: ${data.formattedTokens.cached} | Total: ${data.formattedTokens.total}`;
      elements.push(renderElement('tokens', 'Tokens', tokensValue, config.style === 'dragon' ? '💰' : ''));
    }

    if (data.contextCurrent && data.contextMax && data.contextUsed) {
      elements.push(renderElement('context', 'Ctx', data.formattedContext, config.style === 'dragon' ? '🧠' : ''));
    }

    if (data.sessionTime && data.blockTime) {
      const sessionValue = `${data.sessionTime} | Block: ${data.blockTime}`;
      elements.push(renderElement('session', 'Session', sessionValue, config.style === 'dragon' ? '⏱️' : ''));
    }

    return elements.filter(Boolean);
  }, [data, config]);

  const line3Elements = useMemo(() => {
    const elements = [];

    if (data.cost) {
      elements.push(renderElement('cost', 'Cost', data.formattedCost, config.style === 'dragon' ? '💸' : ''));
    }

    // Dragon UI specific metrics
    if (config.showDragonMetrics) {
      if (data.activeProjects) {
        elements.push(renderElement('dragon-projects', 'Projects', data.activeProjects.toString(), '🚀'));
      }

      if (data.dailyUsage) {
        elements.push(renderElement('dragon-usage', 'Usage', `${data.dailyUsage}%`, '📊'));
      }
    }

    if (data.lastUpdateFormatted) {
      elements.push(renderElement('last-update', 'Updated', data.lastUpdateFormatted, '🕐'));
    }

    return elements.filter(Boolean);
  }, [data, config]);

  const containerClasses = cn(
    'w-full border-t border-border bg-background/95 backdrop-blur-sm',
    config.style === 'dragon' && 'bg-gradient-to-r from-dragon-primary/10 to-dragon-secondary/10 border-dragon-primary/20',
    config.style === 'modern' && 'bg-muted/50',
    config.style === 'classic' && 'bg-gray-900 text-gray-100 border-gray-700',
    config.style === 'minimal' && 'bg-transparent border-border'
  );

  const lineClasses = cn(
    'flex items-center space-x-2 px-4 py-1',
    config.compactMode && 'px-2 py-0.5 space-x-1'
  );

  return (
    <div className={containerClasses} style={{ fontFamily: config.fontFamily }}>
      {config.lines >= 1 && line1Elements.length > 0 && (
        <div className={lineClasses}>
          {line1Elements}
        </div>
      )}

      {config.lines >= 2 && line2Elements.length > 0 && (
        <div className={cn(lineClasses, 'border-t border-border/20')}>
          {line2Elements}
        </div>
      )}

      {config.lines >= 3 && line3Elements.length > 0 && (
        <div className={cn(lineClasses, 'border-t border-border/20')}>
          {line3Elements}
        </div>
      )}
    </div>
  );
};

export default StatuslineRenderer;