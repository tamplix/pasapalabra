import { pick, shuffle, type Rng } from './rng'
import { ALPHABET, type Profile, type RoscoEntry, type WordRecord } from './types'

export interface RoscoOptions {
  /** Proporción de palabras de argot/cultura pop por rosco (por defecto, un 25 %). */
  popRatio?: number
  /** Palabras ya usadas (por ejemplo, en el rosco del rival); se evitan si hay alternativa. */
  exclude?: ReadonlySet<string>
}

export class IncompleteBankError extends Error {
  readonly letter: string
  readonly profile: Profile

  constructor(letter: string, profile: Profile) {
    super(`El banco no tiene palabras para la letra ${letter} y el perfil ${profile}`)
    this.name = 'IncompleteBankError'
    this.letter = letter
    this.profile = profile
  }
}

export function buildPrompt(word: Pick<WordRecord, 'letter' | 'position'>): string {
  return word.position === 'starts_with'
    ? `Empieza por ${word.letter}`
    : `Contiene la ${word.letter}`
}

/**
 * Genera un rosco de 25 letras con una cuota fija de argot/cultura pop
 * (`popRatio`, un 25 % por defecto: 6 de 25). Las letras que llevan argot se
 * eligen al azar entre las que tienen alguna palabra pop disponible; si hay
 * menos de las necesarias, el rosco lleva todas las que se puedan.
 */
export function generateRosco(
  bank: readonly WordRecord[],
  profile: Profile,
  rng: Rng,
  { popRatio = 0.25, exclude = new Set() }: RoscoOptions = {},
): RoscoEntry[] {
  const pool = bank.filter((w) => w.profile === profile || w.profile === 'all')
  const target = Math.round(ALPHABET.length * popRatio)
  const free = (w: WordRecord) => !exclude.has(w.id)

  const withPop = shuffle(ALPHABET, rng).filter((letter) =>
    pool.some((w) => w.letter === letter && w.isPop && free(w)),
  )
  const popLetters = new Set(withPop.slice(0, target))

  const chosen = new Map<string, WordRecord>()
  const usedWords = new Set<string>()

  for (const letter of shuffle(ALPHABET, rng)) {
    let candidates = pool.filter((w) => w.letter === letter)
    if (!candidates.length) throw new IncompleteBankError(letter, profile)

    const fresh = candidates.filter((w) => free(w) && !usedWords.has(w.word.toLowerCase()))
    if (fresh.length) candidates = fresh

    const wantPop = popLetters.has(letter)
    const matching = candidates.filter((w) => w.isPop === wantPop)
    if (matching.length) candidates = matching

    const word = pick(candidates, rng)
    usedWords.add(word.word.toLowerCase())
    chosen.set(letter, word)
  }

  return ALPHABET.map((letter) => {
    const w = chosen.get(letter)!
    return {
      wordId: w.id,
      letter,
      prompt: buildPrompt(w),
      word: w.word,
      definition: w.definition,
      aliases: w.aliases ?? [],
      isPop: w.isPop,
      status: 'pending' as const,
    }
  })
}
