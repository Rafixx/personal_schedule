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
