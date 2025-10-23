/**
 * Enhanced Flowscope Panel
 * Beautiful, feature-rich UI with timeline, error analysis, and performance stats
 */

import type { NetworkEvent } from '../core/types';

interface PanelState {
  view: 'list' | 'timeline' | 'errors' | 'stats';
  filter: 'all' | 'errors' | 'slow' | 'mutations';
  searchQuery: string;
  expandedEventId: string | null;
}

export class EnhancedFlowscopePanel {
  private container: HTMLElement;
  private panelElement: HTMLElement | null = null;
  private toggleButton: HTMLElement | null = null;
  private minimized = true;
  private events: NetworkEvent[] = [];
  private state: PanelState = {
    view: 'list',
    filter: 'all',
    searchQuery: '',
    expandedEventId: null,
  };

  // Resize functionality
  private isResizing = false;
  private startY = 0;
  private startHeight = 0;
  private panelHeight = 700; // Default height
  private readonly MIN_HEIGHT = 200;
  private readonly MAX_HEIGHT = window.innerHeight - 150;
  private rafId: number | null = null;
  private pendingHeight: number | null = null;

  constructor(containerId: string = 'flowscope-root') {
    const existing = document.getElementById(containerId);
    if (!existing) {
      throw new Error(`Container #${containerId} not found`);
    }
    this.container = existing;

    // Load saved height from localStorage
    const savedHeight = localStorage.getItem('flowscope-panel-height');
    if (savedHeight) {
      this.panelHeight = Math.min(Math.max(parseInt(savedHeight), this.MIN_HEIGHT), this.MAX_HEIGHT);
    }

    this.injectStyles();
    this.createUI();
    this.attachListeners();
  }

