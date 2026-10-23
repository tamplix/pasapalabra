/** Colores de jugador: generación, y color de texto legible según el contraste con el fondo. */

/** Texto sobre fondos claros: casi negro, para que el peor caso de contraste siga superando 4,5:1. */
export const DARK_TEXT = '#02040c'
export const LIGHT_TEXT = '#ffffff'

export function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100
  const lig = l / 100
  const a = sat * Math.min(lig, 1 - lig)
  const channel = (n: number) => {
    const k = (n + h / 30) % 12
    const v = lig - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * v).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

/** Color al azar con saturación media y claridad variada, para que salgan fondos claros y oscuros. */
export function randomColor(rng: () => number = Math.random): string {
  return hslToHex(Math.floor(rng() * 360), 45 + rng() * 30, 25 + rng() * 47)
}

/** Color estable derivado de un identificador, para jugadores que aún no tienen uno guardado. */
export function colorFromSeed(seed: string): string {
  let hue = 0
  for (const ch of seed) hue = (hue * 31 + ch.charCodeAt(0)) % 360
  return hslToHex(hue, 45, 32)
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Luminancia relativa según WCAG 2.x (0 = negro, 1 = blanco). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [relativeLuminance(a), relativeLuminance(b)]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/** Fondo claro → letras oscuras; fondo oscuro → letras claras (la opción de mayor contraste). */
export function readableTextColor(background: string): string {
  return contrastRatio(background, DARK_TEXT) >= contrastRatio(background, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT
}

/** Las dos primeras letras del nombre, en mayúsculas. */
export function initialsOf(name: string): string {
  return name.trim().slice(0, 2).toUpperCase() || '?'
}
