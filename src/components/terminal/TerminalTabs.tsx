/**
 * Terminal Tabs Component
 * Tab bar for managing multiple terminal sessions
 */

import React, { useEffect, useCallback } from 'react';
import { X, Plus, Terminal, ChevronDown, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useTerminalStore } from './useTerminal';

interface TerminalTabsProps {
  onSettingsClick?: () => void;
}

const getShellIcon = (shell: string): React.ReactNode => {
  switch (shell) {
    case 'powershell':
    case 'pwsh':
      return <span className="text-blue-400 font-bold text-xs">PS</span>;
    case 'cmd':
      return <span className="text-yellow-400 font-bold text-xs">CMD</span>;
    case 'gitbash':
      return <span className="text-orange-400 font-bold text-xs">GIT</span>;
    case 'wsl':
      return <span className="text-green-400 font-bold text-xs">WSL</span>;
    case 'bash':
    case 'zsh':
      return <span className="text-purple-400 font-bold text-xs">$</span>;
    default:
      return <Terminal className="h-3 w-3" />;
  }
};

const TerminalTabs: React.FC<TerminalTabsProps> = ({ onSettingsClick }) => {
  const {
    tabs,
    activeTabId,
    availableShells,
    isLoading,
    addTab,
    removeTab,
    setActiveTab,
    loadAvailableShells
  } = useTerminalStore();

  // Load available shells on mount
  useEffect(() => {
    loadAvailableShells();
  }, [loadAvailableShells]);

  const handleNewTerminal = useCallback(async (shell?: string) => {
    await addTab(shell);
  }, [addTab]);

  const handleCloseTab = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    removeTab(id);
  }, [removeTab]);

  const handleTabClick = useCallback((id: string) => {
    setActiveTab(id);
  }, [setActiveTab]);

  return (
    <div className="flex items-center gap-1 bg-zinc-900 border-b border-zinc-800 px-2 py-1">
      {/* Terminal tabs */}
      <div className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-thin">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabClick(tab.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors min-w-0',
              'hover:bg-zinc-800',
              tab.isActive
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-white',
              tab.isClosed && 'opacity-50'
            )}
          >
            {getShellIcon(tab.shell)}
            <span className="truncate max-w-[120px]">{tab.title}</span>
            <button
              onClick={(e) => handleCloseTab(e, tab.id)}
              className={cn(
                'p-0.5 rounded hover:bg-zinc-700 transition-colors',
                'opacity-0 group-hover:opacity-100',
                tab.isActive ? 'opacity-100' : ''
              )}
              title="Close terminal"
            >
              <X className="h-3 w-3" />
            </button>
          </button>
        ))}
      </div>

      {/* New terminal dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-zinc-800"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-white" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <div className="px-2 py-1.5 text-xs font-medium text-zinc-500">
            New Terminal
          </div>
          {availableShells.map((shell) => (
            <DropdownMenuItem
              key={shell.id}
              onClick={() => handleNewTerminal(shell.id)}
              className="flex items-center gap-2"
            >
              {getShellIcon(shell.id)}
              <span>{shell.name}</span>
            </DropdownMenuItem>
          ))}
          {availableShells.length === 0 && (
            <DropdownMenuItem disabled>
              <span className="text-zinc-500">Loading shells...</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => handleNewTerminal()}
            className="flex items-center gap-2"
          >
            <Terminal className="h-4 w-4" />
            <span>Default Shell</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Settings button */}
      {onSettingsClick && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 hover:bg-zinc-800"
          onClick={onSettingsClick}
          title="Terminal Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
};

export default TerminalTabs;
