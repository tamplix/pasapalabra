import { describe, expect, it } from 'vitest'
import { createGame, reduce, scoreOf, winnerOf } from './engine'
import { isCorrectAnswer, normalize } from './normalize'
import { createRng } from './rng'
import { buildPool, generateRosco, IncompleteBankError, MIN_OWN_WORDS } from './rosco'
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
  it('prefiere las palabras menos usadas', () => {
    const bank = makeBank(3, 1)
    // n0 y n1 muy usadas en todas las letras; n2 sin usar.
    const usage = Object.fromEntries(ALPHABET.flatMap((l) => [[`${l}0`, 5], [`${l}1`, 5]]))
    for (let seed = 0; seed < 20; seed++) {
      const rosco = generateRosco(bank, 'adults', createRng(seed), { usage })
      expect(rosco.every((e) => e.word.endsWith('palabra2'))).toBe(true)
    }
  })
  it('mantiene equilibrado el uso: dentro de cada letra y tipo la diferencia es de 1 como mucho', () => {
    const bank = makeBank(3, 2) // por letra: dos pop (n0, n2) y una formal (n1)
    const usage: Record<string, number> = {}
    for (let game = 0; game < 60; game++) {
      for (const e of generateRosco(bank, 'adults', createRng(game), { usage })) {
        usage[e.wordId] = (usage[e.wordId] ?? 0) + 1
      }
    }
    for (const letter of ALPHABET) {
      const pops = [usage[`${letter}0`] ?? 0, usage[`${letter}2`] ?? 0]
      expect(Math.abs(pops[0]! - pops[1]!)).toBeLessThanOrEqual(1)
    }
  })
  it('lleva argot en las letras cuyas palabras pop están menos usadas', () => {
    const bank = makeBank(3, 2)
    const fresh = new Set(['T', 'U', 'V', 'X', 'Y', 'Z'])
    const usage = Object.fromEntries(
      ALPHABET.flatMap((l) => (fresh.has(l) ? [] : [[`${l}0`, 3], [`${l}2`, 3]])),
    )
    for (let seed = 0; seed < 20; seed++) {
      const rosco = generateRosco(bank, 'adults', createRng(seed), { usage })
      expect(new Set(rosco.filter((e) => e.isPop).map((e) => e.letter))).toEqual(fresh)
    }
  })
  it('la prioridad por uso no rompe la cuota del 25 % de argot', () => {
    const bank = makeBank(3, 2)
    // Las formales (n=1) están muy usadas, pero la cuota manda sobre la prioridad.
    const usage = Object.fromEntries(ALPHABET.map((l) => [`${l}1`, 9]))
    for (let seed = 0; seed < 20; seed++) {
      expect(generateRosco(bank, 'adults', createRng(seed), { usage }).filter((e) => e.isPop)).toHaveLength(6)
    }
  })
  it('falla con un error claro si falta una letra', () => {
    const bank = makeBank().filter((w) => w.letter !== 'Q')
    expect(() => generateRosco(bank, 'adults', createRng(1))).toThrow(IncompleteBankError)
  })
})

