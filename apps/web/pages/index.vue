<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useSocket } from '~/composables/useSocket';
import { useToast } from '~/composables/useToast';
import { exportAsHAR, exportAsPostman, exportAsCSV, downloadFile } from '~/utils/export';
import type { CapturedEvent } from '@flowscope/shared';

const toast = useToast();

useHead({
  title: 'Flowscope - A local, ephemeral HTTP request and response viewer',
});

const api = useApiBase();
const events = ref<CapturedEvent[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const expandedEventId = ref<string | null>(null);
const copied = ref<string | null>(null);
const replaying = ref<string | null>(null);
const hoveredEventId = ref<string | null>(null);

// Diff/Compare mode
const compareMode = ref(false);
const selectedForCompare = ref<string[]>([]);

// View mode: frontend (response-first) vs backend (request-first)
type ViewMode = 'fe' | 'be';
const viewMode = ref<ViewMode>('fe');

// Tab management
type Tab = 'events' | 'cost' | 'flows' | 'actions';
const activeTab = ref<Tab>('events');

// Check if there are any LLM requests
const hasLLMRequests = computed(() => {
  return events.value.some(event => event.llm);
});

// Auto-switch away from cost tab if no LLM requests
watch(hasLLMRequests, (hasLLM) => {
  if (!hasLLM && activeTab.value === 'cost') {
    activeTab.value = 'events';
  }
});

// Check if there are any events to export/share
const hasEvents = computed(() => {
  return events.value.length > 0;
});

// Auto-switch away from actions tab if no events
watch(hasEvents, (hasEvts) => {
  if (!hasEvts && activeTab.value === 'actions') {
    activeTab.value = 'events';
  }
});

const pathIncludes = ref('');
const method = ref<string>('');
const status = ref<string>('');
const q = ref('');
const sinceMinutes = ref(60);

// Quick filters
type QuickFilter = 'all' | 'errors' | 'slow' | 'mutations';
const activeFilter = ref<QuickFilter>('all');

let debounceTimer: NodeJS.Timeout | null = null;

async function load() {
  loading.value = true;
  error.value = null;

  try {
    const params = new URLSearchParams();
    if (pathIncludes.value) params.set('pathIncludes', pathIncludes.value);
    if (method.value) params.set('method', method.value);
    if (status.value) params.set('status', status.value);
    if (q.value) params.set('q', q.value);
    params.set('sinceTs', String(Date.now() - sinceMinutes.value * 60_000));

    console.log('Fetching events from:', `${api}/events?${params.toString()}`);

    const res = await fetch(`${api}/events?${params.toString()}`);

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    const data = await res.json();
    events.value = data;
    console.log('Loaded events:', data.length);
  } catch (err) {
    console.error('Failed to load events:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load events';
  } finally {
    loading.value = false;
  }
}

function connect() {
  const s = useSocket();
  s.on('events:rehydrate', (list: CapturedEvent[]) => {
    events.value = list;
  });
  s.on('events:new', (ev: CapturedEvent) => {
    events.value = [ev, ...events.value].slice(0, 1000);
  });
}

function toggleEvent(eventId: string) {
  if (expandedEventId.value === eventId) {
    expandedEventId.value = null;
  } else {
    expandedEventId.value = eventId;
  }
}

function toggleCompareMode() {
  compareMode.value = !compareMode.value;
  if (!compareMode.value) {
    selectedForCompare.value = [];
  }
}

function toggleSelectForCompare(eventId: string) {
  const idx = selectedForCompare.value.indexOf(eventId);
  if (idx >= 0) {
    selectedForCompare.value.splice(idx, 1);
  } else {
    if (selectedForCompare.value.length < 2) {
      selectedForCompare.value.push(eventId);
    }
  }
}

const compareEvents = computed(() => {
  if (selectedForCompare.value.length !== 2) return null;
  return {
    left: events.value.find(e => e.id === selectedForCompare.value[0]),
    right: events.value.find(e => e.id === selectedForCompare.value[1]),
  };
});

function getCurlCommand(ev: CapturedEvent) {
  const { req } = ev;
  const headers = Object.entries(req.headers || {})
    .map(([k, v]) => `-H '${k}: ${v}'`)
    .join(' ');
  const data = req.bodyPreview
    ? `--data '${req.bodyPreview.replace(/'/g, "'\\''")}'`
    : '';
  return `curl -X ${req.method} ${headers} ${data} '${req.url}'`;
}

async function copyCurl(ev: CapturedEvent) {
  const curlCmd = getCurlCommand(ev);
  await navigator.clipboard.writeText(curlCmd);
  copied.value = ev.id;
  toast.success('Copied as cURL');
  setTimeout(() => {
    copied.value = null;
  }, 2000);
}

async function replay(ev: CapturedEvent) {
  replaying.value = ev.id;
  try {
    const response = await fetch(`${api}/replay/${ev.id}`, { method: 'POST' });
    const result = await response.json();

    if (result.ok) {
      toast.success(`Request replayed! Status: ${result.status}`);
    } else {
      toast.error(`Failed to replay: ${result.error || 'Unknown error'}`);
    }
  } catch (error) {
    toast.error(`Failed to replay: ${error instanceof Error ? error.message : 'Network error'}`);
  } finally {
    replaying.value = null;
  }
}

// Export functions
function handleExportHAR() {
  try {
    const har = exportAsHAR(filtered.value);
    downloadFile(har, `flowscope-${Date.now()}.har`, 'application/json');
    toast.success('Exported as HAR file');
  } catch (error) {
    toast.error('Failed to export HAR');
  }
}

function handleExportPostman() {
  try {
    const postman = exportAsPostman(filtered.value);
    downloadFile(postman, `flowscope-${Date.now()}.postman_collection.json`, 'application/json');
    toast.success('Exported as Postman Collection');
  } catch (error) {
    toast.error('Failed to export Postman Collection');
  }
}

function handleExportCSV() {
  try {
    const csv = exportAsCSV(filtered.value);
    downloadFile(csv, `flowscope-${Date.now()}.csv`, 'text/csv');
    toast.success('Exported as CSV');
  } catch (error) {
    toast.error('Failed to export CSV');
  }
}

// Auto-search with debounce when filters change
watch([pathIncludes, method, status, q, sinceMinutes], () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    load();
  }, 500); // Wait 500ms after user stops typing
});

