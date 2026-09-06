import { useState } from 'react'
import type { Plato } from '../../domain/types'
import { colorVarDeEtiqueta } from '../../shared/tagColors'

export interface PlatoPickerProps {
  abierto: boolean
  tituloHueco: string
  platos: Plato[]
  onElegir: (idPlato: number) => void
  onCerrar: () => void
}

export function PlatoPicker({ abierto, tituloHueco, platos, onElegir, onCerrar }: PlatoPickerProps) {
  const [busqueda, setBusqueda] = useState('')

  if (!abierto) return null

  const filtrados = platos.filter((p) => p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-4.5 shadow-xl dark:bg-neutral-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Elegir plato · {tituloHueco}</h3>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-8.5 w-8.5 place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-700"
          >
            ×
          </button>
        </div>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar plato…"
          autoFocus
          className="w-full rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-base dark:border-neutral-600 dark:bg-neutral-900"
        />
        <div className="flex flex-col gap-2 overflow-y-auto">
          {filtrados.length === 0 && <p className="py-3.5 text-center text-sm text-neutral-400">Ningún plato coincide</p>}
          {filtrados.map((plato) => {
            const etiqueta = plato.etiquetas[0]
            const colorVar = etiqueta ? colorVarDeEtiqueta(etiqueta) : 'var(--tag-color-0)'
            return (
              <button
                key={plato.id}
                type="button"
                onClick={() => onElegir(plato.id)}
                style={{ borderLeft: `6px solid ${colorVar}` }}
                className="flex min-h-12 items-center gap-2.5 rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 p-3 text-left hover:border-amber-500 dark:border-neutral-600 dark:bg-neutral-900"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">{plato.nombre}</span>
                  {etiqueta && (
                    <span className="text-[0.7rem] font-bold uppercase" style={{ color: colorVar }}>
                      {etiqueta}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
