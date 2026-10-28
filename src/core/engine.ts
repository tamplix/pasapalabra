import { isCorrectAnswer } from './normalize'
import { createRng } from './rng'
import { generateRosco, type RoscoOptions } from './rosco'
import type {
  GameAction,
  GameState,
  PlayerConfig,
  PlayerState,
  RoscoEntry,
  WordRecord,
} from './types'

export const DEFAULT_DURATION_MS = 150_000

export const MAX_UNDO = 20

export interface NewGameOptions extends Pick<RoscoOptions, 'popRatio' | 'usage'> {
  seed: number
  players: PlayerConfig[]
  durationMs?: number
}

export function createGame(bank: readonly WordRecord[], opts: NewGameOptions): GameState {
  const rng = createRng(opts.seed)
  const used = new Set<string>()
  const players: PlayerState[] = opts.players.map((cfg) => {
    const rosco = generateRosco(bank, cfg.profile, rng, { popRatio: opts.popRatio, usage: opts.usage, exclude: used })
    rosco.forEach((e) => used.add(e.wordId))
    return {
      ...cfg,
      rosco,
      remainingMs: opts.durationMs ?? DEFAULT_DURATION_MS,
      cursor: 0,
      finished: false,
    }
  })
  return {
    seed: opts.seed,
    status: 'lobby',
    players,
    activeIndex: 0,
    turnStartedAt: null,
    paused: false,
    startedAt: null,
    finishedAt: null,
    history: [],
  }
}

/** Siguiente casilla pendiente a partir de `from` (sin incluirla), o -1 si no queda ninguna. */
function nextPending(rosco: readonly RoscoEntry[], from: number): number {
  for (let step = 1; step <= rosco.length; step++) {
    const i = (from + step) % rosco.length
    if (rosco[i]!.status === 'pending') return i
  }
  return -1
}

function withPlayer(state: GameState, index: number, patch: Partial<PlayerState>): GameState {
  return {
    ...state,
    players: state.players.map((p, i) => (i === index ? { ...p, ...patch } : p)),
  }
}

/** Descuenta del jugador activo el tiempo transcurrido desde que empezó su turno. */
function spendTime(state: GameState, at: number): GameState {
  const idx = state.activeIndex
  const player = state.players[idx]!
  const elapsed = Math.max(0, at - (state.turnStartedAt ?? at))
  const remainingMs = Math.max(0, player.remainingMs - elapsed)
  const next = withPlayer(state, idx, {
    remainingMs,
    finished: player.finished || remainingMs === 0,
  })
  return { ...next, turnStartedAt: at }
}

/** Cede el turno al siguiente jugador que no haya terminado; cierra la partida si no queda ninguno. */
function advanceTurn(state: GameState, at: number, switchPlayer: boolean): GameState {
  const n = state.players.length
  const current = state.players[state.activeIndex]!
  const order = switchPlayer || current.finished
    ? Array.from({ length: n }, (_, k) => (state.activeIndex + 1 + k) % n)
    : [state.activeIndex]
  // Al ceder el turno, los demás van primero y el actual queda al final de la cola.
  const nextIndex = order.find((i) => !state.players[i]!.finished)
  if (nextIndex === undefined) {
    return { ...state, status: 'finished', turnStartedAt: null, finishedAt: at }
  }
  // Al cambiar de jugador hay pausa de preparación; si sigue el mismo, el reloj no se detiene.
  const switched = nextIndex !== state.activeIndex
  return { ...state, activeIndex: nextIndex, turnStartedAt: switched ? null : at }
}

/** Marca como vista la casilla en juego, siempre que el reloj del turno esté en marcha. */
function markSeen(state: GameState): GameState {
  if (state.status !== 'playing' || state.turnStartedAt === null) return state
  const player = state.players[state.activeIndex]
  const entry = player?.rosco[player.cursor]
  if (!player || player.finished || !entry || entry.seen) return state
  return withPlayer(state, state.activeIndex, {
    rosco: player.rosco.map((e, i) => (i === player.cursor ? { ...e, seen: true } : e)),
  })
}

export function reduce(state: GameState, action: GameAction): GameState {
  return markSeen(step(state, action))
}

