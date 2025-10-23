/**
 * Vue 3 Integration
 */

import { onMounted, onUnmounted, type App } from 'vue';
import type { FlowscopeConfig } from '../core/types';
import flowscope from '../core/flowscope';

export function useFlowscope(config?: FlowscopeConfig) {
  onMounted(() => {
    flowscope.init(config);
  });

  onUnmounted(() => {
    flowscope.setEnabled(false);
  });

  return {
    toggle: () => flowscope.toggle(),
    open: () => flowscope.open(),
    close: () => flowscope.close(),
    clear: () => flowscope.clear(),
    getEvents: () => flowscope.getEvents(),
    export: (format: 'har' | 'json' | 'csv') => flowscope.export(format),
  };
}

// Vue Plugin
export const FlowscopePlugin = {
  install(app: App, config?: FlowscopeConfig) {
    flowscope.init(config);

    app.config.globalProperties.$flowscope = flowscope;

    app.provide('flowscope', flowscope);
  },
};

export default FlowscopePlugin;

