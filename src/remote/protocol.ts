/** Mensajes entre la pantalla compartida (que manda) y el móvil del presentador (que la maneja). */

export const COMMANDS = ['begin', 'judge-yes', 'judge-no', 'pass', 'undo', 'surrender', 'pause', 'resume'] as const
export type Command = (typeof COMMANDS)[number]

export interface PresenterPlayer {
  id: string
  name: string
  color: string
  correct: number
  wrong: number
  remainingMs: number
  finished: boolean
  active: boolean
}

export interface PresenterEntry {
  letter: string
  prompt: string
  definition: string
  /** Solución: solo la ve el presentador. */
  word: string
}

export interface PresenterView {
  /**
   * idle: sin partida · waiting: pausa de preparación del turno · playing: turno en marcha ·
   * paused: partida en pausa con el reloj parado · finished: partida terminada
   */
  phase: 'idle' | 'waiting' | 'playing' | 'paused' | 'finished'
  /** Casilla en juego; null en la preparación del turno (no se adelanta la definición). Con la partida en pausa sigue visible para el presentador. */
  entry: PresenterEntry | null
  players: PresenterPlayer[]
  /** Tiempo restante del jugador activo en el instante del envío. */
  remainingMs: number
  canUndo: boolean
  /** Resultado de la última respuesta, durante unos segundos. */
  verdict: { word: string; correct: boolean } | null
}

export type HostMessage = { t: 'state'; view: PresenterView } | { t: 'ack'; id: string }
export type PresenterMessage = { t: 'hello' } | { t: 'ping' } | { t: 'cmd'; id: string; cmd: Command }

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null

export function isPresenterMessage(x: unknown): x is PresenterMessage {
  if (!isObject(x)) return false
  if (x.t === 'hello' || x.t === 'ping') return true
  return x.t === 'cmd' && typeof x.id === 'string' && x.id.length > 0 && COMMANDS.includes(x.cmd as Command)
}

export function isHostMessage(x: unknown): x is HostMessage {
  if (!isObject(x)) return false
  if (x.t === 'ack') return typeof x.id === 'string'
  return x.t === 'state' && isObject(x.view) && Array.isArray(x.view.players)
}
