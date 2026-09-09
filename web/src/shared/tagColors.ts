const NUM_COLORES_ETIQUETA = 7

function hashEtiqueta(etiqueta: string): number {
  let h = 0
  for (let i = 0; i < etiqueta.length; i++) h = (h * 31 + etiqueta.charCodeAt(i)) >>> 0
  return h
}

export function colorVarDeEtiqueta(etiqueta: string): string {
  const indice = hashEtiqueta(etiqueta) % NUM_COLORES_ETIQUETA
  return `var(--tag-color-${indice})`
}

// Sin etiqueta, usar el nombre del plato como clave del color en vez de un
// color fijo: dos platos sin etiquetar siguen distinguiéndose entre sí en
// vez de fundirse todos en el mismo color (lo que hoy ocurre en la hoja real,
// donde ningún plato tiene aún etiquetas).
export function colorVarDePlato(plato: { etiquetas: string[]; nombre: string }): string {
  const clave = plato.etiquetas[0] ?? plato.nombre
  return colorVarDeEtiqueta(clave)
}
