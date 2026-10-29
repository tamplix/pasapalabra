<script setup lang="ts">
import { computed, ref } from 'vue'
import PlayerAvatar from '../components/PlayerAvatar.vue'
import { players, screen, startGame } from '../app/store'
import { settings } from '../app/settings'
import { playerSummary } from '../app/age'
import PresenterLink from '../components/PresenterLink.vue'

const MAX_PLAYERS = 4
const selected = ref<string[]>([])

function toggle(id: string) {
  selected.value = selected.value.includes(id)
    ? selected.value.filter((x) => x !== id)
    : selected.value.length < MAX_PLAYERS
      ? [...selected.value, id]
      : selected.value
}
const canStart = computed(() => selected.value.length >= 1)
</script>

<template>
  <div class="setup">
    <h1>Nueva partida</h1>

    <section v-if="players.length === 0" class="empty">
      <p>Todavía no hay jugadores. Crea al menos uno para empezar.</p>
      <button class="primary" @click="screen = 'players'">Crear jugadores</button>
    </section>

    <template v-else>
      <section>
        <h2>Jugadores (hasta {{ MAX_PLAYERS }}; el orden de selección es el orden de turno)</h2>
        <ul class="list">
          <li v-for="p in players" :key="p.id">
            <button class="choice" :class="{ on: selected.includes(p.id) }" :aria-pressed="selected.includes(p.id)" @click="toggle(p.id)">
              <PlayerAvatar :name="p.name" :image="p.avatar" :color="p.color" :seed="p.id" :size="44" />
              <span class="label">
                <strong>{{ p.name }}</strong>
                <small>{{ playerSummary(p) }}</small>
              </span>
              <b v-if="selected.includes(p.id)" class="order">{{ selected.indexOf(p.id) + 1 }}</b>
            </button>
          </li>
        </ul>
      </section>

      <fieldset class="mode">
        <legend>Cómo se responde</legend>
        <label class="radio">
          <input v-model="settings.answerMode" type="radio" value="manual" />
          <span><strong>Manual</strong><small>Se responde en voz alta y alguien valida con los botones o con el teclado (Mayús izquierda: incorrecto, Mayús derecha: correcto, Espacio: pasapalabra).</small></span>
        </label>
        <label class="radio">
          <input v-model="settings.answerMode" type="radio" value="typed" :disabled="settings.presenter" />
          <span><strong>Escribiendo</strong><small>Cada jugador teclea la palabra y el juego la comprueba.</small></span>
        </label>
      </fieldset>

      <section class="options">
        <h2>Opciones</h2>
        <label>
          Tiempo por jugador (segundos)
          <input v-model.number="settings.durationSec" type="number" min="30" max="900" step="10" />
        </label>
        <label class="check">
          <input v-model="settings.presenter" type="checkbox" />
          Usar un móvil como presentador: lee las definiciones y valida las respuestas
        </label>
        <div v-if="settings.presenter" class="presenter-box">
          <p class="hint">Con presentador, las respuestas se validan siempre desde su móvil (modo manual).</p>
          <label class="check">
            <input v-model="settings.presenterHidesDefinition" type="checkbox" />
            Ocultar la definición en esta pantalla mientras el presentador esté conectado
          </label>
          <PresenterLink />
        </div>
        <label class="check">
          <input v-model="settings.camera" type="checkbox" />
          Mostrar la cámara en directo dentro del aro, en lugar de la foto
        </label>
        <label class="check">
          <input v-model="settings.music" type="checkbox" />
          Música de fondo, que se vuelve más tensa durante el turno de cada jugador
        </label>
        <label class="check">
          <input v-model="settings.effects" type="checkbox" />
          Efectos de sonido: aplausos al acertar y un «ooohh» del público al fallar
        </label>
      </section>

      <button class="primary start" :disabled="!canStart" @click="startGame(selected)">Empezar partida</button>
    </template>
  </div>
</template>

<style scoped>
.setup { display: grid; gap: 28px; max-width: 760px; margin: 0 auto; }
h1 { font-size: clamp(2.2rem, 6vw, 3.6rem); margin: 0; font-weight: 800; font-stretch: 80%; }
h2 { font-size: 1.05rem; font-weight: 600; margin: 0 0 12px; color: var(--gold); }
.list { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
.choice {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  text-align: left;
  border-radius: 16px;
  border: 2px solid color-mix(in srgb, var(--chalk) 16%, transparent);
  background: color-mix(in srgb, var(--stage-2) 70%, transparent);
  color: inherit;
  cursor: pointer;
  font: inherit;
}
.choice.on { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 14%, var(--stage-2)); }
.choice .label { display: grid; flex: 1; min-width: 0; }
.choice small { color: var(--muted); }
.order { background: var(--gold); color: var(--stage); border-radius: 50%; width: 28px; height: 28px; display: grid; place-items: center; }
.mode { border: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.mode legend { font-size: 1.05rem; font-weight: 600; color: var(--gold); margin-bottom: 12px; padding: 0; }
.radio { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-radius: 14px; border: 2px solid color-mix(in srgb, var(--chalk) 16%, transparent); cursor: pointer; }
.radio:has(input:checked) { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 12%, var(--stage-2)); }
.radio span { display: grid; }
.radio small { color: var(--muted); }
.options { display: grid; gap: 14px; }
.options label { display: grid; gap: 6px; }
.options label.check { display: flex; align-items: center; gap: 10px; }
.options input[type='number'] { max-width: 160px; }
.presenter-box { display: grid; gap: 12px; padding: 14px 16px; border-radius: 14px; border: 1.5px solid color-mix(in srgb, var(--chalk) 16%, transparent); background: color-mix(in srgb, var(--stage-2) 55%, transparent); }
.hint { margin: 0; color: var(--muted); font-size: 0.95rem; }
.start { justify-self: start; font-size: 1.2rem; padding: 14px 28px; }
.empty { display: grid; gap: 14px; justify-items: start; }
</style>
