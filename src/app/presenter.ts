import { computed, ref, watch } from 'vue'
import { colorFromSeed } from './color'
import { settings } from './settings'
import { dispatch, game, lastResult, playersById } from './store'
import { commandToAction, createDeduper, generateCode } from '../remote/commands'
import type { PresenterMessage } from '../remote/protocol'
import type { HostLink, PresenterHost } from '../remote/transport'
import { buildPresenterView } from '../remote/view'

/**
 * Lado de la pantalla compartida: abre una «sala» para el móvil del presentador, le envía lo que debe leer
 * y ejecuta sus órdenes en el motor. Con la opción desactivada no hace nada ni carga la librería de conexión.
 */

export type PresenterStatus = 'off' | 'starting' | 'waiting' | 'connected' | 'error'

export const presenterCode = ref('')
export const presenterStatus = ref<PresenterStatus>('off')

/** Dirección que abre el mando en el móvil; es la que codifica el QR. */
export const presenterUrl = computed(() =>
  presenterCode.value ? `${location.origin}${location.pathname}#/presentador/${presenterCode.value}` : '',
)

/** La definición se oculta en esta pantalla solo si el presentador está conectado: si se cae, vuelve a verse. */
export const presenterHidesDefinition = computed(
  () => settings.presenter && settings.presenterHidesDefinition && presenterStatus.value === 'connected',
)

const CODE_KEY = 'pasapalabra:presenter-code'
/** Sin noticias del móvil durante este tiempo (envía un latido cada 2 s), se considera desconectado. */
const SILENCE_MS = 6000

let host: PresenterHost | null = null
let link: HostLink | null = null
let timer: ReturnType<typeof setInterval> | undefined
let lastSeen = 0
let lastSignature = ''
const alreadyApplied = createDeduper()

function loadCode(): string {
  try {
    const saved = sessionStorage.getItem(CODE_KEY)
    if (saved) return saved
    const fresh = generateCode()
    sessionStorage.setItem(CODE_KEY, fresh)
    return fresh
  } catch {
    return generateCode()
  }
}

function newCode(): string {
  const fresh = generateCode()
  try { sessionStorage.setItem(CODE_KEY, fresh) } catch { /* sin almacenamiento */ }
  return fresh
}

function publish(force: boolean) {
  if (!link) return
  const now = Date.now()
  const last = lastResult.value
  const view = buildPresenterView(game.value, {
    now,
    colorOf: (id) => playersById.value.get(id)?.color ?? colorFromSeed(id),
    verdict: last ? { word: last.word, correct: last.correct, at: last.at } : null,
  })
  // La firma ignora el reloj: solo se envía al instante lo que cambia en la partida; el reloj va con el envío periódico.
  const signature = JSON.stringify({ ...view, remainingMs: 0, players: view.players.map((p) => ({ ...p, remainingMs: 0 })) })
  if (!force && signature === lastSignature) return
  lastSignature = signature
  link.send({ t: 'state', view })
}

function onMessage(message: PresenterMessage) {
  lastSeen = Date.now()
  if (presenterStatus.value === 'waiting') presenterStatus.value = 'connected'
  if (message.t === 'hello') return publish(true)
  if (message.t !== 'cmd') return
  if (!alreadyApplied(message.id) && game.value) dispatch(commandToAction(message.cmd, Date.now()))
  link?.send({ t: 'ack', id: message.id })
}

function onConnect(next: HostLink) {
  link?.close()
  link = next
  lastSeen = Date.now()
  lastSignature = ''
  presenterStatus.value = 'connected'
  next.onMessage(onMessage)
  next.onClose(() => {
    if (link !== next) return
    link = null
    presenterStatus.value = 'waiting'
  })
  publish(true)
}

async function start() {
  if (host || presenterStatus.value === 'starting') return
  presenterStatus.value = 'starting'
  presenterCode.value = loadCode()
  const { hostPresenter } = await import('../remote/transport')
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      host = await hostPresenter(presenterCode.value, { onConnect })
      presenterStatus.value = 'waiting'
      timer = setInterval(tick, 1000)
      return
    } catch (e) {
      if (!settings.presenter) return
      // El código sigue ocupado (recarga rápida): se espera a que el servicio lo libere y, si no, se cambia.
      if ((e as { type?: string }).type === 'unavailable-id') {
        await new Promise((r) => setTimeout(r, 2000))
        if (attempt >= 3) presenterCode.value = newCode()
      } else {
        presenterStatus.value = 'error'
        return
      }
    }
  }
  presenterStatus.value = 'error'
}

function stop() {
  clearInterval(timer)
  link?.close()
  host?.close()
  host = null
  link = null
  lastSignature = ''
  presenterStatus.value = 'off'
}

function tick() {
  if (link && Date.now() - lastSeen > SILENCE_MS) {
    if (presenterStatus.value === 'connected') presenterStatus.value = 'waiting'
  }
  publish(true)
}

/** Activa o desactiva el presentador según el ajuste. Se llama una vez al arrancar la aplicación. */
export function initPresenter() {
  watch(() => settings.presenter, (on) => (on ? void start() : stop()), { immediate: true })
  watch([game, lastResult], () => publish(false), { flush: 'post' })
}
