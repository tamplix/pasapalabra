<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { readableTextColor } from '../app/color'
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

const running = computed(() => view.value?.phase === 'playing')
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
  if (cmd !== 'undo') {
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
        <p>Turno de <strong>{{ active?.name }}</strong>. Cuando estéis listos, empieza el turno.</p>
        <button class="primary big" type="button" :disabled="locked" @click="send('begin')">Empezar turno</button>
        <button v-if="view.canUndo" type="button" @click="send('undo')">Deshacer</button>
      </section>

      <template v-else-if="view.phase === 'playing' && view.entry">
        <section class="clue">
          <p class="prompt"><span class="letter">{{ view.entry.letter }}</span>{{ view.entry.prompt }}</p>
          <p class="definition">{{ view.entry.definition }}</p>
          <p class="solution">Solución: <strong>{{ view.entry.word }}</strong></p>
        </section>

        <section class="actions" aria-label="Valorar la respuesta">
          <button class="no" type="button" :disabled="locked" @click="send('judge-no')">Incorrecto</button>
          <button class="yes" type="button" :disabled="locked" @click="send('judge-yes')">Correcto</button>
          <button class="pass" type="button" :disabled="locked" @click="send('pass')">Pasapalabra</button>
        </section>
      </template>

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
        <button v-if="view.phase === 'playing' && view.canUndo" type="button" class="link" @click="send('undo')">Deshacer</button>
        <button type="button" class="link" @click="surrender">Rendirse</button>
      </footer>
    </template>
  </main>
</template>

<style scoped>
.remote {
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
.center p { margin: 0; }
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
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.actions button { padding: 22px 12px; font-size: 1.25rem; }
.actions .yes { background: var(--ok); border-color: var(--ok); color: #04210f; }
.actions .no { background: var(--bad); border-color: var(--bad); color: #fff; }
.actions .pass { grid-column: 1 / -1; padding: 16px; font-size: 1.05rem; }
.big { font-size: 1.3rem; padding: 20px 40px; }
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
</style>
