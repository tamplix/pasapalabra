export const ALPHABET = [
  'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'L', 'M', 'N',
  'Ñ', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'X', 'Y', 'Z',
] as const

export type Letter = (typeof ALPHABET)[number]
export type Profile = 'kids' | 'teens' | 'young' | 'adults'
export type WordProfile = Profile | 'all'
export type LetterPosition = 'starts_with' | 'contains'

export interface WordRecord {
  id: string
  letter: Letter
  position: LetterPosition
  word: string
  definition: string
  profile: WordProfile
  isPop: boolean
  /** Otros perfiles para los que la palabra también es apta (además de `profile`). No aplica a `all`. */
  also?: Profile[]
  aliases?: string[]
  difficulty?: 1 | 2 | 3
  tags?: string[]
}

export type EntryStatus = 'pending' | 'correct' | 'wrong'

export interface RoscoEntry {
  wordId: string
  letter: Letter
  prompt: string
  word: string
  definition: string
  aliases: string[]
  isPop: boolean
  status: EntryStatus
  /** La casilla ha estado en juego con el reloj en marcha, es decir, se ha mostrado su definición. */
  seen: boolean
  /** Respuesta escrita por el jugador (solo si ha respondido). */
  given?: string
}

export interface PlayerConfig {
  id: string
  name: string
  profile: Profile
}

export interface PlayerState extends PlayerConfig {
  rosco: RoscoEntry[]
  remainingMs: number
  /** Índice de la casilla activa; -1 si el jugador ya ha terminado. */
  cursor: number
  finished: boolean
}

/** Estado del tablero justo antes de una acción, para poder deshacerla. */
export interface Snapshot {
  players: PlayerState[]
  activeIndex: number
}

export interface GameState {
  seed: number
  status: 'lobby' | 'playing' | 'finished'
  players: PlayerState[]
  activeIndex: number
  /**
   * Instante (ms epoch) en que empezó el turno actual. Null con la partida en curso
   * significa pausa de preparación: el reloj está parado hasta la acción `begin`.
   */
  turnStartedAt: number | null
  /** Partida en pausa: el reloj está parado y solo se admite reanudar. */
  paused: boolean
  startedAt: number | null
  finishedAt: number | null
  /** Pila de acciones deshacibles (la más reciente al final). */
  history: Snapshot[]
}

export type GameAction =
  | { type: 'start'; at: number }
  /** Arranca el reloj del jugador con el turno, que antes está en pausa de preparación. */
  | { type: 'begin'; at: number }
  | { type: 'answer'; at: number; text: string }
  /** Veredicto de un árbitro (respuesta hablada): no hay texto que comparar. */
  | { type: 'judge'; at: number; correct: boolean }
  | { type: 'pass'; at: number }
  | { type: 'surrender'; at: number }
  /** Anula la última respuesta, veredicto o pasapalabra. */
  | { type: 'undo'; at: number }
  /** Detiene el reloj del turno en marcha. */
  | { type: 'pause'; at: number }
  /** Reanuda el turno tras una pausa. */
  | { type: 'resume'; at: number }
  | { type: 'tick'; at: number }
