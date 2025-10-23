/**
 * Flowscope Core
 * Main entry point for the SDK
 */

import { NetworkInterceptor } from './interceptor';
import { FlowscopeStorage } from './storage';
import type { FlowscopeConfig, FlowscopeAPI, NetworkEvent } from './types';

class Flowscope implements FlowscopeAPI {
  private config: FlowscopeConfig;
  private interceptor: NetworkInterceptor | null = null;
  private storage: FlowscopeStorage | null = null;
  private panelVisible = false;
  private initialized = false;
  private activated = false;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  init(config: FlowscopeConfig = {}): void {
    if (this.initialized) {
      console.warn('[Flowscope] Already initialized');
      return;
    }

    this.config = { ...this.getDefaultConfig(), ...config };
    this.storage = new FlowscopeStorage(this.config);

    this.interceptor = new NetworkInterceptor(
      (event) => this.handleEvent(event),
      this.config
    );

    if (this.config.enabled !== false) {
      this.interceptor.patch();
    }

    this.setupKeyboardShortcuts();
    this.injectUI();

    this.initialized = true;
    this.activated = true;

    console.log('[Flowscope] Initialized', this.config);
  }

  activate(accessKey: string): boolean {
    // In the future, this can validate the access key against a backend
    // For now, we'll just enable it if an access key is provided
    if (!accessKey || accessKey.trim() === '') {
      console.warn('[Flowscope] Invalid access key');
      return false;
    }

    this.config.accessKey = accessKey;
    this.activated = true;

    if (!this.initialized) {
      this.init(this.config);
    }

    console.log('[Flowscope] Activated with access key');
    return true;
  }

  isActive(): boolean {
    return this.activated && this.initialized;
  }

  setEnabled(enabled: boolean): void {
    if (!this.interceptor) {
      console.warn('[Flowscope] Not initialized');
      return;
    }

    this.config.enabled = enabled;

    if (enabled) {
      this.interceptor.patch();
    } else {
      this.interceptor.unpatch();
    }
  }

  toggle(): void {
    if (this.panelVisible) {
      this.close();
    } else {
      this.open();
    }
  }

  open(): void {
    this.panelVisible = true;
    this.updateUIVisibility();
    this.dispatchEvent('panel-opened');
  }

  close(): void {
    this.panelVisible = false;
    this.updateUIVisibility();
    this.dispatchEvent('panel-closed');
  }

  getEvents(): NetworkEvent[] {
    return this.storage?.getEvents() || [];
  }

  clear(): void {
    this.storage?.clear();
    this.dispatchEvent('events-cleared');
  }

  export(format: 'har' | 'json' | 'csv'): string {
    const events = this.getEvents();

    switch (format) {
      case 'json':
        return JSON.stringify(events, null, 2);

      case 'csv':
        return this.exportAsCSV(events);

      case 'har':
        return this.exportAsHAR(events);

      default:
        throw new Error(`Unknown export format: ${format}`);
    }
  }

  getConfig(): FlowscopeConfig {
    return { ...this.config };
  }

  updateConfig(config: Partial<FlowscopeConfig>): void {
    this.config = { ...this.config, ...config };

    if (this.interceptor && config.enabled !== undefined) {
      this.setEnabled(config.enabled);
    }
  }

  // Private methods

  private getDefaultConfig(): FlowscopeConfig {
    return {
      enabled: true,
      position: 'bottom-right',
      theme: 'dark',
      hotkey: 'cmd+k,ctrl+k',
      maxRequests: 100,
      sampleRate: 1.0,
      redact: {
        headers: ['authorization', 'cookie', 'x-api-key', 'x-auth-token'],
        bodyPaths: ['password', 'token', 'secret', 'apiKey'],
        queryParams: ['token', 'key', 'secret', 'apiKey'],
      },
    };
  }

  private handleEvent(event: NetworkEvent): void {
    this.storage?.addEvent(event);
    this.dispatchEvent('event-captured', event);
    this.updateUI();
  }

  private setupKeyboardShortcuts(): void {
    if (!this.config.hotkey) return;

    const hotkeys = this.config.hotkey.split(',').map(k => k.trim());

    document.addEventListener('keydown', (e) => {
      for (const hotkey of hotkeys) {
        if (this.matchesHotkey(e, hotkey)) {
          e.preventDefault();
          this.toggle();
          break;
        }
      }
    });
  }

