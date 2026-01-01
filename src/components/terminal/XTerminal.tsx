/**
 * XTerminal Component
 * xterm.js based terminal emulator
 */

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { useTerminalStore } from './useTerminal';
import { TERMINAL_THEMES, TerminalTheme } from './types';
import { cn } from '@/lib/utils';

interface XTerminalProps {
  sessionId: string;
  className?: string;
  onTitleChange?: (title: string) => void;
}

const XTerminal: React.FC<XTerminalProps> = ({
  sessionId,
  className,
  onTitleChange
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);
  const resizeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializedRef = useRef(false);
  const [isReady, setIsReady] = useState(false);

  const { config } = useTerminalStore();

  // Get theme colors
  const getTheme = useCallback((): TerminalTheme => {
    return TERMINAL_THEMES[config.theme] || TERMINAL_THEMES.dragon;
  }, [config.theme]);

  // Write to terminal process
  const writeToProcess = useCallback((data: string) => {
    if (window.electronAPI) {
      window.electronAPI.terminalWrite(sessionId, data);
    }
  }, [sessionId]);

  // Debounced resize terminal
  const resizeTerminal = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }

    resizeTimeoutRef.current = setTimeout(() => {
      if (fitAddonRef.current && xtermRef.current && isReady) {
        try {
          fitAddonRef.current.fit();

          const cols = xtermRef.current.cols;
          const rows = xtermRef.current.rows;

          if (window.electronAPI && cols > 0 && rows > 0) {
            window.electronAPI.terminalResize(sessionId, cols, rows);
          }
        } catch {
          // Ignore resize errors during mount/unmount
        }
      }
    }, 100);
  }, [sessionId, isReady]);

  // Initialize terminal
  useEffect(() => {
    if (!terminalRef.current || initializedRef.current) return;
    initializedRef.current = true;

    const theme = getTheme();

    // Create terminal with optimized settings
    const terminal = new Terminal({
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      cursorBlink: config.cursorBlink,
      cursorStyle: config.cursorStyle,
      scrollback: config.scrollback,
      theme: theme,
      allowProposedApi: true,
      convertEol: true,
      windowsMode: true,
      // Performance optimizations
      fastScrollModifier: 'alt',
      fastScrollSensitivity: 5,
      smoothScrollDuration: 0,
      // Disable GPU rendering if causing issues
      // rendererType: 'canvas'
    });

    // Create addons
    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();
    const searchAddon = new SearchAddon();

    // Load addons
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);
    terminal.loadAddon(searchAddon);

    // Open terminal in container
    terminal.open(terminalRef.current);

    // Store references
    xtermRef.current = terminal;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Initial fit after a short delay
    setTimeout(() => {
      try {
        fitAddon.fit();
        setIsReady(true);
      } catch {
        // Ignore
      }
    }, 50);

    // Handle input
    terminal.onData((data) => {
      writeToProcess(data);
    });

    // Handle title changes
    terminal.onTitleChange((title) => {
      onTitleChange?.(title);
    });

    // Set up resize observer with debouncing
    let resizeObserver: ResizeObserver | null = null;
    const setupResizeObserver = () => {
      if (terminalRef.current) {
        resizeObserver = new ResizeObserver(() => {
          resizeTerminal();
        });
        resizeObserver.observe(terminalRef.current);
      }
    };

    // Delay resize observer setup
    setTimeout(setupResizeObserver, 200);

    // Set up IPC listeners for terminal data
    let dataHandler: ((event: { id: string; data: string }) => void) | null = null;
    let exitHandler: ((event: { id: string }) => void) | null = null;

    if (window.electronAPI) {
      dataHandler = (event: { id: string; data: string }) => {
        if (event.id === sessionId && xtermRef.current) {
          xtermRef.current.write(event.data);
        }
      };

      exitHandler = (event: { id: string }) => {
        if (event.id === sessionId && xtermRef.current) {
          xtermRef.current.write('\r\n\x1b[31m[Process exited]\x1b[0m\r\n');
        }
      };

      window.electronAPI.onTerminalData(dataHandler);
      window.electronAPI.onTerminalExit(exitHandler);
    }

    // Focus terminal
    setTimeout(() => {
      terminal.focus();
    }, 100);

    // Cleanup
    return () => {
      initializedRef.current = false;
      setIsReady(false);

      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }

      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      terminal.dispose();
    };
  }, [sessionId]); // Only depend on sessionId

  // Update terminal options when config changes (separate effect)
  useEffect(() => {
    if (!xtermRef.current || !isReady) return;

    const theme = getTheme();

    xtermRef.current.options.fontSize = config.fontSize;
    xtermRef.current.options.fontFamily = config.fontFamily;
    xtermRef.current.options.cursorBlink = config.cursorBlink;
    xtermRef.current.options.cursorStyle = config.cursorStyle;
    xtermRef.current.options.theme = theme;

    // Re-fit after config change
    setTimeout(() => resizeTerminal(), 50);
  }, [config.fontSize, config.fontFamily, config.cursorBlink, config.cursorStyle, config.theme, getTheme, resizeTerminal, isReady]);

  // Handle window resize
  useEffect(() => {
    if (!isReady) return;

    const handleResize = () => resizeTerminal();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [resizeTerminal, isReady]);

  // Focus terminal on click
  const handleClick = useCallback(() => {
    if (xtermRef.current) {
      xtermRef.current.focus();
    }
  }, []);

  return (
    <div
      ref={terminalRef}
      className={cn(
        'w-full h-full min-h-[200px]',
        className
      )}
      onClick={handleClick}
      style={{ backgroundColor: '#0a0a0a' }}
    />
  );
};

export default XTerminal;
