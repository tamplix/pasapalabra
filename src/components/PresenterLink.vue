<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { presenterCode, presenterStatus, presenterUrl } from '../app/presenter'

/** Emparejamiento con el móvil del presentador: QR, código y estado. `compact` lo reduce a un indicador desplegable. */
const props = defineProps<{ compact?: boolean }>()

const qr = ref('')
const open = ref(false)
const copied = ref(false)

watch(
  presenterUrl,
  async (url) => {
    if (!url) return (qr.value = '')
    const { toDataURL } = await import('qrcode')
    qr.value = await toDataURL(url, { margin: 1, width: 240, color: { dark: '#071533', light: '#ffffff' } })
  },
  { immediate: true },
)

const text = computed(
  () =>
    ({
      off: 'Desactivado',
      starting: 'Preparando la conexión…',
      waiting: 'Esperando al presentador',
      connected: 'Presentador conectado',
      error: 'No se pudo preparar la conexión',
    })[presenterStatus.value],
)

async function copy() {
  try {
    await navigator.clipboard.writeText(presenterUrl.value)
    copied.value = true
    setTimeout(() => (copied.value = false), 1800)
  } catch {
    // Sin permiso para el portapapeles: el enlace sigue visible para copiarlo a mano.
  }
}

const expanded = computed(() => !props.compact || open.value)
</script>

<template>
  <section class="presenter-link" :class="[presenterStatus, { compact }]" aria-live="polite">
    <button v-if="compact" class="chip" type="button" :aria-expanded="open" @click="open = !open">
      <span class="dot" aria-hidden="true" />
      {{ text }}
    </button>
    <p v-else class="state"><span class="dot" aria-hidden="true" />{{ text }}</p>

    <div v-if="expanded && presenterCode" class="pairing">
      <img v-if="qr" :src="qr" alt="Código QR para abrir el mando del presentador en el móvil" width="160" height="160" />
      <div class="info">
        <p>Escanea el código con el móvil del presentador, o abre este enlace en él:</p>
        <p class="code">Código <strong class="presenter-code">{{ presenterCode }}</strong></p>
        <button type="button" class="link" @click="copy">{{ copied ? 'Copiado' : 'Copiar enlace' }}</button>
      </div>
    </div>
    <p v-if="presenterStatus === 'error'" class="error">
      Comprueba que hay conexión a internet y vuelve a activar la opción.
    </p>
  </section>
</template>

<style scoped>
.presenter-link { display: grid; gap: 10px; }
.state, .chip { display: inline-flex; align-items: center; gap: 8px; margin: 0; }
.chip {
  justify-self: center;
  padding: 4px 12px;
  font-size: 0.85rem;
  font-weight: 500;
  border-radius: 999px;
}
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--muted); flex: none; }
.connected .dot { background: var(--ok); }
.waiting .dot, .starting .dot { background: var(--gold); }
.error .dot { background: var(--bad); }
.pairing { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; }
.pairing img { border-radius: 10px; background: #fff; }
.info { display: grid; gap: 6px; max-width: 280px; }
.info p { margin: 0; font-size: 0.95rem; }
.code strong { font-size: 1.4rem; letter-spacing: 0.15em; color: var(--gold); }
.error { margin: 0; color: var(--bad); }
.compact .pairing { justify-content: center; }
.compact .info { text-align: center; }
</style>
