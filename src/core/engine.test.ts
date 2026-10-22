import { describe, expect, it } from 'vitest'
import { createGame, reduce, scoreOf, winnerOf } from './engine'
import { isCorrectAnswer, normalize } from './normalize'
import { createRng } from './rng'
import { generateRosco, IncompleteBankError } from './rosco'
import { ALPHABET, type GameState, type WordRecord } from './types'

function makeBank(perLetter = 3, popEvery = 1): WordRecord[] {
  const bank: WordRecord[] = []
  for (const letter of ALPHABET) {
    for (let n = 0; n < perLetter; n++) {
      bank.push({
        id: `${letter}${n}`,
        letter,
        position: 'starts_with',
        word: `${letter.toLowerCase()}palabra${n}`,
        definition: `def ${letter}${n}`,
        profile: n === 0 ? 'all' : 'adults',
        isPop: n % popEvery === 0,
      })
    }
  }
  return bank
}

const players = [
  { id: 'p1', name: 'Ana', profile: 'adults' as const },
  { id: 'p2', name: 'Leo', profile: 'adults' as const },
]

/** Partida en curso con el reloj del primer jugador ya en marcha desde t=0. */
function started(): GameState {
  const lobby = createGame(makeBank(), { seed: 1, players, durationMs: 10_000 })
  return reduce(reduce(lobby, { type: 'start', at: 0 }), { type: 'begin', at: 0 })
}

const begin = (s: GameState, at: number) => reduce(s, { type: 'begin', at })

const solutionOf = (s: GameState) => {
  const p = s.players[s.activeIndex]!
  return p.rosco[p.cursor]!.word
}

describe('normalize / isCorrectAnswer', () => {
  it('ignora tildes, mayúsculas y signos, pero conserva la ñ', () => {
    expect(normalize(' Él, Cañón! ')).toBe('elcañon')
    expect(normalize('E.T.')).toBe('et')
    expect(normalize('año')).not.toBe(normalize('ano'))
  })
  it('tolera erratas solo en palabras largas', () => {
    expect(isCorrectAnswer('Dinosaurio', 'Dinosaurio')).toBe(true)
    expect(isCorrectAnswer('Dinosauro', 'Dinosaurio')).toBe(true)
    expect(isCorrectAnswer('Gato', 'Pato')).toBe(false)
    expect(isCorrectAnswer('', 'Pato')).toBe(false)
  })
  it('acepta alias', () => {
    expect(isCorrectAnswer('un dos tres', 'Un, dos, tres')).toBe(true)
    expect(isCorrectAnswer('1,2,3', 'Un, dos, tres', ['123'])).toBe(true)
  })
})

describe('generateRosco', () => {
  it('es determinista por semilla y cubre las 25 letras en orden', () => {
    const bank = makeBank()
    const a = generateRosco(bank, 'adults', createRng(7))
    const b = generateRosco(bank, 'adults', createRng(7))
    expect(a).toEqual(b)
    expect(a.map((e) => e.letter)).toEqual([...ALPHABET])
  })
  it('incluye exactamente un 25 % de argot (6 de 25) cuando el banco lo permite', () => {
    const bank = makeBank(3, 2) // n=0 y n=2 son pop; n=1 es formal
    for (let seed = 0; seed < 30; seed++) {
      const rosco = generateRosco(bank, 'adults', createRng(seed))
      expect(rosco.filter((e) => e.isPop)).toHaveLength(6)
    }
  })
  it('si faltan letras con argot, lleva todas las posibles', () => {
    const bank = makeBank(2, 1).map((w) => ({ ...w, isPop: w.letter === 'A' || w.letter === 'B' }))
    const rosco = generateRosco(bank, 'adults', createRng(1))
    expect(rosco.filter((e) => e.isPop)).toHaveLength(2)
  })
  it('falla con un error claro si falta una letra', () => {
    const bank = makeBank().filter((w) => w.letter !== 'Q')
    expect(() => generateRosco(bank, 'adults', createRng(1))).toThrow(IncompleteBankError)
  })
})

