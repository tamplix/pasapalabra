<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import RoscoRing from '../components/RoscoRing.vue'
import RingMedia from '../components/RingMedia.vue'
import { answerMode, dispatch, game, lastResult, now, playersById, remainingMs } from '../app/store'
import { settings } from '../app/settings'
import { presenterHidesDefinition } from '../app/presenter'
import PresenterLink from '../components/PresenterLink.vue'
import { scoreOf } from '../core/engine'

const state = computed(() => game.value!)
const active = computed(() => state.value.players[state.value.activeIndex]!)
const entry = computed(() => active.value.rosco[active.value.cursor])
const profile = computed(() => playersById.value.get(active.value.id))
const others = computed(() =>
  state.value.players.map((p, i) => ({ p, i })).filter(({ i }) => i !== state.value.activeIndex),
)

/** Pausa de preparación: con la partida en curso y el reloj del turno aún parado. */
const waiting = computed(() => state.value.status === 'playing' && state.value.turnStartedAt === null)

const text = ref('')
const input = ref<HTMLInputElement | null>(null)
const cameraError = ref('')
const showSolution = ref(false)

const verdict = computed(() => {
  const r = lastResult.value
  return r && now.value - r.at < 2800 ? r : null
})

function fmt(ms: number) {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function submit() {
  const value = text.value.trim()
  if (!value) return
  text.value = ''
  if (/^pasapalabra$/i.test(value)) return dispatch({ type: 'pass', at: Date.now() })
  dispatch({ type: 'answer', at: Date.now(), text: value })
}
function pass() {
  text.value = ''
  dispatch({ type: 'pass', at: Date.now() })
}
function judge(correct: boolean) {
  showSolution.value = false
  dispatch({ type: 'judge', at: Date.now(), correct })
}
/**
 * Atajos de teclado.
 * En la pausa de preparación: Intro o Espacio empiezan el turno y Retroceso deshace.
 * En el modo manual, durante el turno: Mayús izquierda = incorrecto, Mayús derecha = correcto,
 * Espacio = pasapalabra, Retroceso = deshacer e Intro (mantenida) = ver la solución.
 */
function onKeyDown(e: KeyboardEvent) {
  if (game.value?.status !== 'playing') return
  if (waiting.value) {
    if (e.code === 'Backspace' && !e.repeat) undo()
    else if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
      e.preventDefault()
      suppressEnter = e.code === 'Enter'
      begin()
    }
    return
  }
  if (answerMode.value !== 'manual') return
  if (e.code === 'Enter') {
    e.preventDefault()
    if (!suppressEnter) showSolution.value = true
    return
  }
  if (e.repeat) return
  if (e.code === 'Backspace') undo()
  else if (e.code === 'ShiftLeft') judge(false)
  else if (e.code === 'ShiftRight') judge(true)
  else if (e.code === 'Space') {
    e.preventDefault()
    pass()
  }
}
function onKeyUp(e: KeyboardEvent) {
  if (e.code === 'Enter') {
    suppressEnter = false
    showSolution.value = false
  }
  // Evita que Espacio active el botón que tenga el foco al soltarlo (en el campo de texto sí escribe).
  if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) e.preventDefault()
}
onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
})

/** Si el turno se empezó con Intro, se ignora esa misma pulsación (y sus repeticiones) para no revelar la solución. */
let suppressEnter = false

function begin() {
  dispatch({ type: 'begin', at: Date.now() })
}
function undo() {
  showSolution.value = false
  dispatch({ type: 'undo', at: Date.now() })
}
function surrender() {
  if (confirm(`¿Seguro que ${active.value.name} se rinde? Las letras pendientes quedarán sin responder.`)) {
    dispatch({ type: 'surrender', at: Date.now() })
  }
}

watch([() => state.value.activeIndex, () => active.value.cursor, waiting], () => {
  showSolution.value = false
  nextTick(() => input.value?.focus())
}, {
  immediate: true,
  flush: 'post',
})
</script>

