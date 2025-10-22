<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold"
    :class="methodClass"
  >
    {{ method }}
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  method: string;
}>();

const methodClass = computed(() => {
  switch (props.method.toUpperCase()) {
    case 'GET':
      return 'bg-blue-500/10 text-blue-300 border border-blue-500/20';
    case 'POST':
      return 'bg-green-500/10 text-green-300 border border-green-500/20';
    case 'PUT':
      return 'bg-yellow-500/10 text-yellow-300 border border-yellow-500/20';
    case 'PATCH':
      return 'bg-orange-500/10 text-orange-300 border border-orange-500/20';
    case 'DELETE':
      return 'bg-red-500/10 text-red-300 border border-red-500/20';
    case 'OPTIONS':
      return 'bg-purple-500/10 text-purple-300 border border-purple-500/20';
    case 'HEAD':
      return 'bg-gray-500/10 text-gray-300 border border-gray-500/20';
    default:
      return 'bg-gray-500/10 text-gray-300 border border-gray-500/20';
  }
});
</script>

