<template>
  <div class="flex items-center gap-2 flex-wrap">
    <!-- Export Mock Server -->
    <button
      @click="exportMock"
      :disabled="exporting"
      class="px-3 py-2 bg-purple-300 font-medium hover:bg-purple-400 disabled:bg-gray-700 rounded-lg text-xs text-black transition flex items-center gap-2"
    >
      <!-- <span>{{ exporting ? '⏳' : '🎭' }}</span> -->
      <span>Export Mock Server</span>
    </button>

    <!-- Share Session -->
    <button
      @click="showShareModal = true"
      class="px-3 py-2 bg-green-300 font-medium hover:bg-green-400 rounded-lg text-xs text-black transition flex items-center gap-2"
    >
      <!-- <span>🔗</span> -->
      <span>Share Session</span>
    </button>

    <!-- View Saved Sessions -->
    <button
      @click="showSessionsModal = true"
      class="px-3 py-2 bg-blue-300 font-medium hover:bg-blue-400 rounded-lg text-xs text-black transition flex items-center gap-2"
    >
      <!-- <span>📂</span> -->
      <span>Saved Sessions</span>
    </button>

    <!-- Export as cURL -->
    <button
      v-if="selectedEventId"
      @click="$emit('export-curl', selectedEventId)"
      class="px-3 py-2 bg-gray-500/5 border border-gray-500/10 hover:bg-gray-500/10 rounded-lg text-xs text-white transition"
    >
      Export as cURL
    </button>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="showShareModal = false">
      <div class="bg-black border border-gray-500/20 rounded-lg p-6 max-w-md w-full mx-4" @click.stop>
        <h3 class="text-xl font-bold text-white mb-4">Share Session</h3>

        <div class="space-y-4">
          <div>
            <label class="text-sm text-gray-400">Session Name</label>
            <input
              v-model="sessionName"
              placeholder="e.g., User registration flow"
              class="w-full px-3 py-2 bg-gray-500/5 border border-gray-500/10 rounded text-white mt-1"
            />
          </div>

          <div>
            <label class="text-sm text-gray-400">Time Range</label>
            <select v-model="shareTimeRange" class="w-full px-3 py-2 bg-gray-500/5 border border-gray-500/10 rounded text-white mt-1">
              <option :value="5 * 60 * 1000">Last 5 minutes</option>
              <option :value="15 * 60 * 1000">Last 15 minutes</option>
              <option :value="60 * 60 * 1000">Last hour</option>
              <option :value="24 * 60 * 60 * 1000">Last 24 hours</option>
            </select>
          </div>

          <div>
            <label class="flex items-center gap-2 text-sm text-gray-400">
              <input type="checkbox" v-model="shareOnlyErrors" class="rounded">
              Only include errors (4xx/5xx)
            </label>
          </div>

          <div v-if="sessionUrl" class="bg-green-300/10 border border-green-300/20 rounded-lg p-3">
            <div class="text-sm text-green-300 mb-2">Session created!</div>
            <div class="flex items-center gap-2">
              <input
                :value="fullSessionUrl"
                readonly
                class="flex-1 px-3 py-2 bg-gray-500/5 border border-gray-500/10 rounded-lg text-white text-sm"
              />
              <button
                @click="copySessionUrl"
                class="px-3 py-2 font-medium bg-blue-300 hover:bg-blue-400 rounded-lg text-sm text-black transition"
              >
                {{ copied ? '✓' : 'Copy' }}
              </button>
            </div>
            <div class="text-xs text-gray-400 mt-2">
              Link expires in 7 days • {{ sessionEvents }} events captured
            </div>
          </div>
        </div>

        <div class="flex gap-2 mt-6">
          <button
            @click="createSession"
            :disabled="creating"
            class="flex-1 px-4 py-2 bg-blue-300 text-sm font-medium hover:bg-blue-400 disabled:bg-gray-700 rounded-lg text-black transition"
          >
            {{ creating ? 'Creating...' : 'Create Share Link' }}
          </button>
          <button
            @click="closeShareModal"
            class="px-4 py-2 font-medium bg-gray-500/5 border border-gray-500/10 hover:bg-gray-500/10 rounded-lg text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Sessions List Modal -->
    <div v-if="showSessionsModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50" @click="showSessionsModal = false">
      <div class="bg-black border border-gray-500/20 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto" @click.stop>
        <h3 class="text-xl font-bold text-white mb-4">Saved Sessions</h3>

        <div v-if="loadingSessions" class="text-gray-400 text-center py-8">
          Loading sessions...
        </div>

        <div v-else-if="savedSessions.length === 0" class="text-gray-400 text-center py-8">
          No saved sessions yet. Create one to share with your team!
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="session in savedSessions"
            :key="session.id"
            class="bg-gray-500/5 border border-gray-500/10 rounded-lg p-4 hover:bg-gray-500/20 cursor-pointer transition"
            @click="openSession(session.id)"
          >
            <div class="flex items-start justify-between">
              <div class="flex-1">
                <div class="text-white font-semibold">{{ session.name || 'Unnamed Session' }}</div>
                <div class="text-sm text-gray-400 mt-1">
                  {{ new Date(session.createdAt).toLocaleString() }} • {{ session.eventCount }} events
                </div>
              </div>
              <button
                @click.stop="copyLink(session.id)"
                class="px-3 py-1 bg-blue-300 hover:bg-blue-400 rounded-lg font-medium text-sm text-black transition"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>

        <div class="mt-6">
          <button
            @click="showSessionsModal = false"
            class="w-full px-4 py-2 bg-gray-500/5 border border-gray-500/10 hover:bg-gray-500/10 rounded-lg text-white transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const props = defineProps<{
  selectedEventId?: string;
}>();

