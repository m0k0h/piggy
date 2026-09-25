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

/** Grosor máximo de un marco pegado al borde (típico de una captura) que se quita. */
const MAX_FRAME = 4

/** Parte mínima del borde que ocupa el segundo color del cuadriculado. */
const MIN_BACKGROUND_SHARE = 0.15

/** Parte del borde que tiene que ser fondo para atreverse a borrarlo. */
const MIN_BACKGROUND_COVER = 0.6

/** Gris claro o blanco, sin apenas color: los cuadros del falso "transparente". */
const lightGrey = ([r, g, b]: number[]) =>
  Math.min(r, g, b) >= 180 && Math.max(r, g, b) - Math.min(r, g, b) <= 16

/**
 * Muchos escudos llegan sin transparencia de verdad: un JPEG, un PNG con el
 * fondo blanco pintado o, muy típico de las descargas, con el cuadriculado
 * gris y blanco de "transparente" pintado dentro de la imagen. Sin arreglarlo,
 * un escudo redondo se ve sobre un cuadrado.
 *
 * 1. Se quita el marco fino que a veces rodea la imagen (una línea de un solo
 *    color pegada al borde, de hasta unos píxeles).
 * 2. El color que ocupa la mayor parte del borde que queda es el fondo. Si
 *    es el cuadriculado, sus dos grises claros.
 * 3. Se borra ese fondo desde los bordes hacia dentro, sin tocar lo que no esté
 *    conectado con ellos (el blanco de dentro del escudo se queda).
 *
 * Una imagen que ya trae el borde transparente, o sin un fondo claro, no se toca.
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
  const opaque = (i: number) => data[i + 3] >= 250
  const near = (i: number, c: number[]) =>
    Math.hypot(data[i] - c[0], data[i + 1] - c[1], data[i + 2] - c[2])

  // 1. Marco: mientras una línea del borde sea casi toda de un color (o
  //    transparente), se vacía y se mira la siguiente.
  let [left, top, right, bottom] = [0, 0, w - 1, h - 1]
  // Devuelve los píxeles del marco si la línea lo es, y si no, null. Solo se
  // vacían esos: lo que asome del escudo en esa línea se queda.
  const frameOf = (cells: number[]) => {
    // Si el 90 % de la línea es de un color, ese color sale en alguno de
    // estos tres puntos: no hace falta probar cada píxel como referencia.
    for (const ref of [cells[0], cells[cells.length >> 1], cells[cells.length - 1]]) {
      const alike = cells.filter((i) => sameAs(ref, i))
      if (alike.length >= cells.length * 0.9) return alike
    }
    return null
  }
  const sameAs = (i: number, j: number) =>
    !opaque(i) ? !opaque(j) : opaque(j) && near(j, [data[i], data[i + 1], data[i + 2]]) <= BACKGROUND_TOLERANCE
  const clear = (cells: number[] | null) => cells?.forEach((i) => (data[i + 3] = 0))
  const rowCells = (py: number) => Array.from({ length: right - left + 1 }, (_, k) => at(left + k, py))
  const colCells = (px: number) => Array.from({ length: bottom - top + 1 }, (_, k) => at(px, top + k))
  for (let pass = 0; pass < MAX_FRAME && right - left > 2 && bottom - top > 2; pass++) {
    let changed = false
    const topFrame = frameOf(rowCells(top))
    if (topFrame) {
      clear(topFrame)
      top++
      changed = true
    }
    const bottomFrame = frameOf(rowCells(bottom))
    if (bottomFrame) {
      clear(bottomFrame)
      bottom--
      changed = true
    }
    const leftFrame = frameOf(colCells(left))
    if (leftFrame) {
      clear(leftFrame)
      left++
      changed = true
    }
    const rightFrame = frameOf(colCells(right))
    if (rightFrame) {
      clear(rightFrame)
      right--
      changed = true
    }
    if (!changed) break
  }

  // 2. Colores del fondo, sacados del borde que queda.
  const border: number[] = []
  for (let px = left; px <= right; px++) border.push(at(px, top), at(px, bottom))
  for (let py = top + 1; py < bottom; py++) border.push(at(left, py), at(right, py))
  const solid = border.filter(opaque)
  // Borde casi todo transparente: la imagen ya viene bien.
  if (solid.length < border.length * 0.5) {
    context.putImageData(image, x, y)
    return
  }
  const palette: { color: number[]; count: number }[] = []
  for (const i of solid) {
    const found = palette.find((p) => near(i, p.color) <= BACKGROUND_TOLERANCE)
    if (found) found.count++
    else palette.push({ color: [data[i], data[i + 1], data[i + 2]], count: 1 })
  }
  palette.sort((a, b) => b.count - a.count)
  const [main, second] = palette
  // El fondo tiene que ser la mayor parte del borde; lo que asome del escudo
  // (que puede tocarlo en varios sitios) no llega.
  const background = [main.color]
  // Un segundo color solo si los dos son grises claros: el cuadriculado.
  if (
    second &&
    second.count >= solid.length * MIN_BACKGROUND_SHARE &&
    lightGrey(main.color) &&
    lightGrey(second.color)
  ) {
    background.push(second.color)
  }
  const covered = solid.filter((i) => background.some((c) => near(i, c) <= BACKGROUND_TOLERANCE)).length
  if (covered < solid.length * MIN_BACKGROUND_COVER) {
    context.putImageData(image, x, y)
    return
  }
  // Con cuadriculado, también los tonos de paso entre sus dos grises (el
  // borde suavizado de cada cuadro): se mide la distancia al tramo que los une.
  const distance = (i: number) => {
    if (background.length === 1) return near(i, background[0])
    const [a, b] = background
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
    const ap = [data[i] - a[0], data[i + 1] - a[1], data[i + 2] - a[2]]
    const length = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2
    const t = Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / length))
    return near(i, [a[0] + t * ab[0], a[1] + t * ab[1], a[2] + t * ab[2]])
  }

  // 3. Relleno por inundación desde todo el borde.
  const seen = new Uint8Array(w * h)
  const stack: number[] = []
  const push = (px: number, py: number) => {
    if (px < left || px > right || py < top || py > bottom) return
    const n = py * w + px
    if (seen[n]) return
    seen[n] = 1
    if (opaque(n * 4) && distance(n * 4) <= BACKGROUND_TOLERANCE) stack.push(n)
  }
  for (let px = left; px <= right; px++) {
    push(px, top)
    push(px, bottom)
  }
  for (let py = top; py <= bottom; py++) {
    push(left, py)
    push(right, py)
  }
  while (stack.length > 0) {
    const n = stack.pop()!
    // Cuanto más se parece al fondo, más transparente: el borde del escudo
    // (antialiasing) se funde en vez de quedar con un halo del color de fondo.
    const i = n * 4
    // Hasta la mitad de la tolerancia es fondo sin más (el ruido de los cuadros).
    const half = BACKGROUND_TOLERANCE / 2
    data[i + 3] = Math.round(data[i + 3] * Math.max(0, Math.min(1, (distance(i) - half) / half)))
    const px = n % w
    const py = (n - px) / w
    push(px - 1, py)
    push(px + 1, py)
    push(px, py - 1)
    push(px, py + 1)
  }
  cleanEdge(data, w, h, seen, distance)
  context.putImageData(image, x, y)
}

/**
 * Entre el escudo y el fondo borrado queda una fila de píxeles de mezcla (ni
 * fondo ni escudo) que, sobre el fondo oscuro de la app, se ve como un halo
 * claro y dentado. Se quita esa fila y la siguiente se deja a media opacidad,
 * para que el borde quede limpio y suavizado.
 */
