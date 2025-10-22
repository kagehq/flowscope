import { Injectable } from '@nestjs/common';
import { CapturedEvent, CapturedResponse } from '@flowscope/shared';

@Injectable()
export class CaptureStore {
  private ring: (CapturedEvent | null)[];
  private size: number;
  private map = new Map<string, CapturedEvent>();
  private idx = 0;

  constructor() {
    this.size = Number(process.env.RING_SIZE ?? 2000);
    this.ring = new Array(this.size).fill(null);
  }

  add(ev: CapturedEvent) {
    const old = this.ring[this.idx];
    if (old) this.map.delete(old.id);
    this.ring[this.idx] = ev;
    this.map.set(ev.id, ev);
    this.idx = (this.idx + 1) % this.size;
  }

  updateResponse(id: string, res: CapturedResponse) {
    const found = this.map.get(id);
    if (found) found.res = res;
  }

  list(filter?: {
    method?: string[];
    status?: number[];
    pathIncludes?: string;
    q?: string;
    sinceTs?: number;
  }) {
    return Array.from(this.map.values())
      .filter((e) => {
        if (filter?.sinceTs && e.req.ts < filter.sinceTs) return false;
        if (filter?.method && !filter.method.includes(e.req.method)) return false;
        if (filter?.status && e.res && !filter.status.includes(e.res.status)) return false;
        if (filter?.pathIncludes && !e.req.path.includes(filter.pathIncludes)) return false;
        if (filter?.q) {
          const searchStr = (
            e.req.path +
            ' ' +
            (e.req.bodyPreview || '') +
            ' ' +
            (e.res?.bodyPreview || '')
          ).toLowerCase();
          if (!searchStr.includes(filter.q.toLowerCase())) return false;
        }
        return true;
      })
      .sort((a, b) => b.req.ts - a.req.ts);
  }

  get(id: string) {
    return this.map.get(id) || null;
  }
}

