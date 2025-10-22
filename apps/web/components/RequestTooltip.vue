<template>
  <div
    class="absolute left-0 top-full mt-2 z-50 bg-black border border-gray-500/20 rounded-lg shadow-xl p-3 min-w-[300px] pointer-events-none animate-scale-in"
    :class="{ 'hidden': !show }"
  >
    <!-- Arrow -->
    <div class="absolute -top-1 left-4 w-2 h-2 bg-black border-l border-t border-gray-500/20 transform rotate-45"></div>

    <div class="space-y-2">
      <div class="flex items-center justify-between">
        <MethodBadge :method="event.req.method" />
        <span
          class="text-xs font-mono px-2 py-0.5 rounded"
          :class="{
            'bg-green-300/10 text-green-300': event.res?.status && event.res.status >= 200 && event.res.status < 300,
            'bg-red-500/10 text-red-300': event.res?.status && event.res.status >= 400,
            'bg-yellow-300/10 text-yellow-300': event.res?.status && event.res.status >= 300 && event.res.status < 400,
          }"
        >
          {{ event.res?.status || '—' }}
        </span>
      </div>

      <div class="text-xs text-white font-mono truncate">
        {{ event.req.path }}
      </div>

      <div class="flex items-center justify-between text-xs">
        <span class="text-gray-400">Duration:</span>
        <span class="text-white font-mono">{{ event.res?.durationMs || 0 }}ms</span>
      </div>

      <div class="flex items-center justify-between text-xs">
        <span class="text-gray-400">Size:</span>
        <span class="text-white font-mono">{{ formatBytes(event.res?.bodyBytes || 0) }}</span>
      </div>

      <div v-if="event.llm" class="flex items-center justify-between text-xs pt-2 border-t border-gray-500/20">
        <span class="text-gray-400">LLM Cost:</span>
        <span class="text-yellow-300 font-mono">${{ event.llm.cost?.toFixed(4) || '0.0000' }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CapturedEvent } from '@flowscope/shared';

defineProps<{
  event: CapturedEvent;
  show: boolean;
}>();

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
}
</script>

