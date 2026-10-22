import { describe, expect, it } from 'vitest'
import { createRng } from '../core/rng'
import { generateRosco } from '../core/rosco'
import { bank } from './bank'
import { validateBank } from './validate'

describe('banco de palabras real', () => {
  it('tiene 793 registros y ningún error de validación', () => {
    expect(bank).toHaveLength(793)
    expect(validateBank(bank).filter((i) => i.level === 'error')).toEqual([])
  })
  it('genera roscos válidos para todos los perfiles con muchas semillas y un 25 % de argot', () => {
    for (const profile of ['kids', 'teens', 'adults'] as const) {
      for (let seed = 0; seed < 200; seed++) {
        const rosco = generateRosco(bank, profile, createRng(seed))
        expect(rosco).toHaveLength(25)
        expect(new Set(rosco.map((e) => e.word.toLowerCase())).size).toBe(25)
        expect(rosco.filter((e) => e.isPop).length).toBe(6)
      }
    }
  })
})
