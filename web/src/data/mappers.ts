import type { z } from 'zod'
import type {
  Ingrediente,
  IngredientePlato,
  PlanEntry,
  Plato,
  Proveedor,
  Regla,
  Temporada
} from '../domain/types'
import type {
  ingredientePlatoRowSchema,
  ingredienteRowSchema,
  planEntryRowSchema,
  platoRowSchema,
  proveedorRowSchema,
  reglaRowSchema
} from './schemas'

function parseLista(valor: string): string[] {
  return valor
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
}

const TEMPORADAS_VALIDAS = new Set<Temporada>(['TODAS', 'PRIMAVERA', 'VERANO', 'OTOÑO', 'INVIERNO'])

function parseTemporadas(valor: string): Temporada[] {
  return parseLista(valor)
    .map((t) => t.toUpperCase())
    .filter((t): t is Temporada => TEMPORADAS_VALIDAS.has(t as Temporada))
}

export function mapPlato(row: z.infer<typeof platoRowSchema>): Plato {
  return {
    id: row.id_plato,
    nombre: row.nombre,
    temporadas: parseTemporadas(row.temporada),
    etiquetas: parseLista(row.etiquetas),
    notas: row.notas,
    activo: row.activo
  }
}

export function mapIngrediente(row: z.infer<typeof ingredienteRowSchema>): Ingrediente {
  return {
    id: row.id_ingrediente,
    nombre: row.nombre,
    proveedor: row.proveedor,
    unidadBase: row.unidad_base,
    temporadas: parseTemporadas(row.temporada),
    kcal100: row.kcal_100,
    prot100: row.prot_100,
    carb100: row.carb_100,
    grasa100: row.grasa_100
  }
}

export function mapIngredientePlato(row: z.infer<typeof ingredientePlatoRowSchema>): IngredientePlato {
  return {
    id: row.id,
    idPlato: row.id_plato,
    idIngrediente: row.id_ingrediente,
    cantidad: row.cantidad,
    unidad: row.unidad
  }
}

export function mapPlanEntry(row: z.infer<typeof planEntryRowSchema>): PlanEntry {
  return {
    id: row.id,
    fecha: row.fecha,
    turno: row.turno as PlanEntry['turno'],
    idPlato: row.id_plato,
    notas: row.notas
  }
}

export function mapRegla(row: z.infer<typeof reglaRowSchema>): Regla {
  return {
    id: row.id,
    etiqueta: row.etiqueta,
    tipo: row.tipo,
    valor: row.valor,
    activa: row.activa
  }
}

export function mapProveedor(row: z.infer<typeof proveedorRowSchema>): Proveedor {
  return { nombre: row.nombre, orden: row.orden }
}