describe('palabras compartidas entre perfiles (also)', () => {
  const word = (id: string, profile: WordRecord['profile'], w: string, also?: WordRecord['also']): WordRecord => ({
    id, letter: 'A', position: 'starts_with', word: w, definition: 'definición de prueba', profile, isPop: false, ...(also ? { also } : {}),
  })

  it('una palabra compartida entra en la reserva del otro perfil, y solo en esa', () => {
    const bank = [word('1', 'adults', 'Alfa', ['teens']), word('2', 'adults', 'Beta'), word('3', 'kids', 'Gamma')]
    expect(buildPool(bank, 'teens').map((w) => w.id)).toEqual(['1'])
    expect(buildPool(bank, 'adults').map((w) => w.id)).toEqual(['1', '2'])
    expect(buildPool(bank, 'kids').map((w) => w.id)).toEqual(['3'])
  })
  it('no hay palabras repetidas: si coincide con una propia, se queda la propia', () => {
    const bank = [word('1', 'adults', 'Matrix', ['young']), word('2', 'young', 'Matrix'), word('3', 'all', 'matrix')]
    const pool = buildPool(bank, 'young')
    expect(pool).toHaveLength(1)
    expect(pool[0]!.id).toBe('2')
  })
  it('la compartida gana a la de respaldo y una misma palabra no entra por dos vías', () => {
    const bank = [word('1', 'adults', 'Alfa'), word('2', 'teens', 'alfa', ['young']), word('3', 'adults', 'Beta', ['young'])]
    const pool = buildPool(bank, 'young') // young completa con adultos mientras tenga pocas propias
    expect(pool.map((w) => w.id).sort()).toEqual(['2', '3'])
  })
  it('las palabras compartidas cuentan en la generación del rosco', () => {
    const bank = makeBank()
    const shared = bank.map((w) => (w.profile === 'adults' ? { ...w, profile: 'teens' as const, also: ['young' as const] } : w))
    const rosco = generateRosco(shared, 'young', createRng(3))
    expect(rosco).toHaveLength(25)
    expect(buildPool(shared, 'young').some((w) => w.profile === 'teens')).toBe(true)
  })
})

