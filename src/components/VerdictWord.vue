<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { lastResult } from '../app/store'
import { fitFontSize, fitMaxWidth, zoomEndScale } from '../app/zoom'

/**
 * La solución aparece sobre el rosco con cada veredicto, según acierto o fallo:
 * - Acierto: sale del centro del rosco, diminuta y transparente, y avanza hacia nosotros hasta hacerse enorme
 *   y volver a desvanecerse, como si la atravesáramos.
 * - Fallo: se muestra con un resplandor rojo, a un tamaño con el que cabe entera, durante un segundo, y se
 *   desvanece por opacidad.
 * Puede haber varias a la vez. Con «reducir movimiento» no se ve nada: el resultado ya se indica con texto.
 */
interface Item {
  id: number
  word: string
  x: number
  y: number
  /** Escala final (solo acierto). */
  end: number
  /** Tamaño de letra en px (solo fallo). */
  size: number
}

const hits = ref<Item[]>([])
const misses = ref<Item[]>([])
let seq = 0

watch(lastResult, async (result) => {
  // Al deshacer, `lastResult` pasa a null y no hay efecto.
  if (!result) return
  const ring = document.querySelector('.board .ring')?.getBoundingClientRect()
  const x = ring ? ring.left + ring.width / 2 : innerWidth / 2
  const y = ring ? ring.top + ring.height / 2 : innerHeight / 2
  const item: Item = {
    id: ++seq,
    word: result.word,
    x,
    y,
    end: zoomEndScale(result.word, innerWidth, innerHeight),
    size: fitFontSize(result.word, x, innerWidth, innerHeight),
  }
  if (result.correct) {
    hits.value.push(item)
    return
  }
  misses.value.push(item)
  // La estimación por caracteres se corrige midiendo el texto real, para que nunca se salga de la pantalla.
  await nextTick()
  const el = document.querySelector<HTMLElement>(`[data-miss="${item.id}"]`)
  const room = fitMaxWidth(x, innerWidth)
  if (el && el.scrollWidth > room) el.style.fontSize = `${item.size * (room / el.scrollWidth)}px`
})

function removeHit(id: number) {
  hits.value = hits.value.filter((i) => i.id !== id)
}
function removeMiss(id: number) {
  misses.value = misses.value.filter((i) => i.id !== id)
}
</script>

<template>
  <div class="word-layer" aria-hidden="true">
    <span
      v-for="z in hits"
      :key="`h${z.id}`"
      class="hit"
      :style="{ left: `${z.x}px`, top: `${z.y}px`, '--end': z.end }"
      @animationend="removeHit(z.id)"
    >
      {{ z.word }}
    </span>
    <span
      v-for="z in misses"
      :key="`m${z.id}`"
      class="miss"
      :data-miss="z.id"
      :style="{ left: `${z.x}px`, top: `${z.y}px`, fontSize: `${z.size}px` }"
      @animationend="removeMiss(z.id)"
    >
      {{ z.word }}
    </span>
  </div>
</template>

<style scoped>
.word-layer {
  position: fixed;
  inset: 0;
  z-index: 30;
  overflow: hidden;
  pointer-events: none;
}
.hit, .miss {
  position: absolute;
  white-space: nowrap;
  font-weight: 800;
  font-stretch: 75%;
  line-height: 1.05;
  color: #fff;
  /* Estado base invisible: sin animación (reducir movimiento) la palabra no llega a mostrarse. */
  opacity: 0;
  transform: translate(-50%, -50%) scale(0);
  will-change: transform, opacity;
}

/* Acierto: sale del centro y avanza hacia nosotros, cada vez más deprisa. */
.hit {
  font-size: 7vmin;
  line-height: 1;
  text-shadow:
    0 0 0.2em color-mix(in srgb, var(--ok) 85%, transparent),
    0 0 0.6em color-mix(in srgb, var(--ok) 55%, transparent);
  animation: approach 0.9s cubic-bezier(0.55, 0.05, 0.9, 0.55) forwards;
}
@keyframes approach {
  0% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
  14% { opacity: 1; }
  72% { opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(var(--end)); opacity: 0; }
}

/* Fallo: palabra completa con resplandor rojo; entra en 0,15 s, se queda 1 s y se desvanece en 0,35 s. */
.miss {
  text-shadow:
    0 0 0.1em color-mix(in srgb, var(--bad) 100%, transparent),
    0 0 0.35em color-mix(in srgb, var(--bad) 85%, transparent),
    0 0 0.8em color-mix(in srgb, var(--bad) 60%, transparent),
    0 0.05em 0.03em rgb(0 0 0 / 0.45);
  animation: error-word 1.5s ease-out forwards;
}
@keyframes error-word {
  0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0; }
  10% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  76.7% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
  100% { transform: translate(-50%, -50%) scale(1); opacity: 0; }
}
</style>
