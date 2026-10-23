import { pick, shuffle, type Rng } from './rng'
import { ALPHABET, type Profile, type RoscoEntry, type WordRecord } from './types'

export interface RoscoOptions {
  /** Proporción de palabras de argot/cultura pop por rosco (por defecto, un 25 %). */
  popRatio?: number
  /** Palabras ya usadas (por ejemplo, en el rosco del rival); se evitan si hay alternativa. */
  exclude?: ReadonlySet<string>
  /** Veces que se ha usado cada palabra (por id). Se prefieren las menos usadas; las ausentes cuentan 0. */
  usage?: Readonly<Record<string, number>>
}

/** Mientras un perfil tenga menos palabras propias que estas en una letra, esa letra se completa con las de su perfil de respaldo. */
export const MIN_OWN_WORDS = 5

/** Perfil cuyas palabras sirven de respaldo cuando al perfil le faltan palabras propias. */
const FALLBACK: Partial<Record<Profile, Profile>> = { young: 'adults' }

/**
 * Palabras que puede usar un perfil: las suyas, las comunes (`all`) y, en las letras donde
 * tenga menos de `MIN_OWN_WORDS` propias, las de su perfil de respaldo (hoy `young` usa las de `adults`).
 */
export function buildPool(bank: readonly WordRecord[], profile: Profile): WordRecord[] {
  const base = bank.filter((w) => w.profile === profile || w.profile === 'all')
  const fallback = FALLBACK[profile]
  if (!fallback) return base
  const own = new Map<string, number>()
  for (const w of base) if (w.profile === profile) own.set(w.letter, (own.get(w.letter) ?? 0) + 1)
  const extra = bank.filter((w) => w.profile === fallback && (own.get(w.letter) ?? 0) < MIN_OWN_WORDS)
  return [...base, ...extra]
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
 * Dentro de cada letra se eligen las palabras menos usadas (`usage`), al azar si empatan;
 * y las letras con argot son las que tienen sus palabras pop menos usadas.
 */
export function generateRosco(
  bank: readonly WordRecord[],
  profile: Profile,
  rng: Rng,
  { popRatio = 0.25, exclude = new Set(), usage = {} }: RoscoOptions = {},
): RoscoEntry[] {
  const pool = buildPool(bank, profile)
  const target = Math.round(ALPHABET.length * popRatio)
  const free = (w: WordRecord) => !exclude.has(w.id)
  const uses = (w: WordRecord) => usage[w.id] ?? 0

  // Las letras con argot son aquellas cuya palabra pop menos usada lo está menos; el orden
  // aleatorio previo desempata (el sort es estable).
  const popCandidates = (letter: string) => pool.filter((w) => w.letter === letter && w.isPop && free(w))
  const withPop = shuffle(ALPHABET, rng)
    .filter((letter) => popCandidates(letter).length > 0)
    .sort((a, b) => Math.min(...popCandidates(a).map(uses)) - Math.min(...popCandidates(b).map(uses)))
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

    // Prioridad a las menos usadas: solo compiten las que empatan en el menor número de usos.
    const least = Math.min(...candidates.map(uses))
    candidates = candidates.filter((w) => uses(w) === least)

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
      seen: false,
    }
  })
}
