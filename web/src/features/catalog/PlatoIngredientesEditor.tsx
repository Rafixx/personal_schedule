import type { Ingrediente } from '../../domain/types'

export interface LineaEditor {
  idIngrediente: number
  cantidad: number
  unidad: string
}

export interface PlatoIngredientesEditorProps {
  ingredientesDisponibles: Ingrediente[]
  lineas: LineaEditor[]
  onCambiar: (lineas: LineaEditor[]) => void
}

const CAMPO =
  'rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900'

export function PlatoIngredientesEditor({
  ingredientesDisponibles,
  lineas,
  onCambiar
}: PlatoIngredientesEditorProps) {
  function añadirLinea() {
    const primero = ingredientesDisponibles[0]
    if (!primero) return
    onCambiar([...lineas, { idIngrediente: primero.id, cantidad: 1, unidad: primero.unidadBase }])
  }

  function quitarLinea(indice: number) {
    onCambiar(lineas.filter((_, i) => i !== indice))
  }

  function actualizarLinea(indice: number, cambios: Partial<LineaEditor>) {
    onCambiar(lineas.map((linea, i) => (i === indice ? { ...linea, ...cambios } : linea)))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Ingredientes</span>
        <button
          type="button"
          onClick={añadirLinea}
          className="rounded-full bg-neutral-100 px-3.5 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-200"
        >
          + Añadir ingrediente
        </button>
      </div>
      {lineas.length === 0 && <p className="text-sm text-neutral-400">Ningún ingrediente añadido.</p>}
      {lineas.map((linea, indice) => (
        <div key={indice} className="flex items-center gap-2">
          <select
            value={linea.idIngrediente}
            onChange={(e) => actualizarLinea(indice, { idIngrediente: Number(e.target.value) })}
            className={`flex-1 ${CAMPO}`}
          >
            {ingredientesDisponibles.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.nombre}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={linea.cantidad}
            onChange={(e) => actualizarLinea(indice, { cantidad: Number(e.target.value) })}
            className={`w-20 ${CAMPO}`}
          />
          <input
            type="text"
            value={linea.unidad}
            onChange={(e) => actualizarLinea(indice, { unidad: e.target.value })}
            className={`w-20 ${CAMPO}`}
          />
          <button
            type="button"
            onClick={() => quitarLinea(indice)}
            aria-label="Quitar ingrediente"
            className="grid h-8 w-8 place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-700"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
