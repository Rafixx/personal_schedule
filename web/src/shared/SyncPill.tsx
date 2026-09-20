export interface SyncPillProps {
  guardando: boolean
  error: boolean
  onRefrescar: () => void
}

export function SyncPill({ guardando, error, onRefrescar }: SyncPillProps) {
  const texto = error ? 'Sin conexión' : guardando ? 'Guardando…' : 'Guardado'
  const colorDot = error ? 'bg-amber-600' : guardando ? 'bg-amber-500 animate-pulse' : 'bg-green-600'

  return (
    <button
      type="button"
      onClick={onRefrescar}
      aria-label="Actualizar datos de la hoja"
      className="inline-flex min-w-[128px] items-center gap-2 rounded-full bg-white/10 py-2 pl-2.5 pr-3.5 text-sm font-semibold text-white/85 hover:bg-white/20"
    >
      <span className={`h-2.5 w-2.5 rounded-full ${colorDot}`} />
      {texto}
      <span aria-hidden="true" className="ml-auto text-white/60">
        ↻
      </span>
    </button>
  )
}
