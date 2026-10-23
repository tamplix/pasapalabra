<script setup lang="ts">
import { computed } from 'vue'
import { colorFromSeed, initialsOf, readableTextColor } from '../app/color'

const props = defineProps<{ name: string; image?: string; seed: string; color?: string; size?: number }>()

const background = computed(() => props.color ?? colorFromSeed(props.seed))
const foreground = computed(() => readableTextColor(background.value))
const initials = computed(() => initialsOf(props.name))
const px = computed(() => `${props.size ?? 48}px`)
</script>

<template>
  <span class="avatar" :style="{ width: px, height: px, background, color: foreground }">
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
  font-weight: 700;
  box-shadow: 0 0 0 2px var(--gold);
  font-size: calc(v-bind(px) * 0.38);
}
img { width: 100%; height: 100%; object-fit: cover; }
</style>
