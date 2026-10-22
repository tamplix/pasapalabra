import { computed, ref, shallowRef } from 'vue'
import { createGame, reduce } from '../core/engine'
import { isCorrectAnswer } from '../core/normalize'
import type { GameAction, GameState } from '../core/types'
import { bank } from '../data/bank'
import { createIndexedDbRepository } from '../storage/indexeddb'
import { createMemoryRepository } from '../storage/memory'
import { toGameRecord } from '../storage/record'
import type { GameRecord, PlayerProfile, Repository } from '../storage/types'
import { settings, type AnswerMode } from './settings'

export type Screen = 'setup' | 'game' | 'results' | 'players' | 'stats'

export const screen = ref<Screen>('setup')
export const players = ref<PlayerProfile[]>([])
export const games = ref<GameRecord[]>([])
export const game = shallowRef<GameState | null>(null)
/** Reloj de la interfaz; se actualiza varias veces por segundo mientras se juega. */
export const now = ref(Date.now())
export const storageWarning = ref(false)
/** Modo de respuesta de la partida en curso (fijado al empezar). */
export const answerMode = ref<AnswerMode>('manual')

export interface LastResult {
  playerId: string
  word: string
  given: string
  correct: boolean
  at: number
}
export const lastResult = ref<LastResult | null>(null)

let repo: Repository = createMemoryRepository()

export const playersById = computed(() => new Map(players.value.map((p) => [p.id, p])))

export async function init() {
  try {
    repo = await createIndexedDbRepository()
  } catch {
    storageWarning.value = true
  }
  players.value = await repo.listPlayers()
  games.value = await repo.listGames()
  setInterval(() => {
    now.value = Date.now()
    if (game.value?.status === 'playing') dispatch({ type: 'tick', at: now.value })
  }, 200)
}

export async function savePlayer(player: PlayerProfile) {
  await repo.savePlayer(player)
  const rest = players.value.filter((p) => p.id !== player.id)
  players.value = [...rest, player].sort((a, b) => a.createdAt - b.createdAt)
}

export async function deletePlayer(id: string) {
  await repo.deletePlayer(id)
  players.value = players.value.filter((p) => p.id !== id)
}

export function startGame(playerIds: string[]) {
  const chosen = playerIds.map((id) => playersById.value.get(id)!)
  game.value = createGame(bank, {
    seed: Math.floor(Math.random() * 2 ** 32),
    players: chosen.map(({ id, name, profile }) => ({ id, name, profile })),
    durationMs: settings.durationSec * 1000,
  })
  answerMode.value = settings.answerMode
  lastResult.value = null
  dispatch({ type: 'start', at: Date.now() })
  screen.value = 'game'
}

export function dispatch(action: GameAction) {
  const prev = game.value
  if (!prev) return
  const next = reduce(prev, action)
  if ((action.type === 'answer' || action.type === 'judge') && prev.status === 'playing') {
    const player = prev.players[prev.activeIndex]!
    const entry = player.rosco[player.cursor]
    // Una respuesta fuera de tiempo no cuenta, y por tanto no hay veredicto que mostrar.
    if (entry && next.players[prev.activeIndex]!.rosco[player.cursor]!.status !== 'pending') {
      lastResult.value = {
        playerId: player.id,
        word: entry.word,
        given: action.type === 'answer' ? action.text : '',
        correct:
          action.type === 'judge' ? action.correct : isCorrectAnswer(action.text, entry.word, entry.aliases),
        at: action.at,
      }
    }
  }
  if (action.type === 'undo') lastResult.value = null
  game.value = next
  if (prev.status !== 'finished' && next.status === 'finished') void finishGame(next)
}

async function finishGame(state: GameState) {
  const record = toGameRecord(state, crypto.randomUUID())
  await repo.saveGame(record)
  games.value = [...games.value, record]
  screen.value = 'results'
}

/** Milisegundos que le quedan a un jugador, descontando el turno en curso. */
export function remainingMs(index: number): number {
  const g = game.value
  if (!g) return 0
  const p = g.players[index]!
  if (g.status !== 'playing' || g.activeIndex !== index || g.turnStartedAt === null) return p.remainingMs
  return Math.max(0, p.remainingMs - (now.value - g.turnStartedAt))
}
