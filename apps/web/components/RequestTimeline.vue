<template>
  <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4 overflow-visible">
    <h3 class="text-sm font-semibold text-white mb-3">Request Timeline</h3>

    <div v-if="timelineEvents.length === 0" class="text-xs text-gray-500 text-center py-4">
      No recent requests
    </div>

    <div v-else class="relative">
      <!-- Timeline axis -->
      <div class="absolute left-0 right-0 top-1/2 h-px bg-gray-500/20"></div>
      
      <!-- Events -->
      <div class="relative flex items-center justify-between py-4 pb-16 overflow-x-auto">
        <div
          v-for="(event, idx) in timelineEvents"
          :key="event.id"
          class="relative flex flex-col items-center group cursor-pointer p-2 -m-2"
          @click="$emit('select-event', event.id)"
        >
          <!-- Event dot -->
          <div
            class="w-3 h-3 rounded-full border-2 border-gray-800 transition-transform group-hover:scale-150 z-10"
            :class="{
              'bg-green-400': event.res?.status && event.res.status >= 200 && event.res.status < 300,
              'bg-yellow-400': event.res?.status && event.res.status >= 300 && event.res.status < 400,
              'bg-red-400': event.res?.status && event.res.status >= 400,
              'bg-gray-400': !event.res?.status,
            }"
            :title="`${event.req.method} ${event.req.path} - ${event.res?.status || 'pending'}`"
          ></div>

          <!-- Hover info -->
          <div class="absolute top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-black border border-gray-500/50 rounded-lg px-3 py-2 text-xs text-white whitespace-nowrap shadow-2xl z-[100] animate-scale-in">
            <div class="font-mono font-semibold text-blue-300">{{ event.req.method }}</div>
            <div class="text-gray-300 font-mono">{{ fmtMs(event.res?.durationMs) }}</div>
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
</script>

