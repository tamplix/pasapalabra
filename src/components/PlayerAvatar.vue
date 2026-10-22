<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ name: string; image?: string; seed: string; size?: number }>()

const hue = computed(() => {
  let h = 0
  for (const ch of props.seed) h = (h * 31 + ch.charCodeAt(0)) % 360
  return h
})
const initials = computed(() => props.name.trim().slice(0, 2).toUpperCase() || '?')
const px = computed(() => `${props.size ?? 48}px`)
</script>

<template>
  <span class="avatar" :style="{ width: px, height: px, '--h': hue }">
    <img v-if="image" :src="image" alt="" />
    <span v-else>{{ initials }}</span>
  </span>
</template>

<style scoped>
.avatar {
  flex: none;
  display: inline-grid;
  place-items: center;
  border-radius: 50%;
  overflow: hidden;
  background: hsl(var(--h) 45% 32%);
  color: #fff;
  font-weight: 700;
  font-size: 0.4em;
  box-shadow: 0 0 0 2px var(--gold);
}
.avatar { font-size: calc(v-bind(px) * 0.38); }
img { width: 100%; height: 100%; object-fit: cover; }
</style>
