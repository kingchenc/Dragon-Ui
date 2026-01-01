/**
 * Terminal Types
 * Type definitions for the integrated terminal
 */

export interface ShellInfo {
  id: string;
  name: string;
  icon: string;
}

export interface TerminalSessionInfo {
  id: string;
  shell: string;
  cwd: string;
  isAlive: boolean;
  cols: number;
  rows: number;
  pid?: number;
}

export interface TerminalTab {
  id: string;
  title: string;
  shell: string;
  isActive: boolean;
  isClosed: boolean;
}

export interface TerminalTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selection: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

// Dragon UI Terminal Theme (matches app theme)
export const DRAGON_TERMINAL_THEME: TerminalTheme = {
  background: '#0a0a0a',
  foreground: '#e4e4e7',
  cursor: '#dc2626',
  cursorAccent: '#0a0a0a',
  selection: 'rgba(220, 38, 38, 0.3)',
  black: '#09090b',
  red: '#dc2626',
  green: '#22c55e',
  yellow: '#eab308',
  blue: '#3b82f6',
  magenta: '#a855f7',
  cyan: '#06b6d4',
  white: '#e4e4e7',
  brightBlack: '#52525b',
  brightRed: '#f87171',
  brightGreen: '#4ade80',
  brightYellow: '#facc15',
  brightBlue: '#60a5fa',
  brightMagenta: '#c084fc',
  brightCyan: '#22d3ee',
  brightWhite: '#fafafa'
};

// Dark terminal theme (neutral)
export const DARK_TERMINAL_THEME: TerminalTheme = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#aeafad',
  cursorAccent: '#1e1e1e',
  selection: 'rgba(255, 255, 255, 0.3)',
  black: '#000000',
  red: '#cd3131',
  green: '#0dbc79',
  yellow: '#e5e510',
  blue: '#2472c8',
  magenta: '#bc3fbc',
  cyan: '#11a8cd',
  white: '#e5e5e5',
  brightBlack: '#666666',
  brightRed: '#f14c4c',
  brightGreen: '#23d18b',
  brightYellow: '#f5f543',
  brightBlue: '#3b8eea',
  brightMagenta: '#d670d6',
  brightCyan: '#29b8db',
  brightWhite: '#ffffff'
};

// Light terminal theme
export const LIGHT_TERMINAL_THEME: TerminalTheme = {
  background: '#ffffff',
  foreground: '#333333',
  cursor: '#333333',
  cursorAccent: '#ffffff',
  selection: 'rgba(0, 0, 0, 0.15)',
  black: '#000000',
  red: '#c91b00',
  green: '#00a600',
  yellow: '#a6a600',
  blue: '#0451a5',
  magenta: '#bc05bc',
  cyan: '#0598bc',
  white: '#cccccc',
  brightBlack: '#767676',
  brightRed: '#e05050',
  brightGreen: '#1ad51a',
  brightYellow: '#cfcf00',
  brightBlue: '#0066ff',
  brightMagenta: '#e500e5',
  brightCyan: '#00d0d0',
  brightWhite: '#ffffff'
};

export const TERMINAL_THEMES = {
  dragon: DRAGON_TERMINAL_THEME,
  dark: DARK_TERMINAL_THEME,
  light: LIGHT_TERMINAL_THEME
};

export type TerminalThemeName = keyof typeof TERMINAL_THEMES;

export interface TerminalConfig {
  fontSize: number;
  fontFamily: string;
  cursorBlink: boolean;
  cursorStyle: 'block' | 'underline' | 'bar';
  scrollback: number;
  theme: TerminalThemeName;
  defaultShell: string;
}

export const DEFAULT_TERMINAL_CONFIG: TerminalConfig = {
  fontSize: 14,
  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
  cursorBlink: true,
  cursorStyle: 'bar',
  scrollback: 10000,
  theme: 'dragon',
  defaultShell: 'powershell'
};
