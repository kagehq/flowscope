<template>
  <div class="bg-gray-900 border border-gray-700 rounded-lg p-6">
    <div class="flex items-center justify-between mb-4">
      <h2 class="text-xl font-bold text-white">🔄 Flow Tracking</h2>
      <button 
        @click="refresh"
        class="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-white transition"
      >
        Refresh
      </button>
    </div>

    <!-- Search by ID -->
    <div class="mb-4 space-y-2">
      <input
        v-model="searchSessionId"
        @keyup.enter="searchBySession"
        placeholder="Search by Session ID"
        class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
      <input
        v-model="searchCorrelationId"
        @keyup.enter="searchByCorrelation"
        placeholder="Search by Correlation ID"
        class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
      <input
        v-model="searchUserId"
        @keyup.enter="searchByUser"
        placeholder="Search by User ID"
        class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
      />
    </div>

    <!-- Flow Results -->
    <div v-if="flowEvents.length > 0" class="mb-6">
      <h3 class="text-lg font-semibold mb-3 text-white">
        📊 Request Flow ({{ flowEvents.length }} requests)
      </h3>
      
      <div class="bg-gray-800 rounded-lg p-4 max-h-96 overflow-y-auto">
        <div class="space-y-2">
          <div
            v-for="(event, idx) in flowEvents"
            :key="event.id"
            class="flex items-start gap-3 p-3 bg-gray-900 rounded hover:bg-gray-700 cursor-pointer transition"
            @click="$emit('select-event', event.id)"
          >
            <!-- Step Number -->
            <div class="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {{ idx + 1 }}
            </div>
            
            <!-- Request Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span :class="methodColor(event.req.method)" class="text-xs font-mono">
                  {{ event.req.method }}
                </span>
                <span class="text-sm text-white font-mono truncate">{{ event.req.path }}</span>
                <span v-if="event.res" :class="statusColor(event.res.status)" class="text-xs">
                  {{ event.res.status }}
                </span>
              </div>
              
              <div class="text-xs text-gray-400 mt-1">
                {{ formatTime(event.req.ts) }}
                <span v-if="event.res?.durationMs" class="ml-2">
                  • {{ event.res.durationMs }}ms
                </span>
                <span v-if="event.llm" class="ml-2 text-yellow-400">
                  • 🤖 {{ event.llm.model }} (${{ event.llm.cost?.toFixed(4) }})
                </span>
              </div>
            </div>

            <!-- Arrow to next -->
            <div v-if="idx < flowEvents.length - 1" class="flex-shrink-0 text-gray-600">
              ↓
            </div>
          </div>
        </div>
      </div>

      <!-- Flow Summary -->
      <div class="mt-4 grid grid-cols-3 gap-4">
        <div class="bg-gray-800 rounded p-3">
          <div class="text-gray-400 text-xs">Total Duration</div>
          <div class="text-white font-bold">{{ flowDuration }}ms</div>
        </div>
        <div class="bg-gray-800 rounded p-3">
          <div class="text-gray-400 text-xs">LLM Cost</div>
          <div class="text-yellow-400 font-bold">${{ flowCost.toFixed(4) }}</div>
        </div>
        <div class="bg-gray-800 rounded p-3">
          <div class="text-gray-400 text-xs">Errors</div>
          <div class="text-red-400 font-bold">{{ flowErrors }}</div>
        </div>
      </div>
    </div>

    <!-- Active Sessions/Flows -->
    <div v-if="!flowEvents.length">
      <h3 class="text-lg font-semibold mb-3 text-white">Active Sessions</h3>
      <div class="space-y-2">
        <div
          v-for="(session, id) in topSessions"
          :key="id"
          class="bg-gray-800 rounded-lg p-3 hover:bg-gray-700 cursor-pointer transition"
          @click="searchSessionId = id; searchBySession()"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="text-white text-sm font-mono">Session: {{ id.substring(0, 8) }}...</div>
              <div class="text-xs text-gray-400 mt-1">
                {{ session.requests }} requests • {{ formatDuration(session.duration) }}
              </div>
            </div>
            <button class="text-blue-400 text-sm hover:text-blue-300">View →</button>
          </div>
        </div>
      </div>

      <h3 class="text-lg font-semibold mb-3 mt-6 text-white">Active Users</h3>
      <div class="space-y-2">
        <div
          v-for="(user, id) in topUsers"
          :key="id"
          class="bg-gray-800 rounded-lg p-3 hover:bg-gray-700 cursor-pointer transition"
          @click="searchUserId = id; searchByUser()"
        >
          <div class="flex items-center justify-between">
            <div>
              <div class="text-white text-sm">User: {{ id }}</div>
              <div class="text-xs text-gray-400 mt-1">
                {{ user.requests }} requests
                <span v-if="user.llmCost > 0" class="ml-2 text-yellow-400">
                  • ${{ user.llmCost.toFixed(4) }} LLM cost
                </span>
              </div>
            </div>
            <button class="text-blue-400 text-sm hover:text-blue-300">View →</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

