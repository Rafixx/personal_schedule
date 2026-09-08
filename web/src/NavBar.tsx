import { NavLink } from 'react-router-dom'

function claseEnlace({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900'
    : 'rounded-full px-4.5 py-2 text-sm font-semibold text-white/70 hover:bg-white/10'
}

export function NavBar() {
  return (
    <nav className="flex justify-center gap-0.5 bg-neutral-900 p-2" aria-label="Navegación principal">
      <NavLink to="/" end className={claseEnlace}>
        Planificador
      </NavLink>
      <NavLink to="/compra" className={claseEnlace}>
        Compra
      </NavLink>
    </nav>
  )
}
