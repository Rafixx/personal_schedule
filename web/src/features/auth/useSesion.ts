import { useSyncExternalStore } from 'react'
import { leerSesion, suscribirSesion } from '../../data/session'
import type { Sesion } from '../../data/session'

// leerSesion() se pasa tal cual, sin envolverla en otra función: devuelve
// siempre la misma referencia mientras no haya un guardarSesion/borrarSesion
// de por medio (ver session.ts), que es justo lo que useSyncExternalStore
// necesita para no entrar en un bucle de renders.
export function useSesion(): Sesion | null {
  return useSyncExternalStore(suscribirSesion, leerSesion)
}