describe('perfil young', () => {
  const youngWord = (letter: string, n: number): WordRecord => ({
    id: `y${letter}${n}`, letter: letter as WordRecord['letter'], position: 'starts_with',
    word: `${letter.toLowerCase()}joven${n}`, definition: 'definición de prueba', profile: 'young', isPop: false,
  })

  it('sin palabras propias usa las de adultos (y las comunes)', () => {
    const bank = makeBank()
    const young = buildPool(bank, 'young').map((w) => w.id).sort()
    const adults = buildPool(bank, 'adults').map((w) => w.id).sort()
    expect(young).toEqual(adults)
    for (let seed = 0; seed < 20; seed++) {
      expect(generateRosco(bank, 'young', createRng(seed))).toHaveLength(25)
    }
  })
  it('las letras con suficientes palabras propias solo usan las suyas; las demás se completan con adultos', () => {
    const own = Array.from({ length: MIN_OWN_WORDS }, (_, n) => youngWord('A', n))
    const bank = [...makeBank(), ...own]
    const pool = buildPool(bank, 'young')
    const wordsOfA = pool.filter((w) => w.letter === 'A').map((w) => w.profile).sort()
    expect(wordsOfA.every((p) => p === 'young' || p === 'all')).toBe(true)
    expect(pool.filter((w) => w.letter === 'B').some((w) => w.profile === 'adults')).toBe(true)
  })
  it('con pocas palabras propias en una letra, esa letra sigue usando también las de adultos', () => {
    const bank = [...makeBank(), youngWord('A', 0)]
    const wordsOfA = buildPool(bank, 'young').filter((w) => w.letter === 'A')
    expect(wordsOfA.some((w) => w.profile === 'young')).toBe(true)
    expect(wordsOfA.some((w) => w.profile === 'adults')).toBe(true)
  })
  it('los demás perfiles no se ven afectados por el respaldo', () => {
    const bank = [...makeBank(), youngWord('A', 0)]
    expect(buildPool(bank, 'adults').some((w) => w.profile === 'young')).toBe(false)
    expect(buildPool(bank, 'kids').every((w) => w.profile === 'kids' || w.profile === 'all')).toBe(true)
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

describe('pausa', () => {
  it('detiene el reloj del turno y no cobra el tiempo parado', () => {
    let s = started()
    s = reduce(s, { type: 'pause', at: 3000 })
    expect(s.paused).toBe(true)
    expect(s.turnStartedAt).toBeNull()
    expect(s.players[0]!.remainingMs).toBe(7000)
    s = reduce(s, { type: 'tick', at: 60_000 })
    expect(s.players[0]!.remainingMs).toBe(7000)
    expect(s.status).toBe('playing')
  })
  it('al reanudar el reloj sigue desde donde se quedó', () => {
    let s = reduce(started(), { type: 'pause', at: 3000 })
    s = reduce(s, { type: 'resume', at: 9000 })
    expect(s.paused).toBe(false)
    expect(s.turnStartedAt).toBe(9000)
    s = reduce(s, { type: 'tick', at: 10_000 })
    expect(s.players[0]!.remainingMs).toBe(6000)
  })
  it('en pausa solo se admite reanudar: no se puntúa, ni se pasa, ni se deshace, ni se empieza ni se rinde', () => {
    let s = reduce(started(), { type: 'judge', at: 100, correct: true })
    s = reduce(s, { type: 'pause', at: 200 })
    for (const action of [
      { type: 'judge', at: 300, correct: true },
      { type: 'answer', at: 300, text: 'x' },
      { type: 'pass', at: 300 },
      { type: 'undo', at: 300 },
      { type: 'begin', at: 300 },
      { type: 'surrender', at: 300 },
      { type: 'pause', at: 300 },
    ] as const) {
      expect(reduce(s, action)).toBe(s)
    }
  })
  it('no hay pausa si el reloj ya está parado ni si no estaba en pausa al reanudar', () => {
    const s = reduce(started(), { type: 'pass', at: 500 }) // turno de Leo, en preparación
    expect(reduce(s, { type: 'pause', at: 600 })).toBe(s)
    const running = started()
    expect(reduce(running, { type: 'resume', at: 600 })).toBe(running)
  })
  it('pausar y reanudar no altera el historial: se puede deshacer lo anterior', () => {
    let s = reduce(started(), { type: 'judge', at: 100, correct: false })
    s = reduce(s, { type: 'undo', at: 150 }) // vuelve Ana con el reloj en marcha
    s = reduce(s, { type: 'judge', at: 200, correct: true })
    const before = s.history.length
    s = reduce(s, { type: 'pause', at: 300 })
    s = reduce(s, { type: 'resume', at: 400 })
    expect(s.history).toHaveLength(before)
    s = reduce(s, { type: 'undo', at: 500 })
    expect(s.players[0]!.rosco[0]!.status).toBe('pending')
  })
  it('si el tiempo ya se había acabado al pausar, se cede el turno y no queda en pausa', () => {
    const s = reduce(started(), { type: 'pause', at: 11_000 })
    expect(s.paused).toBe(false)
    expect(s.players[0]!.finished).toBe(true)
    expect(s.activeIndex).toBe(1)
  })
})

describe('palabras vistas', () => {
  const seenWords = (s: GameState, i: number) =>
    s.players[i]!.rosco.filter((e) => e.seen).map((e) => e.letter)

  it('al empezar la partida, ninguna se ha visto; al empezar el turno, solo la primera', () => {
    const lobby = createGame(makeBank(), { seed: 1, players, durationMs: 10_000 })
    let s = reduce(lobby, { type: 'start', at: 0 })
    expect(seenWords(s, 0)).toEqual([])
    s = begin(s, 1)
    expect(seenWords(s, 0)).toEqual(['A'])
    expect(seenWords(s, 1)).toEqual([])
  })
  it('al avanzar con el reloj en marcha se ven las siguientes; las pasadas siguen vistas', () => {
    let s = started()
    s = reduce(s, { type: 'judge', at: 10, correct: true }) // sigue Ana: B
    expect(seenWords(s, 0)).toEqual(['A', 'B'])
    s = reduce(s, { type: 'pass', at: 20 }) // Ana pasa B; turno de Leo en pausa
    expect(seenWords(s, 0)).toEqual(['A', 'B'])
    expect(seenWords(s, 1)).toEqual([]) // en pausa no se muestra nada
    s = begin(s, 30)
    expect(seenWords(s, 1)).toEqual(['A'])
  })
  it('rendirse no marca como vistas las letras que quedaban', () => {
    let s = started()
    s = reduce(s, { type: 'surrender', at: 5 })
    expect(seenWords(s, 0)).toEqual(['A'])
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
