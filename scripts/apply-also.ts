/**
 * Aplica las decisiones de `also-lists.ts` al banco: añade a cada palabra elegida los perfiles con los que se comparte.
 * Es idempotente. No añade una palabra si el perfil de destino ya la tiene (propia, común o ya compartida).
 * Uso: npm run apply-also [-- --dry] [-- --report <ruta.md>]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalize } from '../src/core/normalize'
import type { Profile, WordRecord } from '../src/core/types'
import { validateBank } from '../src/data/validate'
import { RULES } from './also-lists'

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const reportPath = args.includes('--report') ? args[args.indexOf('--report') + 1] : undefined

const dir = resolve(import.meta.dirname, '../src/data/words')
const PROFILES = ['all', 'kids', 'teens', 'young', 'adults'] as const
const files = Object.fromEntries(PROFILES.map((p) => [p, JSON.parse(readFileSync(resolve(dir, `${p}.json`), 'utf8')) as WordRecord[]])) as Record<(typeof PROFILES)[number], WordRecord[]>
const everything = PROFILES.flatMap((p) => files[p])

/** Palabras que ya tiene un perfil: propias, comunes y las que ya se le comparten. */
const taken = (profile: Profile) =>
  new Set(everything.filter((w) => w.profile === profile || w.profile === 'all' || w.also?.includes(profile)).map((w) => normalize(w.word)))

const report: string[] = ['# Propuesta de palabras compartidas entre perfiles (`also`)', '']
let totalAdded = 0

for (const rule of RULES) {
  const source = files[rule.from]
  const wanted = rule.names ? new Set(rule.names.map(normalize)) : null
  const found = new Set<string>()
  const exceptions = new Set((rule.except ?? []).map(normalize))
  const skipped = new Set((rule.skipNames ?? []).map(normalize))
  const ids = rule.ids ? new Set(rule.ids.map(String)) : null

  const candidates = source.filter((w) => {
    const key = normalize(w.word)
    if (wanted?.has(key)) { found.add(key); return true }
    if (ids) return ids.has(w.id)
    if (rule.names) return false
    if (rule.formal) return !w.isPop && !skipped.has(key) && !rule.skipDefinition?.test(w.definition)
    if (rule.popAll) return w.isPop && !exceptions.has(key)
    return false
  })

  const lines: string[] = []
  let added = 0, dup = 0
  for (const target of rule.to) {
    const have = taken(target)
    for (const w of candidates) {
      if (w.also?.includes(target)) continue
      if (have.has(normalize(w.word))) { dup++; continue }
      w.also = [...(w.also ?? []), target].sort()
      have.add(normalize(w.word))
      everything.find((e) => e.id === w.id)!.also = w.also
      added++
      lines.push(`- ${w.word} (${rule.from} → ${target})`)
    }
  }
  totalAdded += added
  const missing = rule.names ? rule.names.filter((n) => !found.has(normalize(n))) : []
  console.log(`${rule.label}\n  candidatas ${candidates.length} | añadidas ${added} | ya existían en el destino ${dup}${missing.length ? ` | no encontradas ${missing.length}` : ''}`)
  if (missing.length) console.log('    sin encontrar:', missing.join(', '))
  report.push(`## ${rule.label}`, '', `Añadidas ${added}; omitidas por existir ya en el perfil de destino: ${dup}.`, '', ...lines, '')
}

const issues = validateBank(everything).filter((i) => i.level === 'error')
console.log(`\nTotal de palabras compartidas añadidas: ${totalAdded} | errores de validación: ${issues.length}`)
for (const i of issues) console.log('ERROR', i.id, i.message)
if (issues.length) process.exit(1)

if (reportPath) writeFileSync(reportPath, report.join('\n'))
if (dry) { console.log('Simulación: no se ha escrito nada.'); process.exit(0) }
for (const p of PROFILES) writeFileSync(resolve(dir, `${p}.json`), JSON.stringify(files[p], null, 2) + '\n')
console.log('Escrito.')
