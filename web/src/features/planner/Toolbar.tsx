export type VistaPlanner = 'semana' | 'mes'

export interface ToolbarProps {
  rangoSemana: string
  vista: VistaPlanner
  guardando: boolean
  error: boolean
  onSemanaAnterior: () => void
  onSemanaSiguiente: () => void
  onCambiarVista: (vista: VistaPlanner) => void
}

export function Toolbar({
  rangoSemana,
  vista,
  guardando,
  error,
  onSemanaAnterior,
  onSemanaSiguiente,
  onCambiarVista
}: ToolbarProps) {
  const textoSync = error ? 'Sin conexión' : guardando ? 'Guardando…' : 'Guardado'
  const colorDot = error ? 'bg-amber-600' : guardando ? 'bg-amber-500 animate-pulse' : 'bg-green-600'

  return (
    <header className="flex items-center justify-between gap-4 rounded-b-2xl bg-neutral-900 px-5 py-3.5 text-neutral-100 shadow-lg">
      <div className="flex items-center gap-2.5">
        <button
          type="button"
          onClick={onSemanaAnterior}
          aria-label="Semana anterior"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5 text-xl hover:bg-white/10"
        >
          ‹
        </button>
        <div className="min-w-[150px] text-center">
          <span className="block text-xs uppercase tracking-wide text-white/60">Semana</span>
          <span className="text-lg font-semibold">{rangoSemana}</span>
        </div>
        <button
          type="button"
          onClick={onSemanaSiguiente}
          aria-label="Semana siguiente"
          className="grid h-11 w-11 place-items-center rounded-full border border-white/15 bg-white/5 text-xl hover:bg-white/10"
        >
          ›
        </button>
      </div>

      <div className="flex gap-0.5 rounded-full bg-white/10 p-1" role="tablist">
        {(['semana', 'mes'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={vista === v}
            onClick={() => onCambiarVista(v)}
            className={
              vista === v
                ? 'rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900'
                : 'rounded-full px-4.5 py-2 text-sm font-semibold text-white/70 hover:bg-white/10'
            }
          >
            {v === 'semana' ? 'Semana' : 'Mes'}
          </button>
        ))}
      </div>

      <span className="inline-flex min-w-[128px] items-center gap-2 rounded-full bg-white/10 py-2 pl-2.5 pr-3.5 text-sm font-semibold text-white/85">
        <span className={`h-2.5 w-2.5 rounded-full ${colorDot}`} />
        {textoSync}
      </span>
    </header>
  )
}
