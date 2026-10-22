import { openDB, type DBSchema } from 'idb'
import type { GameRecord, PlayerProfile, Repository } from './types'

interface PasapalabraDB extends DBSchema {
  players: { key: string; value: PlayerProfile }
  games: { key: string; value: GameRecord; indexes: { byDate: number } }
}

export async function createIndexedDbRepository(name = 'pasapalabra'): Promise<Repository> {
  const db = await openDB<PasapalabraDB>(name, 1, {
    upgrade(db) {
      db.createObjectStore('players', { keyPath: 'id' })
      db.createObjectStore('games', { keyPath: 'id' }).createIndex('byDate', 'playedAt')
    },
  })
  return {
    listPlayers: () => db.getAll('players'),
    async savePlayer(p) { await db.put('players', p) },
    async deletePlayer(id) { await db.delete('players', id) },
    async saveGame(g) { await db.put('games', g) },
    listGames: () => db.getAllFromIndex('games', 'byDate'),
  }
}
