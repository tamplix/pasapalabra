import { scoreOf } from '../core/engine'
import type { GameState } from '../core/types'
import type { PresenterView } from './protocol'

export interface Verdict {
  word: string
  correct: boolean
  at: number
}

/** Segundos que el móvil del presentador sigue mostrando el resultado de la última respuesta. */
export const VERDICT_MS = 3000

/**
 * Lo que ve el presentador, calculado a partir del estado de la partida.
 * En la preparación del turno no se envía la casilla, para no adelantar la definición.
 */
export function buildPresenterView(
  game: GameState | null,
  ctx: { now: number; colorOf: (id: string) => string; verdict: Verdict | null },
): PresenterView {
  if (!game || game.status === 'lobby') {
    return { phase: 'idle', entry: null, players: [], remainingMs: 0, canUndo: false, verdict: null }
  }

  const paused = game.status === 'playing' && game.paused
  const running = game.status === 'playing' && game.turnStartedAt !== null
  const elapsed = running ? ctx.now - (game.turnStartedAt ?? ctx.now) : 0

  const players = game.players.map((p, i) => {
    const active = game.status === 'playing' && i === game.activeIndex
    const { correct, wrong } = scoreOf(p)
    return {
      id: p.id,
      name: p.name,
      color: ctx.colorOf(p.id),
      correct,
      wrong,
      remainingMs: active && running ? Math.max(0, p.remainingMs - elapsed) : p.remainingMs,
      finished: p.finished,
      active,
    }
  })

  const verdict = ctx.verdict && ctx.now - ctx.verdict.at < VERDICT_MS ? { word: ctx.verdict.word, correct: ctx.verdict.correct } : null

  if (game.status === 'finished') {
    return { phase: 'finished', entry: null, players, remainingMs: 0, canUndo: false, verdict }
  }

  const active = game.players[game.activeIndex]!
  const entry = running || paused ? active.rosco[active.cursor] : undefined
  return {
    phase: paused ? 'paused' : running ? 'playing' : 'waiting',
    entry: entry ? { letter: entry.letter, prompt: entry.prompt, definition: entry.definition, word: entry.word } : null,
    players,
    remainingMs: players[game.activeIndex]!.remainingMs,
    // En pausa no se puede deshacer, así que no se ofrece.
    canUndo: game.history.length > 0 && !paused,
    verdict,
  }
}
