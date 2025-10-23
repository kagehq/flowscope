import type { App } from 'vue';
import type { FlowscopeConfig } from '../core/types';

export function useFlowscope(config?: FlowscopeConfig): {
  toggle: () => void;
  open: () => void;
  close: () => void;
  clear: () => void;
  getEvents: () => any[];
  export: (format: 'har' | 'json' | 'csv') => string;
};

export const FlowscopePlugin: {
  install(app: App, config?: FlowscopeConfig): void;
};

export default FlowscopePlugin;

