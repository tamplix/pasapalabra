<script setup lang="ts">
import { onMounted } from 'vue'
import NebulaBackground from './components/NebulaBackground.vue'
import VerdictFlash from './components/VerdictFlash.vue'
import GameView from './views/GameView.vue'
import PlayersView from './views/PlayersView.vue'
import ResultsView from './views/ResultsView.vue'
import SetupView from './views/SetupView.vue'
import StatsView from './views/StatsView.vue'
import { init, screen, storageWarning, type Screen } from './app/store'

onMounted(init)

const tabs: { id: Screen; label: string }[] = [
  { id: 'setup', label: 'Jugar' },
  { id: 'players', label: 'Jugadores' },
  { id: 'stats', label: 'Estadísticas' },
]
</script>

<template>
  <NebulaBackground />
  <VerdictFlash />
  <GameView v-if="screen === 'game'" />
  <template v-else>
    <header class="top">
      <span class="brand">Pasapalabra</span>
      <nav aria-label="Principal">
        <button
          v-for="t in tabs"
          :key="t.id"
          :aria-current="screen === t.id ? 'page' : undefined"
          @click="screen = t.id"
        >
          {{ t.label }}
        </button>
      </nav>
    </header>
    <main>
      <p v-if="storageWarning" class="warn" role="status">
        No se puede guardar en este navegador: jugadores y estadísticas se perderán al cerrar la pestaña.
      </p>
      <SetupView v-if="screen === 'setup'" />
      <PlayersView v-else-if="screen === 'players'" />
      <StatsView v-else-if="screen === 'stats'" />
      <ResultsView v-else-if="screen === 'results'" />
    </main>
  </template>
</template>

<style scoped>
.top { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding: 18px clamp(16px, 4vw, 40px); }
.brand { font-weight: 800; font-size: 1.4rem; font-stretch: 75%; color: var(--gold); }
nav { display: flex; gap: 6px; }
nav button { background: none; border-color: transparent; }
nav button[aria-current='page'] { border-color: var(--gold); color: var(--gold); }
main { padding: 12px clamp(16px, 4vw, 40px) 60px; }
.warn { max-width: 760px; margin: 0 auto 18px; padding: 10px 14px; border-radius: 10px; background: color-mix(in srgb, var(--bad) 20%, transparent); }
</style>
