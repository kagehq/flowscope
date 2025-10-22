<script setup lang="ts">
import { computed, ref } from 'vue';

const props = defineProps<{ value: any }>();

const copiedPath = ref<string | null>(null);
const expandedPaths = ref<Set<string>>(new Set());

const parsedValue = computed(() => {
  if (!props.value) return null;
  if (typeof props.value === 'string') {
    try {
      return JSON.parse(props.value);
    } catch {
      return props.value;
    }
  }
  return props.value;
});

const isJsonObject = computed(() => {
  return parsedValue.value && typeof parsedValue.value === 'object';
});

const formattedValue = computed(() => {
  if (!props.value) return '';
  if (typeof props.value === 'string') {
    return props.value;
  }
  return JSON.stringify(props.value, null, 2);
});

function highlightJSON(json: string) {
  if (!json) return '';
  if (typeof props.value === 'string' && !isJsonObject.value) {
    return json; // Don't highlight plain strings
  }

  return json
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, (match) => {
      let cls = 'text-amber-400'; // number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-blue-300 font-semibold'; // key
        } else {
          cls = 'text-green-300'; // string value
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-purple-300 font-semibold'; // boolean
      } else if (/null/.test(match)) {
        cls = 'text-gray-500 italic'; // null
      }
      return `<span class="${cls}">${match}</span>`;
    });
}

async function copyToClipboard(text: string, path?: string) {
  await navigator.clipboard.writeText(text);
  copiedPath.value = path || 'root';
  setTimeout(() => {
    copiedPath.value = null;
  }, 2000);
}

async function copyFullJSON() {
  const jsonStr = typeof parsedValue.value === 'string'
    ? parsedValue.value
    : JSON.stringify(parsedValue.value, null, 2);
  await copyToClipboard(jsonStr, 'full');
}

async function copyPath(path: string, value: any) {
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
  await copyToClipboard(valueStr, path);
}
</script>

<template>
  <div class="relative max-h-[500px] overflow-auto bg-black/30 rounded-lg p-4 border border-gray-500/25 group">
    <!-- Copy Button -->
    <button
      @click="copyFullJSON"
      class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-500/20 hover:bg-gray-500/30 border border-gray-500/30 rounded px-2 py-1 text-xs text-gray-300 hover:text-white flex items-center gap-1.5"
      :class="{ 'opacity-100 bg-green-500/20 border-green-500/50 text-green-300': copiedPath === 'full' }"
    >
      <svg v-if="copiedPath !== 'full'" class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
      <svg v-else class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      {{ copiedPath === 'full' ? 'Copied!' : 'Copy JSON' }}
    </button>

    <pre
      class="text-sm leading-6 font-mono text-gray-300"
      v-html="highlightJSON(formattedValue)"
    ></pre>
  </div>
</template>

<style scoped>
pre {
  margin: 0;
  font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
}
</style>

