import type { ReactNode } from 'react'
import { useSesion } from './useSesion'
import { LoginPage } from './LoginPage'

// Puerta de acceso: sin sesión no hay app, solo login. No hay roles ni
// permisos — cualquier sesión válida ve y edita exactamente lo mismo.
export function AuthGate({ children }: { children: ReactNode }) {
  const sesion = useSesion()
  if (!sesion) return <LoginPage />
  return <>{children}</>
}
