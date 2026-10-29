import { reactive, watch } from 'vue'

/** `manual`: se responde en voz alta y alguien valida con botones o teclas; `typed`: se escribe y el juego comprueba. */
export type AnswerMode = 'typed' | 'manual'

export interface Settings {
  /** Cómo se responde. */
  answerMode: AnswerMode
  /** Un móvil hace de presentador: lee las definiciones y valida las respuestas (siempre en modo manual). */
  presenter: boolean
  /** Oculta la definición en esta pantalla mientras el presentador esté conectado. */
  presenterHidesDefinition: boolean
  /** Muestra la cámara en directo como fondo del jugador que tiene el turno. */
  camera: boolean
  /** Música de tensión mientras corre el reloj de cada turno. */
  music: boolean
  /** Aplausos al acertar y reacción del público al fallar. */
  effects: boolean
  /** Volumen de la música, de 0 a 1. */
  musicVolume: number
  /** Música silenciada sin perder el volumen elegido. */
  musicMuted: boolean
  durationSec: number
}

/** Volumen inicial de la música: suave, para que no tape las voces. */
export const DEFAULT_VOLUME = 0.35
const KEY = 'pasapalabra:settings'
const defaults: Settings = { answerMode: 'manual', presenter: false, presenterHidesDefinition: true, camera: false, music: true, effects: true, musicVolume: DEFAULT_VOLUME, musicMuted: false, durationSec: 150 }

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    // Migración: el modo «spoken» pasó a llamarse «manual».
    if (saved.answerMode === 'spoken') saved.answerMode = 'manual'
    const volume = Number(saved.musicVolume)
    return { ...defaults, ...saved, musicVolume: Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : DEFAULT_VOLUME }
  } catch {
    return { ...defaults }
  }
}

export const settings = reactive<Settings>(load())

watch(settings, (value) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(value))
  } catch {
    // Almacenamiento no disponible (modo privado): los ajustes duran solo la sesión.
  }
})
