import { describe, expect, it } from 'vitest'
import { joinNatural } from '../format'

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
