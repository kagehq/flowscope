<script setup lang="ts">
defineProps<{
  size?: 'sm' | 'md' | 'lg';
}>();
</script>

<template>
  <div
    class="inline-flex items-center justify-center"
    :class="{
      'w-4 h-4': size === 'sm',
      'w-8 h-8': size === 'md' || !size,
      'w-12 h-12': size === 'lg'
    }"
  >
    <div class="relative w-full h-full">
      <div
        class="absolute inset-0 rounded-full border-2 border-primary-200"
      ></div>
      <div
        class="absolute inset-0 rounded-full border-2 border-transparent border-t-primary-600 animate-spin"
      ></div>
    </div>
  </div>
</template>

<style scoped>
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>