defineEmits(['select-event']);

const searchSessionId = ref('');
const searchCorrelationId = ref('');
const searchUserId = ref('');

const flowEvents = ref<any[]>([]);
const flowStats = ref<any>(null);

const flowDuration = computed(() => {
  if (flowEvents.value.length === 0) return 0;
  const durations = flowEvents.value.filter(e => e.res?.durationMs).map(e => e.res.durationMs);
  return durations.reduce((sum, d) => sum + d, 0);
});

const flowCost = computed(() => {
  return flowEvents.value
    .filter(e => e.llm?.cost)
    .reduce((sum, e) => sum + e.llm.cost, 0);
});

const flowErrors = computed(() => {
  return flowEvents.value.filter(e => e.res && e.res.status >= 400).length;
});

const topSessions = computed(() => {
  if (!flowStats.value?.sessions) return {};
  return Object.fromEntries(
    Object.entries(flowStats.value.sessions)
      .sort((a: any, b: any) => b[1].requests - a[1].requests)
      .slice(0, 5)
  );
});

const topUsers = computed(() => {
  if (!flowStats.value?.users) return {};
  return Object.fromEntries(
    Object.entries(flowStats.value.users)
      .sort((a: any, b: any) => b[1].requests - a[1].requests)
      .slice(0, 5)
  );
});

function methodColor(method: string) {
  const colors: Record<string, string> = {
    GET: 'text-blue-400',
    POST: 'text-green-400',
    PUT: 'text-yellow-400',
    PATCH: 'text-orange-400',
    DELETE: 'text-red-400',
  };
  return colors[method] || 'text-gray-400';
}

function statusColor(status: number) {
  if (status < 300) return 'text-green-400';
  if (status < 400) return 'text-yellow-400';
  return 'text-red-400';
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString();
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

async function searchBySession() {
  if (!searchSessionId.value) return;
  await fetchRelated('sessionId', searchSessionId.value);
}

async function searchByCorrelation() {
  if (!searchCorrelationId.value) return;
  await fetchRelated('correlationId', searchCorrelationId.value);
}

async function searchByUser() {
  if (!searchUserId.value) return;
  await fetchRelated('userId', searchUserId.value);
}

async function fetchRelated(type: string, value: string) {
  try {
    const apiBase = 'http://localhost:4317';
    const response = await fetch(`${apiBase}/stats/flow/related?${type}=${value}`);
    const data = await response.json();
    flowEvents.value = data.events || [];
  } catch (err) {
    console.error('Failed to fetch related requests:', err);
    flowEvents.value = [];
  }
}

async function fetchFlowStats() {
  try {
    const apiBase = 'http://localhost:4317';
    const response = await fetch(`${apiBase}/stats/flow?since=${Date.now() - 24 * 60 * 60 * 1000}`);
    flowStats.value = await response.json();
  } catch (err) {
    console.error('Failed to fetch flow stats:', err);
  }
}

async function refresh() {
  await fetchFlowStats();
  flowEvents.value = [];
  searchSessionId.value = '';
  searchCorrelationId.value = '';
  searchUserId.value = '';
}

onMounted(() => {
  fetchFlowStats();
});
</script>

