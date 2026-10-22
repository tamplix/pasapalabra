<script setup lang="ts">
import { computed } from 'vue'
import type { RoscoEntry } from '../core/types'

const props = defineProps<{
  entries: readonly RoscoEntry[]
  /** Índice de la casilla en juego; -1 si no hay ninguna. */
  active: number
  compact?: boolean
}>()

const SIZE = 520
const RADIUS = 214
const BEAD = 25

const beads = computed(() =>
  props.entries.map((entry, i) => {
    const angle = (-90 + (i * 360) / props.entries.length) * (Math.PI / 180)
    return {
      entry,
      x: SIZE / 2 + RADIUS * Math.cos(angle),
      y: SIZE / 2 + RADIUS * Math.sin(angle),
      isActive: i === props.active,
    }
  }),
)

const label = computed(() => {
  const c = props.entries.filter((e) => e.status === 'correct').length
  const w = props.entries.filter((e) => e.status === 'wrong').length
  return `Rosco: ${c} aciertos, ${w} fallos, ${props.entries.length - c - w} pendientes`
})
</script>

<template>
  <div class="ring" :class="{ compact }">
    <div v-if="$slots.media" class="media"><slot name="media" /></div>
    <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" role="img" :aria-label="label">
      <circle :cx="SIZE / 2" :cy="SIZE / 2" :r="RADIUS" class="track" />
      <g v-for="b in beads" :key="b.entry.letter" :class="['bead', b.entry.status, { active: b.isActive }]">
        <circle v-if="b.isActive" :cx="b.x" :cy="b.y" :r="BEAD + 9" class="halo" />
        <circle :cx="b.x" :cy="b.y" :r="BEAD" class="disc" />
        <text :x="b.x" :y="b.y" class="glyph" text-anchor="middle" dominant-baseline="central">
          {{ b.entry.letter }}
        </text>
      </g>
    </svg>
  </div>
</template>

<style scoped>
.ring {
  position: relative;
  width: 100%;
  aspect-ratio: 1;
}
svg {
  width: 100%;
  height: 100%;
  display: block;
}
.track {
  fill: none;
  stroke: color-mix(in srgb, var(--gold) 22%, transparent);
  stroke-width: 1.5;
  stroke-dasharray: 2 7;
}
.disc {
  fill: var(--stage-2);
  stroke: var(--gold);
  stroke-width: 2.5;
  transition: fill 0.25s, stroke 0.25s;
}
.glyph {
  fill: var(--chalk);
  font-size: 26px;
  font-weight: 700;
  pointer-events: none;
}
.correct .disc { fill: var(--ok); stroke: var(--ok); }
.wrong .disc { fill: var(--bad); stroke: var(--bad); }
.correct .glyph, .wrong .glyph { fill: #fff; }
.active .disc { fill: var(--gold); stroke: #fff; stroke-width: 3; }
.active .glyph { fill: var(--stage); }
.halo {
  fill: color-mix(in srgb, var(--gold) 35%, transparent);
  animation: pulse 1.6s ease-in-out infinite;
  transform-box: fill-box;
  transform-origin: center;
}
@keyframes pulse {
  50% { transform: scale(1.18); opacity: 0.45; }
}
@media (prefers-reduced-motion: reduce) {
  .halo { animation: none; }
}
.media {
  position: absolute;
  inset: 14%;
}
.compact .glyph { font-size: 30px; }
.compact .track { stroke-width: 3; }
.compact .media { display: none; }
</style>
