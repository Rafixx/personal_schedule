import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useLogout } from '../data/queries'
import { useSesion } from '../features/auth/useSesion'

function claseEnlace({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'border-b-2 border-sky-400 pb-0.5 text-sm font-semibold text-white'
    : 'border-b-2 border-transparent pb-0.5 text-sm font-semibold text-white/55 hover:text-white/80'
}

export function AppBar({ children }: { children?: ReactNode }) {
  const sesion = useSesion()
  const logout = useLogout()

  return (
    <header className="flex flex-wrap items-center gap-5 rounded-b-2xl bg-neutral-900 px-5 py-3.5 text-neutral-100 shadow-lg">
      <nav className="flex gap-4.5" aria-label="Navegación principal">
        <NavLink to="/" end className={claseEnlace}>
          Planificador
        </NavLink>
        <NavLink to="/compra" className={claseEnlace}>
          Compra
        </NavLink>
        <NavLink to="/catalogo" className={claseEnlace}>
          Catálogo
        </NavLink>
      </nav>
      {children}
      <div className="ml-auto flex items-center gap-3">
        {sesion && <span className="text-sm font-medium text-white/70">{sesion.nombre}</span>}
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white/85 hover:bg-white/20 disabled:opacity-50"
        >
          Salir
        </button>
      </div>
    </header>
  )
}
