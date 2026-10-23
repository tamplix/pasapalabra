<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { colorFromSeed, initialsOf, readableTextColor } from '../app/color'

const props = defineProps<{ image?: string; camera: boolean; name: string; seed: string; color?: string }>()
const emit = defineEmits<{ cameraError: [message: string] }>()

const background = computed(() => props.color ?? colorFromSeed(props.seed))
const foreground = computed(() => readableTextColor(background.value))
const initials = computed(() => initialsOf(props.name))

const video = ref<HTMLVideoElement | null>(null)
const live = ref(false)
let stream: MediaStream | null = null

function stop() {
  stream?.getTracks().forEach((t) => t.stop())
  stream = null
  live.value = false
}

async function start() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
    if (video.value) video.value.srcObject = stream
    live.value = true
  } catch (e) {
    emit('cameraError', e instanceof Error ? e.message : 'No se pudo acceder a la cámara')
  }
}

watch(
  () => props.camera,
  (on) => (on ? void start() : stop()),
  { immediate: true, flush: 'post' },
)
onBeforeUnmount(stop)
</script>

<template>
  <div class="stage-bg" aria-hidden="true">
    <!-- Sin foto ni cámara: las iniciales del jugador sobre su color, como en la lista de jugadores. -->
    <div v-if="!image && !live" class="placeholder" :style="{ background, color: foreground }">{{ initials }}</div>
    <img v-if="image && !live" :src="image" alt="" class="media" />
    <video v-show="live" ref="video" class="media mirror" autoplay playsinline muted />
  </div>
</template>

<style scoped>
.stage-bg {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  overflow: hidden;
  pointer-events: none;
  container-type: inline-size;
  background: radial-gradient(circle at 50% 35%, var(--stage-2), var(--stage) 75%);
}
.placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  font-weight: 800;
  font-stretch: 85%;
  /* El tamaño sigue al del círculo, no al de la ventana. */
  font-size: 40cqw;
  letter-spacing: 0.02em;
}
.media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mirror { transform: scaleX(-1); }
</style>
