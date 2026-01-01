/**
 * Terminal Components
 * Integrated terminal for Dragon UI
 */

export { default as TerminalPanel } from './TerminalPanel';
export { default as TerminalTabs } from './TerminalTabs';
export { default as TerminalSettings } from './TerminalSettings';
export { default as XTerminal } from './XTerminal';

export { useTerminalStore, useTerminalEvents } from './useTerminal';

export {
  DRAGON_TERMINAL_THEME,
  DARK_TERMINAL_THEME,
  LIGHT_TERMINAL_THEME,
  TERMINAL_THEMES,
  DEFAULT_TERMINAL_CONFIG
} from './types';

export type {
  ShellInfo,
  TerminalSessionInfo,
  TerminalTab,
  TerminalTheme,
  TerminalConfig,
  TerminalThemeName
} from './types';
