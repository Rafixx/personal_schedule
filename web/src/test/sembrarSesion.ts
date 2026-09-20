import { guardarSesion } from '../data/session'
import type { Sesion } from '../data/session'

const SESION_POR_DEFECTO: Sesion = { token: 'test-token', idUsuario: 1, nombre: 'Test' }

// Helper compartido para sembrar una sesión válida en los tests que montan
// árboles detrás de AuthGate (hoy solo App.test.tsx, el único fichero que
// renderiza <App>). Los 8 ficheros que ya sembraban sesión antes de que
// existiera este helper (queries.test.tsx, useWeekPlan.test.tsx, etc.) no
// se han migrado a él: siguen con su beforeEach/afterEach inline.
export function sembrarSesion(sesion: Partial<Sesion> = {}): void {
  guardarSesion({ ...SESION_POR_DEFECTO, ...sesion })
}
