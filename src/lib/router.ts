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
}

export const goBack = () => window.history.back()
