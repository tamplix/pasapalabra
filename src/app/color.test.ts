import { describe, expect, it } from 'vitest'
import { createRng } from '../core/rng'
import {
  colorFromSeed, contrastRatio, DARK_TEXT, hslToHex, initialsOf, LIGHT_TEXT, randomColor, readableTextColor,
} from './color'

describe('color de jugador', () => {
  it('convierte HSL a hexadecimal', () => {
    expect(hslToHex(0, 100, 50)).toBe('#ff0000')
    expect(hslToHex(120, 100, 25)).toBe('#008000')
    expect(hslToHex(0, 0, 100)).toBe('#ffffff')
    expect(hslToHex(0, 0, 0)).toBe('#000000')
  })
  it('fondo claro lleva letras oscuras y fondo oscuro, letras claras', () => {
    expect(readableTextColor('#ffffff')).toBe(DARK_TEXT)
    expect(readableTextColor('#ffee88')).toBe(DARK_TEXT)
    expect(readableTextColor('#000000')).toBe(LIGHT_TEXT)
    expect(readableTextColor('#071533')).toBe(LIGHT_TEXT)
    expect(readableTextColor('#12306e')).toBe(LIGHT_TEXT)
  })
  it('el contraste del texto nunca baja de 4,5:1 (AA) con ningún fondo posible', () => {
    // Recorre toda la escala de grises y una malla de colores: el peor caso es la luminancia en que ambas opciones empatan.
    const samples: string[] = []
    for (let v = 0; v <= 255; v++) samples.push(`#${v.toString(16).padStart(2, '0').repeat(3)}`)
    for (let h = 0; h < 360; h += 15) for (let s = 0; s <= 100; s += 25) for (let l = 0; l <= 100; l += 10) samples.push(hslToHex(h, s, l))
    for (const bg of samples) expect(contrastRatio(bg, readableTextColor(bg))).toBeGreaterThanOrEqual(4.5)
  })
  it('los colores al azar son válidos y variados, con fondos claros y oscuros', () => {
    const rng = createRng(1)
    const colors = Array.from({ length: 400 }, () => randomColor(rng))
    expect(colors.every((c) => /^#[0-9a-f]{6}$/.test(c))).toBe(true)
    expect(new Set(colors).size).toBeGreaterThan(300)
    const lights = colors.filter((c) => readableTextColor(c) === DARK_TEXT).length
    expect(lights).toBeGreaterThan(40)
    expect(lights).toBeLessThan(360)
  })
  it('el color derivado de un identificador es estable', () => {
    expect(colorFromSeed('abc')).toBe(colorFromSeed('abc'))
    expect(colorFromSeed('abc')).not.toBe(colorFromSeed('abd'))
  })
  it('las iniciales son las dos primeras letras en mayúsculas', () => {
    expect(initialsOf('  ana')).toBe('AN')
    expect(initialsOf('Z')).toBe('Z')
    expect(initialsOf('   ')).toBe('?')
  })
})
