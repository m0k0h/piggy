/** Lado máximo del escudo ya reducido. */
const SIZE = 256

/** Un escudo grande hincharía la fila del equipo y con ella cada sincronización. */
export const MAX_BYTES = 200_000

export class ImageTooBig extends Error {
  constructor() {
    super('La imagen sigue pesando demasiado después de reducirla.')
  }
}

/**
 * Reduce la imagen elegida a un cuadrado de 256 px y la devuelve como data URL,
 * lista para guardarse en la fila del equipo y viajar con el resto de los datos.
 *
 * Se mantiene entera dentro del cuadrado (sin recortar) y sobre fondo
 * transparente, que es lo que quiere un escudo.
 */
export async function toLogo(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    const canvas = document.createElement('canvas')
    canvas.width = SIZE
    canvas.height = SIZE

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Este navegador no puede procesar la imagen.')

    const scale = Math.min(SIZE / bitmap.width, SIZE / bitmap.height)
    const width = bitmap.width * scale
    const height = bitmap.height * scale
    context.drawImage(bitmap, (SIZE - width) / 2, (SIZE - height) / 2, width, height)
    clearSolidBackground(context, Math.round((SIZE - width) / 2), Math.round((SIZE - height) / 2), Math.round(width), Math.round(height))

    const dataUrl = canvas.toDataURL('image/png')
    if (dataUrl.length > MAX_BYTES) throw new ImageTooBig()
    return dataUrl
  } finally {
    bitmap.close()
  }
}

/** Cuánto puede separarse un color del fondo (distancia RGB) y seguir contando como fondo. */
const BACKGROUND_TOLERANCE = 40

/**
 * Muchos escudos llegan como JPEG, o como PNG con el fondo blanco pintado: sin
 * transparencia, un escudo redondo se ve sobre un cuadrado. Si las cuatro
 * esquinas de la imagen son opacas y del mismo color, ese color es fondo: se
 * borra desde los bordes hacia dentro, sin tocar lo que no esté conectado con
 * ellos (el blanco de dentro del escudo se queda). Una imagen que ya trae
 * transparencia, o sin fondo liso, no se toca.
 *
 * `x`, `y`, `w`, `h` marcan dónde quedó la imagen dentro del lienzo.
 */
export function clearSolidBackground(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (w < 2 || h < 2) return
  const image = context.getImageData(x, y, w, h)
  const data = image.data
  const at = (px: number, py: number) => (py * w + px) * 4

  const corners = [at(0, 0), at(w - 1, 0), at(0, h - 1), at(w - 1, h - 1)]
  if (corners.some((i) => data[i + 3] < 250)) return
  const [r, g, b] = [data[corners[0]], data[corners[0] + 1], data[corners[0] + 2]]
  const distance = (i: number) =>
    Math.hypot(data[i] - r, data[i + 1] - g, data[i + 2] - b)
  if (corners.some((i) => distance(i) > BACKGROUND_TOLERANCE)) return

  // Relleno por inundación desde todo el borde.
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  const push = (px: number, py: number) => {
    const n = py * w + px
    if (seen[n]) return
    seen[n] = 1
    if (distance(n * 4) <= BACKGROUND_TOLERANCE) stack.push(n)
  }
  for (let px = 0; px < w; px++) {
    push(px, 0)
    push(px, h - 1)
  }
  for (let py = 0; py < h; py++) {
    push(0, py)
    push(w - 1, py)
  }
  while (stack.length > 0) {
    const n = stack.pop()!
    // Cuanto más se parece al fondo, más transparente: el borde del escudo
    // (antialiasing) se funde en vez de quedar con un halo del color de fondo.
    const i = n * 4
    data[i + 3] = Math.round(data[i + 3] * Math.min(1, distance(i) / BACKGROUND_TOLERANCE))
    const px = n % w
    const py = (n - px) / w
    if (px > 0) push(px - 1, py)
    if (px < w - 1) push(px + 1, py)
    if (py > 0) push(px, py - 1)
    if (py < h - 1) push(px, py + 1)
  }
  context.putImageData(image, x, y)
}

/** Lado largo máximo de una foto para la portada. */
const PHOTO_SIDE = 1080

/** La foto viaja en la fila del equipo como el escudo: mejor que no pese mucho más. */
export const MAX_PHOTO_BYTES = 400_000

/**
 * Reduce una foto para la noticia de la portada. A diferencia del escudo no se
 * mete en un cuadrado: mantiene su proporción y se guarda en JPEG, bajando la
 * calidad hasta que quepa.
 */
export async function toPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  try {
    const scale = Math.min(1, PHOTO_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const context = canvas.getContext('2d')
    if (!context) throw new Error('Este navegador no puede procesar la imagen.')
    // JPEG no tiene transparencia: sin fondo, un PNG recortado saldría en negro.
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    for (const quality of [0.82, 0.7, 0.55, 0.4]) {
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      if (dataUrl.length <= MAX_PHOTO_BYTES) return dataUrl
    }
    throw new ImageTooBig()
  } finally {
    bitmap.close()
  }
}
