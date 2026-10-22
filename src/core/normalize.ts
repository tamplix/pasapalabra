/**
 * Normaliza texto para compararlo: sin tildes, minúsculas y sin signos ni espacios.
 * La «ñ» se conserva como letra propia (no se convierte en «n»).
 */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ')
    .replace(/[^a-z0-9ñ]/g, '')
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const curr = [i]
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(prev[j]! + 1, curr[j - 1]! + 1, prev[j - 1]! + cost)
    }
    prev = curr
  }
  return prev[b.length]!
}

/** Errores tipográficos tolerados según la longitud de la solución. */
export function allowedTypos(length: number): number {
  if (length >= 9) return 2
  if (length >= 6) return 1
  return 0
}

export function isCorrectAnswer(
  given: string,
  solution: string,
  aliases: readonly string[] = [],
): boolean {
  const g = normalize(given)
  if (!g) return false
  return [solution, ...aliases].some((candidate) => {
    const c = normalize(candidate)
    // La tolerancia nunca puede convertir una palabra corta en otra distinta.
    return levenshtein(g, c) <= allowedTypos(c.length)
  })
}
