/**
 * Shared constants for the demo LitElement components.
 * Edit these values while the dev server is running to test HMR!
 */

// Counter configuration
export const COUNTER_INITIAL_VALUE = 0;
export const COUNTER_STEP = 1;
export const COUNTER_MIN = -100;
export const COUNTER_MAX = 100;

// Labels
export const COUNTER_TITLE = 'Reactive Counter';
export const COUNTER_HINT_TEXT =
  'Try editing constants.ts or counter-controller.ts to see HMR in action!';

// Theme colors
export const COLORS = {
  primary: '#646cff',
  accent: '#4ade80',
  warning: '#ff6464',
  background: '#1a1a2e',
  backgroundAlt: '#16213e',
  surface: '#1a1a1a',
  text: '#ffffff',
  textMuted: '#888888',
} as const;