  private injectStyles(): void {
    // Skip if styles already injected
    if (document.getElementById('flowscope-panel-styles')) return;

    const style = document.createElement('style');
    style.id = 'flowscope-panel-styles';
    // Inline the compiled CSS from panel.css
    style.textContent = `/* Flowscope Panel Styles * Modern, component-based CSS matching the product design system *//* Design Tokens */:root { --fs-bg-primary: #000000; --fs-bg-secondary: #000000; --fs-border: rgb(107 114 128 / 0.2); --fs-text-primary: #cccccc; --fs-text-secondary: #999999; --fs-text-tertiary: #666666; --fs-accent: #569cd6; --fs-transition: cubic-bezier(0.4, 0, 0.2, 1);}/* Base Panel Styles */#flowscope-panel { position: fixed; bottom: 0; left: 0; right: 0; z-index: 999997; display: flex; flex-direction: column; background: var(--fs-bg-primary); border-top: 1px solid var(--fs-border); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; font-size: 12px; transition: height 0.3s var(--fs-transition); overflow: hidden; pointer-events: auto;}#flowscope-panel.fs-hidden { display: none;}/* Toggle Button */#flowscope-toggle { position: fixed; z-index: 2147483647; padding: 8px 12px; background: #93c5fd; color: #000000; border: 1px solid #93c5fd; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; transition: background-color 0.2s;}#flowscope-toggle:hover { background: #333333;}/* Resize Handle */.flowscope-resize-handle { position: absolute; top: 0; left: 0; right: 0; height: 4px; cursor: ns-resize; z-index: 10; background: var(--fs-border);}/* .flowscope-resize-handle:hover { background-color: var(--fs-accent) !important;} */body.flowscope-resizing { -webkit-user-select: none !important; -moz-user-select: none !important; user-select: none !important; pointer-events: none !important;}body.flowscope-resizing #flowscope-panel,body.flowscope-resizing .flowscope-resize-handle { pointer-events: auto !important;}/* Scrollbar */.flowscope-scrollbar::-webkit-scrollbar { width: 8px; height: 8px;}.flowscope-scrollbar::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.02); border-radius: 4px;}.flowscope-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 4px;}.flowscope-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.2);}/* Header */.flowscope-header { /* border-bottom: 1px solid var(--fs-border); */ background: var(--fs-bg-secondary);}.flowscope-header-top { display: flex; justify-content: space-between; align-items: center; padding: 0px 8px; border-bottom: 1px solid var(--fs-border);}.flowscope-header-title { display: flex; align-items: center; gap: 10px;}.flowscope-header-title-left { display: flex; align-items: center; gap: 8px;}.flowscope-title-text { color: var(--fs-text-primary); font-weight: 500; font-size: 12px;}.flowscope-subtitle { color: var(--fs-text-tertiary); font-size: 11px;}.flowscope-header-actions { display: flex; gap: 6px; align-items: center; padding: 0px 8px; /* border-bottom: 1px solid var(--fs-border); */}.flowscope-search-container { border-bottom: 1px solid var(--fs-border); margin-bottom: 10px;}.flowscope-count { color: var(--fs-text-secondary); font-size: 11px; padding: 2px 6px; font-weight: 400;}/* Buttons */.flowscope-btn { background: transparent; border: none; cursor: pointer; transition: background-color 0.15s; font-size: 12px; font-weight: 400; border-radius: 2px; padding: 4px 8px; color: var(--fs-text-primary);}.flowscope-btn:hover { background: rgba(255, 255, 255, 0.08);}#flowscope-clear:hover { background: rgba(239, 68, 68, 0.08) !important;}.flowscope-btn-primary { background: var(--fs-bg-secondary); border: 1px solid var(--fs-border);}.flowscope-btn-primary:hover { background: #333333;}.flowscope-btn-close { color: var(--fs-text-secondary); font-size: 16px; padding: 2px 6px; width: auto; height: auto;}.flowscope-btn-close:hover { color: var(--fs-text-primary);}.flex-con{ display: flex; align-items: center; justify-content: center; gap: 2px;}.flex-con-btw{ display: flex; align-items: center; justify-content: space-between; gap: 8px;}/* Tabs */.flowscope-tabs { display: flex; gap: 0; /* border-bottom: 1px solid var(--fs-border); */ padding: 0; background: transparent;}.flowscope-tab { padding: 6px 12px; font-size: 12px; font-weight: 400; color: var(--fs-text-secondary); background: transparent; border: none; border-bottom: 2px solid transparent; cursor: pointer; transition: all 0.15s;}.flowscope-tab:hover { color: var(--fs-text-primary); background: rgba(255, 255, 255, 0.03);}.flowscope-tab.active { color: var(--fs-accent); border-bottom-color: var(--fs-accent); background: transparent; font-weight: 600;}/* Content */.flowscope-content { flex: 1; overflow-y: auto; padding: 0; overscroll-behavior: contain; -webkit-overflow-scrolling: touch;}/* List Items */.flowscope-list-item { padding: 4px 8px; margin: 0; background: transparent; border-bottom: 1px solid var(--fs-border); cursor: pointer; transition: background-color 0.1s;}.flowscope-list-item:hover { background: rgba(255, 255, 255, 0.03);}/* Method Badge */.flowscope-method { padding: 2px 4px; font-size: 10px; font-weight: 500; font-family: 'Consolas', 'Monaco', 'Courier New', monospace;}.flowscope-method-get { color: #7cb342;}.flowscope-method-post { color: #5c6bc0;}.flowscope-method-put { color: #ff9800;}.flowscope-method-patch { color: #ab47bc;}.flowscope-method-delete { color: #ef5350;}/* Status Badge */.flowscope-status { padding: 0 4px; font-size: 11px; font-weight: 400; font-family: 'Consolas', 'Monaco', 'Courier New', monospace;}.flowscope-status-success { color: #7cb342;}.flowscope-status-error { color: #ef5350;}.flowscope-status-pending { color: #ff9800;}/* Animations */@keyframes flowscope-fade-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); }}@keyframes flowscope-scale-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); }}@keyframes flowscope-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; }}.flowscope-animate-in { animation: flowscope-fade-in 0.2s ease-out;}.flowscope-scale-in { animation: flowscope-scale-in 0.15s ease-out;}.flowscope-pulse { animation: flowscope-pulse 2s ease-in-out infinite;}/* Input */.flowscope-input { background: var(--fs-bg-primary); border: 1px solid var(--fs-border); color: var(--fs-text-primary); padding: 4px 8px; border-radius: 2px; font-size: 12px; transition: border-color 0.15s; width: 100%;}.flowscope-input:focus { outline: none; border-color: var(--fs-accent);}.flowscope-input::-moz-placeholder { color: var(--fs-text-tertiary);}.flowscope-input::placeholder { color: var(--fs-text-tertiary);}`;
    document.head.appendChild(style);
  }

  private createUI(): void {
    // Toggle button with notification badge
    this.toggleButton = document.createElement('button');
    this.toggleButton.id = 'flowscope-toggle';
    this.toggleButton.innerHTML = `FS`;
    this.updateToggleButtonPosition();
  }

  private updateToggleButtonPosition(): void {
    if (!this.toggleButton) return;

    const bottomPos = this.minimized ? '20px' : `${this.panelHeight + 20}px`;
    this.toggleButton.style.bottom = bottomPos;
    this.toggleButton.style.right = '20px';

    // Only attach listeners once
    if (!this.toggleButton.onclick) {
    this.toggleButton.addEventListener('click', () => this.toggle());
    }

    // Main panel (only create once)
    if (!this.panelElement) {
    this.panelElement = document.createElement('div');
      this.panelElement.id = 'flowscope-panel';
      this.updatePanelStyle();

      this.panelElement.innerHTML = `
        <div class="flowscope-resize-handle"></div>
        ${this.getPanelHTML()}
      `;

    this.container.appendChild(this.toggleButton);
    this.container.appendChild(this.panelElement);

    this.attachPanelHandlers();
      this.attachResizeHandlers();
      this.attachScrollHandlers();
    }
  }

  private updatePanelStyle(): void {
    if (!this.panelElement) return;

    // CSS handles most styling, we just need to set dynamic values
    this.panelElement.style.height = `${this.panelHeight}px`;
    this.panelElement.style.display = this.minimized ? 'none' : 'flex';
  }

