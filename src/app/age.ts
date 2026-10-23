import type { Profile } from '../core/types'

/** Rangos de edad (en años cumplidos, ambos incluidos) de cada perfil de palabras. */
export const PROFILE_RANGES: { profile: Profile; from: number; to: number; label: string }[] = [
  { profile: 'kids', from: 0, to: 13, label: 'Niños' },
  { profile: 'teens', from: 14, to: 22, label: 'Adolescentes' },
  { profile: 'young', from: 23, to: 38, label: 'Jóvenes' },
  { profile: 'adults', from: 39, to: Infinity, label: 'Adultos' },
]

export const MIN_BIRTH_DATE = '1900-01-01'

export function profileLabel(profile: Profile): string {
  return PROFILE_RANGES.find((r) => r.profile === profile)!.label
}

/** Fecha local de hoy como `AAAA-MM-DD`, el formato del selector de fecha. */
export function todayIso(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function parse(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return null
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(y, m - 1, d)
  // Descarta fechas que JavaScript «corrige» (31 de febrero, mes 13…).
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d ? { y, m, d } : null
}

/** Fecha válida, no futura y posterior a 1900. */
export function isValidBirthDate(iso: string, now = new Date()): boolean {
  return parse(iso) !== null && iso >= MIN_BIRTH_DATE && iso <= todayIso(now)
}

/** Años cumplidos en la fecha `now`. Devuelve null si la fecha de nacimiento no es válida. */
export function ageOn(birthDate: string, now = new Date()): number | null {
  const born = parse(birthDate)
  if (!born || !isValidBirthDate(birthDate, now)) return null
  const years = now.getFullYear() - born.y
  const birthdayPassed = now.getMonth() + 1 > born.m || (now.getMonth() + 1 === born.m && now.getDate() >= born.d)
  return birthdayPassed ? years : years - 1
}

export function profileForAge(age: number): Profile {
  return PROFILE_RANGES.find((r) => age >= r.from && age <= r.to)!.profile
}

/**
 * Perfil de palabras de un jugador: sale de su edad hoy. Los jugadores creados antes de pedir la
 * fecha de nacimiento conservan el perfil que tenían (o «adults» si no consta ninguno).
 */
export function profileOf(player: { birthDate?: string; profile?: Profile }, now = new Date()): Profile {
  const age = player.birthDate ? ageOn(player.birthDate, now) : null
  return age === null ? (player.profile ?? 'adults') : profileForAge(age)
}

/** Texto breve para listas: perfil y edad («Jóvenes, 31 años»), o aviso si aún no hay fecha de nacimiento. */
export function playerSummary(player: { birthDate?: string; profile?: Profile }, now = new Date()): string {
  const label = profileLabel(profileOf(player, now))
  const age = player.birthDate ? ageOn(player.birthDate, now) : null
  return age === null ? `${label}, sin fecha de nacimiento` : `${label}, ${age} ${age === 1 ? 'año' : 'años'}`
}
