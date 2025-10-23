/**
 * Flowscope Client SDK
 * Main entry point
 */

export { default } from './core/flowscope';
export { default as Flowscope } from './core/flowscope';
export type {
  FlowscopeConfig,
  FlowscopeAPI,
  NetworkEvent,
  CapturedRequest,
  CapturedResponse,
  HttpMethod
} from './core/types';

