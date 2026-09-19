export interface Sesion {
  token: string
  idUsuario: number
  nombre: string
}

const CLAVE_SESION = 'sesion'

// La sesión parseada se cachea aquí y solo se sustituye por una referencia
// nueva cuando guardarSesion/borrarSesion escriben. leerSesion() debe poder
// llamarse en cada render (useSyncExternalStore) sin producir un objeto
// distinto cada vez, o React entraría en un bucle de renders infinito.
let sesionCacheada: Sesion | null | undefined

function parsearSesionGuardada(): Sesion | null {
  try {
    const raw = localStorage.getItem(CLAVE_SESION)
    return raw ? (JSON.parse(raw) as Sesion) : null
  } catch {
    // JSON corrupto o localStorage inaccesible (modo privado, cuota): sin sesión.
    return null
  }
}

const suscriptores = new Set<() => void>()

function notificarSuscriptores(): void {
  for (const cb of suscriptores) cb()
}

export function leerSesion(): Sesion | null {
  if (sesionCacheada === undefined) {
    sesionCacheada = parsearSesionGuardada()
  }
  return sesionCacheada
}

export function guardarSesion(sesion: Sesion): void {
  sesionCacheada = sesion
  try {
    localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion))
  } catch {
    // localStorage puede fallar (modo privado, cuota agotada); la sesión
    // queda disponible en memoria para esta pestaña aunque no persista.
  }
  notificarSuscriptores()
}

export function borrarSesion(): void {
  sesionCacheada = null
  try {
    localStorage.removeItem(CLAVE_SESION)
  } catch {
    // ver comentario en guardarSesion
  }
  notificarSuscriptores()
}

export function suscribirSesion(cb: () => void): () => void {
  suscriptores.add(cb)
  return () => suscriptores.delete(cb)
}
