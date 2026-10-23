<script setup lang="ts">
import { ref, watch } from 'vue'
import { lastResult } from '../app/store'

/**
 * Destello en el fondo con cada veredicto: verde si se acierta, rojo si se falla.
 * Cada veredicto cambia `serial`, lo que recrea el elemento y reinicia la animación aunque
 * se repita el mismo resultado seguido. Al deshacer, `lastResult` pasa a null y no hay destello.
 */
const kind = ref<'ok' | 'bad'>('ok')
const serial = ref(0)

watch(lastResult, (result) => {
  if (!result) return
  kind.value = result.correct ? 'ok' : 'bad'
  serial.value++
})
</script>

<template>
  <div v-if="serial" :key="serial" class="flash" :class="kind" aria-hidden="true" />
</template>

<style scoped>
.flash {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  opacity: 0;
  /* Velo de color en toda la pantalla y brillo más intenso hacia los bordes. */
  background: color-mix(in srgb, var(--c) 20%, transparent);
  box-shadow: inset 0 0 22vmin 4vmin color-mix(in srgb, var(--c) 75%, transparent);
  mix-blend-mode: screen;
  animation: flash 0.9s ease-out;
}
.ok { --c: var(--ok); }
.bad { --c: var(--bad); }
/* Subida rápida y bajada suave: se nota sin parpadear. */
@keyframes flash {
  0% { opacity: 0; }
  12% { opacity: 1; }
  100% { opacity: 0; }
}
</style>
