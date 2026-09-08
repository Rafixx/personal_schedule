import { useState } from 'react'
import type { RangoCompra } from './useShoppingList'
import { useShoppingList } from './useShoppingList'
import { ProviderGroup } from './ProviderGroup'
import { formatoTextoCompra } from '../../domain/compra'
import { lunesDe } from '../../shared/semanaDates'
import { AppBar } from '../../shared/AppBar'

export function ShoppingListPage() {
  const [lunesActual] = useState(() => lunesDe(new Date()))
  const [rango, setRango] = useState<RangoCompra>('actual')
  const [copiado, setCopiado] = useState(false)
  const { listas, cargando, error, comprado, marcarComprado } = useShoppingList(lunesActual, rango)

  async function copiar() {
    await navigator.clipboard.writeText(formatoTextoCompra(listas))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="mx-auto max-w-[1560px] pb-7">
      <AppBar>
        <div className="flex flex-1 flex-wrap items-center justify-between gap-4">
          <div className="flex gap-0.5 rounded-full bg-white/10 p-1">
            <button
              type="button"
              onClick={() => setRango('actual')}
              aria-pressed={rango === 'actual'}
              className={
                rango === 'actual'
                  ? 'rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900'
                  : 'rounded-full px-4.5 py-2 text-sm font-semibold text-white/70 hover:bg-white/10'
              }
            >
              Esta semana
            </button>
            <button
              type="button"
              onClick={() => setRango('siguiente')}
              aria-pressed={rango === 'siguiente'}
              className={
                rango === 'siguiente'
                  ? 'rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900'
                  : 'rounded-full px-4.5 py-2 text-sm font-semibold text-white/70 hover:bg-white/10'
              }
            >
              La semana que viene
            </button>
          </div>
          <button
            type="button"
            onClick={copiar}
            disabled={listas.length === 0}
            className="rounded-full bg-white/10 px-4.5 py-2 text-sm font-semibold text-white/85 hover:bg-white/20 disabled:opacity-40"
          >
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      </AppBar>

      {cargando && <p className="px-5 pt-6 text-center text-neutral-500">Cargando…</p>}
      {!cargando && error && (
        <p className="px-5 pt-6 text-center text-amber-700 dark:text-amber-500">
          Sin conexión — no se pudo cargar la lista de la compra.
        </p>
      )}
      {!cargando && !error && listas.length === 0 && (
        <p className="px-5 pt-6 text-center text-neutral-500">No hay platos planificados para esta semana.</p>
      )}

      <div className="mx-auto flex max-w-2xl flex-col gap-3 px-5 pt-4">
        {listas.map((lista) => (
          <ProviderGroup key={lista.proveedor} lista={lista} comprado={comprado} onMarcar={marcarComprado} />
        ))}
      </div>
    </div>
  )
}
