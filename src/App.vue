<script setup lang="ts">
import { computed, onMounted, watch, watchEffect } from 'vue'
import NebulaBackground from './components/NebulaBackground.vue'
import PresenterRemoteView from './views/PresenterRemoteView.vue'
import { initPresenter } from './app/presenter'
import VerdictFlash from './components/VerdictFlash.vue'
import GameView from './views/GameView.vue'
import PlayersView from './views/PlayersView.vue'
import ResultsView from './views/ResultsView.vue'
import SetupView from './views/SetupView.vue'
import StatsView from './views/StatsView.vue'
import VolumeControl from './components/VolumeControl.vue'
import { playSfx, setMusicMode, setTension } from './app/music'
import { settings } from './app/settings'
import { game, init, lastResult, remainingMs, screen, storageWarning, type Screen } from './app/store'

/** El móvil del presentador abre `#/presentador/CODIGO`: solo muestra el mando, sin el resto de la aplicación. */
const remote = /^#\/presentador\/([A-Za-z0-9]{4,12})$/.exec(location.hash)
const remoteCode = remote ? remote[1]!.toUpperCase() : null

onMounted(() => {
  if (remoteCode) return
  void init()
  initPresenter()
})

/** El reloj del turno corre: ni en la preparación del turno ni en pausa. */
const clockRunning = computed(() => game.value?.status === 'playing' && game.value.turnStartedAt !== null && !game.value.paused)

// La música ambiental suena en toda la aplicación y deja paso a la de tensión mientras corre el reloj del turno.
watchEffect(() => {
  if (remoteCode) return
  setMusicMode(!settings.music ? 'off' : clockRunning.value ? 'tension' : 'ambient')
  const g = game.value
  if (g && clockRunning.value) {
    // Empieza tranquila y se acelera de forma pronunciada al final, cuando quedan pocos segundos.
    const left = Math.min(1, remainingMs(g.activeIndex) / (settings.durationSec * 1000))
    setTension(0.15 + 0.85 * (1 - left) ** 1.6)
  } else setTension(0)
})
// Aplauso al acertar y «ooohh» al fallar, a la vez que la animación de la palabra. Al deshacer no suena nada.
watch(lastResult, (result) => {
  if (!remoteCode && result) playSfx(result.correct ? 'applause' : 'groan')
})
function setVolume(volume: number) {
  settings.musicVolume = volume
  settings.musicMuted = false
}
function setMuted(muted: boolean) {
  settings.musicMuted = muted
}

const tabs: { id: Screen; label: string }[] = [
  { id: 'setup', label: 'Jugar' },
  { id: 'players', label: 'Jugadores' },
  { id: 'stats', label: 'Estadísticas' },
]
</script>

<template>
  <PresenterRemoteView v-if="remoteCode" :code="remoteCode" />
  <template v-else>
  <NebulaBackground />
  <VerdictFlash />
  <GameView v-if="screen === 'game'" />
  <template v-else>
    <header class="top">
      <span class="brand">Pasapalabra</span>
      <VolumeControl v-if="settings.music || settings.effects" class="vol" :volume="settings.musicVolume" :muted="settings.musicMuted" @volume="setVolume" @mute="setMuted" />
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
</template>

<style scoped>
.top { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; padding: 18px clamp(16px, 4vw, 40px); }
.brand { font-weight: 800; font-size: 1.4rem; font-stretch: 75%; color: var(--gold); }
.vol { width: 230px; margin-left: auto; }
nav { display: flex; gap: 6px; }
nav button { background: none; border-color: transparent; }
nav button[aria-current='page'] { border-color: var(--gold); color: var(--gold); }
main { padding: 12px clamp(16px, 4vw, 40px) 60px; }
.warn { max-width: 760px; margin: 0 auto 18px; padding: 10px 14px; border-radius: 10px; background: color-mix(in srgb, var(--bad) 20%, transparent); }
</style>