onMounted(() => {
  load();
  connect();
});

// Fuzzy search helper
function fuzzyMatch(searchTerm: string, target: string): boolean {
  const search = searchTerm.toLowerCase();
  const text = target.toLowerCase();

  // Simple substring match first
  if (text.includes(search)) return true;

  // Fuzzy matching: all characters must appear in order
  let searchIdx = 0;
  for (let i = 0; i < text.length && searchIdx < search.length; i++) {
    if (text[i] === search[searchIdx]) {
      searchIdx++;
    }
  }
  return searchIdx === search.length;
}

function searchEvent(ev: CapturedEvent, query: string): boolean {
  if (!query) return true;

  // Search across multiple fields
  const searchableFields = [
    ev.req.path,
    ev.req.method,
    ev.req.url,
    ev.req.bodyPreview || '',
    ev.res?.bodyPreview || '',
    JSON.stringify(ev.req.headers || {}),
    JSON.stringify(ev.res?.headers || {}),
    JSON.stringify(ev.req.query || {}),
    String(ev.res?.status || ''),
  ];

  const combinedText = searchableFields.join(' ');
  return fuzzyMatch(query, combinedText);
}

const filtered = computed(() => {
  let result = events.value;

  // Apply quick filters
  if (activeFilter.value === 'errors') {
    result = result.filter(ev => ev.res?.status && ev.res.status >= 400);
  } else if (activeFilter.value === 'slow') {
    result = result.filter(ev => ev.res?.durationMs && ev.res.durationMs > 500);
  } else if (activeFilter.value === 'mutations') {
    result = result.filter(ev => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(ev.req.method));
  }

  // Apply search/fuzzy filter (client-side for instant feedback)
  if (q.value) {
    result = result.filter(ev => searchEvent(ev, q.value));
  }

  return result;
});

// Performance insights
const perfStats = computed(() => {
  const durations = events.value
    .map(ev => ev.res?.durationMs)
    .filter((d): d is number => d !== undefined)
    .sort((a, b) => a - b);

  if (durations.length === 0) {
    return { p50: 0, p95: 0, p99: 0, avg: 0, count: 0 };
  }

  const percentile = (p: number) => {
    const idx = Math.ceil(durations.length * p) - 1;
    return durations[Math.max(0, idx)];
  };

  const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);

  return {
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
    avg,
    count: durations.length,
  };
});

// Sparkline data - group events into time buckets to show actual trends
const requestsSparkline = computed(() => {
  if (events.value.length === 0) return [];

  const bucketCount = 20;
  const recentEvents = events.value.slice(0, 100); // Look at last 100 events

  if (recentEvents.length === 0) return [];

  const oldest = recentEvents[recentEvents.length - 1].req.ts;
  const newest = recentEvents[0].req.ts;
  const range = newest - oldest || 1;
  const bucketSize = range / bucketCount;

  const buckets = new Array(bucketCount).fill(0);

  recentEvents.forEach(event => {
    const bucketIndex = Math.min(
      Math.floor((event.req.ts - oldest) / bucketSize),
      bucketCount - 1
    );
    buckets[bucketIndex]++;
  });

  return buckets;
});

const errorsSparkline = computed(() => {
  if (events.value.length === 0) return [];

  const bucketCount = 20;
  const recentEvents = events.value.slice(0, 100);

  if (recentEvents.length === 0) return [];

  const oldest = recentEvents[recentEvents.length - 1].req.ts;
  const newest = recentEvents[0].req.ts;
  const range = newest - oldest || 1;
  const bucketSize = range / bucketCount;

  const buckets = new Array(bucketCount).fill(0);

  recentEvents.forEach(event => {
    if (event.res?.status && event.res.status >= 400) {
      const bucketIndex = Math.min(
        Math.floor((event.req.ts - oldest) / bucketSize),
        bucketCount - 1
      );
      buckets[bucketIndex]++;
    }
  });

  return buckets;
});

const costSparkline = computed(() => {
  if (events.value.length === 0) return [];

  const bucketCount = 20;
  const recentEvents = events.value.slice(0, 100).filter(ev => ev.llm?.cost);

  if (recentEvents.length === 0) return [];

  const oldest = recentEvents[recentEvents.length - 1].req.ts;
  const newest = recentEvents[0].req.ts;
  const range = newest - oldest || 1;
  const bucketSize = range / bucketCount;

  const buckets = new Array(bucketCount).fill(0);

  recentEvents.forEach(event => {
    const bucketIndex = Math.min(
      Math.floor((event.req.ts - oldest) / bucketSize),
      bucketCount - 1
    );
    buckets[bucketIndex] += event.llm?.cost || 0;
  });

  return buckets;
});

