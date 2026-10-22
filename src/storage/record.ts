import { scoreOf, winnerOf } from '../core/engine'
import type { GameState, Letter } from '../core/types'
import type { GameRecord } from './types'

export function toGameRecord(state: GameState, id: string): GameRecord {
  return {
    id,
    playedAt: state.finishedAt ?? Date.now(),
    seed: state.seed,
    winnerId: winnerOf(state)?.id ?? null,
    players: state.players.map((p) => ({
      playerId: p.id,
      name: p.name,
      profile: p.profile,
      ...scoreOf(p),
      remainingMs: p.remainingMs,
      letters: Object.fromEntries(
        p.rosco.map((e) => [
          e.letter as Letter,
          e.status === 'pending' ? null : e.status === 'correct',
        ]),
      ),
    })),
  }
}
