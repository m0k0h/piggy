import { useEffect, useState } from 'react'

/** Rutas en el hash: el botón "atrás" del móvil funciona sin añadir dependencias. */
export function useRoute(): string[] {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash.replace(/^#\/?/, '').split('/').filter(Boolean)
}

export const navigate = (path: string) => {
  window.location.hash = `/${path.replace(/^\//, '')}`
  // Marca la entrada como abierta desde dentro de la app: detrás hay otra
  // pantalla nuestra a la que `goBack` puede volver.
  window.history.replaceState({ inApp: true }, '')
}

/**
 * Vuelve a la pantalla anterior. Si se ha entrado directo por un enlace (el que
 * se comparte por WhatsApp), detrás no hay nada de la app y `history.back()` no
 * haría nada o sacaría de la web: entonces va a `fallback`, sustituyendo la
 * entrada para que el "atrás" del móvil no devuelva a esta pantalla.
 */
export const goBack = (fallback: string) => {
  if ((window.history.state as { inApp?: boolean } | null)?.inApp) window.history.back()
  else window.location.replace(`#/${fallback.replace(/^\//, '')}`)
}
