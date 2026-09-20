import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { borrarSesion, guardarSesion } from '../../data/session'
import { useSesion } from './useSesion'

afterEach(() => {
  borrarSesion()
})

describe('useSesion', () => {
  it('devuelve null si no hay sesión guardada', () => {
    const { result } = renderHook(() => useSesion())
    expect(result.current).toBeNull()
  })

  it('devuelve la sesión activa y se actualiza cuando guardarSesion escribe una nueva', () => {
    const { result } = renderHook(() => useSesion())
    act(() => guardarSesion({ token: 't1', idUsuario: 1, nombre: 'Ana' }))
    expect(result.current).toEqual({ token: 't1', idUsuario: 1, nombre: 'Ana' })
  })

  it('vuelve a null cuando borrarSesion se ejecuta', () => {
    guardarSesion({ token: 't1', idUsuario: 1, nombre: 'Ana' })
    const { result } = renderHook(() => useSesion())
    act(() => borrarSesion())
    expect(result.current).toBeNull()
  })
})
