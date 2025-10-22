<template>
  <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold text-white flex items-center gap-2">
        <svg class="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        Error Analysis
      </h2>
      <div class="text-sm text-gray-400">
        {{ errorEvents.length }} errors found
      </div>
    </div>

    <div v-if="errorEvents.length === 0" class="text-center py-8 text-gray-500">
      <svg class="w-12 h-12 mx-auto mb-3 text-green-400/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="text-sm">No errors detected. All systems operational! 🎉</p>
    </div>

    <div v-else class="space-y-4">
      <!-- Error Stats -->
      <div class="grid grid-cols-4 gap-3">
        <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <div class="text-xs text-red-300">5xx Errors</div>
          <div class="text-2xl font-bold text-red-400">{{ serverErrors }}</div>
        </div>
        <div class="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
          <div class="text-xs text-yellow-300">4xx Errors</div>
          <div class="text-2xl font-bold text-yellow-400">{{ clientErrors }}</div>
        </div>
        <div class="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3">
          <div class="text-xs text-orange-300">Error Rate</div>
          <div class="text-2xl font-bold text-orange-400">{{ errorRate }}%</div>
        </div>
        <div class="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
          <div class="text-xs text-purple-300">Unique Errors</div>
          <div class="text-2xl font-bold text-purple-400">{{ Object.keys(groupedErrors).length }}</div>
        </div>
      </div>

      <!-- Grouped Errors -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-white mb-3">Most Common Errors</h3>
        <div class="space-y-2">
          <div
            v-for="(group, key) in sortedErrorGroups"
            :key="key"
            class="flex items-start gap-3 p-3 bg-gray-500/5 border border-gray-500/10 rounded-lg hover:bg-gray-500/10 cursor-pointer transition-all"
            @click="$emit('jump-to-error', group.events[0].id)"
          >
            <!-- Status Badge -->
            <div
              class="flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center font-bold text-sm"
              :class="{
                'bg-red-500/20 text-red-300': group.status >= 500,
                'bg-yellow-500/20 text-yellow-300': group.status >= 400 && group.status < 500,
              }"
            >
              {{ group.status }}
            </div>

            <!-- Error Details -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-mono text-xs text-blue-300">{{ group.method }}</span>
                <span class="font-mono text-xs text-gray-400 truncate">{{ group.path }}</span>
              </div>
              
              <!-- Error Message Preview -->
              <div v-if="group.errorMessage" class="text-xs text-red-300 font-mono mb-2 truncate">
                {{ group.errorMessage }}
              </div>

              <!-- Stack Trace Preview -->
              <div v-if="group.stackTrace" class="text-xs text-gray-500 font-mono mb-2 truncate">
                {{ group.stackTrace }}
              </div>

              <!-- SQL Query Preview -->
              <div v-if="group.sqlQuery" class="text-xs text-cyan-400 font-mono mb-2 truncate bg-cyan-500/5 px-2 py-1 rounded">
                🗄️ {{ group.sqlQuery }}
              </div>

              <div class="flex items-center gap-3 text-xs text-gray-500">
                <span>{{ group.events.length }} occurrence{{ group.events.length > 1 ? 's' : '' }}</span>
                <span>{{ formatTimeAgo(group.lastSeen) }}</span>
              </div>
            </div>

            <!-- Jump Arrow -->
            <div class="flex-shrink-0">
              <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="flex items-center gap-2">
        <button
          @click="$emit('filter-5xx')"
          class="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-300 rounded-lg text-xs hover:bg-red-500/20 transition-all"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Filter 5xx Only
        </button>
        
        <button
          @click="$emit('export-errors')"
          class="flex items-center gap-1.5 px-3 py-2 bg-gray-500/10 border border-gray-500/20 text-gray-300 rounded-lg text-xs hover:bg-gray-500/20 transition-all"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export Error Log
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CapturedEvent } from '@flowscope/shared';

const props = defineProps<{
  events: CapturedEvent[];
}>();

defineEmits(['jump-to-error', 'filter-5xx', 'export-errors']);

const errorEvents = computed(() => 
  props.events.filter(e => e.res?.status && e.res.status >= 400)
);

const serverErrors = computed(() => 
  errorEvents.value.filter(e => e.res!.status >= 500).length
);

const clientErrors = computed(() => 
  errorEvents.value.filter(e => e.res!.status >= 400 && e.res!.status < 500).length
);

const errorRate = computed(() => {
  if (props.events.length === 0) return 0;
  return ((errorEvents.value.length / props.events.length) * 100).toFixed(1);
});

// Group errors by status + path + error message
const groupedErrors = computed(() => {
  const groups: Record<string, {
    status: number;
    method: string;
    path: string;
    errorMessage?: string;
    stackTrace?: string;
    sqlQuery?: string;
    events: CapturedEvent[];
    lastSeen: number;
  }> = {};

  errorEvents.value.forEach(event => {
    // Extract error details from response body
    let errorMessage = '';
    let stackTrace = '';
    let sqlQuery = '';

    try {
      const body = event.res?.bodyPreview;
      if (body) {
        const parsed = typeof body === 'string' ? JSON.parse(body) : body;
        
        // Common error message fields
        errorMessage = parsed.error || parsed.message || parsed.error_description || parsed.detail || '';
        
        // Stack trace detection
        if (parsed.stack) {
          stackTrace = parsed.stack.split('\n')[0]; // First line only
        } else if (typeof body === 'string' && body.includes('    at ')) {
          const lines = body.split('\n');
          stackTrace = lines.find(l => l.trim().startsWith('at ')) || '';
        }

        // SQL query detection (ORM logs)
        if (parsed.sql || parsed.query) {
          sqlQuery = (parsed.sql || parsed.query).slice(0, 100);
        } else if (typeof body === 'string' && (body.includes('SELECT ') || body.includes('INSERT ') || body.includes('UPDATE ') || body.includes('DELETE '))) {
          const sqlMatch = body.match(/(SELECT|INSERT|UPDATE|DELETE)[^;]+/i);
          if (sqlMatch) {
            sqlQuery = sqlMatch[0].slice(0, 100);
          }
        }
      }
    } catch (e) {
      // If parsing fails, use raw body preview
      const body = event.res?.bodyPreview;
      if (body && typeof body === 'string') {
        errorMessage = body.slice(0, 100);
      }
    }

    // Create group key: status + path + error message
    const key = `${event.res!.status}-${event.req.path}-${errorMessage.slice(0, 50)}`;

    if (!groups[key]) {
      groups[key] = {
        status: event.res!.status,
        method: event.req.method,
        path: event.req.path,
        errorMessage,
        stackTrace,
        sqlQuery,
        events: [],
        lastSeen: event.req.ts,
      };
    }

    groups[key].events.push(event);
    groups[key].lastSeen = Math.max(groups[key].lastSeen, event.req.ts);
  });

  return groups;
});

const sortedErrorGroups = computed(() => {
  return Object.values(groupedErrors.value)
    .sort((a, b) => b.events.length - a.events.length) // Most common first
    .slice(0, 10); // Top 10
});

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  return `${hours}h ago`;
}
</script>

