import { Controller, Get, Query } from '@nestjs/common';
import { CaptureStore } from '../store/capture.store';

interface CostStats {
  totalCost: number;
  totalRequests: number;
  totalLLMRequests: number;
  totalTokens: number;
  byProvider: Record<string, { cost: number; requests: number; tokens: number }>;
  byModel: Record<string, { cost: number; requests: number; tokens: number }>;
  mostExpensive: Array<{ id: string; cost: number; model: string; path: string; timestamp: number }>;
  costOverTime: Array<{ timestamp: number; cost: number; cumulative: number }>;
}

interface FlowStats {
  sessions: Record<string, { requests: number; duration: number; firstSeen: number; lastSeen: number }>;
  correlations: Record<string, { requests: number; duration: number; firstSeen: number; lastSeen: number }>;
  users: Record<string, { requests: number; llmCost: number; sessions: number }>;
}

@Controller('stats')
export class StatsController {
  constructor(private store: CaptureStore) {}

  @Get('cost')
  getCostStats(@Query('since') since?: string): CostStats {
    const sinceTs = since ? parseInt(since) : Date.now() - 24 * 60 * 60 * 1000; // Default: last 24h
    const events = this.store.list({ sinceTs });
    
    const stats: CostStats = {
      totalCost: 0,
      totalRequests: events.length,
      totalLLMRequests: 0,
      totalTokens: 0,
      byProvider: {},
      byModel: {},
      mostExpensive: [],
      costOverTime: [],
    };

    const expensiveList: Array<{ id: string; cost: number; model: string; path: string; timestamp: number }> = [];
    const costByTime: Map<number, number> = new Map();

    for (const event of events) {
      if (!event.llm) continue;

      stats.totalLLMRequests++;
      const cost = event.llm.cost || 0;
      const tokens = event.llm.totalTokens || 0;
      const provider = event.llm.provider;
      const model = event.llm.model || 'unknown';

      stats.totalCost += cost;
      stats.totalTokens += tokens;

      // By provider
      if (!stats.byProvider[provider]) {
        stats.byProvider[provider] = { cost: 0, requests: 0, tokens: 0 };
      }
      stats.byProvider[provider].cost += cost;
      stats.byProvider[provider].requests++;
      stats.byProvider[provider].tokens += tokens;

      // By model
      if (!stats.byModel[model]) {
        stats.byModel[model] = { cost: 0, requests: 0, tokens: 0 };
      }
      stats.byModel[model].cost += cost;
      stats.byModel[model].requests++;
      stats.byModel[model].tokens += tokens;

      // Most expensive
      if (cost > 0) {
        expensiveList.push({
          id: event.id,
          cost,
          model,
          path: event.req.path,
          timestamp: event.req.ts,
        });
      }

      // Cost over time (bucket by hour)
      const hourBucket = Math.floor(event.req.ts / (60 * 60 * 1000)) * (60 * 60 * 1000);
      costByTime.set(hourBucket, (costByTime.get(hourBucket) || 0) + cost);
    }

    // Sort and limit most expensive
    stats.mostExpensive = expensiveList
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10);

    // Build cost over time with cumulative
    let cumulative = 0;
    stats.costOverTime = Array.from(costByTime.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, cost]) => {
        cumulative += cost;
        return { timestamp, cost, cumulative };
      });

    return stats;
  }

  @Get('flow')
  getFlowStats(@Query('since') since?: string): FlowStats {
    const sinceTs = since ? parseInt(since) : Date.now() - 24 * 60 * 60 * 1000;
    const events = this.store.list({ sinceTs });

    const stats: FlowStats = {
      sessions: {},
      correlations: {},
      users: {},
    };

    for (const event of events) {
      const ts = event.req.ts;
      const duration = event.res?.durationMs || 0;

      // Track by session
      if (event.sessionId) {
        if (!stats.sessions[event.sessionId]) {
          stats.sessions[event.sessionId] = { requests: 0, duration: 0, firstSeen: ts, lastSeen: ts };
        }
        stats.sessions[event.sessionId].requests++;
        stats.sessions[event.sessionId].duration += duration;
        stats.sessions[event.sessionId].lastSeen = Math.max(stats.sessions[event.sessionId].lastSeen, ts);
        stats.sessions[event.sessionId].firstSeen = Math.min(stats.sessions[event.sessionId].firstSeen, ts);
      }

      // Track by correlation
      if (event.correlationId) {
        if (!stats.correlations[event.correlationId]) {
          stats.correlations[event.correlationId] = { requests: 0, duration: 0, firstSeen: ts, lastSeen: ts };
        }
        stats.correlations[event.correlationId].requests++;
        stats.correlations[event.correlationId].duration += duration;
        stats.correlations[event.correlationId].lastSeen = Math.max(stats.correlations[event.correlationId].lastSeen, ts);
        stats.correlations[event.correlationId].firstSeen = Math.min(stats.correlations[event.correlationId].firstSeen, ts);
      }

      // Track by user
      if (event.userId) {
        if (!stats.users[event.userId]) {
          stats.users[event.userId] = { requests: 0, llmCost: 0, sessions: 0 };
        }
        stats.users[event.userId].requests++;
        if (event.llm?.cost) {
          stats.users[event.userId].llmCost += event.llm.cost;
        }
        if (event.sessionId) {
          stats.users[event.userId].sessions++;
        }
      }
    }

    return stats;
  }

  @Get('flow/related')
  getRelatedRequests(
    @Query('sessionId') sessionId?: string,
    @Query('correlationId') correlationId?: string,
    @Query('userId') userId?: string,
  ) {
    const allEvents = this.store.list({});
    
    const related = allEvents.filter(event => {
      if (sessionId && event.sessionId === sessionId) return true;
      if (correlationId && event.correlationId === correlationId) return true;
      if (userId && event.userId === userId) return true;
      return false;
    });

    // Sort chronologically
    related.sort((a, b) => a.req.ts - b.req.ts);

    return {
      total: related.length,
      events: related,
    };
  }
}

