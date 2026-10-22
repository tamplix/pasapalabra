import type { GameRecord, PlayerProfile, Repository } from './types'

export function createMemoryRepository(): Repository {
  const players = new Map<string, PlayerProfile>()
  const games: GameRecord[] = []
  return {
    async listPlayers() { return [...players.values()] },
    async savePlayer(p) { players.set(p.id, p) },
    async deletePlayer(id) { players.delete(id) },
    async saveGame(g) { games.push(g) },
    async listGames() { return [...games] },
  }
}
