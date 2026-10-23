import { describe, expect, it } from 'vitest'
import { createGame, reduce } from '../core/engine'
import type { WordRecord } from '../core/types'
import { ALPHABET } from '../core/types'
import { createMemoryRepository } from './memory'
import { toGameRecord } from './record'
import { computeStats } from './stats'

const bank: WordRecord[] = ALPHABET.map((letter) => ({
  id: letter, letter, position: 'starts_with', word: `${letter}x`, definition: 'd',
  profile: 'all', isPop: false,
}))

describe('estadísticas', () => {
  it('agrega partidas guardadas por jugador', async () => {
    let s = createGame(bank, {
      seed: 3, durationMs: 5000,
      players: [{ id: 'a', name: 'Ana', profile: 'kids' }, { id: 'b', name: 'Leo', profile: 'kids' }],
    })
    s = reduce(reduce(s, { type: 'start', at: 0 }), { type: 'begin', at: 0 })
    s = reduce(s, { type: 'answer', at: 1, text: s.players[0]!.rosco[0]!.word }) // Ana acierta
    s = reduce(s, { type: 'answer', at: 2, text: 'mal' }) // Ana falla
    s = reduce(s, { type: 'begin', at: 3 }) // empieza Leo
    s = reduce(s, { type: 'tick', at: 5000 })
    s = reduce(s, { type: 'tick', at: 10_000 }) // Leo agota su tiempo
    s = reduce(s, { type: 'begin', at: 10_001 }) // vuelve Ana
    s = reduce(s, { type: 'tick', at: 20_000 }) // Ana agota su tiempo restante
    expect(s.status).toBe('finished')

    const repo = createMemoryRepository()
    await repo.saveGame(toGameRecord(s, 'g1'))
    const stats = computeStats(await repo.listGames())
    const ana = stats.find((x) => x.playerId === 'a')!
    expect(ana.games).toBe(1)
    expect(ana.wins).toBe(1)
    expect(ana.avgCorrect).toBe(1)
    expect(ana.accuracy).toBe(0.5)
    expect(ana.byLetter.A).toEqual({ correct: 1, wrong: 0 })
  })
})

describe('contador de uso de palabras', () => {
  it('suma usos por palabra y acumula entre partidas', async () => {
    const repo = createMemoryRepository()
    expect(await repo.getWordUsage()).toEqual({})
    await repo.addWordUsage(['1', '2', '2'])
    await repo.addWordUsage(['2', '3'])
    expect(await repo.getWordUsage()).toEqual({ '1': 1, '2': 3, '3': 1 })
  })
})

