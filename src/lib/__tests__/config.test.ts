import { describe, expect, it } from 'vitest'
import { normalizeSupabaseUrl } from '../config'

describe('normalizeSupabaseUrl', () => {
  it('se queda con la Project URL aunque se pegue el endpoint REST', () => {
    expect(normalizeSupabaseUrl('https://tihqomsswocpfyjmcndp.supabase.co/rest/v1/')).toBe(
      'https://tihqomsswocpfyjmcndp.supabase.co',
    )
  })

  it('también recorta el endpoint de auth o cualquier otra ruta de más', () => {
    expect(normalizeSupabaseUrl('https://proyecto.supabase.co/auth/v1')).toBe(
      'https://proyecto.supabase.co',
    )
    expect(normalizeSupabaseUrl('https://proyecto.supabase.co/algo/raro?x=1')).toBe(
      'https://proyecto.supabase.co',
    )
  })

  it('deja igual una Project URL ya limpia', () => {
    expect(normalizeSupabaseUrl('https://proyecto.supabase.co')).toBe(
      'https://proyecto.supabase.co',
    )
  })

  it('no revienta con una cadena vacía o que no es una URL', () => {
    expect(normalizeSupabaseUrl('')).toBe('')
    expect(normalizeSupabaseUrl('no es una url')).toBe('no es una url')
  })
})