function step(state: GameState, action: GameAction): GameState {
  if (action.type === 'start') {
    if (state.status !== 'lobby') return state
    return { ...state, status: 'playing', startedAt: action.at, turnStartedAt: null }
  }
  if (state.status !== 'playing') return state

  if (state.paused) {
    // En pausa el reloj sigue parado y solo se puede reanudar; cualquier otra acción no hace nada.
    return action.type === 'resume' ? { ...state, paused: false, turnStartedAt: action.at } : state
  }
  if (action.type === 'resume') return state

  if (action.type === 'pause') {
    // Con el reloj ya parado (pausa de preparación del turno) no hay nada que detener.
    if (state.turnStartedAt === null) return state
    const spent = spendTime(state, action.at)
    // Si el tiempo se acabó justo antes de pausar, no hay pausa: se cede el turno como siempre.
    if (spent.players[spent.activeIndex]!.finished) return advanceTurn(spent, action.at, true)
    return { ...spent, turnStartedAt: null, paused: true }
  }

  if (action.type === 'undo') {
    const previous = state.history.at(-1)
    if (!previous) return state
    // El reloj se reanuda ahora: el tiempo transcurrido desde la pulsación errónea no se cobra a nadie.
    return {
      ...state,
      players: previous.players,
      activeIndex: previous.activeIndex,
      turnStartedAt: action.at,
      history: state.history.slice(0, -1),
    }
  }

  if (state.turnStartedAt === null) {
    if (action.type === 'begin') return { ...state, turnStartedAt: action.at }
    // En la pausa de preparación solo se puede rendirse; el resto de acciones no hacen nada.
    if (action.type !== 'surrender') return state
  }
  if (action.type === 'begin') return state

  const spent = spendTime(state, action.at)
  const idx = spent.activeIndex
  const player = spent.players[idx]!

  // Se acabó el tiempo antes de actuar: la acción no cuenta.
  if (player.finished) return advanceTurn(spent, action.at, true)
  if (action.type === 'tick') return spent

  if (action.type === 'surrender') {
    return advanceTurn(withPlayer(spent, idx, { finished: true }), action.at, true)
  }

  const entry = player.rosco[player.cursor]!

  const remembered: GameState = {
    ...spent,
    history: [...spent.history, { players: spent.players, activeIndex: idx }].slice(-MAX_UNDO),
  }

  if (action.type === 'pass') {
    const cursor = nextPending(player.rosco, player.cursor)
    return advanceTurn(withPlayer(remembered, idx, { cursor }), action.at, true)
  }

  // answer o judge
  const correct =
    action.type === 'judge' ? action.correct : isCorrectAnswer(action.text, entry.word, entry.aliases)
  const given = action.type === 'answer' ? action.text : undefined
  const rosco = player.rosco.map((e, i) =>
    i === player.cursor
      ? { ...e, status: correct ? ('correct' as const) : ('wrong' as const), given }
      : e,
  )
  const cursor = nextPending(rosco, player.cursor)
  const finished = cursor === -1
  const updated = withPlayer(remembered, idx, { rosco, cursor, finished })
  // Acertar mantiene el turno; fallar lo cede.
  return advanceTurn(updated, action.at, !correct)
}

export function scoreOf(player: PlayerState) {
  const correct = player.rosco.filter((e) => e.status === 'correct').length
  const wrong = player.rosco.filter((e) => e.status === 'wrong').length
  return { correct, wrong, pending: player.rosco.length - correct - wrong }
}

/** Ganador: más aciertos; a igualdad, menos fallos y después más tiempo restante. Null si empatan del todo. */
export function winnerOf(state: GameState): PlayerState | null {
  const ranked = [...state.players].sort((a, b) => {
    const sa = scoreOf(a)
    const sb = scoreOf(b)
    return sb.correct - sa.correct || sa.wrong - sb.wrong || b.remainingMs - a.remainingMs
  })
  if (ranked.length < 2) return ranked[0] ?? null
  const [first, second] = ranked as [PlayerState, PlayerState]
  const sf = scoreOf(first)
  const ss = scoreOf(second)
  const tied =
    sf.correct === ss.correct && sf.wrong === ss.wrong && first.remainingMs === second.remainingMs
  return tied ? null : first
}
