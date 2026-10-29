<script setup lang="ts">
import { computed } from 'vue'
import Icon from './Icon.vue'

/** Silenciar y volumen de la música, con el porcentaje a la vista. Lo usan la pantalla de juego y el móvil del presentador. */
const props = defineProps<{ volume: number; muted: boolean }>()
const emit = defineEmits<{ volume: [value: number]; mute: [muted: boolean] }>()

const percent = computed(() => Math.round(props.volume * 100))
const shown = computed(() => (props.muted ? 0 : percent.value))

function onInput(e: Event) {
  emit('volume', Number((e.target as HTMLInputElement).value) / 100)
}
</script>

<template>
  <div class="volume" :class="{ off: muted }">
    <button
      type="button"
      class="mute"
      :aria-pressed="muted"
      :aria-label="muted ? 'Activar la música' : 'Silenciar la música'"
      :title="muted ? 'Activar la música' : 'Silenciar la música'"
      @click="emit('mute', !muted)"
    >
      <Icon :name="muted ? 'mute' : 'volume'" />
    </button>
    <input type="range" min="0" max="100" step="1" :value="percent" aria-label="Volumen de la música" :aria-valuetext="`${shown} %`" @input="onInput" />
    <output class="percent" aria-hidden="true">{{ shown }} %</output>
  </div>
</template>

<style scoped>
.volume { display: flex; align-items: center; gap: 10px; touch-action: manipulation; }
.mute {
  flex: none;
  width: 40px;
  height: 40px;
  padding: 0;
  display: grid;
  place-items: center;
  border-radius: 12px;
  touch-action: manipulation;
}
.mute svg { width: 22px; height: 22px; }
input[type='range'] { flex: 1; min-width: 0; accent-color: var(--gold); height: 32px; }
.off input[type='range'] { opacity: 0.45; }
.percent { flex: none; min-width: 3.4rem; text-align: right; font-variant-numeric: tabular-nums; font-weight: 700; }
</style>