describe('engine', () => {
  it('acertar mantiene el turno; fallar lo cede', () => {
    let s = started()
    s = reduce(s, { type: 'answer', at: 1000, text: solutionOf(s) })
    expect(s.activeIndex).toBe(0)
    expect(scoreOf(s.players[0]!).correct).toBe(1)
    s = reduce(s, { type: 'answer', at: 2000, text: 'nada' })
    expect(s.activeIndex).toBe(1)
    expect(scoreOf(s.players[0]!).wrong).toBe(1)
  })
  it('un veredicto externo puntúa sin texto: acierto mantiene el turno, fallo lo cede', () => {
    let s = started()
    s = reduce(s, { type: 'judge', at: 100, correct: true })
    expect(s.activeIndex).toBe(0)
    expect(s.players[0]!.rosco[0]!.status).toBe('correct')
    expect(s.players[0]!.rosco[0]!.given).toBeUndefined()
    s = reduce(s, { type: 'judge', at: 200, correct: false })
    expect(s.players[0]!.rosco[1]!.status).toBe('wrong')
    expect(s.activeIndex).toBe(1)
  })
  it('pasapalabra cede el turno y la casilla sigue pendiente', () => {
    let s = started()
    s = reduce(s, { type: 'pass', at: 500 })
    expect(s.activeIndex).toBe(1)
    expect(s.players[0]!.rosco[0]!.status).toBe('pending')
    expect(s.players[0]!.cursor).toBe(1)
  })
  it('solo descuenta tiempo al jugador activo', () => {
    let s = started()
    s = reduce(s, { type: 'pass', at: 3000 })
    expect(s.players[0]!.remainingMs).toBe(7000)
    expect(s.players[1]!.remainingMs).toBe(10_000)
  })
  it('una respuesta fuera de tiempo no cuenta y se cede el turno', () => {
    let s = started()
    s = reduce(s, { type: 'answer', at: 11_000, text: solutionOf(s) })
    expect(s.players[0]!.finished).toBe(true)
    expect(scoreOf(s.players[0]!).correct).toBe(0)
    expect(s.activeIndex).toBe(1)
  })
  it('si un jugador termina, el otro sigue hasta acabar y la partida se cierra', () => {
    let s = started()
    s = reduce(s, { type: 'tick', at: 10_000 })
    s = begin(s, 10_001)
    expect(s.activeIndex).toBe(1)
    for (let i = 0; i < 25; i++) {
      s = reduce(s, { type: 'answer', at: 10_001 + i + 1, text: solutionOf(s) })
    }
    expect(s.status).toBe('finished')
    expect(winnerOf(s)?.id).toBe('p2')
  })
  it('completar el rosco con pasapalabras vuelve a las pendientes', () => {
    let s = started()
    s = reduce(s, { type: 'pass', at: 1 }) // p1 pasa A
    s = begin(s, 2)
    s = reduce(s, { type: 'pass', at: 3 }) // p2 pasa A
    expect(s.activeIndex).toBe(0)
    expect(solutionOf(s)).toBe(s.players[0]!.rosco[1]!.word)
  })
  it('rendirse termina al jugador, conserva las pendientes y cede el turno', () => {
    let s = started()
    s = reduce(s, { type: 'answer', at: 1, text: solutionOf(s) })
    s = reduce(s, { type: 'surrender', at: 2 })
    expect(s.players[0]!.finished).toBe(true)
    expect(scoreOf(s.players[0]!)).toEqual({ correct: 1, wrong: 0, pending: 24 })
    expect(s.activeIndex).toBe(1)
    s = reduce(s, { type: 'surrender', at: 3 })
    expect(s.status).toBe('finished')
  })
  it('deshacer devuelve el tablero y el turno al estado previo sin cobrar el tiempo muerto', () => {
    let s = started()
    s = reduce(s, { type: 'judge', at: 1000, correct: false }) // pulsación equivocada de Ana
    expect(s.activeIndex).toBe(1)
    s = reduce(s, { type: 'undo', at: 9000 })
    expect(s.activeIndex).toBe(0)
    expect(s.players[0]!.rosco[0]!.status).toBe('pending')
    expect(s.players[0]!.cursor).toBe(0)
    expect(s.players[0]!.remainingMs).toBe(9000) // gastó 1 s hasta la pulsación, ni uno más
    expect(s.players[1]!.remainingMs).toBe(10_000)
    s = reduce(s, { type: 'tick', at: 9500 })
    expect(s.players[0]!.remainingMs).toBe(8500) // el reloj se reanuda en el deshacer
  })
  it('deshacer anula también un pasapalabra y se puede encadenar', () => {
    let s = started()
    s = reduce(s, { type: 'judge', at: 10, correct: true })
    s = reduce(s, { type: 'pass', at: 20 })
    s = reduce(s, { type: 'undo', at: 30 })
    expect(s.activeIndex).toBe(0)
    expect(s.players[0]!.cursor).toBe(1)
    s = reduce(s, { type: 'undo', at: 40 })
    expect(s.players[0]!.rosco[0]!.status).toBe('pending')
    expect(s.history).toHaveLength(0)
  })
  it('deshacer sin historial no cambia nada', () => {
    const s = started()
    expect(reduce(s, { type: 'undo', at: 5 })).toBe(s)
  })
  it('empate total devuelve null', () => {
    let s = started()
    s = reduce(s, { type: 'tick', at: 10_000 })
    s = begin(s, 10_001)
    s = reduce(s, { type: 'tick', at: 20_001 })
    expect(s.status).toBe('finished')
    expect(winnerOf(s)).toBeNull()
  })
})

