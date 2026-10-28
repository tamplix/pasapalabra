import { describe, expect, it } from 'vitest'
import { createGame, reduce } from '../core/engine'
import { createRng } from '../core/rng'
import { bank } from '../data/bank'
import { commandToAction, createDeduper, generateCode } from './commands'
import { isHostMessage, isPresenterMessage, COMMANDS } from './protocol'
import { buildPresenterView, VERDICT_MS } from './view'

const colorOf = (id: string) => (id === 'a' ? '#112233' : '#aabbcc')
const base = () =>
  createGame(bank, {
    seed: 5,
    durationMs: 60_000,
    players: [
      { id: 'a', name: 'Ana', profile: 'adults' },
      { id: 'b', name: 'Leo', profile: 'kids' },
    ],
  })

describe('vista del presentador', () => {
  it('sin partida o en la sala previa no hay nada que mostrar', () => {
    expect(buildPresenterView(null, { now: 0, colorOf, verdict: null }).phase).toBe('idle')
    expect(buildPresenterView(base(), { now: 0, colorOf, verdict: null }).phase).toBe('idle')
  })
  it('en la pausa de preparación no adelanta la definición ni la solución', () => {
    const g = reduce(base(), { type: 'start', at: 0 })
    const v = buildPresenterView(g, { now: 10, colorOf, verdict: null })
    expect(v.phase).toBe('waiting')
    expect(v.entry).toBeNull()
    expect(v.players.find((p) => p.active)?.name).toBe('Ana')
    expect(JSON.stringify(v)).not.toContain(g.players[0]!.rosco[0]!.word)
  })
  it('con el turno en marcha incluye letra, definición y solución, y descuenta el tiempo', () => {
    let g = reduce(base(), { type: 'start', at: 0 })
    g = reduce(g, { type: 'begin', at: 1000 })
    const first = g.players[0]!.rosco[0]!
    const v = buildPresenterView(g, { now: 4000, colorOf, verdict: null })
    expect(v.phase).toBe('playing')
    expect(v.entry).toEqual({ letter: 'A', prompt: first.prompt, definition: first.definition, word: first.word })
    expect(v.remainingMs).toBe(57_000)
    expect(v.players[1]!.remainingMs).toBe(60_000)
    expect(v.players[0]!.color).toBe('#112233')
  })
  it('indica si se puede deshacer y cuenta aciertos y fallos', () => {
    let g = reduce(reduce(base(), { type: 'start', at: 0 }), { type: 'begin', at: 0 })
    expect(buildPresenterView(g, { now: 1, colorOf, verdict: null }).canUndo).toBe(false)
    g = reduce(g, { type: 'judge', at: 100, correct: true })
    const v = buildPresenterView(g, { now: 101, colorOf, verdict: null })
    expect(v.canUndo).toBe(true)
    expect(v.players[0]!.correct).toBe(1)
  })
  it('el resultado de la última respuesta caduca', () => {
    const g = reduce(reduce(base(), { type: 'start', at: 0 }), { type: 'begin', at: 0 })
    const verdict = { word: 'Amigo', correct: false, at: 1000 }
    expect(buildPresenterView(g, { now: 1000 + VERDICT_MS - 1, colorOf, verdict }).verdict).toEqual({ word: 'Amigo', correct: false })
    expect(buildPresenterView(g, { now: 1000 + VERDICT_MS, colorOf, verdict }).verdict).toBeNull()
  })
  it('al terminar la partida lo indica y no muestra casilla', () => {
    let g = reduce(reduce(base(), { type: 'start', at: 0 }), { type: 'begin', at: 0 })
    g = reduce(g, { type: 'surrender', at: 1 })
    g = reduce(g, { type: 'surrender', at: 2 })
    const v = buildPresenterView(g, { now: 3, colorOf, verdict: null })
    expect(v.phase).toBe('finished')
    expect(v.entry).toBeNull()
  })
})

describe('pausa en la vista del presentador', () => {
  it('con la partida en pausa informa de ello, conserva la casilla y el tiempo, y no ofrece deshacer', () => {
    let g = reduce(reduce(base(), { type: 'start', at: 0 }), { type: 'begin', at: 0 })
    g = reduce(g, { type: 'judge', at: 100, correct: true })
    g = reduce(g, { type: 'pause', at: 5000 })
    const v = buildPresenterView(g, { now: 20_000, colorOf, verdict: null })
    expect(v.phase).toBe('paused')
    expect(v.entry?.letter).toBe('B')
    expect(v.remainingMs).toBe(55_000)
    expect(v.canUndo).toBe(false)
  })
  it('las órdenes de pausa y reanudación se traducen y se aceptan', () => {
    expect(commandToAction('pause', 3)).toEqual({ type: 'pause', at: 3 })
    expect(commandToAction('resume', 3)).toEqual({ type: 'resume', at: 3 })
    expect(isPresenterMessage({ t: 'cmd', id: 'x', cmd: 'pause' })).toBe(true)
    expect(isPresenterMessage({ t: 'cmd', id: 'x', cmd: 'resume' })).toBe(true)
  })
})

describe('órdenes del presentador', () => {
  it('cada orden se traduce a la acción del motor con la hora de la pantalla', () => {
    expect(commandToAction('begin', 7)).toEqual({ type: 'begin', at: 7 })
    expect(commandToAction('judge-yes', 7)).toEqual({ type: 'judge', at: 7, correct: true })
    expect(commandToAction('judge-no', 7)).toEqual({ type: 'judge', at: 7, correct: false })
    expect(commandToAction('pass', 7)).toEqual({ type: 'pass', at: 7 })
    expect(commandToAction('undo', 7)).toEqual({ type: 'undo', at: 7 })
    expect(commandToAction('surrender', 7)).toEqual({ type: 'surrender', at: 7 })
    for (const c of COMMANDS) expect(commandToAction(c, 1).at).toBe(1)
  })
  it('una orden repetida no se aplica dos veces y el detector olvida las más antiguas', () => {
    const seen = createDeduper(3)
    expect(seen('a')).toBe(false)
    expect(seen('a')).toBe(true)
    seen('b'); seen('c'); seen('d')
    expect(seen('a')).toBe(false) // «a» salió de la memoria de 3
  })
  it('los mensajes mal formados se rechazan', () => {
    expect(isPresenterMessage({ t: 'cmd', id: 'x', cmd: 'judge-yes' })).toBe(true)
    expect(isPresenterMessage({ t: 'cmd', id: 'x', cmd: 'borrar-todo' })).toBe(false)
    expect(isPresenterMessage({ t: 'cmd', cmd: 'pass' })).toBe(false)
    expect(isPresenterMessage({ t: 'ping' })).toBe(true)
    expect(isPresenterMessage(null)).toBe(false)
    expect(isPresenterMessage('hola')).toBe(false)
    expect(isHostMessage({ t: 'ack', id: 'x' })).toBe(true)
    expect(isHostMessage({ t: 'state', view: { players: [] } })).toBe(true)
    expect(isHostMessage({ t: 'state', view: 3 })).toBe(false)
  })
  it('los códigos de sala son cortos, sin caracteres ambiguos y distintos', () => {
    const rng = createRng(1)
    const codes = Array.from({ length: 200 }, () => generateCode(6, rng))
    expect(codes.every((c) => /^[A-HJKMNP-Z2-9]{6}$/.test(c))).toBe(true)
    expect(new Set(codes).size).toBeGreaterThan(190)
  })
})
