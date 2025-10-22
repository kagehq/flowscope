<template>
  <div class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-6">
    <h2 class="text-xl font-bold mb-4 text-white">💰 LLM Cost Tracking</h2>

    <div v-if="loading">
      <LoadingSkeleton type="cost-dashboard" />
    </div>

    <EmptyState
      v-else-if="!stats || stats.totalLLMRequests === 0"
      title="No LLM requests detected"
      description="Make LLM API calls through FlowScope proxy to track costs and optimize spending."
    >
      <template #icon>
        <svg class="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </template>
      <template #actions>
        <div class="text-xs text-gray-400 space-y-1">
          <p>Supported providers: OpenAI, Anthropic, Mistral, Cohere, Google AI</p>
          <p>→ Configure your LLM client to use <code class="bg-gray-500/10 px-1.5 py-0.5 rounded">http://localhost:4317/proxy/...</code></p>
        </div>
      </template>
    </EmptyState>
    
    <div v-else class="space-y-6">
      <!-- Summary Cards -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4">
          <div class="text-gray-400 text-sm">Total Cost (24h)</div>
          <div class="text-2xl font-bold text-white">${{ stats.totalCost.toFixed(4) }}</div>
          <div class="text-xs text-gray-500 mt-1">{{ stats.totalLLMRequests }} requests</div>
        </div>
        
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4">
          <div class="text-gray-400 text-sm">Total Tokens</div>
          <div class="text-2xl font-bold text-white">{{ formatNumber(stats.totalTokens) }}</div>
          <div class="text-xs text-gray-500 mt-1">{{ stats.totalRequests }} total reqs</div>
        </div>
        
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4">
          <div class="text-gray-400 text-sm">Avg Cost/Request</div>
          <div class="text-2xl font-bold text-white">
            ${{ stats.totalLLMRequests > 0 ? (stats.totalCost / stats.totalLLMRequests).toFixed(4) : '0.0000' }}
          </div>
        </div>
        
        <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4">
          <div class="text-gray-400 text-sm">Est. Monthly</div>
          <div class="text-2xl font-bold text-yellow-300">
            ${{ (stats.totalCost * 30).toFixed(2) }}
          </div>
          <div class="text-xs text-gray-500 mt-1">if sustained</div>
        </div>
      </div>

      <!-- Cost by Provider -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3 text-white">By Provider</h3>
        <div class="space-y-2">
          <div v-for="(data, provider) in stats.byProvider" :key="provider" class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm capitalize text-white">{{ provider }}</span>
              <span class="text-xs text-gray-500">({{ data.requests }} reqs)</span>
            </div>
            <div class="text-right">
              <div class="text-white font-mono">${{ data.cost.toFixed(4) }}</div>
              <div class="text-xs text-gray-500">{{ formatNumber(data.tokens) }} tokens</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cost by Model -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3 text-white">By Model</h3>
        <div class="space-y-2">
          <div v-for="(data, model) in sortedModels" :key="model" class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <span class="text-sm font-mono text-white">{{ model }}</span>
              <span class="text-xs text-gray-500">({{ data.requests }} reqs)</span>
            </div>
            <div class="text-right">
              <div class="text-white font-mono">${{ data.cost.toFixed(4) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Most Expensive Requests -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3 text-white">🔥 Most Expensive Requests</h3>
        <div class="space-y-2">
          <div 
            v-for="req in stats.mostExpensive" 
            :key="req.id"
            class="flex items-center justify-between py-2 px-3 bg-gray-500/5 border border-gray-500/10 rounded hover:bg-gray-500/20 cursor-pointer transition"
            @click="$emit('select-event', req.id)"
          >
            <div class="flex-1">
              <div class="text-sm text-white font-mono">{{ req.path }}</div>
              <div class="text-xs text-gray-400">
                {{ req.model }} • {{ new Date(req.timestamp).toLocaleTimeString() }}
              </div>
            </div>
            <div class="text-right">
              <div class="text-lg font-bold text-red-400">${{ req.cost.toFixed(4) }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Cost Over Time Chart -->
      <div class="bg-gray-500/10 border border-gray-500/10 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3 text-white">Cost Over Time</h3>
        <div class="h-48 flex items-end gap-1">
          <div 
            v-for="(point, idx) in stats.costOverTime" 
            :key="idx"
            class="flex-1 bg-green-500 hover:bg-green-400 rounded-t transition"
            :style="{ height: (point.cost / maxCostInBucket * 100) + '%' }"
            :title="`$${point.cost.toFixed(4)} at ${new Date(point.timestamp).toLocaleTimeString()}`"
          ></div>
        </div>
        <div class="text-xs text-gray-500 mt-2 text-center">
          Hourly cost distribution (hover for details)
        </div>
      </div>

      <!-- Optimization Tips -->
      <div v-if="optimizationTips.length > 0" class="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <h3 class="text-lg font-semibold mb-3 text-blue-300">💡 Optimization Tips</h3>
        <ul class="space-y-2">
          <li v-for="(tip, idx) in optimizationTips" :key="idx" class="text-sm text-gray-300">
            • {{ tip }}
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

defineEmits(['select-event']);

const stats = ref<any>(null);
const loading = ref(true);

const sortedModels = computed(() => {
  if (!stats.value) return {};
  return Object.fromEntries(
    Object.entries(stats.value.byModel).sort((a: any, b: any) => b[1].cost - a[1].cost)
  );
});

const maxCostInBucket = computed(() => {
  if (!stats.value?.costOverTime?.length) return 1;
  return Math.max(...stats.value.costOverTime.map((p: any) => p.cost));
});

const optimizationTips = computed(() => {
  if (!stats.value) return [];
  const tips: string[] = [];
  
  // Check for expensive models
  for (const [model, data] of Object.entries(stats.value.byModel) as any) {
    if (model.includes('gpt-4') && !model.includes('mini') && data.requests > 10) {
      tips.push(`Consider using gpt-4o-mini for ${model} requests - could save ~70% ($${(data.cost * 0.7).toFixed(2)}/day)`);
    }
    if (model.includes('claude-3-opus') && data.requests > 5) {
      tips.push(`Claude 3.5 Sonnet is faster and cheaper than Opus for most tasks - potential savings: $${(data.cost * 0.8).toFixed(2)}/day`);
    }
  }
  
  // Check for high-cost endpoints
  if (stats.value.mostExpensive.length > 0) {
    const topCost = stats.value.mostExpensive[0].cost;
    if (topCost > 0.10) {
      tips.push(`Your most expensive request costs $${topCost.toFixed(4)} - consider caching results or reducing prompt size`);
    }
  }
  
  return tips;
});

function formatNumber(num: number): string {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(1) + 'K';
  return num.toString();
}

async function fetchCostStats() {
  try {
    loading.value = true;
    const apiBase = 'http://localhost:4317';
    const response = await fetch(`${apiBase}/stats/cost?since=${Date.now() - 24 * 60 * 60 * 1000}`);
    stats.value = await response.json();
  } catch (err) {
    console.error('Failed to fetch cost stats:', err);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  fetchCostStats();
  // Refresh every 30 seconds
  setInterval(fetchCostStats, 30000);
});
</script>