describe('pausa de preparación del turno', () => {
  it('la partida y cada cambio de jugador empiezan con el reloj parado', () => {
    const lobby = createGame(makeBank(), { seed: 1, players, durationMs: 10_000 })
    let s = reduce(lobby, { type: 'start', at: 0 })
    expect(s.status).toBe('playing')
    expect(s.turnStartedAt).toBeNull()
    s = begin(s, 100)
    expect(s.turnStartedAt).toBe(100)
    s = reduce(s, { type: 'pass', at: 200 })
    expect(s.activeIndex).toBe(1)
    expect(s.turnStartedAt).toBeNull()
  })
  it('en pausa no corre el tiempo ni se admiten respuestas, veredictos o pasapalabras', () => {
    let s = reduce(started(), { type: 'pass', at: 1000 })
    const waiting = s
    s = reduce(s, { type: 'tick', at: 5000 })
    s = reduce(s, { type: 'answer', at: 5001, text: solutionOf(s) })
    s = reduce(s, { type: 'judge', at: 5002, correct: true })
    s = reduce(s, { type: 'pass', at: 5003 })
    expect(s).toBe(waiting)
    s = begin(s, 6000)
    s = reduce(s, { type: 'tick', at: 7000 })
    expect(s.players[1]!.remainingMs).toBe(9000)
  })
  it('acertar no interrumpe el turno: el reloj sigue corriendo', () => {
    const s = reduce(started(), { type: 'judge', at: 500, correct: true })
    expect(s.activeIndex).toBe(0)
    expect(s.turnStartedAt).toBe(500)
  })
  it('begin con el reloj en marcha no hace nada', () => {
    const s = started()
    expect(begin(s, 999)).toBe(s)
  })
  it('también hay pausa cuando se acaba el tiempo del jugador', () => {
    const s = reduce(started(), { type: 'tick', at: 10_000 })
    expect(s.activeIndex).toBe(1)
    expect(s.turnStartedAt).toBeNull()
  })
  it('si el rival ya terminó, el jugador sigue sin pausas', () => {
    let s = started()
    s = reduce(s, { type: 'tick', at: 10_000 })
    s = begin(s, 10_001)
    s = reduce(s, { type: 'judge', at: 10_500, correct: false })
    expect(s.activeIndex).toBe(1)
    expect(s.turnStartedAt).toBe(10_500)
  })
})
