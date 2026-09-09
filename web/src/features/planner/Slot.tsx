import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { AsignacionSemana } from '../../domain/reglas'
import type { DestinoArrastre, OrigenArrastre } from './dragDrop'
import { DishTile } from './DishTile'

export interface SlotProps {
  asignacion: AsignacionSemana
  etiquetaHueco: string
  onAbrirPicker: () => void
  onQuitar: () => void
}

export function Slot({ asignacion, etiquetaHueco, onAbrirPicker, onQuitar }: SlotProps) {
  const destino: DestinoArrastre = { fecha: asignacion.fecha, orden: asignacion.orden }
  const { setNodeRef, isOver } = useDroppable({
    id: `hueco-${asignacion.fecha}-${asignacion.orden}`,
    data: destino
  })

  return (
    <div ref={setNodeRef} className="flex flex-1 flex-col gap-0.5">
      <span className="pl-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-neutral-500">{etiquetaHueco}</span>
      <div className={`flex flex-1 rounded-xl ${isOver ? 'ring-2 ring-amber-500' : ''}`}>
        {asignacion.plato ? (
          <DishTileArrastrable asignacion={asignacion} onQuitar={onQuitar} />
        ) : (
          <button
            type="button"
            onClick={onAbrirPicker}
            className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-neutral-300 text-sm font-semibold text-neutral-500 hover:border-amber-500 hover:bg-amber-50 hover:text-amber-800 dark:border-neutral-600 dark:hover:bg-amber-950"
          >
            <span className="text-xl font-normal leading-none">+</span>
            <span>Añadir</span>
          </button>
        )}
      </div>
    </div>
  )
}

interface DishTileArrastrableProps {
  asignacion: AsignacionSemana
  onQuitar: () => void
}

function DishTileArrastrable({ asignacion, onQuitar }: DishTileArrastrableProps) {
  const plato = asignacion.plato!
  const origen: OrigenArrastre = { tipo: 'asignado', fecha: asignacion.fecha, orden: asignacion.orden, plato }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `asignado-${asignacion.fecha}-${asignacion.orden}`,
    data: origen
  })
  const { role: _role, tabIndex: _tabIndex, ...atributosSinFoco } = attributes

  return (
    <div
      ref={setNodeRef}
      {...atributosSinFoco}
      {...listeners}
      aria-label={`Arrastrar ${plato.nombre}`}
      className="flex flex-1"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <DishTile plato={plato} fecha={asignacion.fecha} onQuitar={onQuitar} />
    </div>
  )
}
