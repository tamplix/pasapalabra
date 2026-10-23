import { openDB, type DBSchema } from 'idb'
import type { GameRecord, PlayerProfile, Repository } from './types'

interface WordUsage {
  wordId: string
  uses: number
  lastUsedAt: number
}

interface PasapalabraDB extends DBSchema {
  players: { key: string; value: PlayerProfile }
  games: { key: string; value: GameRecord; indexes: { byDate: number } }
  wordUsage: { key: string; value: WordUsage }
}

export async function createIndexedDbRepository(name = 'pasapalabra'): Promise<Repository> {
  const db = await openDB<PasapalabraDB>(name, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('players', { keyPath: 'id' })
        db.createObjectStore('games', { keyPath: 'id' }).createIndex('byDate', 'playedAt')
      }
      if (oldVersion < 2) db.createObjectStore('wordUsage', { keyPath: 'wordId' })
    },
  })
  return {
    listPlayers: () => db.getAll('players'),
    async savePlayer(p) { await db.put('players', p) },
    async deletePlayer(id) { await db.delete('players', id) },
    async saveGame(g) { await db.put('games', g) },
    listGames: () => db.getAllFromIndex('games', 'byDate'),
    async getWordUsage() {
      const rows = await db.getAll('wordUsage')
      return Object.fromEntries(rows.map((r) => [r.wordId, r.uses]))
    },
    async addWordUsage(ids) {
      // Una sola transacción: o se suman todos los usos de la partida o ninguno.
      const tx = db.transaction('wordUsage', 'readwrite')
      const now = Date.now()
      const counts = new Map<string, number>()
      for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1)
      await Promise.all(
        [...counts].map(async ([wordId, n]) => {
          const current = await tx.store.get(wordId)
          await tx.store.put({ wordId, uses: (current?.uses ?? 0) + n, lastUsedAt: now })
        }),
      )
      await tx.done
    },
  }
}
