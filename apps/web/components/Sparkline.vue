<template>
  <svg :width="width" :height="height" class="inline-block" :class="className">
    <!-- Main line -->
    <polyline
      :points="points"
      fill="none"
      :stroke="color"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      opacity="0.8"
    />
    <!-- Dots at each data point for visibility -->
    <circle
      v-for="(point, idx) in pointsArray"
      :key="idx"
      :cx="point.x"
      :cy="point.y"
      :r="strokeWidth * 0.8"
      :fill="color"
      opacity="0.6"
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

const pointsArray = computed(() => {
  if (props.data.length === 0) return [];

  const max = Math.max(...props.data);
  const min = Math.min(...props.data);

  // Add padding to prevent flat lines at edges
  const padding = props.height * 0.1;
  const availableHeight = props.height - (padding * 2);

  // If all values are the same, show a horizontal line in the middle
  const range = max - min;
  if (range === 0) {
    return props.data.map((value, index) => {
      const x = (index / (props.data.length - 1)) * props.width;
      const y = props.height / 2; // Center line
      return { x, y };
    });
  }

  return props.data.map((value, index) => {
    const x = (index / (props.data.length - 1)) * props.width;
    const normalizedValue = (value - min) / range;
    const y = props.height - padding - (normalizedValue * availableHeight);
    return { x, y };
  });
});

const points = computed(() => {
  return pointsArray.value.map(p => `${p.x},${p.y}`).join(' ');
});
</script>

