import type { Catalogo, PlanEntry } from './types'

export interface LineaCompra {
  idIngrediente: number
  nombre: string
  proveedor: string
  cantidad: number
  unidad: string
}

export interface ListaCompra {
  proveedor: string
  lineas: LineaCompra[]
}

export function calcularCompra(plan: PlanEntry[], catalogo: Catalogo): ListaCompra[] {
  const ingredientesPorId = new Map(catalogo.ingredientes.map((i) => [i.id, i]))
  const relacionesPorPlato = new Map<number, typeof catalogo.ingredientesPlatos>()
  for (const rel of catalogo.ingredientesPlatos) {
    const lista = relacionesPorPlato.get(rel.idPlato) ?? []
    lista.push(rel)
    relacionesPorPlato.set(rel.idPlato, lista)
  }

  const acumulado = new Map<string, LineaCompra>()
  for (const entrada of plan) {
    const relaciones = relacionesPorPlato.get(entrada.idPlato) ?? []
    for (const rel of relaciones) {
      const ingrediente = ingredientesPorId.get(rel.idIngrediente)
      if (!ingrediente) continue
      const clave = `${rel.idIngrediente}|${rel.unidad}`
      const existente = acumulado.get(clave)
      if (existente) {
        existente.cantidad += rel.cantidad
      } else {
        acumulado.set(clave, {
          idIngrediente: rel.idIngrediente,
          nombre: ingrediente.nombre,
          proveedor: ingrediente.proveedor,
          cantidad: rel.cantidad,
          unidad: rel.unidad
        })
      }
    }
  }

  const ordenPorProveedor = new Map(catalogo.proveedores.map((p) => [p.nombre, p.orden]))
  const porProveedor = new Map<string, LineaCompra[]>()
  for (const linea of acumulado.values()) {
    const lista = porProveedor.get(linea.proveedor) ?? []
    lista.push(linea)
    porProveedor.set(linea.proveedor, lista)
  }

  return Array.from(porProveedor.entries())
    .sort(([a], [b]) => (ordenPorProveedor.get(a) ?? Infinity) - (ordenPorProveedor.get(b) ?? Infinity))
    .map(([proveedor, lineas]) => ({
      proveedor,
      lineas: lineas.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
    }))
}

export function formatoTextoCompra(listas: ListaCompra[]): string {
  return listas
    .map((lista) => {
      const lineas = lista.lineas.map((l) => `- ${l.nombre}: ${l.cantidad} ${l.unidad}`).join('\n')
      return `${lista.proveedor.toUpperCase()}\n${lineas}`
    })
    .join('\n\n')
}