<template>
  <div class="game" :class="{ solo: !others.length }">
    <div v-if="waiting" class="clue ready" aria-live="polite">
      <div class="text">
        <h2>Turno de {{ active.name }}</h2>
        <p>Cuando estéis listos, pulsad Empezar. El reloj arranca en ese momento.</p>
      </div>
    </div>
    <div v-else-if="entry" class="clue" aria-live="polite">
      <div class="letter">
        <h2>{{ entry.prompt }}</h2>
        <div class="big" aria-hidden="true">{{ entry.letter }}</div>
      </div>
      <p v-if="presenterHidesDefinition" class="definition muted">La definición la lee el presentador desde su móvil.</p>
      <p v-else class="definition">{{ entry.definition }}</p>
    </div>
    <aside v-if="others.length" class="players" aria-label="Otros jugadores">
      <article v-for="{ p, i } in others" :key="p.id" class="pcard" :class="{ done: p.finished }">
        <header>
          <PlayerAvatar :name="p.name" :image="playersById.get(p.id)?.avatar" :color="playersById.get(p.id)?.color" :seed="p.id" :size="32" />
          <strong>{{ p.name }}</strong>
          <time :class="{ low: remainingMs(i) < 15000 && !p.finished }">{{ fmt(remainingMs(i)) }}</time>
        </header>
        <RoscoRing :entries="p.rosco" :active="-1" compact />
        <footer>
          <span class="ok">{{ scoreOf(p).correct }}</span>
          <span v-if="p.finished" class="muted">terminado</span>
          <span class="bad">{{ scoreOf(p).wrong }}</span>
        </footer>
      </article>
    </aside>

    <section class="board">
      <RoscoRing :entries="active.rosco" :active="active.cursor">
        <template #media>
          <RingMedia
            :image="profile?.avatar"
            :color="profile?.color"
            :name="active.name"
            :seed="active.id"
            :camera="settings.camera"
            @camera-error="cameraError = $event"
          />
        </template>
      </RoscoRing>
    </section>

    <section class="panel">
      <div class="turn">
        <PlayerAvatar :name="active.name" :image="profile?.avatar" :color="profile?.color" :seed="active.id" :size="36" />
        <strong>{{ active.name }}</strong>
      </div>
      <div class="clock" :class="{ low: remainingMs(state.activeIndex) < 15000 }">
        {{ fmt(remainingMs(state.activeIndex)) }}
      </div>
      <div v-if="waiting" class="ready-box">
        <button class="primary start" type="button" @click="begin">
          Empezar <kbd>Intro o Espacio</kbd>
        </button>
      </div>
      <form v-else-if="answerMode === 'typed'" @submit.prevent="submit">
        <label class="sr-only" for="answer">Tu respuesta</label>
        <input
          id="answer"
          ref="input"
          v-model="text"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="Escribe la palabra"
        />
        <div class="actions">
          <button class="primary" type="submit">Responder</button>
          <button type="button" @click="pass">Pasapalabra</button>
        </div>
      </form>
      <div v-else class="judge">
        <div v-if="!presenterHidesDefinition" class="solution" :class="{ shown: showSolution }">
          <button
            type="button"
            :aria-pressed="showSolution"
            @pointerdown="showSolution = true"
            @pointerup="showSolution = false"
            @pointerleave="showSolution = false"
          >
            Mantén pulsado para ver la solución <kbd>Intro</kbd>
          </button>
          <p class="word" :class="{ concealed: !showSolution }">{{ entry?.word }}</p>
        </div>
        <div class="actions">
          <button class="no" type="button" @click="judge(false)">Incorrecto <kbd>Mayús izq.</kbd></button>
          <button class="yes" type="button" @click="judge(true)">Correcto <kbd>Mayús der.</kbd></button>
        </div>
        <button type="button" @click="pass">Pasapalabra <kbd>Espacio</kbd></button>
      </div>
      <p v-if="verdict" class="verdict" :class="verdict.correct ? 'ok' : 'bad'" role="status">
        <template v-if="verdict.correct">Correcto: {{ verdict.word }}</template>
        <template v-else>Era «{{ verdict.word }}»</template>
      </p>
      <p v-if="cameraError" class="cam-error">{{ cameraError }}</p>
      <PresenterLink v-if="settings.presenter" compact />
      <div class="foot">
        <button class="link" type="button" :disabled="!state.history.length" @click="undo">
          Deshacer<template v-if="answerMode === 'manual'"> (Retroceso)</template>
        </button>
        <button class="link" type="button" @click="surrender">Rendirse</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.game {
  display: grid;
  grid-template-columns: minmax(130px, 170px) minmax(0, 1fr) minmax(250px, 300px);
  gap: clamp(12px, 2vw, 28px);
  grid-template-rows: auto 1fr;
  align-items: center;
  min-height: 100dvh;
  padding: clamp(12px, 2vw, 24px);
}
.game.solo { grid-template-columns: minmax(0, 1fr) minmax(250px, 300px); }
.players { display: grid; gap: 10px; align-self: center; }
.pcard {
  padding: 8px 10px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--stage) 72%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--chalk) 14%, transparent);
  display: grid;
  gap: 6px;
}
.pcard.done { opacity: 0.6; }
.pcard header { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; }
.pcard strong { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pcard time { font-variant-numeric: tabular-nums; font-weight: 700; }
.pcard footer { display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; }
.muted { color: var(--muted); font-weight: 400; }
.low { color: var(--bad); }
.ok { color: var(--ok); }
.bad { color: var(--bad); }

.board {
  width: min(100%, calc(100dvh - 12rem));
  margin-inline: auto;
  display: grid;
  gap: 14px;
}
.clue {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: clamp(14px, 2.4vw, 28px);
  /* Altura fija (tres líneas de definición): el tamaño del aro no depende del texto. */
  height: 7rem;
}
.letter { flex: none; display: grid; justify-items: start; gap: 2px; }
.letter h2 { margin: 0; font-size: 1rem; font-weight: 600; color: var(--gold); }
.big {
  font-size: clamp(3.6rem, 6vw, 4.8rem);
  line-height: 0.85;
  font-weight: 800;
  font-stretch: 75%;
  color: var(--chalk);
}
.definition {
  flex: 1;
  min-width: 0;
  max-height: 100%;
  overflow-y: auto;
  margin: 0;
  font-size: clamp(1.05rem, 1.8vw, 1.35rem);
  line-height: 1.35;
  text-wrap: pretty;
}
.clue.ready h2 { margin: 0 0 4px; font-size: 1.5rem; color: var(--chalk); }
.clue.ready p { margin: 0; font-size: 1.25rem; }


.panel {
  align-self: start;
  display: grid;
  gap: 12px;
  padding: 18px;
  border-radius: 22px;
  background: color-mix(in srgb, var(--stage) 78%, transparent);
  border: 1.5px solid color-mix(in srgb, var(--chalk) 14%, transparent);
  backdrop-filter: blur(6px);
}
.turn { display: flex; align-items: center; justify-content: center; gap: 10px; font-size: 1.1rem; }
.clock {
  font-size: clamp(3rem, 6vw, 4.6rem);
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
  text-align: center;
}
form { display: grid; gap: 12px; }
input {
  width: 100%;
  padding: 14px 16px;
  font: inherit;
  font-size: 1.2rem;
  border-radius: 12px;
  border: 2px solid color-mix(in srgb, var(--chalk) 30%, transparent);
  background: color-mix(in srgb, var(--stage) 60%, #000);
  color: var(--chalk);
}
input:focus-visible { outline: 3px solid var(--gold); outline-offset: 2px; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.verdict { margin: 0; font-weight: 700; font-size: 1.1rem; text-align: center; }
.cam-error { margin: 0; color: var(--bad); font-size: 0.9rem; }

.foot { display: flex; justify-content: center; gap: 22px; }
.link {
  justify-self: center;
  background: none;
  border: none;
  color: var(--muted);
  text-decoration: underline;
  cursor: pointer;
  font: inherit;
}
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }

@media (max-width: 980px) {
  .game, .game.solo { grid-template-columns: 1fr; grid-template-rows: auto; }
  .clue { order: -2; height: auto; min-height: 7rem; }
  .board { order: -1; width: min(100%, 560px); }
  .players { grid-auto-flow: column; grid-auto-columns: minmax(130px, 1fr); overflow-x: auto; order: 2; }
}
.judge { display: grid; gap: 12px; }
.solution { display: grid; gap: 8px; text-align: center; }
.solution button { background: none; border-style: dashed; font-weight: 400; color: var(--muted); user-select: none; touch-action: none; }
.solution .word { min-height: 1.3em; margin: 0; font-size: 1.7rem; font-weight: 800; color: var(--gold); }
.yes { background: var(--ok); border-color: var(--ok); color: #04210f; font-size: 1.1rem; padding: 16px; }
.no { background: var(--bad); border-color: var(--bad); color: #fff; font-size: 1.1rem; padding: 16px; }
.solution .word.concealed { visibility: hidden; }
kbd {
  display: block;
  margin-top: 2px;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 400;
  opacity: 0.75;
}
.solution kbd { display: inline; margin-left: 6px; }
.link:disabled { opacity: 0.4; cursor: default; text-decoration: none; }
.ready-box { display: grid; }
.start { font-size: 1.3rem; padding: 18px 24px; }
.start kbd { display: inline; margin-left: 8px; }
.definition.muted { color: var(--muted); font-style: italic; }
</style>
