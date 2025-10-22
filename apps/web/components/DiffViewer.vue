<template>
  <div class="space-y-1 font-mono text-xs">
    <div
      v-for="diff in diffs"
      :key="diff.key"
      class="flex items-start gap-2 px-2 py-1 rounded"
      :class="{
        'bg-green-500/10 border-l-2 border-green-500': diff.type === 'added',
        'bg-red-500/10 border-l-2 border-red-500': diff.type === 'removed',
        'bg-yellow-500/10 border-l-2 border-yellow-500': diff.type === 'changed',
        'bg-transparent': diff.type === 'unchanged' && !showUnchanged,
      }"
      v-show="diff.type !== 'unchanged' || showUnchanged"
    >
      <!-- Diff indicator -->
      <span
        class="flex-shrink-0 w-4 text-center font-bold"
        :class="{
          'text-green-400': diff.type === 'added',
          'text-red-400': diff.type === 'removed',
          'text-yellow-400': diff.type === 'changed',
          'text-gray-600': diff.type === 'unchanged',
        }"
      >
        <span v-if="diff.type === 'added'">+</span>
        <span v-else-if="diff.type === 'removed'">-</span>
        <span v-else-if="diff.type === 'changed'">~</span>
        <span v-else>=</span>
      </span>

      <!-- Key -->
      <span class="flex-shrink-0 text-blue-300 min-w-[120px]">{{ diff.key }}:</span>

      <!-- Values -->
      <div class="flex-1 min-w-0">
        <!-- Removed value -->
        <div v-if="diff.type === 'removed' || diff.type === 'changed'" class="text-red-300 line-through opacity-70">
          {{ formatValue(diff.leftValue) }}
        </div>

        <!-- Added/changed value -->
        <div
          v-if="diff.type === 'added' || diff.type === 'changed'"
          class="text-green-300"
          :class="{ 'mt-1': diff.type === 'changed' }"
        >
          {{ formatValue(diff.rightValue) }}
        </div>

        <!-- Unchanged value -->
        <div v-if="diff.type === 'unchanged'" class="text-gray-400 truncate">
          {{ formatValue(diff.leftValue) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { DiffResult } from '~/utils/diff';
import { compareObjects, formatValue } from '~/utils/diff';

const props = defineProps<{
  left: any;
  right: any;
  showUnchanged?: boolean;
}>();

const diffs = computed(() => {
  return compareObjects(props.left, props.right);
});
</script>

