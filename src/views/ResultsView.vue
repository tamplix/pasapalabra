<script setup lang="ts">
import { computed } from 'vue'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import { game, playersById, screen } from '../app/store'
import { scoreOf, winnerOf } from '../core/engine'

const state = computed(() => game.value!)
const winner = computed(() => winnerOf(state.value))
const ranked = computed(() =>
  [...state.value.players].sort((a, b) => scoreOf(b).correct - scoreOf(a).correct || scoreOf(a).wrong - scoreOf(b).wrong),
)
const mark = { correct: '✓', wrong: '✗', pending: '–' } as const
</script>

<template>
  <div class="wrap">
    <h1 v-if="winner">Gana {{ winner.name }}</h1>
    <h1 v-else>Empate</h1>

    <ol class="podium">
      <li v-for="p in ranked" :key="p.id" :class="{ win: p.id === winner?.id }">
        <PlayerAvatar :name="p.name" :image="playersById.get(p.id)?.avatar" :color="playersById.get(p.id)?.color" :seed="p.id" :size="56" />
        <div>
          <strong>{{ p.name }}</strong>
          <span>{{ scoreOf(p).correct }} aciertos, {{ scoreOf(p).wrong }} fallos, {{ scoreOf(p).pending }} sin responder</span>
        </div>
      </li>
    </ol>

    <section v-for="p in state.players" :key="p.id" class="review">
      <h2>Rosco de {{ p.name }}</h2>
      <table>
        <thead><tr><th></th><th>Letra</th><th>Solución</th><th>Definición</th><th>Respuesta</th></tr></thead>
        <tbody>
          <tr v-for="e in p.rosco" :key="e.letter" :class="e.status">
            <td class="mark" :aria-label="e.status">{{ mark[e.status] }}</td>
            <td class="letter">{{ e.letter }}</td>
            <td class="word">{{ e.word }}</td>
            <td class="def">{{ e.definition }}</td>
            <td class="answer" :data-label="e.given ? 'Respuesta' : undefined">{{ e.given ?? '' }}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <div class="actions">
      <button class="primary" @click="screen = 'setup'">Nueva partida</button>
      <button @click="screen = 'stats'">Ver estadísticas</button>
    </div>
  </div>
</template>

<style scoped>
.wrap { max-width: 1040px; margin: 0 auto; display: grid; gap: 24px; }
h1 { font-size: clamp(2.4rem, 7vw, 4.4rem); margin: 0; font-weight: 800; font-stretch: 75%; color: var(--gold); }
h2 { font-size: 1.1rem; margin: 0 0 8px; }
.podium { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; }
.podium li { display: flex; gap: 14px; align-items: center; padding: 12px 16px; border-radius: 16px; background: color-mix(in srgb, var(--stage-2) 70%, transparent); border: 1.5px solid transparent; }
.podium li.win { border-color: var(--gold); }
.podium div { display: grid; }
.podium span { color: var(--muted); }
table { width: 100%; border-collapse: collapse; font-size: 0.95rem; }
th { text-align: left; font-weight: 600; color: var(--muted); }
th, td { padding: 6px 10px; border-bottom: 1px solid color-mix(in srgb, var(--chalk) 12%, transparent); }
.mark { width: 2rem; font-weight: 800; }
.letter { font-weight: 800; }
.word { font-weight: 600; white-space: nowrap; }
.def { color: var(--muted); line-height: 1.35; min-width: 16rem; }
.pending .def { opacity: 0.85; }
.correct .mark { color: var(--ok); }
.wrong .mark { color: var(--bad); }
.pending { color: var(--muted); }
.actions { display: flex; gap: 12px; flex-wrap: wrap; }

/* En pantallas estrechas cada casilla ocupa varias líneas: marca y letra a la izquierda, y debajo de la palabra su definición y la respuesta. */
@media (max-width: 700px) {
  table, tbody { display: block; }
  thead { display: none; }
  tr {
    display: grid;
    grid-template-columns: 1.6rem 2rem minmax(0, 1fr);
    column-gap: 8px;
    padding: 8px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--chalk) 12%, transparent);
  }
  td { border: 0; padding: 1px 0; }
  .def, .answer { grid-column: 3; min-width: 0; }
  .word { white-space: normal; }
  .answer:not([data-label]) { display: none; }
  .answer[data-label]::before { content: attr(data-label) ': '; color: var(--muted); }
}
</style>
