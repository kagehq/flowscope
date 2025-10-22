<template>
  <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
    <h3 class="text-sm font-semibold text-white mb-3">Request Timeline</h3>

    <div v-if="timelineEvents.length === 0" class="text-xs text-gray-500 text-center py-4">
      No recent requests
    </div>

    <div v-else class="relative overflow-x-auto pb-24 pt-4">
      <!-- Timeline axis -->
      <div class="absolute left-0 right-0 top-10 h-px bg-gray-500/20"></div>

      <!-- Events (positioned by actual time) -->
      <div class="relative h-12">
          <div
            v-for="(event, idx) in timelineEvents"
            :key="event.id"
            class="absolute top-1/2 -translate-y-1/2 group cursor-pointer"
            :style="{ left: `${getEventPosition(event)}%` }"
            @click="$emit('select-event', event.id)"
          >
            <!-- Event dot (sized by duration) -->
            <div
              class="rounded-full border-2 border-gray-800 transition-all group-hover:scale-150 z-10 flex items-center justify-center"
              :class="[
                getDotSizeClass(event),
                {
                  'bg-green-300 border-green-500': event.res?.status && event.res.status >= 200 && event.res.status < 300,
                  'bg-yellow-300 border-yellow-500': event.res?.status && event.res.status >= 300 && event.res.status < 400,
                  'bg-red-400 border-red-600': event.res?.status && event.res.status >= 400,
                  'bg-gray-400 border-gray-600': !event.res?.status,
                }
              ]"
              :title="`${event.req.method} ${event.req.path} - ${event.res?.status || 'pending'} - ${fmtMs(event.res?.durationMs)}`"
            >
              <!-- Method indicator (for larger dots) -->
              <span v-if="event.res?.durationMs && event.res.durationMs > 500" class="text-[8px] font-bold text-black">
                {{ event.req.method.slice(0, 1) }}
              </span>
            </div>

            <!-- Hover info -->
            <div class="absolute top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-black border border-gray-500/10 rounded-lg px-3 py-2 text-xs text-white whitespace-nowrap shadow-2xl z-[1000] animate-scale-in">
              <div class="font-mono font-semibold text-blue-300">{{ event.req.method }} {{ event.req.path }}</div>
              <div class="text-gray-300 font-mono mt-1">
                <span class="text-gray-500">Status:</span>
                <span :class="{
                  'text-green-300': event.res?.status && event.res.status >= 200 && event.res.status < 300,
                  'text-red-300': event.res?.status && event.res.status >= 400
                }">{{ event.res?.status || '—' }}</span>
              </div>
              <div class="text-gray-300 font-mono">
                <span class="text-gray-500">Duration:</span> {{ fmtMs(event.res?.durationMs) }}
              </div>
              <div class="text-gray-400 font-mono text-[10px] mt-1">
                {{ formatTimeAgo(event.req.ts) }}
              </div>
              <!-- Arrow -->
              <div class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-gray-900 border-l-2 border-t-2 border-gray-500/50 rotate-45"></div>
            </div>
          </div>
        </div>

      <!-- Time labels -->
      <div class="flex items-center justify-between text-xs text-gray-500 mt-2">
        <span>{{ oldestTime }}</span>
        <span>Now</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { CapturedEvent } from '@flowscope/shared';

const props = defineProps<{
  events: CapturedEvent[];
  maxEvents?: number;
}>();

defineEmits(['select-event']);

const timelineEvents = computed(() => {
  const max = props.maxEvents || 20;
  return props.events.slice(0, max).reverse();
});

const oldestTime = computed(() => {
  if (timelineEvents.value.length === 0) return '';
  const oldest = timelineEvents.value[0];
  const secondsAgo = Math.floor((Date.now() - oldest.req.ts) / 1000);
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  const minutesAgo = Math.floor(secondsAgo / 60);
  return `${minutesAgo}m ago`;
});

function fmtMs(ms?: number) {
  return ms ? `${ms}ms` : '—';
}

// Position events based on actual timestamps (0% = oldest, 100% = newest)
function getEventPosition(event: CapturedEvent): number {
  if (timelineEvents.value.length <= 1) return 50;

  const oldest = timelineEvents.value[0].req.ts;
  const newest = timelineEvents.value[timelineEvents.value.length - 1].req.ts;
  const range = newest - oldest;

  if (range === 0) return 50;

  const position = ((event.req.ts - oldest) / range) * 90 + 5; // 5-95% to avoid edges
  return position;
}

// Size dots based on response duration
function getDotSizeClass(event: CapturedEvent): string {
  const duration = event.res?.durationMs || 0;

  if (duration > 1000) return 'w-6 h-6'; // Very slow
  if (duration > 500) return 'w-5 h-5';  // Slow
  if (duration > 200) return 'w-4 h-4';  // Medium
  return 'w-3 h-3';                       // Fast
}

// Format time ago for tooltip
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

