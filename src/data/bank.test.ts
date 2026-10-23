import { describe, expect, it } from 'vitest'
import { createRng } from '../core/rng'
import { buildPool, generateRosco } from '../core/rosco'
import { bank } from './bank'
import { validateBank } from './validate'

describe('banco de palabras real', () => {
  it('tiene al menos los 793 registros iniciales, ids únicos y ningún error de validación', () => {
    expect(bank.length).toBeGreaterThanOrEqual(793)
    expect(new Set(bank.map((w) => w.id)).size).toBe(bank.length)
    expect(validateBank(bank).filter((i) => i.level === 'error')).toEqual([])
  })
  it('genera roscos válidos para todos los perfiles con muchas semillas y un 25 % de argot', () => {
    for (const profile of ['kids', 'teens', 'young', 'adults'] as const) {
      for (let seed = 0; seed < 200; seed++) {
        const rosco = generateRosco(bank, profile, createRng(seed))
        expect(rosco).toHaveLength(25)
        expect(new Set(rosco.map((e) => e.word.toLowerCase())).size).toBe(25)
        expect(rosco.filter((e) => e.isPop).length).toBe(6)
      }
    }
  })
  it('con el uso acumulado, tras 100 partidas ninguna palabra se queda atrás', () => {
    for (const profile of ['kids', 'teens', 'young', 'adults'] as const) {
      const usage: Record<string, number> = {}
      for (let game = 0; game < 100; game++) {
        for (const e of generateRosco(bank, profile, createRng(game), { usage })) {
          usage[e.wordId] = (usage[e.wordId] ?? 0) + 1
        }
      }
      const pool = buildPool(bank, profile)
      for (const letter of new Set(pool.map((w) => w.letter))) {
        for (const pop of [true, false]) {
          const counts = pool.filter((w) => w.letter === letter && w.isPop === pop).map((w) => usage[w.id] ?? 0)
          if (counts.length) expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})
