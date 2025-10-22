<template>
  <div class="animate-pulse">
    <div v-if="type === 'event-list'" class="space-y-3">
      <div v-for="i in count" :key="i" class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4">
        <div class="flex items-center gap-3">
          <div class="w-16 h-6 bg-gray-500/10 rounded"></div>
          <div class="flex-1 h-4 bg-gray-500/10 rounded"></div>
          <div class="w-12 h-4 bg-gray-500/10 rounded"></div>
        </div>
        <div class="mt-3 h-3 bg-gray-500/10 rounded w-3/4"></div>
      </div>
    </div>

    <div v-else-if="type === 'cost-dashboard'" class="space-y-6">
      <!-- Summary cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div v-for="i in 4" :key="i" class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4">
          <div class="h-4 bg-gray-500/10 rounded w-1/2 mb-2"></div>
          <div class="h-8 bg-gray-500/10 rounded w-3/4"></div>
        </div>
      </div>
      
      <!-- Chart -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4 h-64"></div>
    </div>

    <div v-else-if="type === 'flow-visualizer'" class="space-y-4">
      <div v-for="i in 3" :key="i" class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-3">
        <div class="flex items-center gap-3">
          <div class="w-8 h-8 bg-gray-500/10 rounded-full"></div>
          <div class="flex-1 space-y-2">
            <div class="h-4 bg-gray-500/10 rounded w-3/4"></div>
            <div class="h-3 bg-gray-500/10 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- Default skeleton -->
    <div v-else class="space-y-3">
      <div v-for="i in count" :key="i" class="h-16 bg-gray-500/10 rounded-lg"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  type?: 'event-list' | 'cost-dashboard' | 'flow-visualizer' | 'default';
  count?: number;
}>(), {
  type: 'default',
  count: 5,
});
</script>

