import { describe, expect, it } from 'vitest'
import { clearSolidBackground } from '../image'

type Pixel = [number, number, number, number]

/** Lienzo de mentira: solo lo que usa `clearSolidBackground`. */
function fakeCanvas(size: number, paint: (x: number, y: number) => Pixel) {
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) data.set(paint(x, y), (y * size + x) * 4)
  }
  const image = { data, width: size, height: size }
  const context = {
    getImageData: () => image,
    putImageData: () => {},
  } as unknown as CanvasRenderingContext2D
  const alpha = (x: number, y: number) => data[(y * size + x) * 4 + 3]
  return { context, alpha }
}

const SIZE = 40
const WHITE: Pixel = [255, 255, 255, 255]
const GREY: Pixel = [217, 217, 217, 255]
const BLACK: Pixel = [0, 0, 0, 255]
const BLUE: Pixel = [40, 120, 220, 255]
const CLEAR: Pixel = [0, 0, 0, 0]

/** Escudo redondo: anillo azul con el centro blanco, sobre el fondo que se pida. */
const crest = (background: (x: number, y: number) => Pixel) => (x: number, y: number): Pixel => {
  const d = Math.hypot(x - 20, y - 20)
  if (d < 6) return WHITE
  if (d < 16) return BLUE
  return background(x, y)
}

/** El cuadriculado de "transparente", pintado dentro de la imagen. */
const checker = (x: number, y: number) => ((Math.floor(x / 6) + Math.floor(y / 6)) % 2 ? GREY : WHITE)

const clean = (paint: (x: number, y: number) => Pixel) => {
  const canvas = fakeCanvas(SIZE, paint)
  clearSolidBackground(canvas.context, 0, 0, SIZE, SIZE)
  return canvas.alpha
}

describe('clearSolidBackground', () => {
  it('borra un fondo blanco liso y deja el interior del escudo', () => {
    const alpha = clean(crest(() => WHITE))
    expect(alpha(0, 0)).toBe(0)
    expect(alpha(39, 20)).toBe(0)
    expect(alpha(8, 20)).toBe(255) // anillo
    expect(alpha(20, 20)).toBe(255) // blanco de dentro, no conectado con el borde
  })

  it('borra el cuadriculado pintado y el marco negro de una captura', () => {
    const alpha = clean((x, y) => {
      if (x === 0) return CLEAR
      if (y === 0 || y >= SIZE - 2) return BLACK
      return crest(checker)(x, y)
    })
    expect(alpha(0, 20)).toBe(0)
    expect(alpha(20, 0)).toBe(0) // el marco
    expect(alpha(20, 39)).toBe(0)
    expect(alpha(2, 2)).toBe(0) // cuadro blanco
    expect(alpha(8, 2)).toBe(0) // cuadro gris
    expect(alpha(8, 20)).toBe(255)
    expect(alpha(20, 20)).toBe(255)
  })

  it('no toca una imagen que ya trae transparencia', () => {
    const alpha = clean(crest(() => CLEAR))
    expect(alpha(8, 20)).toBe(255)
    expect(alpha(20, 20)).toBe(255)
  })

  it('no toca una imagen sin un fondo claro (borde de muchos colores)', () => {
    const alpha = clean((x, y) => [(x * 37) % 256, (y * 53) % 256, ((x + y) * 71) % 256, 255])
    expect(alpha(1, 1)).toBe(255)
    expect(alpha(20, 5)).toBe(255)
  })
})
