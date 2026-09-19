import { beforeEach, describe, expect, it, vi } from 'vitest'

async function importSesion() {
  vi.resetModules()
  return import('./session')
}

beforeEach(() => {
  localStorage.clear()
})

describe('leerSesion', () => {
  it('devuelve null si no hay sesión guardada', async () => {
    const { leerSesion } = await importSesion()
    expect(leerSesion()).toBeNull()
  })

  it('devuelve la sesión guardada previamente en localStorage', async () => {
    localStorage.setItem('sesion', JSON.stringify({ token: 't1', idUsuario: 1, nombre: 'Ana' }))
    const { leerSesion } = await importSesion()
    expect(leerSesion()).toEqual({ token: 't1', idUsuario: 1, nombre: 'Ana' })
  })

  it('devuelve null y no lanza si el JSON guardado está corrupto', async () => {
    localStorage.setItem('sesion', '{esto no es json')
    const { leerSesion } = await importSesion()
    expect(leerSesion()).toBeNull()
  })

  it('devuelve null y no lanza si localStorage.getItem falla (modo privado)', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('acceso denegado')
    })
    try {
      const { leerSesion } = await importSesion()
      expect(leerSesion()).toBeNull()
    } finally {
      spy.mockRestore()
    }
  })

  it('devuelve siempre la misma referencia mientras no haya escrituras', async () => {
    localStorage.setItem('sesion', JSON.stringify({ token: 't1', idUsuario: 1, nombre: 'Ana' }))
    const { leerSesion } = await importSesion()
    const primera = leerSesion()
    const segunda = leerSesion()
    const tercera = leerSesion()
    expect(primera).toBe(segunda)
    expect(segunda).toBe(tercera)
  })
})

describe('guardarSesion', () => {
  it('persiste la sesión en localStorage y leerSesion la refleja', async () => {
    const { leerSesion, guardarSesion } = await importSesion()
    guardarSesion({ token: 't2', idUsuario: 2, nombre: 'Bea' })
    expect(JSON.parse(localStorage.getItem('sesion') as string)).toEqual({
      token: 't2',
      idUsuario: 2,
      nombre: 'Bea'
    })
    expect(leerSesion()).toEqual({ token: 't2', idUsuario: 2, nombre: 'Bea' })
  })

  it('no lanza si localStorage.setItem falla, y la sesión queda disponible en memoria', async () => {
    const { leerSesion, guardarSesion } = await importSesion()
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('cuota agotada')
    })
    try {
      expect(() => guardarSesion({ token: 't3', idUsuario: 3, nombre: 'Caz' })).not.toThrow()
      expect(leerSesion()).toEqual({ token: 't3', idUsuario: 3, nombre: 'Caz' })
    } finally {
      spy.mockRestore()
    }
  })

  it('cambia la referencia que devuelve leerSesion tras guardar', async () => {
    localStorage.setItem('sesion', JSON.stringify({ token: 't1', idUsuario: 1, nombre: 'Ana' }))
    const { leerSesion, guardarSesion } = await importSesion()
    const antes = leerSesion()
    guardarSesion({ token: 't2', idUsuario: 2, nombre: 'Bea' })
    const despues = leerSesion()
    expect(despues).not.toBe(antes)
  })

  it('notifica a los suscriptores al guardar', async () => {
    const { guardarSesion, suscribirSesion } = await importSesion()
    const cb = vi.fn()
    suscribirSesion(cb)
    guardarSesion({ token: 't2', idUsuario: 2, nombre: 'Bea' })
    expect(cb).toHaveBeenCalledTimes(1)
  })
})

describe('borrarSesion', () => {
  it('elimina la sesión de localStorage y leerSesion devuelve null', async () => {
    localStorage.setItem('sesion', JSON.stringify({ token: 't1', idUsuario: 1, nombre: 'Ana' }))
    const { leerSesion, borrarSesion } = await importSesion()
    borrarSesion()
    expect(localStorage.getItem('sesion')).toBeNull()
    expect(leerSesion()).toBeNull()
  })

  it('no lanza si localStorage.removeItem falla', async () => {
    const { borrarSesion } = await importSesion()
    const spy = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('bloqueado')
    })
    try {
      expect(() => borrarSesion()).not.toThrow()
    } finally {
      spy.mockRestore()
    }
  })

  it('notifica a los suscriptores al borrar', async () => {
    const { borrarSesion, suscribirSesion } = await importSesion()
    const cb = vi.fn()
    suscribirSesion(cb)
    borrarSesion()
    expect(cb).toHaveBeenCalledTimes(1)
  })
})

describe('suscribirSesion', () => {
  it('deja de notificar tras desuscribirse', async () => {
    const { guardarSesion, suscribirSesion } = await importSesion()
    const cb = vi.fn()
    const cancelar = suscribirSesion(cb)
    cancelar()
    guardarSesion({ token: 't2', idUsuario: 2, nombre: 'Bea' })
    expect(cb).not.toHaveBeenCalled()
  })
})
