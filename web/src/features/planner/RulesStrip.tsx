import type { EstadoRegla } from '../../domain/reglas'

function etiquetaLegible(etiqueta: string): string {
  return etiqueta.charAt(0).toUpperCase() + etiqueta.slice(1)
}

function textoRegla(estado: EstadoRegla): string {
  if (estado.tipo === 'NO_CONSECUTIVO') {
    return `${etiquetaLegible(estado.etiqueta)} en días seguidos`
  }
  return `${etiquetaLegible(estado.etiqueta)} ${estado.actual}/${estado.objetivo}`
}

export function RulesStrip({ estados }: { estados: EstadoRegla[] }) {
  if (estados.length === 0) return null

  return (
    <div className="flex flex-wrap gap-2.5 px-5 pt-4" role="status">
      {estados.map((estado) => (
        <span
          key={`${estado.etiqueta}-${estado.tipo}`}
          className={
            estado.estado === 'ok'
              ? 'inline-flex items-center gap-2 rounded-full border border-green-600/30 bg-green-50 px-3.5 py-2 text-sm font-semibold text-neutral-800 dark:border-green-400/30 dark:bg-green-950 dark:text-neutral-100'
              : 'inline-flex items-center gap-2 rounded-full border border-amber-600/40 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-neutral-800 dark:border-amber-400/40 dark:bg-amber-950 dark:text-neutral-100'
          }
        >
          <span className={estado.estado === 'ok' ? 'h-2.5 w-2.5 rounded-full bg-green-600' : 'h-2.5 w-2.5 rounded-full bg-amber-600'} />
          <span>{textoRegla(estado)}</span>
          <span aria-hidden="true">{estado.estado === 'ok' ? '✓' : '⚠'}</span>
        </span>
      ))}
    </div>
  )
}
