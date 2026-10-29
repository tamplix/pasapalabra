<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { readableTextColor } from '../app/color'
import Icon from '../components/Icon.vue'
import VolumeControl from '../components/VolumeControl.vue'
import type { Command, PresenterView } from '../remote/protocol'
import { connectToHost, type ClientStatus, type PresenterClient } from '../remote/transport'

/** Mando del presentador, pensado para el móvil: lee la definición, ve la solución y valida con botones grandes. */
const props = defineProps<{ code: string }>()

const status = ref<ClientStatus>('connecting')
const view = ref<PresenterView | null>(null)
const receivedAt = ref(Date.now())
const now = ref(Date.now())
const locked = ref(false)
let client: PresenterClient | null = null
let clockTimer: ReturnType<typeof setInterval> | undefined
let wakeLock: { release(): Promise<void> } | null = null

/** Mientras se toca el control se enseña el valor propio: el estado que llega de la pantalla no debe hacer saltar el deslizador. */
const touched = ref({ at: 0, volume: 0, muted: false })
const audio = computed(() => {
  const a = view.value?.audio
  if (!a?.enabled) return null
  return now.value - touched.value.at < 1500 ? { ...a, volume: touched.value.volume, muted: touched.value.muted } : a
})
function setAudio(change: { volume?: number; muted?: boolean }) {
  const a = audio.value
  if (!a) return
  touched.value = { at: Date.now(), volume: change.volume ?? a.volume, muted: change.volume !== undefined ? false : (change.muted ?? a.muted) }
  now.value = Date.now()
  client?.send({ t: 'audio', ...change, ...(change.volume !== undefined ? { muted: false } : {}) })
}

const running = computed(() => view.value?.phase === 'playing')

interface BarButton {
  id: string
  label: string
  icon: 'check' | 'x' | 'skip' | 'pause' | 'play' | 'undo'
  cmd: Command
  tone: 'yes' | 'no' | 'neutral' | 'primary' | 'small'
}

/** Botones de la barra lateral según la fase de la partida. Deshacer va el último y más pequeño. */
const bar = computed<BarButton[]>(() => {
  const v = view.value
  if (!v) return []
  const undo: BarButton[] = v.canUndo ? [{ id: 'undo', label: 'Deshacer', icon: 'undo', cmd: 'undo', tone: 'small' }] : []
  if (v.phase === 'waiting') return [{ id: 'begin', label: 'Empezar turno', icon: 'play', cmd: 'begin', tone: 'primary' }, ...undo]
  if (v.phase === 'paused') return [{ id: 'resume', label: 'Reanudar', icon: 'play', cmd: 'resume', tone: 'primary' }]
  if (v.phase === 'playing') {
    return [
      { id: 'yes', label: 'Correcto', icon: 'check', cmd: 'judge-yes', tone: 'yes' },
      { id: 'no', label: 'Incorrecto', icon: 'x', cmd: 'judge-no', tone: 'no' },
      { id: 'pass', label: 'Pasapalabra', icon: 'skip', cmd: 'pass', tone: 'neutral' },
      { id: 'pause', label: 'Pausa', icon: 'pause', cmd: 'pause', tone: 'neutral' },
      ...undo,
    ]
  }
  return []
})
const remaining = computed(() => {
  if (!view.value) return 0
  const spent = running.value ? now.value - receivedAt.value : 0
  return Math.max(0, view.value.remainingMs - spent)
})
const active = computed(() => view.value?.players.find((p) => p.active))
const statusText = computed(
  () => ({ connecting: 'Conectando…', open: 'Conectado', reconnecting: 'Reconectando…' })[status.value],
)

function fmt(ms: number) {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function send(cmd: Command) {
  client?.send({ t: 'cmd', id: crypto.randomUUID(), cmd })
  navigator.vibrate?.(25)
  // Evita pulsaciones dobles que puntuarían dos letras seguidas.
  if (cmd !== 'undo' && cmd !== 'pause' && cmd !== 'resume') {
    locked.value = true
    setTimeout(() => (locked.value = false), 700)
  }
}

function surrender() {
  if (confirm(`¿Seguro que ${active.value?.name ?? 'el jugador'} se rinde? Las letras pendientes quedarán sin responder.`)) send('surrender')
}

/** Mantiene la pantalla del móvil encendida mientras se presenta; si no se puede, no pasa nada. */
async function keepAwake() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }
    wakeLock = (await nav.wakeLock?.request('screen')) ?? null
  } catch {
    wakeLock = null
  }
}

function onVisible() {
  if (document.visibilityState !== 'visible') return
  void keepAwake()
  // Al volver a encender la pantalla se rehace la conexión por si el sistema la cortó.
  client?.reconnect()
}

onMounted(() => {
  client = connectToHost(props.code, {
    onStatus: (s) => (status.value = s),
    onMessage: (m) => {
      if (m.t !== 'state') return
      view.value = m.view
      receivedAt.value = Date.now()
    },
  })
  clockTimer = setInterval(() => (now.value = Date.now()), 250)
  document.addEventListener('visibilitychange', onVisible)
  void keepAwake()
})

