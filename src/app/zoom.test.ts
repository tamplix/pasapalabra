import { describe, expect, it } from 'vitest'
import { fitFontSize, fitMaxWidth, zoomEndScale, ZOOM_MAX_SCALE, ZOOM_MIN_SCALE } from './zoom'

describe('escala final del efecto de la palabra acertada', () => {
  it('las palabras cortas crecen más que las largas, para acabar ocupando lo mismo', () => {
    expect(zoomEndScale('Sol', 1440, 860)).toBeGreaterThan(zoomEndScale('Constitucionalmente', 1440, 860))
  })
  it('siempre queda entre los límites, incluso con palabras muy largas o muy cortas', () => {
    expect(zoomEndScale('Y', 1440, 860)).toBe(ZOOM_MAX_SCALE)
    expect(zoomEndScale('¿Quién quiere ser millonario? en directo y por la tele', 390, 844)).toBe(ZOOM_MIN_SCALE)
  })
  it('no falla con una palabra vacía', () => {
    expect(zoomEndScale('', 800, 600)).toBeLessThanOrEqual(ZOOM_MAX_SCALE)
  })
})

describe('tamaño del aviso de error para que la palabra quepa entera', () => {
  it('las palabras largas se reducen y las cortas no pasan del máximo', () => {
    const short = fitFontSize('Sol', 720, 1440, 860)
    const long = fitFontSize('Constitucionalmente', 720, 1440, 860)
    expect(long).toBeLessThan(short)
    expect(short).toBeLessThanOrEqual(0.16 * 860 + 0.001)
  })
  it('la palabra estimada nunca excede el ancho disponible, esté centrada o desplazada', () => {
    for (const word of ['Ñu', 'Apogeo', 'Orquesta Mondragón', '¿Quién quiere ser millonario?']) {
      for (const cx of [300, 655, 720, 1100]) {
        const px = fitFontSize(word, cx, 1440, 860)
        expect(word.length * 0.55 * px).toBeLessThanOrEqual(fitMaxWidth(cx, 1440) + 0.5)
      }
    }
  })
  it('el centro más cercano a un borde deja menos sitio', () => {
    expect(fitMaxWidth(200, 1440)).toBeLessThan(fitMaxWidth(720, 1440))
  })
  it('en una ventana estrecha el texto sigue siendo legible: nunca baja de 12 px', () => {
    expect(fitFontSize('¿Quién quiere ser millonario? en directo por la tele', 195, 390, 844)).toBeGreaterThanOrEqual(12)
    expect(fitFontSize('x'.repeat(200), 195, 390, 844)).toBe(12)
  })
})
