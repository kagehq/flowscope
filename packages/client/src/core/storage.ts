/**
 * Storage Layer
 * Manages in-memory and localStorage persistence
 */

import type { NetworkEvent, FlowscopeConfig } from './types';

export class FlowscopeStorage {
  private events: NetworkEvent[] = [];
  private readonly STORAGE_KEY = 'flowscope_events';
  private readonly MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB

  constructor(private config: FlowscopeConfig) {
    this.loadFromStorage();
  }

  addEvent(event: NetworkEvent): void {
    const maxRequests = this.config.maxRequests || 100;

    // Check if event already exists (for updates)
    const existingIndex = this.events.findIndex(e => e.id === event.id);

    if (existingIndex >= 0) {
      // Update existing event
      this.events[existingIndex] = event;
    } else {
      // Add new event at the beginning
      this.events.unshift(event);

      // Trim to max size
      if (this.events.length > maxRequests) {
        this.events = this.events.slice(0, maxRequests);
      }
    }

    this.saveToStorage();
  }

  getEvents(): NetworkEvent[] {
    return [...this.events];
  }

  getEvent(id: string): NetworkEvent | undefined {
    return this.events.find(e => e.id === id);
  }

  clear(): void {
    this.events = [];
    this.saveToStorage();
  }

  remove(id: string): void {
    this.events = this.events.filter(e => e.id !== id);
    this.saveToStorage();
  }

  filter(predicate: (event: NetworkEvent) => boolean): NetworkEvent[] {
    return this.events.filter(predicate);
  }

  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.events = parsed;
        }
      }
    } catch (error) {
      console.warn('[Flowscope] Failed to load from localStorage:', error);
    }
  }

  private saveToStorage(): void {
    try {
      const serialized = JSON.stringify(this.events);

      // Check size limit
      if (serialized.length > this.MAX_STORAGE_SIZE) {
        // Trim events until we're under the limit
        while (serialized.length > this.MAX_STORAGE_SIZE && this.events.length > 10) {
          this.events.pop();
        }
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.events));
    } catch (error) {
      console.warn('[Flowscope] Failed to save to localStorage:', error);
    }
  }
}

