import { describe, expect, it } from 'vitest'
import { getState, publishNotice, removeNotice } from '../store'

describe('noticia de la portada', () => {
  it('solo queda la última: publicar otra sustituye a la anterior', () => {
    publishNotice('Quedamos a las 17:30', '')
    publishNotice('  Cena de equipo el viernes  ', 'data:image/jpeg;base64,xyz')
    expect(getState().team.notice).toMatchObject({
      text: 'Cena de equipo el viernes',
      image: 'data:image/jpeg;base64,xyz',
    })
  })

  it('puede ser solo texto o solo imagen, pero no vacía', () => {
    expect(publishNotice('', 'data:image/jpeg;base64,abc')?.text).toBe('')
    const before = getState().team.notice
    expect(publishNotice('   ', '')).toBeNull()
    expect(getState().team.notice).toBe(before)
  })

  it('se quita de la portada', () => {
    publishNotice('Algo', '')
    removeNotice()
    expect(getState().team.notice).toBeNull()
  })
})