function cleanEdge(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  seen: Uint8Array,
  distance: (i: number) => number,
) {
  // Fondo borrado: lo que el relleno visitó y dejó transparente.
  const gone = new Uint8Array(w * h)
  for (let n = 0; n < w * h; n++) {
    if (data[n * 4 + 3] === 0 || (seen[n] && distance(n * 4) <= BACKGROUND_TOLERANCE)) {
      gone[n] = 1
      // Del todo: el suavizado del borde se hace aquí abajo, no con restos del fondo.
      data[n * 4 + 3] = 0
    }
  }
  const touches = (mask: Uint8Array, n: number) => {
    const px = n % w
    return (
      (px > 0 && mask[n - 1] === 1) ||
      (px < w - 1 && mask[n + 1] === 1) ||
      (n >= w && mask[n - w] === 1) ||
      (n < w * (h - 1) && mask[n + w] === 1)
    )
  }
  const ring = (mask: Uint8Array) => {
    const out: number[] = []
    for (let n = 0; n < w * h; n++) if (!mask[n] && data[n * 4 + 3] > 0 && touches(mask, n)) out.push(n)
    return out
  }
  const halo = ring(gone)
  for (const n of halo) {
    data[n * 4 + 3] = 0
    gone[n] = 1
  }
  for (const n of ring(gone)) data[n * 4 + 3] = Math.round(data[n * 4 + 3] / 2)
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
