import type { GameAction } from '../core/types'
import type { Command } from './protocol'

/** Traduce una orden del presentador a la acción del motor, con la hora de la pantalla (que lleva el reloj). */
export function commandToAction(cmd: Command, at: number): GameAction {
  switch (cmd) {
    case 'begin': return { type: 'begin', at }
    case 'judge-yes': return { type: 'judge', at, correct: true }
    case 'judge-no': return { type: 'judge', at, correct: false }
    case 'pass': return { type: 'pass', at }
    case 'undo': return { type: 'undo', at }
    case 'surrender': return { type: 'surrender', at }
  }
}

/**
 * Detector de órdenes repetidas: un reenvío por red no debe puntuar dos veces.
 * Devuelve `true` si el identificador ya se había visto.
 */
export function createDeduper(capacity = 64): (id: string) => boolean {
  const seen: string[] = []
  return (id) => {
    if (seen.includes(id)) return true
    seen.push(id)
    if (seen.length > capacity) seen.shift()
    return false
  }
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Código de sala corto, sin caracteres que se confundan (0/O, 1/I/L). */
export function generateCode(length = 6, rng: () => number = Math.random): string {
  return Array.from({ length }, () => CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)]).join('')
}