onBeforeUnmount(() => {
  client?.close()
  clearInterval(clockTimer)
  document.removeEventListener('visibilitychange', onVisible)
  void wakeLock?.release()
})
</script>

<template>
  <main class="remote">
    <header>
      <p class="conn" :class="status"><span class="dot" aria-hidden="true" />{{ statusText }}</p>
      <p class="room">Sala {{ code }}</p>
    </header>

    <section v-if="!view || view.phase === 'idle'" class="center">
      <h1>Presentador</h1>
      <p>{{ status === 'open' ? 'Conectado. Esperando a que empiece la partida en la pantalla.' : 'Buscando la pantalla del juego…' }}</p>
    </section>

    <template v-else>
      <VolumeControl v-if="audio" class="vol" :volume="audio.volume" :muted="audio.muted" @volume="(v) => setAudio({ volume: v })" @mute="(m) => setAudio({ muted: m })" />

      <section v-if="view.phase !== 'finished'" class="turn">
        <div class="who" v-if="active">
          <span class="avatar" :style="{ background: active.color, color: readableTextColor(active.color) }" aria-hidden="true">
            {{ active.name.slice(0, 2).toUpperCase() }}
          </span>
          <strong>{{ active.name }}</strong>
        </div>
        <p class="clock" :class="{ low: remaining < 15000 }" aria-label="Tiempo restante">{{ fmt(remaining) }}</p>
      </section>

      <section v-if="view.phase === 'waiting'" class="center">
        <p>Turno de <strong>{{ active?.name }}</strong>. Cuando estéis listos, pulsa <Icon name="play" class="inline" /> para empezar el turno.</p>
      </section>

      <section v-else-if="view.phase === 'paused'" class="center">
        <p><strong>Partida en pausa.</strong> El reloj está parado. Pulsa <Icon name="play" class="inline" /> para reanudar.</p>
      </section>

      <section v-if="(view.phase === 'playing' || view.phase === 'paused') && view.entry" class="clue">
        <p class="prompt"><span class="letter">{{ view.entry.letter }}</span>{{ view.entry.prompt }}</p>
        <p class="definition">{{ view.entry.definition }}</p>
        <p class="solution">Solución: <strong>{{ view.entry.word }}</strong></p>
      </section>

      <p v-if="view.verdict" class="verdict" :class="view.verdict.correct ? 'ok' : 'bad'" role="status">
        {{ view.verdict.correct ? 'Correcto' : 'Era' }}: {{ view.verdict.word }}
      </p>

      <section v-if="view.phase === 'finished'" class="center">
        <h1>Partida terminada</h1>
        <p>Puedes empezar otra desde la pantalla.</p>
      </section>

      <section class="board" aria-label="Marcador">
        <div v-for="p in view.players" :key="p.id" class="row" :class="{ on: p.active }">
          <span class="avatar small" :style="{ background: p.color, color: readableTextColor(p.color) }" aria-hidden="true">
            {{ p.name.slice(0, 2).toUpperCase() }}
          </span>
          <strong>{{ p.name }}</strong>
          <span class="score"><span class="ok">{{ p.correct }}</span> / <span class="bad">{{ p.wrong }}</span></span>
          <time>{{ p.finished ? 'fin' : fmt(p.remainingMs) }}</time>
        </div>
      </section>

      <footer v-if="view.phase !== 'finished'">
        <button type="button" class="link" :disabled="view.phase === 'paused'" @click="surrender">Rendirse</button>
      </footer>

      <!-- Barra fija de solo iconos: no se desplaza con el contenido y queda al alcance del pulgar. -->
      <nav v-if="bar.length" class="bar" aria-label="Acciones del presentador">
        <button
          v-for="b in bar"
          :key="b.id"
          type="button"
          class="icon-btn"
          :class="b.tone"
          :disabled="locked && b.tone !== 'small' && b.id !== 'resume' && b.id !== 'pause'"
          :aria-label="b.label"
          :title="b.label"
          @click="send(b.cmd)"
        >
          <Icon :name="b.icon" />
        </button>
      </nav>
    </template>
  </main>
</template>