  private matchesHotkey(e: KeyboardEvent, hotkey: string): boolean {
    const parts = hotkey.toLowerCase().split('+');
    const key = parts.pop();

    if (!key) return false;

    const hasCmd = parts.includes('cmd') || parts.includes('meta');
    const hasCtrl = parts.includes('ctrl');
    const hasAlt = parts.includes('alt');
    const hasShift = parts.includes('shift');

    return (
      e.key.toLowerCase() === key &&
      (hasCmd ? (e.metaKey || e.ctrlKey) : !e.metaKey && !e.ctrlKey) &&
      (hasCtrl ? e.ctrlKey : !hasCtrl) &&
      (hasAlt ? e.altKey : !e.altKey) &&
      (hasShift ? e.shiftKey : !e.shiftKey)
    );
  }

  private injectUI(): void {
    // Create container for UI
    const container = document.createElement('div');
    container.id = 'flowscope-root';
    container.style.cssText = 'position: fixed; z-index: 999999; pointer-events: none;';

    // Add to DOM
    if (document.body) {
      document.body.appendChild(container);
      this.initializePanel();
    } else {
      document.addEventListener('DOMContentLoaded', () => {
        document.body.appendChild(container);
        this.initializePanel();
      });
    }

    this.updateUIVisibility();
  }

  private async initializePanel(): Promise<void> {
    // Dynamically import and initialize the panel
    try {
      const { EnhancedFlowscopePanel } = await import('../ui/enhanced-panel');
      new EnhancedFlowscopePanel('flowscope-root');
      this.dispatchEvent('initialized');
    } catch (error) {
      console.warn('[Flowscope] Failed to initialize UI panel:', error);
    }
  }

  private updateUIVisibility(): void {
    const container = document.getElementById('flowscope-root');
    if (container) {
      container.style.display = this.panelVisible ? 'block' : 'none';
      container.style.pointerEvents = this.panelVisible ? 'auto' : 'none';
    }

    // Dispatch custom event for UI components
    this.dispatchEvent('visibility-changed', { visible: this.panelVisible });
  }

  private updateUI(): void {
    // Dispatch event for UI to update
    this.dispatchEvent('events-updated');
  }

  private dispatchEvent(name: string, detail?: any): void {
    window.dispatchEvent(
      new CustomEvent(`flowscope:${name}`, { detail })
    );
  }

  private exportAsCSV(events: NetworkEvent[]): string {
    const headers = ['Timestamp', 'Method', 'URL', 'Status', 'Duration', 'Type', 'Error'];
    const rows = events.map(e => [
      new Date(e.request.timestamp).toISOString(),
      e.request.method,
      e.request.url,
      e.response?.status || 'N/A',
      e.response?.duration ? `${e.response.duration}ms` : 'N/A',
      e.type,
      e.error || '',
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
  }

  private exportAsHAR(events: NetworkEvent[]): string {
    // Simplified HAR format
    const har = {
      log: {
        version: '1.2',
        creator: {
          name: 'Flowscope',
          version: '1.0.0',
        },
        entries: events.map(e => ({
          startedDateTime: new Date(e.request.timestamp).toISOString(),
          time: e.response?.duration || 0,
          request: {
            method: e.request.method,
            url: e.request.url,
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(e.request.headers).map(([name, value]) => ({ name, value })),
            queryString: [],
            postData: e.request.body ? {
              mimeType: 'application/json',
              text: e.request.body,
            } : undefined,
          },
          response: e.response ? {
            status: e.response.status,
            statusText: e.response.statusText,
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(e.response.headers).map(([name, value]) => ({ name, value })),
            content: {
              size: e.response.bodySize || 0,
              mimeType: e.response.headers['content-type'] || 'text/plain',
              text: e.response.body || '',
            },
          } : undefined,
        })),
      },
    };

    return JSON.stringify(har, null, 2);
  }
}

// Singleton instance
const flowscope = new Flowscope();

// Expose globally
if (typeof window !== 'undefined') {
  (window as any).Flowscope = flowscope;
}

export default flowscope;

