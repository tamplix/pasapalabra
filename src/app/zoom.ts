/**
 * Tamaños de los efectos de la palabra del veredicto.
 *
 * Escala final del efecto «la palabra viene hacia nosotros» (acierto): suficiente para que el texto llegue a ocupar
 * unas tres veces el ancho de la pantalla, sea corta o larga la palabra.
 */
export const ZOOM_MIN_SCALE = 6
export const ZOOM_MAX_SCALE = 60
/** Tamaño de letra del efecto, como fracción de la dimensión menor de la ventana. */
export const ZOOM_FONT_RATIO = 0.07
/** Anchura media de un carácter, como fracción del tamaño de letra (tipografía gruesa y estrecha). */
const CHAR_WIDTH = 0.55

export function zoomEndScale(word: string, viewportWidth: number, viewportHeight: number): number {
  const fontSize = ZOOM_FONT_RATIO * Math.min(viewportWidth, viewportHeight)
  const textWidth = Math.max(1, word.length) * CHAR_WIDTH * fontSize
  const scale = (viewportWidth * 3) / textWidth
  return Math.round(Math.min(ZOOM_MAX_SCALE, Math.max(ZOOM_MIN_SCALE, scale)) * 10) / 10
}

/** Mayor tamaño de letra del aviso de error, como fracción de la dimensión menor de la ventana. */
export const FIT_MAX_FONT_RATIO = 0.16
/** Fracción del ancho disponible que puede ocupar la palabra, para dejar margen a los lados. */
export const FIT_WIDTH_MARGIN = 0.9

/**
 * Tamaño de letra (en px) con el que una palabra cabe entera en una sola línea, centrada en `centerX`:
 * no sobrepasa el lado más cercano de la ventana ni el máximo que se considera razonable.
 * Es una estimación por número de caracteres; el componente la corrige después midiendo el texto real.
 */
export function fitFontSize(word: string, centerX: number, viewportWidth: number, viewportHeight: number): number {
  const maxFont = FIT_MAX_FONT_RATIO * Math.min(viewportWidth, viewportHeight)
  const maxWidth = fitMaxWidth(centerX, viewportWidth)
  const byWidth = maxWidth / (Math.max(1, word.length) * CHAR_WIDTH)
  return Math.max(12, Math.min(maxFont, byWidth))
}

/** Ancho máximo que puede ocupar un texto centrado en `centerX` sin salirse de la ventana. */
export function fitMaxWidth(centerX: number, viewportWidth: number): number {
  return 2 * Math.min(centerX, viewportWidth - centerX) * FIT_WIDTH_MARGIN
}
