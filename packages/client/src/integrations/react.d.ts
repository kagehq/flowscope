import type { FlowscopeConfig } from '../core/types';

export function useFlowscope(config?: FlowscopeConfig): {
  toggle: () => void;
  open: () => void;
  close: () => void;
  clear: () => void;
  getEvents: () => any[];
  export: (format: 'har' | 'json' | 'csv') => string;
};

export function FlowscopeProvider(props: {
  children: React.ReactNode;
  config?: FlowscopeConfig;
}): JSX.Element;

