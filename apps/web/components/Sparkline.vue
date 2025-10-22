<template>
  <svg :width="width" :height="height" class="inline-block" :class="className">
    <polyline
      :points="points"
      fill="none"
      :stroke="color"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
  </svg>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
}>(), {
  width: 60,
  height: 20,
  color: 'currentColor',
  strokeWidth: 1.5,
  className: '',
});

const points = computed(() => {
  if (props.data.length === 0) return '';
  
  const max = Math.max(...props.data);
  const min = Math.min(...props.data);
  const range = max - min || 1;
  
  return props.data
    .map((value, index) => {
      const x = (index / (props.data.length - 1)) * props.width;
      const y = props.height - ((value - min) / range) * props.height;
      return `${x},${y}`;
    })
    .join(' ');
});
</script>

