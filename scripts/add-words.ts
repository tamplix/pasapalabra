/**
 * Añade palabras nuevas al banco desde una tabla markdown (mismo formato que la migración inicial).
 * Los ids del archivo se ignoran: se asignan ids nuevos a continuación del mayor existente.
 * Se omiten las palabras que ya existen (mismo perfil o `all`) y las entradas inválidas
 * (por ejemplo, una letra que la palabra no cumple), informando de cada omisión.
 *
 * Uso: npm run add-words -- <ruta.md> [--dry]
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalize } from '../src/core/normalize'
import type { WordRecord } from '../src/core/types'
import { bank } from '../src/data/bank'
import { validateBank, validateWord } from '../src/data/validate'

const [input, ...flags] = process.argv.slice(2)
if (!input) {
  console.error('Uso: npm run add-words -- <ruta.md> [--dry]')
  process.exit(1)
}
const dry = flags.includes('--dry')

const rows = readFileSync(input, 'utf8').split('\n').filter((l) => /^\|\s*\d+\s*\|/.test(l))
const incoming = rows.map((line) => {
  const [, letter, position, word, definition, profile, pop] = line.split('|').slice(1, -1).map((c) => c.trim())
  return {
    letter: letter as WordRecord['letter'],
    position: position as WordRecord['position'],
    word: word!,
    definition: definition!,
    profile: profile as WordRecord['profile'],
    isPop: pop === 'true',
  }
})

const key = (w: { word: string }) => normalize(w.word)
/** Perfiles con los que una palabra nueva puede coincidir en un mismo rosco. */
const overlaps = (a: WordRecord['profile'], b: WordRecord['profile']) => a === b || a === 'all' || b === 'all'

let nextId = Math.max(...bank.map((w) => Number(w.id))) + 1
const added: WordRecord[] = []
const skipped: string[] = []
const invalid: string[] = []

for (const w of incoming) {
  const clash = [...bank, ...added].find((e) => key(e) === key(w) && overlaps(e.profile, w.profile))
  if (clash) {
    skipped.push(`«${w.word}» (${w.profile}) ya existe como «${clash.word}» (${clash.profile}, id ${clash.id})`)
    continue
  }
  const candidate: WordRecord = { id: String(nextId), ...w }
  const broken = validateWord(candidate).filter((i) => i.level === 'error')
  if (broken.length) {
    invalid.push(`«${w.word}» (${w.profile}, letra ${w.letter}): ${broken.map((i) => i.message).join('; ')}`)
    continue
  }
  nextId++
  added.push(candidate)
}

const issues = validateBank([...bank, ...added])
const errors = issues.filter((i) => i.level === 'error')

console.log(`Leídas ${incoming.length} | nuevas ${added.length} | omitidas por duplicadas ${skipped.length} | inválidas ${invalid.length} | ids ${added[0]?.id}-${added.at(-1)?.id}`)
for (const s of skipped) console.log('  omitida:', s)
for (const s of invalid) console.log('  INVÁLIDA, no se añade:', s)
for (const i of issues) console.log(`${i.level === 'error' ? 'ERROR' : 'aviso'} ${i.id ?? ''} ${i.message}`)

const perProfile = Object.groupBy(added, (w) => w.profile)
for (const [profile, list] of Object.entries(perProfile)) {
  console.log(`  ${profile}: +${list!.length} (argot/pop ${list!.filter((w) => w.isPop).length})`)
}

if (errors.length) {
  console.error('\nHay errores en el banco resultante: no se ha escrito nada.')
  process.exit(1)
}
if (dry) {
  console.log('\nSimulación: no se ha escrito nada.')
  process.exit(0)
}

const dir = resolve(import.meta.dirname, '../src/data/words')
for (const [profile, list] of Object.entries(perProfile)) {
  const file = resolve(dir, `${profile}.json`)
  const current = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as WordRecord[]) : []
  writeFileSync(file, JSON.stringify([...current, ...list!], null, 2) + '\n')
}
console.log(`\nEscrito: ${added.length} palabras añadidas. Total del banco: ${bank.length + added.length}.`)
