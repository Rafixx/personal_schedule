import { useState } from 'react'
import { useIsMutating, useQueryClient } from '@tanstack/react-query'
import type { RangoCompra } from './useShoppingList'
import { semanaDeRango, useShoppingList } from './useShoppingList'
import { useMarcasCompra } from '../../data/queries'
import { ProviderGroup } from './ProviderGroup'
import { formatoTextoCompra } from '../../domain/compra'
import { lunesDe } from '../../shared/semanaDates'
import { AppBar } from '../../shared/AppBar'
import { SyncPill } from '../../shared/SyncPill'

export function ShoppingListPage() {
  const [lunesActual] = useState(() => lunesDe(new Date()))
  const [rango, setRango] = useState<RangoCompra>('actual')
  const [copiado, setCopiado] = useState(false)
  const { listas, cargando, error, comprado, marcarComprado } = useShoppingList(lunesActual, rango)

  const queryClient = useQueryClient()
  const semana = semanaDeRango(lunesActual, rango)
  // Comparte caché con la query de dentro de useShoppingList (misma clave
  // ['compra', semana]): esta segunda suscripción solo sirve para leer su
  // isFetching/isError, ya que el hook no expone esos estados para no tocar
  // su forma pública. useIsMutating (por mutationKey) detecta el envío en
  // curso de marcarComprado sin necesidad de compartir esa instancia.
  const marcasCompra = useMarcasCompra(semana)
  const marcandoCompra = useIsMutating({ mutationKey: ['compra.marcar'] }) > 0

  function refrescar() {
    queryClient.invalidateQueries({ queryKey: ['compra', semana] })
    queryClient.invalidateQueries({ queryKey: ['plan'] })
    queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  }

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
          <div className="flex items-center gap-2.5">
            <SyncPill
              guardando={marcasCompra.isFetching || marcandoCompra}
              error={marcasCompra.isError}
              onRefrescar={refrescar}
            />
            <button
              type="button"
              onClick={copiar}
              disabled={listas.length === 0}
              className="rounded-full bg-white/10 px-4.5 py-2 text-sm font-semibold text-white/85 hover:bg-white/20 disabled:opacity-40"
            >
              {copiado ? 'Copiado' : 'Copiar'}
            </button>
          </div>
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