  private attachResizeHandlers(): void {
    if (!this.panelElement) return;

    const resizeHandle = this.panelElement.querySelector('.flowscope-resize-handle') as HTMLElement;
    if (!resizeHandle) return;

    const updateHeight = () => {
      if (this.pendingHeight !== null && this.panelElement && this.toggleButton) {
        this.panelElement.style.height = `${this.pendingHeight}px`;
        this.toggleButton.style.bottom = `${this.pendingHeight + 20}px`;
        this.pendingHeight = null;
      }
      this.rafId = null;
    };

    resizeHandle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      this.isResizing = true;
      this.startY = e.clientY;
      this.startHeight = this.panelHeight;
      document.body.classList.add('flowscope-resizing');

      // Disable transition during resize for smoothness
      if (this.panelElement) {
        this.panelElement.style.transition = 'none';
        this.panelElement.style.willChange = 'height';
      }
    });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isResizing) return;

      e.preventDefault();
      e.stopPropagation();

      const deltaY = this.startY - e.clientY;
      const newHeight = Math.min(
        Math.max(this.startHeight + deltaY, this.MIN_HEIGHT),
        this.MAX_HEIGHT
      );

      this.panelHeight = newHeight;
      this.pendingHeight = newHeight;

      // Use requestAnimationFrame for smooth 60fps updates
      if (this.rafId === null) {
        this.rafId = requestAnimationFrame(updateHeight);
      }
    });

    document.addEventListener('mouseup', () => {
      if (this.isResizing) {
        this.isResizing = false;
        document.body.classList.remove('flowscope-resizing');

        // Re-enable transition
        if (this.panelElement) {
          this.panelElement.style.transition = '';
          this.panelElement.style.willChange = '';
        }

        // Cancel any pending RAF
        if (this.rafId !== null) {
          cancelAnimationFrame(this.rafId);
          this.rafId = null;
        }

        // Final update
        if (this.pendingHeight !== null) {
          updateHeight();
        }

        // Save height to localStorage
        localStorage.setItem('flowscope-panel-height', String(this.panelHeight));
      }
    });
  }

  private attachScrollHandlers(): void {
    if (!this.panelElement) return;

    const content = this.panelElement.querySelector('#flowscope-content') as HTMLElement;
    if (!content) return;

    // Prevent wheel events from bubbling to the page when scrolling within content
    content.addEventListener('wheel', (e: WheelEvent) => {
      const target = e.currentTarget as HTMLElement;
      const isScrollingDown = e.deltaY > 0;
      const isAtTop = target.scrollTop === 0;
      const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 1;

      // Stop propagation to prevent page scroll, but allow content scroll
      e.stopPropagation();

      // Only prevent default at boundaries to avoid page scroll
      if ((isAtTop && !isScrollingDown) || (isAtBottom && isScrollingDown)) {
        e.preventDefault();
      }
    }, { passive: false });

    // Prevent touch scroll from bubbling
    content.addEventListener('touchmove', (e: TouchEvent) => {
      e.stopPropagation();
    }, { passive: true });
  }

  private getPanelHTML(): string {
    return `
      <!-- Header -->
      <div class="flowscope-header">
        <div class="flowscope-header-top">
          <div class="flowscope-header-title">
            <div class="flowscope-header-title-left">
              <span style="font-size: 15px;">⚡</span>
            <div>
                <div class="flowscope-title-text">Flowscope</div>
            </div>
          </div>
        <!-- View Tabs -->
            <div class="flowscope-tabs">
              <button data-view="list" class="flowscope-tab active flex-con" style="flex: 1;">List <span id="flowscope-count" class="flowscope-count">0</span></button>
              <button data-view="stats" class="flowscope-tab" style="flex: 1;">Stats</button>
        </div>
          </div>
          <div class="flowscope-header-actions flex-con">
            <div id="flowscope-error-badge" style="
              display: none;
              color: #ef4444;
              font-size: 10px;
              font-weight: 700;
            ">0 errors</div>
            <button id="flowscope-close" class="flowscope-btn flowscope-btn-close">×</button>
        </div>
      </div>

      <!-- Search -->
      <div class="flowscope-search-container flex-con-btw" style="padding: 8px 8px;">
        <div style="width: 100%;">
        <input
          id="flowscope-search"
          type="text"
          placeholder="Search requests (url, status, body)..."
          style="
            width: 100%;
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.05);
            border-radius: 8px;
              padding: 10px 10px;
            color: white;
            font-size: 13px;
            outline: none;
            transition: all 0.2s;
          "
          onfocus="this.style.borderColor='rgba(255, 255, 255, 0.1)'; this.style.background='rgba(255, 255, 255, 0.05)'"
          onblur="this.style.borderColor='rgba(255, 255, 255, 0.1)'; this.style.background='rgba(255, 255, 255, 0.05)'"
        />
      </div>

      <!-- Actions Bar -->
        <div style="display: flex; align-items: center;">
        <button id="flowscope-clear" style="
            padding:  6px 6px;
            background: transparent;
            border: none;
          color: #ef4444;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        ">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" style="color: #ef4444; width: 16px; height: 16px;">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
        </button>
        </div>
      </div>

      <!-- Content -->
      <div id="flowscope-content" class="flowscope-content flowscope-scrollbar"></div>
    `;
  }

  private attachPanelHandlers(): void {
    // Close button
    const closeBtn = this.panelElement?.querySelector('#flowscope-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.hide();
      });
    }

    // Clear button
    const clearBtn = this.panelElement?.querySelector('#flowscope-clear');
    if (clearBtn) {
      clearBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.clearEvents();
      });
    }

    // Export button
    const exportBtn = this.panelElement?.querySelector('#flowscope-export');
    if (exportBtn) {
      exportBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.exportHAR();
      });
    }

    // Search
    this.panelElement?.querySelector('#flowscope-search')?.addEventListener('input', (e) => {
      this.state.searchQuery = (e.target as HTMLInputElement).value;
      this.render();
    });

    // View tabs
    this.panelElement?.querySelectorAll('.flowscope-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const view = (e.target as HTMLElement).dataset.view as PanelState['view'];
        this.state.view = view;

        // Update active state
        this.panelElement?.querySelectorAll('.flowscope-tab').forEach(t => {
          t.classList.remove('active');
        });
        (e.target as HTMLElement).classList.add('active');

        this.render();
      });
    });

    // Filter buttons
    this.panelElement?.querySelectorAll('.flowscope-filter').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const filter = (e.target as HTMLElement).dataset.filter as PanelState['filter'];
        this.state.filter = filter;

        // Update active state
        this.panelElement?.querySelectorAll('.flowscope-filter').forEach(b => {
          const btnEl = b as HTMLElement;
          if (btnEl.dataset.filter === filter) {
            btnEl.style.background = this.getFilterColor(filter);
            btnEl.style.color = 'white';
            btnEl.classList.add('flowscope-filter-active');
          } else {
            btnEl.style.background = 'transparent';
            btnEl.style.color = this.getFilterTextColor(btnEl.dataset.filter as PanelState['filter']);
            btnEl.classList.remove('flowscope-filter-active');
          }
        });

        this.render();
      });
    });
  }

  private getFilterColor(filter: PanelState['filter']): string {
    switch (filter) {
      case 'all': return 'rgba(255, 255, 255, 0.1)';
      case 'errors': return 'rgba(239, 68, 68, 0.2)';
      case 'slow': return 'rgba(251, 191, 36, 0.2)';
      case 'mutations': return 'rgba(139, 92, 246, 0.2)';
    }
  }

  private getFilterTextColor(filter: PanelState['filter']): string {
    switch (filter) {
      case 'all': return 'white';
      case 'errors': return 'rgba(239, 68, 68, 0.8)';
      case 'slow': return 'rgba(251, 191, 36, 0.8)';
      case 'mutations': return 'rgba(139, 92, 246, 0.8)';
    }
  }

  private attachListeners(): void {
    window.addEventListener('flowscope:event-captured', ((e: CustomEvent) => {
      this.addEvent(e.detail);
    }) as EventListener);

    window.addEventListener('flowscope:events-cleared', () => {
      this.events = [];
      this.render();
    });

    window.addEventListener('flowscope:visibility-changed', ((e: CustomEvent) => {
      if (e.detail.visible) {
        this.show();
      } else {
        this.hide();
      }
    }) as EventListener);
  }

  toggle(): void {
    if (this.minimized) {
      this.show();
    } else {
      this.hide();
    }
  }

  show(): void {
    this.minimized = false;
    this.updatePanelStyle();
    this.updateToggleButtonPosition();
    if (this.panelElement) {
      this.panelElement.classList.add('flowscope-scale-in');
    }
    if (this.toggleButton) {
      const icon = this.toggleButton.querySelector('.flowscope-icon') as HTMLElement;
      if (icon) icon.textContent = '−';
    }
  }

  hide(): void {
    this.minimized = true;
    this.updatePanelStyle();
    this.updateToggleButtonPosition();
    if (this.toggleButton) {
      const icon = this.toggleButton.querySelector('.flowscope-icon') as HTMLElement;
      if (icon) icon.textContent = '⚡';
    }
  }

  addEvent(event: NetworkEvent): void {
    this.events.unshift(event);
    if (this.events.length > 200) {
      this.events = this.events.slice(0, 200);
    }
    this.updateBadges();
    this.render();
  }

  clearEvents(): void {
    this.events = [];
    this.render();
    window.dispatchEvent(new Event('flowscope:clear-requested'));
  }

  private updateBadges(): void {
    // Update count
    const countBadge = this.panelElement?.querySelector('#flowscope-count');
    if (countBadge) {
      countBadge.textContent = `${this.events.length}`;
    }

    // Update error badge
    const errors = this.events.filter(e => e.response?.status && e.response.status >= 400);
    const errorBadge = this.panelElement?.querySelector('#flowscope-error-badge') as HTMLElement;
    if (errorBadge) {
      if (errors.length > 0) {
        errorBadge.style.display = 'block';
        errorBadge.textContent = `${errors.length} error${errors.length !== 1 ? 's' : ''}`;
      } else {
        errorBadge.style.display = 'none';
      }
    }

    // Update toggle button badge
    const toggleBadge = this.toggleButton?.querySelector('.flowscope-badge') as HTMLElement;
    if (toggleBadge && errors.length > 0) {
      toggleBadge.style.display = 'block';
      toggleBadge.textContent = String(errors.length);
    } else if (toggleBadge) {
      toggleBadge.style.display = 'none';
    }
  }

  private getFilteredEvents(): NetworkEvent[] {
    let filtered = [...this.events];

    // Apply filter
    switch (this.state.filter) {
      case 'errors':
        filtered = filtered.filter(e => e.response?.status && e.response.status >= 400);
        break;
      case 'slow':
        filtered = filtered.filter(e => e.response?.duration && e.response.duration > 1000);
        break;
      case 'mutations':
        filtered = filtered.filter(e => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(e.request.method));
        break;
    }

    // Apply search
    if (this.state.searchQuery) {
      const query = this.state.searchQuery.toLowerCase();
      filtered = filtered.filter(e =>
        e.request.url.toLowerCase().includes(query) ||
        String(e.response?.status || '').includes(query) ||
        e.request.method.toLowerCase().includes(query) ||
        e.request.body?.toLowerCase().includes(query) ||
        e.response?.body?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }

  private render(): void {
    const content = this.panelElement?.querySelector('#flowscope-content');
    if (!content) return;

    this.updateBadges();

    const filtered = this.getFilteredEvents();

    switch (this.state.view) {
      case 'list':
        content.innerHTML = this.renderListView(filtered);
        break;
      case 'timeline':
        content.innerHTML = this.renderTimelineView(filtered);
        break;
      case 'errors':
        content.innerHTML = this.renderErrorsView(filtered);
        break;
      case 'stats':
        content.innerHTML = this.renderStatsView(filtered);
        break;
    }
  }

  private renderListView(events: NetworkEvent[]): string {
    if (events.length === 0) {
      return this.renderEmptyState();
    }

    return events.map(event => this.renderEventItem(event)).join('');
  }

  private renderEventItem(event: NetworkEvent): string {
    // If there's an error, show 'failed', otherwise use response status or 'pending'
    const status = event.error ? 'failed' : (event.response?.status || 'pending');
    const statusColor = this.getStatusColor(status);
    const methodColor = this.getMethodColor(event.request.method);
    const duration = event.response?.duration ? `${event.response.duration}ms` : '...';
    const time = new Date(event.request.timestamp).toLocaleTimeString();
    const url = this.truncateUrl(event.request.url);
    const isError = (typeof status === 'number' && status >= 400) || status === 'failed';
    const isSlow = event.response?.duration && event.response.duration > 1000;

    return `
      <div class="flowscope-animate-in" style="
        background: ${isError ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255, 255, 255, 0.03)'};
        border: 1px solid ${isError ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)'};
        border-radius: 10px;
        padding: 14px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
      " onmouseenter="this.style.background='${isError ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.08)'}'; this.style.transform='translateX(4px)'" onmouseleave="this.style.background='${isError ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255, 255, 255, 0.03)'}'; this.style.transform='translateX(0)'">
        <div style="display: flex; align-items: start; gap: 10px;">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;">
              <span style="
                color: ${methodColor};
                font-weight: 700;
                font-family: 'SF Mono', Monaco, monospace;
                font-size: 11px;
                letter-spacing: 0.5px;
              ">${event.request.method}</span>
              <span style="
                color: ${statusColor};
                font-weight: 700;
                background: ${statusColor}15;
                padding: 3px 8px;
                border-radius: 6px;
                font-size: 11px;
                border: 1px solid ${statusColor}30;
              ">${status}</span>
              ${isSlow ? `<span style="
                color: #fbbf24;
                font-size: 11px;
                background: rgba(251, 191, 36, 0.1);
                padding: 2px 6px;
                border-radius: 4px;
                display: inline-flex;
                align-items: center;
                gap: 3px;
              "><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 12px; height: 12px;">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
</svg> SLOW</span>` : ''}
              ${isError ? `<span style="
                color: #ef4444;
                font-size: 11px;
                background: rgba(239, 68, 68, 0.1);
                padding: 2px 6px;
                border-radius: 4px;
                animation: flowscope-pulse 2s ease-in-out infinite;
                display: inline-flex;
                align-items: center;
                gap: 3px;
              "><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 12px; height: 12px;">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
</svg> ERROR</span>` : ''}
            </div>
            <div style="
              color: rgba(255, 255, 255, 0.8);
              font-size: 13px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              margin-bottom: 6px;
              font-weight: 500;
            " title="${event.request.url}">${url}</div>
            <div style="
              display: flex;
              gap: 16px;
              color: rgba(255, 255, 255, 0.4);
              font-size: 11px;
              font-family: 'SF Mono', Monaco, monospace;
            ">
              <span style="display: inline-flex; align-items: center; gap: 4px;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 11px; height: 11px;">
  <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
</svg> ${duration}</span>
              <span style="display: inline-flex; align-items: center; gap: 4px;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 11px; height: 11px;">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
</svg> ${time}</span>
              ${event.error ? `<span style="color: #ef4444; display: inline-flex; align-items: center; gap: 4px;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 11px; height: 11px;">
  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
</svg> ${event.error}</span>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private renderTimelineView(events: NetworkEvent[]): string {
    if (events.length === 0) {
      return this.renderEmptyState('timeline');
    }

    // Sort by timestamp
    const sorted = [...events].sort((a, b) => a.request.timestamp - b.request.timestamp);
    const oldest = sorted[0]?.request.timestamp || Date.now();
    const newest = sorted[sorted.length - 1]?.request.timestamp || Date.now();
    const range = newest - oldest || 1;

    return `
      <div style="padding: 20px 0;">
        <h3 style="color: white; font-size: 14px; font-weight: 600; margin-bottom: 24px;">Request Timeline</h3>

        <!-- Timeline -->
        <div style="position: relative; height: 80px; margin-bottom: 30px;">
          <div style="position: absolute; left: 0; right: 0; top: 40px; height: 2px; background: rgba(255, 255, 255, 0.1);"></div>
          ${sorted.slice(-50).map(event => {
            const position = ((event.request.timestamp - oldest) / range) * 90 + 5;
            const size = this.getTimelineDotSize(event);
            const color = event.response?.status && event.response.status >= 400 ? '#ef4444' :
                         event.response?.status && event.response.status >= 300 ? '#fbbf24' : '#10b981';

            return `
              <div style="
                position: absolute;
                left: ${position}%;
                top: 50%;
                transform: translate(-50%, -50%);
                width: ${size}px;
                height: ${size}px;
                background: ${color};
                border: 2px solid rgba(0, 0, 0, 0.3);
                border-radius: 50%;
                cursor: pointer;
                transition: all 0.2s;
                z-index: ${event.response?.duration || 0};
              " title="${event.request.method} ${event.request.url}\n${event.response?.status || 'pending'} • ${event.response?.duration || 0}ms"
              onmouseenter="this.style.transform='translate(-50%, -50%) scale(1.5)'; this.style.zIndex='999'"
              onmouseleave="this.style.transform='translate(-50%, -50%) scale(1)'; this.style.zIndex='${event.response?.duration || 0}'"></div>
            `;
          }).join('')}
        </div>

        <!-- Time labels -->
        <div style="display: flex; justify-content: space-between; color: rgba(255, 255, 255, 0.4); font-size: 11px; margin-bottom: 30px;">
          <span>${this.formatTimeAgo(oldest)}</span>
          <span>Now</span>
        </div>

        <!-- Recent requests -->
        <h4 style="color: white; font-size: 12px; font-weight: 600; margin-bottom: 12px;">Recent Requests</h4>
        ${sorted.slice(-10).reverse().map(e => this.renderEventItem(e)).join('')}
      </div>
    `;
  }

  private renderErrorsView(events: NetworkEvent[]): string {
    const errors = events.filter(e => e.response?.status && e.response.status >= 400);

    if (errors.length === 0) {
      return `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: rgba(255, 255, 255, 0.3); text-align: center; padding: 40px;">
          <div style="margin-bottom: 16px; opacity: 0.6;"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" style="width: 48px; height: 48px; color: rgba(52, 211, 153, 0.5);">
  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
</svg></div>
          <div style="font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.4); margin-bottom: 4px;">No Errors!</div>
          <div style="font-size: 12px; color: rgba(255, 255, 255, 0.25);">All requests completed successfully</div>
        </div>
      `;
    }

    const server5xx = errors.filter(e => e.response!.status >= 500).length;
    const client4xx = errors.filter(e => e.response!.status >= 400 && e.response!.status < 500).length;
    const errorRate = ((errors.length / events.length) * 100).toFixed(1);

    // Group errors
    const grouped = this.groupErrors(errors);

    return `
      <div>
        <h3 style="color: #ef4444; font-size: 16px; font-weight: 700; margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" style="width: 20px; height: 20px;">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
          </svg>
          Error Analysis
        </h3>

        <!-- Stats -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 24px;">
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; padding: 16px;">
            <div style="color: rgba(239, 68, 68, 0.8); font-size: 11px; margin-bottom: 4px;">5xx Server Errors</div>
            <div style="color: #ef4444; font-size: 28px; font-weight: 700;">${server5xx}</div>
          </div>
          <div style="background: rgba(251, 191, 36, 0.1); border: 1px solid rgba(251, 191, 36, 0.3); border-radius: 10px; padding: 16px;">
            <div style="color: rgba(251, 191, 36, 0.8); font-size: 11px; margin-bottom: 4px;">4xx Client Errors</div>
            <div style="color: #fbbf24; font-size: 28px; font-weight: 700;">${client4xx}</div>
          </div>
          <div style="background: rgba(249, 115, 22, 0.1); border: 1px solid rgba(249, 115, 22, 0.3); border-radius: 10px; padding: 16px;">
            <div style="color: rgba(249, 115, 22, 0.8); font-size: 11px; margin-bottom: 4px;">Error Rate</div>
            <div style="color: #f97316; font-size: 28px; font-weight: 700;">${errorRate}%</div>
          </div>
          <div style="background: rgba(168, 85, 247, 0.1); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 10px; padding: 16px;">
            <div style="color: rgba(168, 85, 247, 0.8); font-size: 11px; margin-bottom: 4px;">Unique Errors</div>
            <div style="color: #a855f7; font-size: 28px; font-weight: 700;">${grouped.length}</div>
          </div>
        </div>

        <!-- Grouped errors -->
        <h4 style="color: white; font-size: 13px; font-weight: 600; margin-bottom: 12px;">Common Error Patterns</h4>
        ${grouped.map(group => `
          <div style="
            background: rgba(239, 68, 68, 0.05);
            border: 1px solid rgba(239, 68, 68, 0.2);
            border-radius: 10px;
            padding: 14px;
            margin-bottom: 10px;
          ">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
              <span style="
                background: rgba(239, 68, 68, 0.2);
                color: #ef4444;
                padding: 6px 10px;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 700;
              ">${group.status}</span>
              <span style="color: rgba(255, 255, 255, 0.8); font-size: 13px; font-weight: 600;">${group.path}</span>
            </div>
            <div style="color: rgba(255, 255, 255, 0.5); font-size: 11px; margin-bottom: 6px;">
              ${group.count} occurrence${group.count > 1 ? 's' : ''} • Last seen ${this.formatTimeAgo(group.lastSeen)}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderStatsView(events: NetworkEvent[]): string {
    if (events.length === 0) {
      return this.renderEmptyState('stats');
    }

    const completedEvents = events.filter(e => e.response);
    const durations = completedEvents.map(e => e.response!.duration).filter(d => d !== undefined) as number[];

    const avgDuration = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const maxDuration = durations.length > 0 ? Math.max(...durations) : 0;
    const minDuration = durations.length > 0 ? Math.min(...durations) : 0;

    const successCount = events.filter(e => e.response?.status && e.response.status >= 200 && e.response.status < 300).length;
    const successRate = events.length > 0 ? ((successCount / events.length) * 100).toFixed(1) : '0.0';

    // Method breakdown
    const methods = events.reduce((acc, e) => {
      acc[e.request.method] = (acc[e.request.method] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return `
      <div>

        <!-- Performance metrics -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px;">
          <div style="background: rgba(147, 197, 253, 0.1); border: 1px solid rgba(147, 197, 253, 0.2); border-radius: 10px; padding: 16px;">
            <div style="color: rgba(147, 197, 253, 0.8); font-size: 11px; margin-bottom: 4px;">Avg Response Time</div>
            <div style="color: rgb(147, 197, 253); font-size: 28px; font-weight: 700;">${avgDuration}ms</div>
          </div>
          <div style="background: rgba(134, 239, 172, 0.1); border: 1px solid rgba(134, 239, 172, 0.2); border-radius: 10px; padding: 16px;">
            <div style="color: rgba(134, 239, 172, 0.8); font-size: 11px; margin-bottom: 4px;">Success Rate</div>
            <div style="color: rgb(134, 239, 172); font-size: 28px; font-weight: 700;">${successRate}%</div>
          </div>
          <div style="background: rgba(253, 224, 71, 0.1); border: 1px solid rgba(253, 224, 71, 0.2); border-radius: 10px; padding: 16px;">
            <div style="color: rgba(253, 224, 71, 0.8); font-size: 11px; margin-bottom: 4px;">Slowest Request</div>
            <div style="color: rgb(253, 224, 71); font-size: 28px; font-weight: 700;">${maxDuration}ms</div>
          </div>
          <div style="background: rgba(134, 239, 172, 0.1); border: 1px solid rgba(134, 239, 172, 0.2); border-radius: 10px; padding: 16px;">
            <div style="color: rgba(134, 239, 172, 0.8); font-size: 11px; margin-bottom: 4px;">Fastest Request</div>
            <div style="color: rgb(134, 239, 172); font-size: 28px; font-weight: 700;">${minDuration}ms</div>
          </div>
        </div>

        <!-- Method breakdown -->
        <h4 style="color: white; font-size: 13px; font-weight: 600; margin-bottom: 12px;">By HTTP Method</h4>
        <div style="display: grid; gap: 8px;">
          ${Object.entries(methods).map(([method, count]) => `
            <div style="
              background: rgba(255, 255, 255, 0.03);
              border: 1px solid rgba(255, 255, 255, 0.08);
              border-radius: 8px;
              padding: 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            ">
              <span style="color: ${this.getMethodColor(method)}; font-weight: 700; font-size: 13px;">${method}</span>
              <span style="color: white; font-weight: 700; font-size: 16px;">${count}</span>
            </div>
          `).join('')}
        </div>

        <!-- Slowest requests -->
        <h4 style="color: white; font-size: 13px; font-weight: 600; margin: 24px 0 12px;">Slowest Requests</h4>
        ${[...completedEvents]
          .sort((a, b) => (b.response!.duration || 0) - (a.response!.duration || 0))
          .slice(0, 5)
          .map(e => this.renderEventItem(e))
          .join('')}
      </div>
    `;
  }

  private renderEmptyState(context: string = 'list'): string {
    const messages = {
      list: {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" style="width: 48px; height: 48px; color: rgba(255, 255, 255, 0.2);">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9.348 14.652a3.75 3.75 0 0 1 0-5.304m5.304 0a3.75 3.75 0 0 1 0 5.304m-7.425 2.121a6.75 6.75 0 0 1 0-9.546m9.546 0a6.75 6.75 0 0 1 0 9.546M5.106 18.894c-3.808-3.807-3.808-9.98 0-13.788m13.788 0c3.808 3.807 3.808 9.98 0 13.788M12 12h.008v.008H12V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
        </svg>`,
        title: 'No requests captured yet',
        desc: 'Make HTTP requests and they\'ll appear here'
      },
      timeline: {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" style="width: 48px; height: 48px; color: rgba(255, 255, 255, 0.2);">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
        </svg>`,
        title: 'Timeline is empty',
        desc: 'Requests will be visualized on the timeline'
      },
      stats: {
        icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1" stroke="currentColor" style="width: 48px; height: 48px; color: rgba(255, 255, 255, 0.2);">
          <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
        </svg>`,
        title: 'No stats available',
        desc: 'Make some requests to see performance metrics'
      },
    };

    const msg = messages[context as keyof typeof messages] || messages.list;

    return `
      <div style="
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: rgba(255, 255, 255, 0.3);
        text-align: center;
        padding: 40px;
      ">
        <div style="margin-bottom: 16px; opacity: 0.6;">${msg.icon}</div>
        <div style="font-size: 13px; font-weight: 500; color: rgba(255, 255, 255, 0.4); margin-bottom: 4px;">${msg.title}</div>
        <div style="font-size: 12px; color: rgba(255, 255, 255, 0.25);">${msg.desc}</div>
      </div>
    `;
  }

  private getStatusColor(status: number | string): string {
    if (status === 'pending') return '#9ca3af';
    if (status === 'failed') return '#ef4444';
    const statusNum = Number(status);
    if (statusNum < 300) return '#10b981';
    if (statusNum < 400) return '#fbbf24';
    return '#ef4444';
  }

  private getMethodColor(method: string): string {
    const colors: Record<string, string> = {
      GET: '#93c5fd',
      POST: '#86efac',
      PUT: '#fbbf24',
      PATCH: '#fb923c',
      DELETE: '#f87171',
    };
    return colors[method] || '#9ca3af';
  }

  private getTimelineDotSize(event: NetworkEvent): number {
    const duration = event.response?.duration || 0;
    if (duration > 2000) return 16;
    if (duration > 1000) return 12;
    if (duration > 500) return 10;
    return 8;
  }

  private truncateUrl(url: string, maxLength: number = 45): string {
    try {
      const parsed = new URL(url);
      const path = parsed.pathname + parsed.search;
      if (path.length > maxLength) {
        return path.substring(0, maxLength - 3) + '...';
      }
      return path;
    } catch {
      if (url.length > maxLength) {
        return url.substring(0, maxLength - 3) + '...';
      }
      return url;
    }
  }

  private formatTimeAgo(timestamp: number): string {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  }

  private groupErrors(errors: NetworkEvent[]): Array<{ status: number; path: string; count: number; lastSeen: number }> {
    const groups = new Map<string, { status: number; path: string; count: number; lastSeen: number }>();

    errors.forEach(event => {
      const key = `${event.response!.status}-${event.request.url.split('?')[0]}`;
      const existing = groups.get(key);

      if (existing) {
        existing.count++;
        existing.lastSeen = Math.max(existing.lastSeen, event.request.timestamp);
      } else {
        groups.set(key, {
          status: event.response!.status,
          path: this.truncateUrl(event.request.url, 40),
          count: 1,
          lastSeen: event.request.timestamp,
        });
      }
    });

    return Array.from(groups.values()).sort((a, b) => b.count - a.count).slice(0, 10);
  }

  private exportHAR(): void {
    const har = {
      log: {
        version: '1.2',
        creator: { name: 'Flowscope', version: '1.0.0' },
        entries: this.events.map(e => ({
          startedDateTime: new Date(e.request.timestamp).toISOString(),
          time: e.response?.duration || 0,
          request: {
            method: e.request.method,
            url: e.request.url,
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(e.request.headers).map(([name, value]) => ({ name, value })),
          },
          response: e.response ? {
            status: e.response.status,
            statusText: e.response.statusText,
            httpVersion: 'HTTP/1.1',
            headers: Object.entries(e.response.headers).map(([name, value]) => ({ name, value })),
          } : undefined,
        })),
      },
    };

    const blob = new Blob([JSON.stringify(har, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flowscope-${Date.now()}.har`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

