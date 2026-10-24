import type { DataConnection, Peer, PeerOptions } from 'peerjs'
import { isHostMessage, isPresenterMessage, type HostMessage, type PresenterMessage } from './protocol'

/**
 * Canal entre la pantalla y el móvil del presentador, sobre WebRTC con PeerJS.
 * Solo el primer saludo pasa por el servicio público de PeerJS; después los datos van directos
 * por la red local. La librería se carga bajo demanda: si el presentador no se usa, ni se descarga.
 */

export const peerId = (code: string) => `pasapalabra-${code.toUpperCase()}`

/** Por defecto, el servicio público de PeerJS. Se puede apuntar a uno propio con variables VITE_PEER_*. */
function peerOptions(): PeerOptions {
  const env = import.meta.env
  if (!env.VITE_PEER_HOST) return {}
  return {
    host: env.VITE_PEER_HOST as string,
    port: Number(env.VITE_PEER_PORT) || 443,
    path: (env.VITE_PEER_PATH as string) || '/',
    secure: env.VITE_PEER_SECURE !== 'false',
  }
}

/* ---------- lado de la pantalla (la que manda) ---------- */

export interface HostLink {
  send(message: HostMessage): void
  onMessage(callback: (message: PresenterMessage) => void): void
  onClose(callback: () => void): void
  close(): void
}

export interface PresenterHost {
  close(): void
}

function wrapHost(conn: DataConnection): HostLink {
  let onMessage: ((m: PresenterMessage) => void) | undefined
  let onClose: (() => void) | undefined
  conn.on('data', (data) => {
    if (isPresenterMessage(data)) onMessage?.(data)
  })
  conn.on('close', () => onClose?.())
  conn.on('error', () => onClose?.())
  return {
    send: (m) => {
      if (conn.open) conn.send(m)
    },
    onMessage: (cb) => (onMessage = cb),
    onClose: (cb) => (onClose = cb),
    close: () => conn.close(),
  }
}

export async function hostPresenter(
  code: string,
  handlers: { onConnect(link: HostLink): void },
): Promise<PresenterHost> {
  const { Peer } = await import('peerjs')
  const peer = new Peer(peerId(code), peerOptions())

  await new Promise<void>((resolve, reject) => {
    peer.on('open', () => resolve())
    // «unavailable-id»: ese código aún lo tiene otra sesión (por ejemplo, tras recargar con prisa).
    peer.on('error', (e) => reject(Object.assign(new Error(e.message), { type: e.type })))
  })

  peer.on('connection', (conn) => handlers.onConnect(wrapHost(conn)))
  // Si se pierde el contacto con el servicio de saludo, se reintenta; las conexiones ya abiertas no se ven afectadas.
  peer.on('disconnected', () => {
    if (!peer.destroyed) peer.reconnect()
  })
  peer.on('error', () => {})
  return { close: () => peer.destroy() }
}

/* ---------- lado del móvil (el mando) ---------- */

export type ClientStatus = 'connecting' | 'open' | 'reconnecting'

export interface PresenterClient {
  send(message: PresenterMessage): void
  /** Fuerza una reconexión, por ejemplo al volver a encender la pantalla del móvil. */
  reconnect(): void
  close(): void
}

/** Se considera perdida la conexión si no llega nada de la pantalla en este tiempo (ella envía el estado cada segundo). */
const STALE_MS = 6000

export function connectToHost(
  code: string,
  handlers: { onStatus(status: ClientStatus): void; onMessage(message: HostMessage): void },
): PresenterClient {
  let stopped = false
  let peer: Peer | null = null
  let conn: DataConnection | null = null
  let attempt = 0
  let lastMessageAt = Date.now()
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let watchdog: ReturnType<typeof setInterval> | undefined

  function teardown() {
    clearTimeout(retryTimer)
    try { conn?.close() } catch { /* ya cerrada */ }
    try { peer?.destroy() } catch { /* ya destruido */ }
    conn = null
    peer = null
  }

  function retry() {
    if (stopped) return
    teardown()
    attempt++
    handlers.onStatus('reconnecting')
    retryTimer = setTimeout(open, Math.min(5000, 600 * attempt))
  }

  async function open() {
    if (stopped) return
    handlers.onStatus(attempt === 0 ? 'connecting' : 'reconnecting')
    const { Peer } = await import('peerjs')
    if (stopped) return
    const mine = new Peer(peerOptions())
    peer = mine
    mine.on('error', () => {
      if (peer === mine) retry()
    })
    mine.on('open', () => {
      const c = mine.connect(peerId(code), { reliable: true })
      conn = c
      // Si la conexión no llega a abrirse (pantalla aún sin preparar), se reintenta.
      const openTimer = setTimeout(() => {
        if (conn === c && !c.open) retry()
      }, 10_000)
      c.on('open', () => {
        clearTimeout(openTimer)
        attempt = 0
        lastMessageAt = Date.now()
        handlers.onStatus('open')
        c.send({ t: 'hello' } satisfies PresenterMessage)
      })
      c.on('data', (data) => {
        if (!isHostMessage(data)) return
        lastMessageAt = Date.now()
        handlers.onMessage(data)
      })
      c.on('close', () => {
        if (conn === c) retry()
      })
      c.on('error', () => {
        if (conn === c) retry()
      })
    })
  }

  watchdog = setInterval(() => {
    if (conn?.open) {
      conn.send({ t: 'ping' } satisfies PresenterMessage)
      if (Date.now() - lastMessageAt > STALE_MS) retry()
    }
  }, 2000)

  void open()

  return {
    send: (m) => {
      if (conn?.open) conn.send(m)
    },
    reconnect: () => {
      if (!stopped) retry()
    },
    close: () => {
      stopped = true
      clearInterval(watchdog)
      teardown()
    },
  }
}
