import { useState } from 'react'
import { useCatalogo } from '../../data/queries'
import { AppBar } from '../../shared/AppBar'
import { PlatoList } from './PlatoList'
import { IngredienteList } from './IngredienteList'
import { ReglaList } from './ReglaList'

type Pestaña = 'platos' | 'ingredientes' | 'reglas'

const NOMBRE_PESTAÑA: Record<Pestaña, string> = {
  platos: 'Platos',
  ingredientes: 'Ingredientes',
  reglas: 'Reglas'
}

export function CatalogPage() {
  const [pestaña, setPestaña] = useState<Pestaña>('platos')
  const catalogo = useCatalogo()

  return (
    <div className="mx-auto max-w-[1560px] pb-7">
      <AppBar>
        <div className="flex gap-0.5 rounded-full bg-white/10 p-1" role="tablist">
          {(['platos', 'ingredientes', 'reglas'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={pestaña === p}
              onClick={() => setPestaña(p)}
              className={
                pestaña === p
                  ? 'rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900'
                  : 'rounded-full px-4.5 py-2 text-sm font-semibold text-white/70 hover:bg-white/10'
              }
            >
              {NOMBRE_PESTAÑA[p]}
            </button>
          ))}
        </div>
      </AppBar>

      {catalogo.isLoading && <p className="px-5 pt-6 text-center text-neutral-500">Cargando…</p>}
      {catalogo.isError && (
        <p className="px-5 pt-6 text-center text-amber-700 dark:text-amber-500">
          Sin conexión — no se pudo cargar el catálogo.
        </p>
      )}

      {catalogo.data && (
        <div className="mx-auto max-w-3xl px-5 pt-4">
          {pestaña === 'platos' && (
            <PlatoList
              platos={catalogo.data.catalogo.platos}
              ingredientesDisponibles={catalogo.data.catalogo.ingredientes}
              ingredientesPlato={catalogo.data.catalogo.ingredientesPlatos}
            />
          )}
          {pestaña === 'ingredientes' && <IngredienteList ingredientes={catalogo.data.catalogo.ingredientes} />}
          {pestaña === 'reglas' && <ReglaList reglas={catalogo.data.catalogo.reglas} />}
        </div>
      )}
    </div>
  )
}
