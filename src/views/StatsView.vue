<script setup lang="ts">
import { computed } from 'vue'
import { games, screen } from '../app/store'
import { ALPHABET } from '../core/types'
import { computeStats } from '../storage/stats'

const stats = computed(() => computeStats(games.value).sort((a, b) => b.wins - a.wins || b.avgCorrect - a.avgCorrect))
const pct = (n: number) => `${Math.round(n * 100)} %`

function rate(c: number, w: number) {
  return c + w ? c / (c + w) : null
}
function cellStyle(r: number | null) {
  return r === null ? {} : { '--r': String(r) }
}
</script>

<template>
  <div class="wrap">
    <h1>Estadísticas</h1>

    <section v-if="stats.length === 0" class="empty">
      <p>Aún no hay partidas guardadas. Cuando termine la primera aparecerán aquí.</p>
      <button class="primary" @click="screen = 'setup'">Jugar una partida</button>
    </section>

    <article v-for="s in stats" :key="s.playerId" class="player">
      <h2>{{ s.name }}</h2>
      <dl>
        <div><dt>Partidas</dt><dd>{{ s.games }}</dd></div>
        <div><dt>Victorias</dt><dd>{{ s.wins }}</dd></div>
        <div><dt>Empates</dt><dd>{{ s.draws }}</dd></div>
        <div><dt>Media de aciertos</dt><dd>{{ s.avgCorrect.toFixed(1) }}</dd></div>
        <div><dt>Mejor partida</dt><dd>{{ s.bestCorrect }}</dd></div>
        <div><dt>Precisión</dt><dd>{{ pct(s.accuracy) }}</dd></div>
        <div><dt>Roscos perfectos</dt><dd>{{ s.perfectGames }}</dd></div>
      </dl>
      <h3>Acierto por letra</h3>
      <ul class="letters">
        <li
          v-for="l in ALPHABET"
          :key="l"
          :class="{ empty: rate(s.byLetter[l].correct, s.byLetter[l].wrong) === null }"
          :style="cellStyle(rate(s.byLetter[l].correct, s.byLetter[l].wrong))"
          :title="`${l}: ${s.byLetter[l].correct} aciertos, ${s.byLetter[l].wrong} fallos`"
        >
          <b>{{ l }}</b>
          <span>{{ rate(s.byLetter[l].correct, s.byLetter[l].wrong) === null ? '–' : pct(rate(s.byLetter[l].correct, s.byLetter[l].wrong)!) }}</span>
        </li>
      </ul>
    </article>
  </div>
</template>

<style scoped>
.wrap { max-width: 900px; margin: 0 auto; display: grid; gap: 24px; }
h1 { font-size: clamp(2.2rem, 6vw, 3.6rem); margin: 0; font-weight: 800; font-stretch: 80%; }
h2 { margin: 0; font-size: 1.5rem; }
h3 { margin: 0; font-size: 1rem; color: var(--gold); font-weight: 600; }
.player { display: grid; gap: 14px; padding: 20px; border-radius: 20px; background: color-mix(in srgb, var(--stage-2) 70%, transparent); border: 1.5px solid color-mix(in srgb, var(--chalk) 14%, transparent); }
dl { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 12px; margin: 0; }
dt { color: var(--muted); font-size: 0.85rem; }
dd { margin: 0; font-size: 1.6rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.letters { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(62px, 1fr)); gap: 6px; }
.letters li {
  display: grid;
  place-items: center;
  padding: 6px 2px;
  border-radius: 10px;
  /* Rojo (0) a verde (1) mezclando según el porcentaje de acierto. */
  background: color-mix(in srgb, var(--ok) calc(var(--r) * 100%), var(--bad));
  color: #fff;
}
.letters li.empty { background: color-mix(in srgb, var(--chalk) 10%, transparent); color: var(--muted); }
.letters span { font-size: 0.75rem; }
.empty { display: grid; gap: 12px; justify-items: start; }
</style>