function fmtMs(ms?: number) {
  return ms ? `${ms}ms` : '—';
}

function fmtTime(timestamp: number) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function tryParseJSON(value: string | undefined): any {
  if (!value) return {};
  try {
    return JSON.parse(value);
  } catch {
    return { _raw: value };
  }
}
</script>

<template>
  <div class="min-h-screen">
    <div class="mx-auto max-w-8xl animate-fade-in">
      <!-- Header -->
      <header class="flex flex-col p-6 py-2 gap-4 border-b border-gray-500/15">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <h1 class="text-sm font-semibold text-white">
              Flowscope
            </h1>
            <span class="text-gray-500/50 text-sm">/</span>
            <div class="border border-gray-500/20 rounded-xl">
              <nav class="flex gap-1 p-0.5">
                  <button
                    @click="activeTab = 'events'"
                    class="px-2.5 py-1 text-xs font-medium transition-all border rounded-lg"
                    :class="activeTab === 'events'
                      ? 'text-white border-gray-500/15 bg-gray-500/15'
                      : 'text-gray-400 hover:text-white border-transparent'"
                  >
                    Events
                    <!-- <span class="ml-2 text-xs bg-gray-500/5 px-2 py-0.5 rounded">{{ filtered.length }}</span> -->
                  </button>
                  <button
                    v-if="hasLLMRequests"
                    @click="activeTab = 'cost'"
                    class="px-2.5 py-1 text-xs font-medium transition-all border rounded-lg"
                    :class="activeTab === 'cost'
                      ? 'text-white border-gray-500/15 bg-gray-500/15'
                      : 'text-gray-400 hover:text-white border-transparent'"
                  >
                    LLM Costs
                  </button>
                  <button
                    @click="activeTab = 'flows'"
                    class="px-2.5 py-1 text-xs font-medium transition-all border rounded-lg"
                    :class="activeTab === 'flows'
                      ? 'text-white border-gray-500/15 bg-gray-500/15'
                      : 'text-gray-400 hover:text-white border-transparent'"
                  >
                    Flows
                  </button>
                  <button
                    v-if="hasEvents"
                    @click="activeTab = 'actions'"
                    class="px-2.5 py-1 text-xs font-medium transition-all border rounded-lg"
                    :class="activeTab === 'actions'
                      ? 'text-white border-gray-500/15 bg-gray-500/15'
                      : 'text-gray-400 hover:text-white border-transparent'"
                  >
                    Export & Share
                  </button>
              </nav>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 px-3 py-1">
              <div class="w-2 h-2 bg-green-300 rounded-full animate-pulse"></div>
              <span class="text-sm font-medium text-white">Live</span>
            </div>

            <!-- View Mode Toggle -->
            <div class="flex items-center gap-1 bg-gray-500/10 border border-gray-500/10 rounded-lg p-0.5">
              <button
                @click="viewMode = 'fe'"
                class="px-2.5 py-1 rounded text-xs font-medium transition-all"
                :class="viewMode === 'fe'
                  ? 'bg-blue-300 text-black shadow-sm'
                  : 'text-gray-300 hover:text-white'"
              >
                FE View
              </button>
              <button
                @click="viewMode = 'be'"
                class="px-2.5 py-1 rounded text-xs font-medium transition-all"
                :class="viewMode === 'be'
                  ? 'bg-blue-300 text-black shadow-sm'
                  : 'text-gray-300 hover:text-white'"
              >
                BE View
              </button>
            </div>

            <button
              @click="toggleCompareMode"
              class="bg-gray-500/10 border flex items-center border-gray-500/10 text-white rounded-lg px-3 py-1.5 text-xs hover:bg-gray-500/20 transition-all"
              :class="{ 'bg-purple-300 text-black border-purple-300 hover:bg-purple-300 focus:text-black': compareMode }"
            >
              <svg class="w-3.5 h-3.5 inline-block mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <span class="hidden sm:inline">
                {{ compareMode ? `Compare (${selectedForCompare.length}/2)` : 'Compare' }}
              </span>
            </button>
            <button
              @click="load"
              :disabled="loading"
              class="bg-gray-500/10 border flex items-center border-gray-500/10 text-white rounded-lg px-3 py-1.5 text-xs hover:bg-gray-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <svg v-if="!loading" class="w-3.5 h-3.5 inline-block mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <svg v-else class="w-3.5 h-3.5 inline-block mr-1.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span class="hidden sm:inline">{{ loading ? 'Loading...' : 'Refresh' }}</span>
              <span class="sm:hidden">{{ loading ? '...' : 'Sync' }}</span>
            </button>
          </div>
        </div>

      </header>

      <!-- Tabs -->


      <!-- Error Display -->
      <div v-if="error" class="mx-6 my-4 p-4 bg-red-500/10 border border-red-500/25 rounded-lg">
        <div class="flex items-start gap-3">
          <svg class="w-5 h-5 text-red-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div class="flex-1">
            <p class="text-red-400 text-sm font-medium">{{ error }}</p>
            <!-- <p class="text-red-300 text-xs mt-1">{{ error }}</p> -->
            <p class="text-red-300 text-xs mt-2">Make sure the server is running on http://localhost:4317</p>
          </div>
          <button @click="error = null" class="text-red-400 hover:text-red-300">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- LLM Cost Dashboard Tab -->
      <div v-if="activeTab === 'cost' && hasLLMRequests" class="p-6">
        <CostDashboard @select-event="(id) => { activeTab = 'events'; expandedEventId = id; }" />
      </div>

      <!-- Flow Visualizer Tab -->
      <div v-if="activeTab === 'flows'" class="p-6">
        <FlowVisualizer @select-event="(id) => { activeTab = 'events'; expandedEventId = id; }" />
      </div>

      <!-- Export & Share Tab -->
      <div v-if="activeTab === 'actions' && hasEvents" class="p-6 max-w-4xl">
        <h2 class="text-2xl font-bold text-white mb-6">Export & Share</h2>

        <!-- Export Section -->
        <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-6 mb-6">
          <h3 class="text-lg font-bold text-white mb-4">Export Data</h3>
          <p class="text-sm text-gray-400 mb-4">Export {{ filtered.length }} filtered event{{ filtered.length === 1 ? '' : 's' }} in various formats</p>
          <div class="flex flex-wrap gap-3">
            <button
              @click="handleExportHAR"
              class="flex items-center gap-2 px-4 py-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 rounded-lg transition"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              Export as HAR
            </button>
            <button
              @click="handleExportPostman"
              class="flex items-center gap-2 px-4 py-2 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-300 rounded-lg transition"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              Export for Postman
            </button>
            <button
              @click="handleExportCSV"
              class="flex items-center gap-2 px-4 py-2 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-300 rounded-lg transition"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export as CSV
            </button>
          </div>
        </div>

        <div class="space-y-4">
          <ActionBar :selectedEventId="expandedEventId ?? undefined" />

          <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-6 mt-6">
            <h3 class="text-lg font-bold text-white mb-3">Available Actions</h3>
            <ul class="space-y-3 text-gray-300">
              <li class="flex items-start gap-3">
                <svg class="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <div>
                  <strong>Export Mock Server:</strong> Generate a working Node.js mock server from captured traffic with realistic timings and error rates
                </div>
              </li>
              <li class="flex items-start gap-3">
                <svg class="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <div>
                  <strong>Share Session:</strong> Create a shareable link to captured requests (expires in 7 days)
                </div>
              </li>
              <li class="flex items-start gap-3">
                <svg class="w-5 h-5 text-gray-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
                </svg>
                <div>
                  <strong>View Saved Sessions:</strong> Access previously shared debugging sessions
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Events Tab -->
      <div v-if="activeTab === 'events'">
       <!-- Search Bar -->
       <div class="relative">
         <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
           <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
         </svg>
         <input
           v-model="q"
           placeholder="Search paths, request body, response body..."
           class="w-full bg-gray-500/5 border-b border-gray-500/10 pl-10 pr-10 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-300/50 focus:border-blue-300/50"
         />
         <div v-if="loading" class="absolute right-3 top-1/2 -translate-y-1/2">
           <div class="w-4 h-4 border-2 border-gray-500 border-t-blue-300 rounded-full animate-spin"></div>
         </div>
       </div>

       <!-- Request Timeline -->
       <div v-if="events.length > 0" class="border-b border-gray-500/10 px-6 py-3 bg-gray-500/5">
         <RequestTimeline :events="events" :maxEvents="15" @select-event="(id) => expandedEventId = id" />
       </div>

       <!-- Quick Filters -->
       <div class="border-b border-gray-500/10 px-6 py-3 flex items-center gap-2 bg-gray-500/5">
         <span class="text-xs text-gray-400 font-medium mr-2">Quick filters:</span>

         <button
           @click="activeFilter = 'all'"
           class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
           :class="activeFilter === 'all'
             ? 'bg-blue-300 text-black'
             : 'bg-gray-500/10 text-gray-300 hover:bg-gray-500/20 border border-gray-500/20'"
         >
           All
           <span class="ml-1.5 opacity-75">({{ events.length }})</span>
         </button>

         <button
           @click="activeFilter = 'errors'"
           class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
           :class="activeFilter === 'errors'
             ? 'bg-red-300 text-black'
             : 'bg-gray-500/10 text-gray-300 hover:bg-gray-500/20 border border-gray-500/20'"
         >
           Errors
           <span class="ml-1.5 opacity-75">({{ events.filter(ev => ev.res?.status && ev.res.status >= 400).length }})</span>
         </button>

         <button
           @click="activeFilter = 'slow'"
           class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
           :class="activeFilter === 'slow'
             ? 'bg-amber-300 text-black'
             : 'bg-gray-500/10 text-gray-300 hover:bg-gray-500/20 border border-gray-500/20'"
         >
           Slow (&gt;500ms)
           <span class="ml-1.5 opacity-75">({{ events.filter(ev => ev.res?.durationMs && ev.res.durationMs > 500).length }})</span>
         </button>

         <button
           @click="activeFilter = 'mutations'"
           class="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
           :class="activeFilter === 'mutations'
             ? 'bg-purple-300 text-black'
             : 'bg-gray-500/10 text-gray-300 hover:bg-gray-500/20 border border-gray-500/20'"
         >
           Mutations
           <span class="ml-1.5 opacity-75">({{ events.filter(ev => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(ev.req.method)).length }})</span>
         </button>
       </div>

       <!-- Performance Insights -->
       <div v-if="events.length > 0" class="border-b border-gray-500/10 px-6 py-3 bg-gray-500/5">
         <div class="flex items-center gap-6">
           <div class="flex items-center gap-2">
             <svg class="w-4 h-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
               <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
             </svg>
             <span class="text-xs text-gray-400 font-medium">Performance:</span>
           </div>

           <div class="flex items-center gap-1.5">
             <span class="text-xs text-gray-400">Avg</span>
             <span class="text-sm font-mono font-semibold" :class="{
               'text-green-300': perfStats.avg < 100,
               'text-yellow-300': perfStats.avg >= 100 && perfStats.avg < 500,
               'text-orange-300': perfStats.avg >= 500 && perfStats.avg < 1000,
               'text-red-300': perfStats.avg >= 1000
             }">{{ perfStats.avg }}ms</span>
           </div>

           <div class="flex items-center gap-1.5">
             <span class="text-xs text-gray-400">p50</span>
             <span class="text-sm font-mono font-semibold" :class="{
               'text-green-300': perfStats.p50 < 100,
               'text-yellow-300': perfStats.p50 >= 100 && perfStats.p50 < 500,
               'text-orange-300': perfStats.p50 >= 500 && perfStats.p50 < 1000,
               'text-red-300': perfStats.p50 >= 1000
             }">{{ perfStats.p50 }}ms</span>
           </div>

           <div class="flex items-center gap-1.5">
             <span class="text-xs text-gray-400">p95</span>
             <span class="text-sm font-mono font-semibold" :class="{
               'text-green-300': perfStats.p95 < 100,
               'text-yellow-300': perfStats.p95 >= 100 && perfStats.p95 < 500,
               'text-orange-300': perfStats.p95 >= 500 && perfStats.p95 < 1000,
               'text-red-300': perfStats.p95 >= 1000
             }">{{ perfStats.p95 }}ms</span>
           </div>

          <div class="flex items-center gap-1.5">
            <span class="text-xs text-gray-400">p99</span>
            <span class="text-sm font-mono font-semibold" :class="{
              'text-green-300': perfStats.p99 < 100,
              'text-yellow-300': perfStats.p99 >= 100 && perfStats.p99 < 500,
              'text-orange-300': perfStats.p99 >= 500 && perfStats.p99 < 1000,
              'text-red-300': perfStats.p99 >= 1000
            }">{{ perfStats.p99 }}ms</span>
          </div>

          <div class="flex-1"></div>

          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400">Requests:</span>
              <Sparkline v-if="requestsSparkline.length > 0" :data="requestsSparkline" :width="60" :height="20" color="#6ee7b7" class="opacity-70" />
              <span class="text-xs font-mono text-green-300">{{ events.length }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-xs text-gray-400">Errors:</span>
              <Sparkline v-if="errorsSparkline.length > 0" :data="errorsSparkline" :width="60" :height="20" color="#fca5a5" class="opacity-70" />
              <span class="text-xs font-mono text-red-300">{{ events.filter(e => e.res?.status && e.res.status >= 400).length }}</span>
            </div>
            <div v-if="hasLLMRequests" class="flex items-center gap-2">
              <span class="text-xs text-gray-400">Cost:</span>
              <Sparkline v-if="costSparkline.length > 0" :data="costSparkline" :width="60" :height="20" color="#fde047" class="opacity-70" />
              <span class="text-xs font-mono text-yellow-300">${{ events.reduce((sum, e) => sum + (e.llm?.cost || 0), 0).toFixed(3) }}</span>
            </div>
          </div>

          <div class="text-xs text-gray-400">
            {{ filtered.length }} / {{ events.length }} requests
          </div>
        </div>
      </div>

      <section class="pb-5 px-0">
        <!-- Events List -->
        <main class="overflow-hidden animate-slide-up">
          <!-- <div class="px-6 py-4 border-b border-gray-500/25 flex justify-between items-center">
            <h2 class="font-semibold text-white">Requests</h2>
            <div class="flex items-center gap-2">
              <span class=" text-sm text-white">
                {{ filtered.length }} events
              </span>
            </div>
          </div> -->

          <!-- Loading Skeleton -->
          <div v-if="loading" class="px-6 py-4">
            <LoadingSkeleton type="event-list" :count="8" />
          </div>

          <!-- Empty State -->
          <EmptyState
            v-else-if="filtered.length === 0"
            title="No requests captured yet"
            description="Start making HTTP requests through the FlowScope proxy to see them appear here in real-time."
          >
            <template #icon>
              <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </template>
            <template #actions>
              <div class="space-y-2">
                <div class="text-xs text-gray-400 space-y-1">
                  <p>→ Point your app to <code class="bg-gray-500/10 px-1.5 py-0.5 rounded">http://localhost:4317/proxy/...</code></p>
                  <p>→ Or try our mock server: <code class="bg-gray-500/10 px-1.5 py-0.5 rounded">npm run test:mock</code></p>
                </div>
                <button @click="load" class="bg-blue-500/20 border border-blue-500/30 text-blue-300 hover:bg-blue-500/30 rounded-lg px-4 py-2 text-sm transition">
                  Refresh Events
                </button>
              </div>
            </template>
          </EmptyState>

          <!-- Events List -->
          <ul v-else>
            <li
              v-for="ev in filtered"
              :key="ev.id"
              class="transition-all duration-150"
            >
              <div class="w-full flex items-center gap-2 border-b border-gray-500/15"
                :class="{
                  'bg-red-500/5 border-red-500/20': ev.res?.durationMs && ev.res.durationMs > 1000 && !compareMode,
                  'bg-orange-500/5 border-orange-500/20': ev.res?.durationMs && ev.res.durationMs > 500 && ev.res.durationMs <= 1000 && !compareMode,
                  'bg-purple-500/10 border-purple-500/30': selectedForCompare.includes(ev.id)
                }"
              >
                <!-- Compare Checkbox -->
                <div v-if="compareMode" class="px-3">
                  <input
                    type="checkbox"
                    :checked="selectedForCompare.includes(ev.id)"
                    @click.stop="toggleSelectForCompare(ev.id)"
                    :disabled="!selectedForCompare.includes(ev.id) && selectedForCompare.length >= 2"
                    class="w-4 h-4 rounded border-gray-500/50 bg-gray-500/10 text-purple-300 focus:ring-purple-300 focus:ring-offset-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                <button
                  @click="compareMode ? toggleSelectForCompare(ev.id) : toggleEvent(ev.id)"
                  @mouseenter="hoveredEventId = ev.id"
                  @mouseleave="hoveredEventId = null"
                  class="relative flex-1 flex items-center gap-4 px-6 py-3 font-mono hover:bg-gray-500/5 group cursor-pointer text-left"
                  :class="{
                    'bg-gray-500/10': expandedEventId === ev.id && !compareMode
                  }"
                >
                  <!-- Tooltip -->
                  <RequestTooltip :event="ev" :show="hoveredEventId === ev.id && !expandedEventId" />
                  <!-- Duration -->
                  <div class="text-sm font-mono w-16 shrink-0 text-gray-500">
                    {{ fmtMs(ev.res?.durationMs) }}
                  </div>

                  <!-- Status Code (highlighted in FE view) -->
                  <div class="shrink-0 w-12">
                    <span class="font-semibold text-sm font-mono transition-all" :class="{
                      'text-green-300': ev.res?.status && ev.res.status >= 200 && ev.res.status < 300,
                      'text-yellow-300': ev.res?.status && ev.res.status >= 300 && ev.res.status < 400,
                      'text-orange-300': ev.res?.status && ev.res.status >= 400 && ev.res.status < 500,
                      'text-red-300': ev.res?.status && ev.res.status >= 500,
                      'text-gray-500': !ev.res?.status
                    }">
                      {{ ev.res?.status ?? '—' }}
                    </span>
                  </div>

                  <!-- Method -->
                  <div class="shrink-0 w-20">
                    <MethodBadge :method="ev.req.method" />
                  </div>

                  <!-- Path -->
                  <div class="min-w-0">
                    <p class="text-gray-300 text-sm truncate group-hover:text-white transition-colors">
                      {{ ev.req.path }}
                    </p>
                  </div>

                  <!-- Spacer to push arrow to the right -->
                  <div class="flex-1"></div>

                  <!-- Expand Icon -->
                  <div v-if="!compareMode" class="text-gray-500 shrink-0">
                    <svg
                      class="w-4 h-4 transition-transform duration-200"
                      :class="{ 'rotate-180': expandedEventId === ev.id }"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
              </button>
              </div>

              <!-- Expanded Details -->
              <div
                v-if="expandedEventId === ev.id"
                class="bg-gray-500/5 border-b border-gray-500/15 px-6 py-4 animate-slide-up"
              >
                <div class="space-y-4">
                  <!-- Action Buttons -->
                  <div class="flex items-center justify-between gap-2 pb-2 border-b border-gray-500/15">
                    <!-- Full URL -->
                    <div class="bg-gray-500/5 flex items-center gap-2 rounded-lg px-3 py-2 border border-gray-500/10">
                      <h3 class="text-xs font-semibold text-white">URL:</h3>
                      <p class="text-xs text-blue-300 font-mono break-all text-ellipsis overflow-hidden">{{ ev.req.url }}</p>
                    </div>
                    <div class="flex items-center gap-2">
                      <button
                        @click.stop="copyCurl(ev)"
                        class="flex items-center gap-1.5 bg-gray-500/5 border border-gray-500/10 text-white rounded-lg px-2 py-2 text-xs hover:bg-gray-500/20 transition-all"
                        :class="{ 'bg-green-300/20 border-green-300/50 text-green-300': copied === ev.id }"
                      >
                        <svg v-if="copied !== ev.id" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {{ copied === ev.id ? 'Copied!' : 'Copy cURL' }}
                      </button>
                      <button
                        @click.stop="replay(ev)"
                        :disabled="replaying === ev.id"
                        class="flex items-center gap-1.5 bg-gray-500/5 border border-gray-500/10 text-white rounded-lg px-2 py-2 text-xs hover:bg-gray-500/20 transition-all disabled:opacity-50"
                      >
                        <svg v-if="replaying !== ev.id" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <svg v-else class="w-3.5 h-3.5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        {{ replaying === ev.id ? 'Replaying...' : 'Replay' }}
                      </button>
                    </div>
                  </div>

                  <!-- Timing Info -->
                  <div class="grid grid-cols-3 gap-4">
                    <div class="bg-gray-500/5 rounded-lg px-3 py-2 border border-gray-500/10">
                      <p class="text-xs text-gray-400 mb-1">Duration</p>
                      <p class="text-sm font-semibold text-white font-mono">{{ fmtMs(ev.res?.durationMs) }}</p>
                    </div>
                    <div class="bg-gray-500/5 rounded-lg px-3 py-2 border border-gray-500/10">
                      <p class="text-xs text-gray-400 mb-1">Timestamp</p>
                      <p class="text-xs text-white">{{ ev.req.ts ? fmtTime(ev.req.ts) : '—' }}</p>
                    </div>
                    <div class="bg-gray-500/5 rounded-lg px-3 py-2 border border-gray-500/10">
                      <p class="text-xs text-gray-400 mb-1">Status</p>
                      <p class="text-sm font-semibold text-white font-mono">{{ ev.res?.status || 'Pending' }}</p>
                    </div>
                  </div>

                  <!-- FE View: Response-first layout -->
                  <template v-if="viewMode === 'fe'">
                    <!-- Response Body (highlighted for FE) -->
                    <CollapsibleSection
                      v-if="ev.res?.bodyPreview"
                      title="Response Body"
                      :badge="ev.res.bodyBytes ? `${ev.res.bodyBytes} bytes` : undefined"
                      :default-expanded="true"
                    >
                      <JsonView :value="ev.res.bodyPreview" />
                    </CollapsibleSection>

                    <!-- Response Headers -->
                    <CollapsibleSection
                      v-if="ev.res?.headers"
                      title="Response Headers"
                      :badge="`${Object.keys(ev.res.headers).length} headers`"
                    >
                      <div class="space-y-1 font-mono text-xs">
                        <div v-for="([key, val]) in Object.entries(ev.res.headers)" :key="key" class="flex gap-2">
                          <span class="text-blue-300">{{ key }}:</span>
                          <span class="text-gray-300 break-all">{{ val }}</span>
                        </div>
                      </div>
                    </CollapsibleSection>

                    <!-- Request Body -->
                    <CollapsibleSection
                      v-if="ev.req.bodyPreview"
                      title="Request Body"
                      :badge="ev.req.bodyBytes ? `${ev.req.bodyBytes} bytes` : undefined"
                    >
                      <JsonView :value="ev.req.bodyPreview" />
                    </CollapsibleSection>

                    <!-- Request Headers -->
                    <CollapsibleSection
                      v-if="ev.req.headers"
                      title="Request Headers"
                      :badge="`${Object.keys(ev.req.headers).length} headers`"
                    >
                      <div class="space-y-1 font-mono text-xs">
                        <div v-for="([key, val]) in Object.entries(ev.req.headers || {})" :key="key" class="flex gap-2">
                          <span class="text-blue-300">{{ key }}:</span>
                          <span class="text-gray-300 break-all">{{ val }}</span>
                        </div>
                      </div>
                    </CollapsibleSection>
                  </template>

                  <!-- BE View: Request-first layout -->
                  <template v-else>
                    <!-- Query Parameters (highlighted for BE) -->
                    <CollapsibleSection
                      v-if="ev.req.query && Object.keys(ev.req.query).length > 0"
                      title="Query Parameters"
                      :badge="`${Object.keys(ev.req.query).length} params`"
                      :default-expanded="true"
                    >
                      <div class="space-y-1 font-mono text-xs">
                        <div v-for="([key, val]) in Object.entries(ev.req.query)" :key="key" class="flex gap-2">
                          <span class="text-blue-300">{{ key }}:</span>
                          <span class="text-gray-300">{{ val }}</span>
                        </div>
                      </div>
                    </CollapsibleSection>

                    <!-- Request Headers (highlighted for BE) -->
                    <CollapsibleSection
                      title="Request Headers"
                      :badge="`${Object.keys(ev.req.headers || {}).length} headers`"
                      :default-expanded="true"
                    >
                      <div class="space-y-1 font-mono text-xs">
                        <div v-for="([key, val]) in Object.entries(ev.req.headers || {})" :key="key" class="flex gap-2">
                          <span class="text-blue-300">{{ key }}:</span>
                          <span class="text-gray-300 break-all">{{ val }}</span>
                        </div>
                      </div>
                    </CollapsibleSection>

                    <!-- Request Body -->
                    <CollapsibleSection
                      v-if="ev.req.bodyPreview"
                      title="Request Body"
                      :badge="ev.req.bodyBytes ? `${ev.req.bodyBytes} bytes` : undefined"
                      :default-expanded="true"
                    >
                      <JsonView :value="ev.req.bodyPreview" />
                    </CollapsibleSection>

                    <!-- Response Body -->
                    <CollapsibleSection
                      v-if="ev.res?.bodyPreview"
                      title="Response Body"
                      :badge="ev.res.bodyBytes ? `${ev.res.bodyBytes} bytes` : undefined"
                    >
                      <JsonView :value="ev.res.bodyPreview" />
                    </CollapsibleSection>

                    <!-- Response Headers -->
                    <CollapsibleSection
                      v-if="ev.res?.headers"
                      title="Response Headers"
                      :badge="`${Object.keys(ev.res.headers).length} headers`"
                    >
                      <div class="space-y-1 font-mono text-xs">
                        <div v-for="([key, val]) in Object.entries(ev.res.headers)" :key="key" class="flex gap-2">
                          <span class="text-blue-300">{{ key }}:</span>
                          <span class="text-gray-300 break-all">{{ val }}</span>
                        </div>
                      </div>
                    </CollapsibleSection>
                  </template>
                </div>
              </div>
            </li>
          </ul>
        </main>
      </section>

      <!-- Comparison Modal -->
      <div
        v-if="compareEvents"
        class="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        @click.self="selectedForCompare = []"
      >
        <div class="bg-black border border-gray-500/15 rounded-lg max-w-7xl w-full max-h-[90vh] overflow-auto">
          <!-- Header -->
          <div class="sticky top-0 bg-black border-b border-gray-500/15 px-6 py-4 flex items-center justify-between z-10">
            <h2 class="text-lg font-semibold text-white">Compare Requests</h2>
            <button
              @click="selectedForCompare = []"
              class="text-gray-400 hover:text-white transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Diff Highlights Section -->
          <div class="border-b border-gray-500/15 px-6 py-4 bg-gray-500/5">
            <h3 class="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <svg class="w-4 h-4 text-yellow-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
              </svg>
              Differences Detected
            </h3>

            <div class="space-y-4">
              <!-- Headers Diff -->
              <div v-if="compareEvents.left && compareEvents.right" class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
                <h4 class="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                  <span>Request Headers</span>
                  <span class="text-gray-500 font-normal">(A → B)</span>
                </h4>
                <DiffViewer
                  :left="compareEvents.left.req.headers"
                  :right="compareEvents.right.req.headers"
                />
              </div>

              <!-- Query Params Diff -->
              <div v-if="compareEvents.left && compareEvents.right && (compareEvents.left.req.query || compareEvents.right.req.query)" class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
                <h4 class="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                  <span>Query Parameters</span>
                  <span class="text-gray-500 font-normal">(A → B)</span>
                </h4>
                <DiffViewer
                  :left="compareEvents.left.req.query || {}"
                  :right="compareEvents.right.req.query || {}"
                />
              </div>

              <!-- Request Body Diff -->
              <div v-if="compareEvents.left && compareEvents.right && (compareEvents.left.req.bodyPreview || compareEvents.right.req.bodyPreview)" class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
                <h4 class="text-xs font-semibold text-white mb-2 flex items-center gap-2">
                  <span>Request Body</span>
                  <span class="text-gray-500 font-normal">(A → B)</span>
                </h4>
                <DiffViewer
                  :left="tryParseJSON(compareEvents.left.req.bodyPreview)"
                  :right="tryParseJSON(compareEvents.right.req.bodyPreview)"
                />
              </div>
            </div>

            <div class="mt-3 flex items-center gap-4 text-xs">
              <div class="flex items-center gap-1">
                <span class="w-2 h-2 bg-green-500 rounded-full"></span>
                <span class="text-gray-400">Added</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="w-2 h-2 bg-red-500 rounded-full"></span>
                <span class="text-gray-400">Removed</span>
              </div>
              <div class="flex items-center gap-1">
                <span class="w-2 h-2 bg-yellow-500 rounded-full"></span>
                <span class="text-gray-400">Changed</span>
              </div>
            </div>
          </div>

          <!-- Comparison Grid -->
          <div class="grid grid-cols-2 gap-6 p-6">
            <!-- Left Request -->
            <div v-if="compareEvents.left" class="space-y-4">
              <div class="bg-blue-300/5 border border-blue-300/10 rounded-lg p-4">
                <h3 class="text-sm font-semibold text-blue-300 mb-2">Request A</h3>
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">Method:</span>
                    <span class="text-sm font-mono text-white">{{ compareEvents.left.req.method }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">Status:</span>
                    <span class="text-sm font-mono text-blue-300" :class="{
                      'text-green-300': compareEvents.left.res?.status && compareEvents.left.res.status >= 200 && compareEvents.left.res.status < 300,
                      'text-red-300': compareEvents.left.res?.status && compareEvents.left.res.status >= 400
                    }">{{ compareEvents.left.res?.status || '—' }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">Duration:</span>
                    <span class="text-sm font-mono text-white">{{ fmtMs(compareEvents.left.res?.durationMs) }}</span>
                  </div>
                </div>
              </div>

              <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
                <h4 class="text-xs font-semibold text-white mb-2">Path</h4>
                <p class="text-sm font-mono text-gray-300 break-all">{{ compareEvents.left.req.path }}</p>
              </div>

              <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
                <h4 class="text-xs font-semibold text-white mb-2">Request Body</h4>
                <JsonView :value="compareEvents.left.req.bodyPreview || 'No body'" />
              </div>

              <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
                <h4 class="text-xs font-semibold text-white mb-2">Response Body</h4>
                <JsonView :value="compareEvents.left.res?.bodyPreview || 'No response'" />
              </div>
            </div>

            <!-- Right Request -->
            <div v-if="compareEvents.right" class="space-y-4">
              <div class="bg-purple-300/5 border border-purple-300/10 rounded-lg p-4">
                <h3 class="text-sm font-semibold text-purple-300 mb-2">Request B</h3>
                <div class="space-y-2">
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">Method:</span>
                    <span class="text-sm font-mono text-white">{{ compareEvents.right.req.method }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">Status:</span>
                    <span class="text-sm font-mono text-blue-300" :class="{
                      'text-green-300': compareEvents.right.res?.status && compareEvents.right.res.status >= 200 && compareEvents.right.res.status < 300,
                      'text-red-300': compareEvents.right.res?.status && compareEvents.right.res.status >= 400
                    }">{{ compareEvents.right.res?.status || '—' }}</span>
                  </div>
                  <div class="flex items-center gap-2">
                    <span class="text-xs text-gray-400">Duration:</span>
                    <span class="text-sm font-mono text-white">{{ fmtMs(compareEvents.right.res?.durationMs) }}</span>
                  </div>
                </div>
              </div>

              <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
                <h4 class="text-xs font-semibold text-white mb-2">Path</h4>
                <p class="text-sm font-mono text-gray-300 break-all">{{ compareEvents.right.req.path }}</p>
              </div>

              <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
                <h4 class="text-xs font-semibold text-white mb-2">Request Body</h4>
                <JsonView :value="compareEvents.right.req.bodyPreview || 'No body'" />
              </div>

              <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
                <h4 class="text-xs font-semibold text-white mb-2">Response Body</h4>
                <JsonView :value="compareEvents.right.res?.bodyPreview || 'No response'" />
              </div>
            </div>
          </div>
        </div>
      </div>
      </div><!-- End Events Tab -->
    </div>
  </div>
</template>

