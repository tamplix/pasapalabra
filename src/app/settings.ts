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
  durationSec: number
}

const KEY = 'pasapalabra:settings'
const defaults: Settings = { answerMode: 'manual', presenter: false, presenterHidesDefinition: true, camera: false, durationSec: 150 }

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    // Migración: el modo «spoken» pasó a llamarse «manual».
    if (saved.answerMode === 'spoken') saved.answerMode = 'manual'
    return { ...defaults, ...saved }
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
