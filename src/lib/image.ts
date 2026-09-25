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

    const dataUrl = canvas.toDataURL('image/png')
    if (dataUrl.length > MAX_BYTES) throw new ImageTooBig()
    return dataUrl
  } finally {
    bitmap.close()
  }
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
