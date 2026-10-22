/** Huella de credenciales con PBKDF2-SHA256. Se comparte entre el navegador y el script `set-login`. */
export const DEFAULT_ITERATIONS = 250_000

const encoder = new TextEncoder()

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(hex.match(/../g) ?? [], (pair) => parseInt(pair, 16))
}

/** El usuario no distingue mayúsculas ni espacios en los extremos; la contraseña sí. */
export function normalizeUser(user: string): string {
  return user.trim().toLowerCase()
}

export function randomSaltHex(bytes = 16): string {
  return toHex(crypto.getRandomValues(new Uint8Array(bytes)).buffer)
}

export async function hashCredentials(
  user: string,
  password: string,
  saltHex: string,
  iterations: number = DEFAULT_ITERATIONS,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(`${normalizeUser(user)}\u0000${password}`),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromHex(saltHex), iterations },
    key,
    256,
  )
  return toHex(bits)
}

/** Comparación sin cortocircuito para no filtrar en qué posición difieren. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
