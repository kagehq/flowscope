import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { CaptureStore } from '../store/capture.store';
import { CapturedEvent } from '@flowscope/shared';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuid } from 'uuid';

interface SessionSnapshot {
  id: string;
  name: string;
  createdAt: number;
  expiresAt: number;
  events: CapturedEvent[];
  metadata: {
    totalRequests: number;
    llmRequests: number;
    totalCost: number;
    timeRange: { start: number; end: number };
  };
}

@Controller('sessions')
export class SessionsController {
  private sessionsDir = path.join(process.cwd(), '.flowscope-sessions');

  constructor(private store: CaptureStore) {
    // Ensure sessions directory exists
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
  }

  @Post('create')
  createSession(@Body() body: { name?: string; since?: number; filter?: any }): { id: string; url: string } {
    const id = uuid();
    const name = body.name || `Session ${new Date().toISOString()}`;
    const since = body.since || Date.now() - 60 * 60 * 1000; // Default: last hour
    
    let events = this.store.list({ sinceTs: since });
    
    // Apply any additional filters
    if (body.filter) {
      if (body.filter.method) {
        events = events.filter(e => body.filter.method.includes(e.req.method));
      }
      if (body.filter.pathIncludes) {
        events = events.filter(e => e.req.path.includes(body.filter.pathIncludes));
      }
      if (body.filter.status) {
        events = events.filter(e => e.res && body.filter.status.includes(e.res.status));
      }
    }

    // Calculate metadata
    const llmEvents = events.filter(e => e.llm);
    const totalCost = llmEvents.reduce((sum, e) => sum + (e.llm?.cost || 0), 0);
    const timestamps = events.map(e => e.req.ts);
    const timeRange = {
      start: Math.min(...timestamps),
      end: Math.max(...timestamps),
    };

    const snapshot: SessionSnapshot = {
      id,
      name,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
      events,
      metadata: {
        totalRequests: events.length,
        llmRequests: llmEvents.length,
        totalCost,
        timeRange,
      },
    };

    // Save to disk
    const filePath = path.join(this.sessionsDir, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));

    console.log(`[Sessions] Created session ${id} with ${events.length} events`);

    return {
      id,
      url: `/sessions/${id}`,
    };
  }

  @Get(':id')
  getSession(@Param('id') id: string): SessionSnapshot {
    const filePath = path.join(this.sessionsDir, `${id}.json`);
    
    if (!fs.existsSync(filePath)) {
      throw new Error('Session not found');
    }

    const snapshot: SessionSnapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    
    // Check if expired
    if (snapshot.expiresAt < Date.now()) {
      fs.unlinkSync(filePath);
      throw new Error('Session expired');
    }

    return snapshot;
  }

  @Get()
  listSessions(): Array<{ id: string; name: string; createdAt: number; eventCount: number }> {
    if (!fs.existsSync(this.sessionsDir)) {
      return [];
    }

    const files = fs.readdirSync(this.sessionsDir);
    const sessions = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      
      try {
        const filePath = path.join(this.sessionsDir, file);
        const snapshot: SessionSnapshot = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        
        // Skip expired
        if (snapshot.expiresAt < Date.now()) {
          fs.unlinkSync(filePath);
          continue;
        }

        sessions.push({
          id: snapshot.id,
          name: snapshot.name,
          createdAt: snapshot.createdAt,
          eventCount: snapshot.events.length,
        });
      } catch (err) {
        console.error(`[Sessions] Failed to read ${file}:`, err);
      }
    }

    return sessions.sort((a, b) => b.createdAt - a.createdAt);
  }
}

