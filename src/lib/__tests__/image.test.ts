import { describe, expect, it } from 'vitest'
import { clearSolidBackground } from '../image'

/** Lienzo de mentira: solo lo que usa `clearSolidBackground`. */
function fakeCanvas(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number]) {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) data.set(paint(x, y), (y * w + x) * 4)
  }
  const image = { data, width: w, height: h }
  const context = {
    getImageData: () => image,
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D
  const alpha = (x: number, y: number) => data[(y * w + x) * 4 + 3]
  return { context, alpha }
}

const WHITE: [number, number, number, number] = [255, 255, 255, 255]
const BLUE: [number, number, number, number] = [40, 120, 220, 255]

/** Escudo de 9×9: fondo blanco, anillo azul y el centro blanco otra vez. */
const crest = (x: number, y: number) => {
  const d = Math.max(Math.abs(x - 4), Math.abs(y - 4))
  return d >= 1 && d <= 2 ? BLUE : WHITE
}

describe('clearSolidBackground', () => {
  it('borra el fondo liso conectado con el borde y deja el interior del escudo', () => {
    const { context, alpha } = fakeCanvas(9, 9, crest)
    clearSolidBackground(context, 0, 0, 9, 9)
    expect(alpha(0, 0)).toBe(0)
    expect(alpha(8, 4)).toBe(0)
    expect(alpha(3, 4)).toBe(255) // anillo
    expect(alpha(4, 4)).toBe(255) // blanco de dentro, no conectado con el borde
  })

  it('no toca una imagen que ya trae transparencia', () => {
    const { context, alpha } = fakeCanvas(9, 9, (x, y) => (x === 0 && y === 0 ? [255, 255, 255, 0] : crest(x, y)))
    clearSolidBackground(context, 0, 0, 9, 9)
    expect(alpha(8, 8)).toBe(255)
  })

  it('no toca una imagen sin fondo liso (esquinas de colores distintos)', () => {
    const { context, alpha } = fakeCanvas(9, 9, (x, y) => (x === 8 && y === 8 ? BLUE : crest(x, y)))
    clearSolidBackground(context, 0, 0, 9, 9)
    expect(alpha(0, 0)).toBe(255)
  })
})
