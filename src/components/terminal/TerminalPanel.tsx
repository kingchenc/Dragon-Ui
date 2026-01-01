/**
 * Terminal Panel Component
 * Main terminal panel with tabs and resizable height
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, Maximize2, Minimize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useTerminalStore, useTerminalEvents } from './useTerminal';
import TerminalTabs from './TerminalTabs';
import XTerminal from './XTerminal';
import TerminalSettings from './TerminalSettings';

interface TerminalPanelProps {
  className?: string;
}

const TerminalPanel: React.FC<TerminalPanelProps> = ({ className }) => {
  const {
    tabs,
    activeTabId,
    isVisible,
    panelHeight,
    setVisibility,
    setPanelHeight,
    updateTabTitle,
    loadAvailableShells,
    addTab
  } = useTerminalStore();

  const [isMaximized, setIsMaximized] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const resizeStartY = useRef<number>(0);
  const resizeStartHeight = useRef<number>(0);

  // Set up terminal event listeners
  const { setupListeners, cleanupListeners } = useTerminalEvents();

  useEffect(() => {
    // Load available shells when component mounts
    loadAvailableShells();

    // Set up terminal data listeners
    const handleData = (id: string, data: string) => {
      // Data is handled by XTerminal component directly
    };

    const handleExit = (id: string) => {
      console.log(`[TERM] Terminal ${id} exited`);
    };

    setupListeners(handleData, handleExit);

    return () => {
      cleanupListeners();
    };
  }, [loadAvailableShells, setupListeners, cleanupListeners]);

  // Handle panel resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartY.current = e.clientY;
    resizeStartHeight.current = panelHeight;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = resizeStartY.current - e.clientY;
      const newHeight = resizeStartHeight.current + deltaY;
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [panelHeight, setPanelHeight]);

  // Toggle maximize
  const toggleMaximize = useCallback(() => {
    setIsMaximized(!isMaximized);
  }, [isMaximized]);

  // Handle title change from terminal
  const handleTitleChange = useCallback((id: string, title: string) => {
    updateTabTitle(id, title);
  }, [updateTabTitle]);

  // Close panel
  const handleClose = useCallback(() => {
    setVisibility(false);
  }, [setVisibility]);

  // Create initial terminal if no tabs exist when panel opens
  useEffect(() => {
    if (isVisible && tabs.length === 0) {
      addTab();
    }
  }, [isVisible, tabs.length, addTab]);

  if (!isVisible) return null;

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div
      ref={panelRef}
      className={cn(
        'fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 shadow-lg z-50',
        'flex flex-col',
        isMaximized && 'top-0 h-screen',
        isResizing && 'select-none',
        className
      )}
      style={{ height: isMaximized ? '100vh' : panelHeight }}
    >
      {/* Resize handle */}
      {!isMaximized && (
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-1 cursor-ns-resize',
            'hover:bg-dragon-primary/50 transition-colors',
            isResizing && 'bg-dragon-primary'
          )}
          onMouseDown={handleResizeStart}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900">
        <TerminalTabs onSettingsClick={() => setShowSettings(!showSettings)} />

        <div className="flex items-center gap-1 px-2">
          {/* Maximize/Minimize button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-zinc-800"
            onClick={toggleMaximize}
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </Button>

          {/* Close button */}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 hover:bg-zinc-800"
            onClick={handleClose}
            title="Close Terminal Panel"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Terminal content */}
      <div className="flex-1 overflow-hidden relative">
        {/* Terminal instances */}
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={cn(
              'absolute inset-0',
              tab.id === activeTabId ? 'block' : 'hidden'
            )}
          >
            <XTerminal
              sessionId={tab.id}
              onTitleChange={(title) => handleTitleChange(tab.id, title)}
            />
          </div>
        ))}

        {/* Empty state */}
        {tabs.length === 0 && (
          <div className="flex items-center justify-center h-full text-zinc-500">
            <div className="text-center">
              <p className="mb-2">No terminal sessions</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => addTab()}
              >
                Create Terminal
              </Button>
            </div>
          </div>
        )}

        {/* Settings panel */}
        {showSettings && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-zinc-900 border-l border-zinc-800 overflow-y-auto">
            <TerminalSettings onClose={() => setShowSettings(false)} />
          </div>
        )}
      </div>
    </div>
  );
};

export default TerminalPanel;
