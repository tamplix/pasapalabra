import { describe, expect, it } from 'vitest'
import { createRng } from '../core/rng'
import { normalize } from '../core/normalize'
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
  it('ninguna reserva de perfil repite palabras, aunque lleguen por distintas vías', () => {
    for (const profile of ['kids', 'teens', 'young', 'adults'] as const) {
      const pool = buildPool(bank, profile)
      expect(new Set(pool.map((w) => normalize(w.word))).size).toBe(pool.length)
    }
  })
  it('las palabras compartidas respetan el criterio: sin recuerdos de época ni jerga ajena en perfiles más jóvenes', () => {
    const shared = (word: string) => bank.find((w) => w.word === word && w.profile === 'adults')?.also ?? []
    for (const word of ['Javi', 'Unicaja', 'Verano Azul', 'Zipi y Zape', 'Barrio Sésamo', 'Reválida']) {
      expect(shared(word), word).not.toContain('young')
      expect(shared(word), word).not.toContain('teens')
    }
    // Nada de contenido para adultos hacia los adolescentes.
    for (const word of ['Pulp Fiction', 'Rambo', 'South Park', 'Padre de familia', 'Juego de Tronos', 'Dexter']) {
      const hits = bank.filter((w) => w.word === word).flatMap((w) => w.also ?? [])
      expect(hits, word).not.toContain('teens')
    }
  })
  it('lo compartido amplía de verdad las reservas de jóvenes y adultos', () => {
    expect(buildPool(bank, 'young').length).toBeGreaterThan(bank.filter((w) => w.profile === 'young').length + 500)
    expect(buildPool(bank, 'adults').length).toBeGreaterThan(bank.filter((w) => w.profile === 'adults').length + 500)
  })
})
