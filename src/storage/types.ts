import type { Letter, Profile } from '../core/types'

export interface PlayerResult {
  playerId: string
  name: string
  profile: Profile
  correct: number
  wrong: number
  pending: number
  remainingMs: number
  /** Resultado por letra: true acierto, false fallo, null sin responder. */
  letters: Partial<Record<Letter, boolean | null>>
}

export interface GameRecord {
  id: string
  playedAt: number
  seed: number
  winnerId: string | null
  players: PlayerResult[]
}

export interface PlayerProfile {
  id: string
  name: string
  profile: Profile
  createdAt: number
  /** Foto del jugador (data URL JPEG reducida): avatar y, en su turno, interior del aro. */
  avatar?: string
}

/**
 * Contrato de persistencia. Hoy lo implementa IndexedDB; un backend online
 * implementaría la misma interfaz sin tocar el motor ni la UI.
 */
export interface Repository {
  listPlayers(): Promise<PlayerProfile[]>
  savePlayer(player: PlayerProfile): Promise<void>
  deletePlayer(id: string): Promise<void>
  saveGame(game: GameRecord): Promise<void>
  listGames(): Promise<GameRecord[]>
}
