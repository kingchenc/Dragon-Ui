/**
 * Statusline Components Export
 * Central export for all statusline-related components and utilities
 */

export { default as StatuslineRenderer } from './statusline-renderer';
export { default as StatuslineConfigurator } from './statusline-configurator';
export { useStatusline, useStatuslineData, useStatuslineDataProvider } from './hooks/useStatusline';
export type {
  StatuslineConfig,
  StatuslineData,
  StatuslineElement,
  StatuslineStyle
} from './types';
export {
  DEFAULT_STATUSLINE_CONFIG,
  STATUSLINE_STYLES,
  FONT_FAMILIES,
  PRESET_COLORS
} from './types';
