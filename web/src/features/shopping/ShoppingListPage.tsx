import { useState } from 'react'
import type { RangoCompra } from './useShoppingList'
import { useShoppingList } from './useShoppingList'
import { ProviderGroup } from './ProviderGroup'
import { formatoTextoCompra } from '../../domain/compra'
import { lunesDe } from '../../shared/semanaDates'

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
    <div className="mx-auto max-w-2xl px-5 pb-7 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
          <button
            type="button"
            onClick={() => setRango('actual')}
            aria-pressed={rango === 'actual'}
            className={
              rango === 'actual'
                ? 'rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900'
                : 'rounded-full px-4.5 py-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300'
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
                : 'rounded-full px-4.5 py-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300'
            }
          >
            La semana que viene
          </button>
        </div>
        <button
          type="button"
          onClick={copiar}
          disabled={listas.length === 0}
          className="rounded-full bg-neutral-900 px-4.5 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      {cargando && <p className="pt-6 text-center text-neutral-500">Cargando…</p>}
      {!cargando && error && (
        <p className="pt-6 text-center text-amber-700 dark:text-amber-500">
          Sin conexión — no se pudo cargar la lista de la compra.
        </p>
      )}
      {!cargando && !error && listas.length === 0 && (
        <p className="pt-6 text-center text-neutral-500">No hay platos planificados para esta semana.</p>
      )}

      <div className="flex flex-col gap-3 pt-4">
        {listas.map((lista) => (
          <ProviderGroup key={lista.proveedor} lista={lista} comprado={comprado} onMarcar={marcarComprado} />
        ))}
      </div>
    </div>
  )
}
