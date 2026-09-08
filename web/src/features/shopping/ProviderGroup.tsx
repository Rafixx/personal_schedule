import type { ListaCompra } from '../../domain/compra'

export interface ProviderGroupProps {
  lista: ListaCompra
  comprado: (idIngrediente: number, unidad: string) => boolean
  onMarcar: (idIngrediente: number, unidad: string, valor: boolean) => void
}

export function ProviderGroup({ lista, comprado, onMarcar }: ProviderGroupProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      <h3 className="mb-2.5 text-base font-semibold">{lista.proveedor}</h3>
      <ul className="flex flex-col gap-2">
        {lista.lineas.map((linea) => {
          const marcado = comprado(linea.idIngrediente, linea.unidad)
          return (
            <li key={`${linea.idIngrediente}-${linea.unidad}`}>
              <label className="flex min-h-11 items-center gap-2.5 rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3.5 py-2 dark:border-neutral-600 dark:bg-neutral-900">
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={(e) => onMarcar(linea.idIngrediente, linea.unidad, e.target.checked)}
                  className="h-5 w-5"
                />
                <span className={marcado ? 'text-neutral-400 line-through' : ''}>
                  {linea.nombre}: {linea.cantidad} {linea.unidad}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
