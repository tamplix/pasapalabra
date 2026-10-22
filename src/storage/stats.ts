import { ALPHABET, type Letter } from '../core/types'
import type { GameRecord } from './types'

export interface PlayerStats {
  playerId: string
  name: string
  games: number
  wins: number
  draws: number
  /** Media de aciertos por partida. */
  avgCorrect: number
  bestCorrect: number
  /** Aciertos / (aciertos + fallos); las pendientes no cuentan. */
  accuracy: number
  /** Partidas con rosco completo (25 aciertos). */
  perfectGames: number
  byLetter: Record<Letter, { correct: number; wrong: number }>
}

export function computeStats(games: readonly GameRecord[]): PlayerStats[] {
  const acc = new Map<string, PlayerStats>()
  const emptyLetters = () =>
    Object.fromEntries(ALPHABET.map((l) => [l, { correct: 0, wrong: 0 }])) as PlayerStats['byLetter']

  for (const game of games) {
    for (const r of game.players) {
      const s = acc.get(r.playerId) ?? {
        playerId: r.playerId, name: r.name, games: 0, wins: 0, draws: 0,
        avgCorrect: 0, bestCorrect: 0, accuracy: 0, perfectGames: 0, byLetter: emptyLetters(),
      }
      s.name = r.name
      s.games++
      if (game.winnerId === r.playerId) s.wins++
      else if (game.winnerId === null) s.draws++
      s.avgCorrect += r.correct
      s.bestCorrect = Math.max(s.bestCorrect, r.correct)
      if (r.correct === ALPHABET.length) s.perfectGames++
      for (const [letter, ok] of Object.entries(r.letters) as [Letter, boolean | null][]) {
        if (ok === true) s.byLetter[letter].correct++
        else if (ok === false) s.byLetter[letter].wrong++
      }
      acc.set(r.playerId, s)
    }
  }

  return [...acc.values()].map((s) => {
    const correct = Object.values(s.byLetter).reduce((n, l) => n + l.correct, 0)
    const wrong = Object.values(s.byLetter).reduce((n, l) => n + l.wrong, 0)
    return {
      ...s,
      avgCorrect: s.avgCorrect / s.games,
      accuracy: correct + wrong ? correct / (correct + wrong) : 0,
    }
  })
}
