<template>
  <div class="flex flex-col items-center justify-center py-16 px-4 text-center">
    <!-- Icon -->
    <div class="w-16 h-16 mb-4 rounded-full bg-gray-500/10 flex items-center justify-center">
      <slot name="icon">
        <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </slot>
    </div>

    <!-- Title -->
    <h3 class="text-lg font-semibold text-white mb-2">
      {{ title }}
    </h3>

    <!-- Description -->
    <p class="text-sm text-gray-400 mb-6 max-w-md">
      {{ description }}
    </p>

    <!-- Actions -->
    <div v-if="$slots.actions" class="space-y-2">
      <slot name="actions"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();
</script>

