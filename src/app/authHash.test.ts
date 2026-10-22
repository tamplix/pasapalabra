import { describe, expect, it } from 'vitest'
import { hashCredentials, randomSaltHex, safeEqual } from './authHash'

const salt = '00112233445566778899aabbccddeeff'

describe('huella de credenciales', () => {
  it('es determinista y de 256 bits', async () => {
    const a = await hashCredentials('Fer', 'secreta', salt, 1000)
    expect(a).toBe(await hashCredentials('Fer', 'secreta', salt, 1000))
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
  it('el usuario no distingue mayúsculas ni espacios exteriores, la contraseña sí', async () => {
    const base = await hashCredentials('fer', 'Secreta', salt, 1000)
    expect(await hashCredentials('  FER ', 'Secreta', salt, 1000)).toBe(base)
    expect(await hashCredentials('fer', 'secreta', salt, 1000)).not.toBe(base)
  })
  it('cambia con la sal, el usuario y las iteraciones', async () => {
    const base = await hashCredentials('fer', 'x', salt, 1000)
    expect(await hashCredentials('fer', 'x', randomSaltHex(), 1000)).not.toBe(base)
    expect(await hashCredentials('ana', 'x', salt, 1000)).not.toBe(base)
    expect(await hashCredentials('fer', 'x', salt, 1001)).not.toBe(base)
  })
  it('no confunde usuario y contraseña desplazando el separador', async () => {
    expect(await hashCredentials('ab', 'c', salt, 1000)).not.toBe(await hashCredentials('a', 'bc', salt, 1000))
  })
  it('safeEqual compara cadenas', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'ab')).toBe(false)
  })
})
