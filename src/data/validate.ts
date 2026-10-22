import { z } from 'zod'
import { normalize } from '../core/normalize'
import { ALPHABET, type Profile, type WordRecord } from '../core/types'

export const wordSchema = z.object({
  id: z.string().min(1),
  letter: z.enum(ALPHABET),
  position: z.enum(['starts_with', 'contains']),
  word: z.string().min(1),
  definition: z.string().min(10),
  profile: z.enum(['all', 'kids', 'teens', 'adults']),
  isPop: z.boolean(),
  aliases: z.array(z.string()).optional(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  tags: z.array(z.string()).optional(),
})

export interface Issue {
  level: 'error' | 'warning'
  id?: string
  message: string
}

/** Primera letra normalizada (sin tildes; la Ñ cuenta como Ñ). */
function firstLetter(word: string): string {
  return normalize(word)[0]?.toUpperCase() ?? ''
}

export function validateBank(bank: readonly WordRecord[], minPerLetter = 5): Issue[] {
  const issues: Issue[] = []
  const seenIds = new Set<string>()
  const seenWords = new Map<string, WordRecord>()

  for (const w of bank) {
    const parsed = wordSchema.safeParse(w)
    if (!parsed.success) {
      issues.push({ level: 'error', id: w.id, message: parsed.error.issues.map((i) => i.message).join('; ') })
      continue
    }
    if (seenIds.has(w.id)) issues.push({ level: 'error', id: w.id, message: 'id duplicado' })
    seenIds.add(w.id)

    const norm = normalize(w.word)
    const letter = w.letter.toLowerCase()
    if (w.position === 'starts_with' && firstLetter(w.word) !== w.letter) {
      issues.push({ level: 'error', id: w.id, message: `«${w.word}» no empieza por ${w.letter}` })
    }
    if (w.position === 'contains' && !norm.includes(letter)) {
      issues.push({ level: 'error', id: w.id, message: `«${w.word}» no contiene la ${w.letter}` })
    }

    const key = `${w.profile}:${norm}`
    const prev = seenWords.get(key)
    if (prev) issues.push({ level: 'warning', id: w.id, message: `«${w.word}» duplicada en ${w.profile} (id ${prev.id})` })
    else seenWords.set(key, w)
  }

  const profiles: Profile[] = ['kids', 'teens', 'adults']
  for (const profile of profiles) {
    for (const letter of ALPHABET) {
      const pool = bank.filter((w) => w.letter === letter && (w.profile === profile || w.profile === 'all'))
      if (pool.length === 0) issues.push({ level: 'error', message: `${profile}/${letter}: sin palabras` })
      else if (pool.length < minPerLetter) {
        issues.push({ level: 'warning', message: `${profile}/${letter}: solo ${pool.length} candidatas (mínimo recomendado ${minPerLetter})` })
      }
      const formal = pool.filter((w) => !w.isPop).length
      if (pool.length && formal === 0) {
        issues.push({ level: 'warning', message: `${profile}/${letter}: todas son argot/pop` })
      }
    }
  }
  return issues
}
