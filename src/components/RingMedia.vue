<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ image?: string; camera: boolean }>()
const emit = defineEmits<{ cameraError: [message: string] }>()

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
    <img v-if="image && !live" :src="image" alt="" class="media" />
    <video v-show="live" ref="video" class="media mirror" autoplay playsinline muted />
    <div class="scrim" />
  </div>
</template>

<style scoped>
.stage-bg {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  overflow: hidden;
  background: radial-gradient(circle at 50% 35%, var(--stage-2), var(--stage) 75%);
}
.media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.mirror { transform: scaleX(-1); }
.scrim {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle, color-mix(in srgb, var(--stage) 35%, transparent), color-mix(in srgb, var(--stage) 70%, transparent) 100%);
}
</style>
