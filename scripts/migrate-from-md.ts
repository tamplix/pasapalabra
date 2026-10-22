/**
 * Convierte la tabla markdown del repositorio de palabras en JSON por perfil.
 * Uso: npm run migrate-bank -- <ruta.md>
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { WordRecord } from '../src/core/types'
import { validateBank } from '../src/data/validate'

const input = process.argv[2]
if (!input) {
  console.error('Uso: npm run migrate-bank -- <ruta.md>')
  process.exit(1)
}

const rows = readFileSync(input, 'utf8')
  .split('\n')
  .filter((l) => /^\|\s*\d+\s*\|/.test(l))

const bank: WordRecord[] = rows.map((line) => {
  const [id, letter, position, word, definition, profile, pop] = line
    .split('|').slice(1, -1).map((c) => c.trim())
  return {
    id: id!,
    letter: letter as WordRecord['letter'],
    position: position as WordRecord['position'],
    word: word!,
    definition: definition!,
    profile: profile as WordRecord['profile'],
    isPop: pop === 'true',
  }
})

const outDir = resolve(import.meta.dirname, '../src/data/words')
mkdirSync(outDir, { recursive: true })
for (const profile of ['all', 'kids', 'teens', 'adults'] as const) {
  const subset = bank.filter((w) => w.profile === profile)
  writeFileSync(resolve(outDir, `${profile}.json`), JSON.stringify(subset, null, 2) + '\n')
  console.log(`${profile}: ${subset.length}`)
}

const issues = validateBank(bank)
const errors = issues.filter((i) => i.level === 'error')
console.log(`\nTotal ${bank.length} | errores ${errors.length} | avisos ${issues.length - errors.length}`)
for (const i of issues) console.log(`${i.level === 'error' ? 'ERROR' : 'aviso'} ${i.id ?? ''} ${i.message}`)
