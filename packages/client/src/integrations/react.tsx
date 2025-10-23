/**
 * React Integration
 */

import React, { useEffect } from 'react';
import type { FlowscopeConfig } from '../core/types';
import flowscope from '../core/flowscope';

export function useFlowscope(config?: FlowscopeConfig) {
  useEffect(() => {
    flowscope.init(config);

    return () => {
      // Cleanup if needed
      flowscope.setEnabled(false);
    };
  }, []);

  return {
    toggle: () => flowscope.toggle(),
    open: () => flowscope.open(),
    close: () => flowscope.close(),
    clear: () => flowscope.clear(),
    getEvents: () => flowscope.getEvents(),
    export: (format: 'har' | 'json' | 'csv') => flowscope.export(format),
  };
}

export function FlowscopeProvider({
  children,
  config
}: {
  children: React.ReactNode;
  config?: FlowscopeConfig;
}) {
  useFlowscope(config);
  return <>{children}</>;
}

