import { describe, expect, it } from 'vitest'
import { isToday, joinNatural, youtubeId } from '../format'

describe('joinNatural', () => {
  it('une tres o más con comas y una "y" antes del último', () => {
    expect(joinNatural(['Anna', 'Marta', 'Laura'])).toBe('Anna, Marta y Laura')
  })

  it('une dos con una sola "y", sin coma', () => {
    expect(joinNatural(['Anna', 'Marta'])).toBe('Anna y Marta')
  })

  it('deja uno solo tal cual', () => {
    expect(joinNatural(['Anna'])).toBe('Anna')
  })

  it('con la lista vacía no revienta', () => {
    expect(joinNatural([])).toBe('')
  })
})

describe('isToday', () => {
  const today = new Date(2026, 9, 16, 12, 0)

  it('vale para cualquier hora del mismo día', () => {
    expect(isToday(new Date(2026, 9, 16, 0, 5).toISOString(), today)).toBe(true)
    expect(isToday(new Date(2026, 9, 16, 23, 55).toISOString(), today)).toBe(true)
  })

  it('no vale ni ayer ni mañana', () => {
    expect(isToday(new Date(2026, 9, 15, 20, 0).toISOString(), today)).toBe(false)
    expect(isToday(new Date(2026, 9, 17, 9, 0).toISOString(), today)).toBe(false)
  })

  it('con una fecha rota no revienta', () => {
    expect(isToday('no-es-fecha', today)).toBe(false)
  })
})

describe('youtubeId', () => {
  it('saca el vídeo de los enlaces de siempre, los cortos y los de directo', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ?si=abc')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://www.youtube.com/live/dQw4w9WgXcQ?feature=share')).toBe('dQw4w9WgXcQ')
    expect(youtubeId('https://m.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('el del canal no lleva vídeo: vacío', () => {
    expect(youtubeId('https://www.youtube.com/@club/live')).toBe('')
    expect(youtubeId('https://example.com/watch?v=dQw4w9WgXcQ')).toBe('')
    expect(youtubeId('no es un enlace')).toBe('')
  })
})