defineEmits(['export-curl']);

const exporting = ref(false);
const showShareModal = ref(false);
const showSessionsModal = ref(false);
const creating = ref(false);
const sessionName = ref('');
const shareTimeRange = ref(60 * 60 * 1000); // 1 hour
const shareOnlyErrors = ref(false);
const sessionUrl = ref('');
const sessionEvents = ref(0);
const copied = ref(false);
const savedSessions = ref<any[]>([]);
const loadingSessions = ref(false);

const fullSessionUrl = computed(() => {
  if (!sessionUrl.value) return '';
  return `${window.location.origin}${sessionUrl.value}`;
});

async function exportMock() {
  try {
    exporting.value = true;
    const apiBase = 'http://localhost:4317';
    const since = Date.now() - shareTimeRange.value;

    // Open in new tab to trigger download
    window.open(`${apiBase}/mock/generate?since=${since}&format=js`, '_blank');

    setTimeout(() => {
      exporting.value = false;
    }, 1000);
  } catch (err) {
    console.error('Failed to export mock:', err);
    exporting.value = false;
  }
}

async function createSession() {
  try {
    creating.value = true;
    const apiBase = 'http://localhost:4317';

    const body: any = {
      name: sessionName.value || `Session ${new Date().toLocaleString()}`,
      since: Date.now() - shareTimeRange.value,
    };

    if (shareOnlyErrors) {
      body.filter = { status: [400, 401, 403, 404, 500, 502, 503] };
    }

    const response = await fetch(`${apiBase}/sessions/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    sessionUrl.value = data.url;

    // Get session details to show event count
    const sessionResponse = await fetch(`${apiBase}${data.url}`);
    const sessionData = await sessionResponse.json();
    sessionEvents.value = sessionData.events.length;
  } catch (err) {
    console.error('Failed to create session:', err);
  } finally {
    creating.value = false;
  }
}

function closeShareModal() {
  showShareModal.value = false;
  sessionUrl.value = '';
  sessionName.value = '';
  shareOnlyErrors.value = false;
  copied.value = false;
}

function copySessionUrl() {
  navigator.clipboard.writeText(fullSessionUrl.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 2000);
}

function copyLink(sessionId: string) {
  const url = `${window.location.origin}/sessions/${sessionId}`;
  navigator.clipboard.writeText(url);
}

function openSession(sessionId: string) {
  window.open(`/sessions/${sessionId}`, '_blank');
}

async function loadSessions() {
  try {
    loadingSessions.value = true;
    const apiBase = 'http://localhost:4317';
    const response = await fetch(`${apiBase}/sessions`);
    savedSessions.value = await response.json();
  } catch (err) {
    console.error('Failed to load sessions:', err);
  } finally {
    loadingSessions.value = false;
  }
}

onMounted(() => {
  // Load sessions when component mounts
  loadSessions();
});
</script>

