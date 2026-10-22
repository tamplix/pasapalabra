import { ref } from 'vue'
import { DEFAULT_ITERATIONS, hashCredentials, safeEqual } from './authHash'

/** Huella configurada con `npm run set-login` (variables VITE_LOGIN_* inyectadas al construir). */
const SALT = (import.meta.env.VITE_LOGIN_SALT as string | undefined) ?? ''
const HASH = (import.meta.env.VITE_LOGIN_HASH as string | undefined) ?? ''
const ITERATIONS = Number(import.meta.env.VITE_LOGIN_ITERATIONS) || DEFAULT_ITERATIONS

const SESSION_KEY = 'pasapalabra:session'

export const loginConfigured = Boolean(SALT && HASH)

function readSession(): boolean {
  if (!loginConfigured) return false
  try {
    const stored = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY)
    return stored !== null && safeEqual(stored, HASH)
  } catch {
    return false
  }
}

export const authenticated = ref(readSession())

/** Comprueba usuario y contraseña; si son correctos abre sesión (recordada solo si `remember`). */
export async function login(user: string, password: string, remember: boolean): Promise<boolean> {
  if (!loginConfigured) return false
  const attempt = await hashCredentials(user, password, SALT, ITERATIONS)
  if (!safeEqual(attempt, HASH)) return false
  try {
    ;(remember ? localStorage : sessionStorage).setItem(SESSION_KEY, HASH)
  } catch {
    // Sin almacenamiento: la sesión dura hasta recargar la página.
  }
  authenticated.value = true
  return true
}

export function logout() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(SESSION_KEY)
  } catch {
    // Nada que limpiar.
  }
  authenticated.value = false
}