<style scoped>
.remote {
  /* 4 botones grandes + Deshacer (más pequeño) repartidos por el alto disponible. */
  --btn-h: min(112px, calc((100dvh - 28px - 32px) / 4.6));
  --btn-w: calc(var(--btn-h) * 1.4);
  min-height: 100dvh;
  max-width: 560px;
  margin: 0 auto;
  padding: 14px 16px 28px;
  display: grid;
  align-content: start;
  gap: 16px;
}
header { display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; color: var(--muted); }
header p { margin: 0; }
.conn { display: inline-flex; align-items: center; gap: 8px; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--gold); }
.open .dot { background: var(--ok); }
.reconnecting .dot { background: var(--bad); }
.center { display: grid; gap: 14px; text-align: center; justify-items: center; padding-top: 8px; }
.center h1 { margin: 0; font-size: 1.8rem; }
.center p { margin: 0; line-height: 1.5; }
.inline { width: 1.1em; height: 1.1em; vertical-align: -0.2em; }
.turn { display: flex; justify-content: space-between; align-items: center; }
.who { display: flex; align-items: center; gap: 10px; font-size: 1.2rem; }
.avatar { display: inline-grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; font-weight: 700; box-shadow: 0 0 0 2px var(--gold); flex: none; }
.avatar.small { width: 28px; height: 28px; font-size: 0.75rem; box-shadow: none; }
.clock { margin: 0; font-size: 2.8rem; font-weight: 800; font-variant-numeric: tabular-nums; line-height: 1; }
.clock.low { color: var(--bad); }
.clue {
  display: grid;
  gap: 10px;
  padding: 18px;
  border-radius: 18px;
  background: color-mix(in srgb, var(--stage-2) 75%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--chalk) 14%, transparent);
}
.prompt { margin: 0; display: flex; align-items: center; gap: 12px; color: var(--gold); font-weight: 600; }
.letter { font-size: 3rem; font-weight: 800; line-height: 1; color: var(--chalk); }
.definition { margin: 0; font-size: 1.35rem; line-height: 1.4; }
.solution { margin: 0; padding-top: 10px; border-top: 1px dashed color-mix(in srgb, var(--chalk) 25%, transparent); color: var(--muted); }
.solution strong { color: var(--gold); font-size: 1.5rem; }
.verdict { margin: 0; text-align: center; font-weight: 700; font-size: 1.15rem; }
.ok { color: var(--ok); }
.bad { color: var(--bad); }
.board { display: grid; gap: 6px; }
.row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px; background: color-mix(in srgb, var(--stage) 70%, transparent); }
.row.on { outline: 2px solid var(--gold); }
.row strong { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.score { font-weight: 700; font-variant-numeric: tabular-nums; }
time { font-variant-numeric: tabular-nums; min-width: 3.2rem; text-align: right; }
footer { display: flex; justify-content: center; gap: 24px; }

/* Barra de acciones: fija, de solo iconos. En horizontal va a la derecha (pulgar derecho); en vertical, abajo. */
.bar {
  position: fixed;
  z-index: 5;
  display: flex;
  gap: 10px;
  align-items: center;
  justify-content: center;
  background: color-mix(in srgb, var(--stage) 88%, transparent);
  backdrop-filter: blur(8px);
  border: 0 solid color-mix(in srgb, var(--chalk) 16%, transparent);
}
.icon-btn {
  width: var(--btn-w);
  height: var(--btn-h);
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 18px;
  border-width: 2px;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.icon-btn svg { height: 56%; width: auto; aspect-ratio: 1; }
.icon-btn.yes { background: var(--ok); border-color: var(--ok); color: #04210f; }
.icon-btn.no { background: var(--bad); border-color: var(--bad); color: #fff; }
.icon-btn.primary { background: var(--gold); border-color: var(--gold); color: var(--stage); }
.icon-btn.small { width: calc(var(--btn-w) * 0.62); height: calc(var(--btn-h) * 0.55); border-radius: 14px; opacity: 0.9; }

@media (orientation: landscape) {
  .remote { padding-right: calc(var(--btn-w) + 36px + env(safe-area-inset-right)); padding-left: max(16px, env(safe-area-inset-left)); max-width: none; }
  .bar {
    top: 0;
    right: 0;
    bottom: 0;
    width: calc(var(--btn-w) + 24px + env(safe-area-inset-right));
    padding: 14px 12px;
    padding-right: calc(12px + env(safe-area-inset-right));
    flex-direction: column;
    border-left-width: 1.5px;
  }
}
@media (orientation: portrait) {
  .remote {
    --btn-w: min(112px, calc((100vw - 24px - 3 * 10px - 8px) / 4.6));
    --btn-h: calc(var(--btn-w) * 0.95);
    padding-bottom: calc(var(--btn-h) + 48px + env(safe-area-inset-bottom));
  }
  .bar {
    left: 0;
    right: 0;
    bottom: 0;
    padding: 10px 12px calc(10px + env(safe-area-inset-bottom));
    flex-direction: row;
    border-top-width: 1.5px;
  }
}
/* Móvil en horizontal: poca altura útil, así que se compacta el contenido para leer sin desplazarse. */
@media (orientation: landscape) and (max-height: 560px) {
  .remote { padding-top: 8px; padding-bottom: 14px; gap: 10px; }
  .clue { padding: 12px 14px; gap: 6px; }
  .letter { font-size: 2.2rem; }
  .definition { font-size: 1.2rem; line-height: 1.35; }
  .solution strong { font-size: 1.3rem; }
  .clock { font-size: 2rem; }
  .who { font-size: 1.05rem; }
  .avatar { width: 32px; height: 32px; font-size: 0.8rem; }
  .row { padding: 5px 10px; }
}
</style>
