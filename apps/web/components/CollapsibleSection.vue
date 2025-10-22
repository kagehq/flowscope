<template>
  <div class="border border-gray-500/10 rounded-lg overflow-hidden">
    <!-- Header (always visible, clickable) -->
    <button
      @click="toggle"
      class="w-full flex items-center justify-between px-4 py-3 bg-gray-500/5 hover:bg-gray-500/10 transition-colors text-left"
    >
      <div class="flex items-center gap-2">
        <!-- Chevron icon -->
        <svg
          class="w-4 h-4 text-gray-400 transition-transform duration-200"
          :class="{ 'rotate-90': isExpanded }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>

        <!-- Title -->
        <h4 class="text-xs font-semibold text-white">{{ title }}</h4>

        <!-- Badge (optional) -->
        <span v-if="badge" class="text-xs text-gray-500 bg-gray-500/10 px-2 py-0.5 rounded">
          {{ badge }}
        </span>
      </div>

      <!-- Right content slot -->
      <div v-if="$slots.headerRight">
        <slot name="headerRight"></slot>
      </div>
    </button>

    <!-- Content (collapsible) -->
    <Transition
      name="collapse"
      @enter="onEnter"
      @after-enter="onAfterEnter"
      @leave="onLeave"
    >
      <div v-show="isExpanded" class="overflow-hidden">
        <div class="px-4 py-3">
          <slot></slot>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const props = withDefaults(defineProps<{
  title: string;
  badge?: string;
  defaultExpanded?: boolean;
}>(), {
  defaultExpanded: false,
});

const isExpanded = ref(props.defaultExpanded);

function toggle() {
  isExpanded.value = !isExpanded.value;
}

// Smooth collapse/expand animations
function onEnter(el: Element) {
  const element = el as HTMLElement;
  element.style.height = '0';
  // Force reflow
  element.offsetHeight;
  element.style.height = element.scrollHeight + 'px';
}

function onAfterEnter(el: Element) {
  const element = el as HTMLElement;
  element.style.height = 'auto';
}

function onLeave(el: Element) {
  const element = el as HTMLElement;
  element.style.height = element.scrollHeight + 'px';
  // Force reflow
  element.offsetHeight;
  element.style.height = '0';
}
</script>

<style scoped>
.collapse-enter-active,
.collapse-leave-active {
  transition: height 0.3s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  height: 0;
}
</style>

