export type Temporada = 'TODAS' | 'PRIMAVERA' | 'VERANO' | 'OTOÑO' | 'INVIERNO'

export interface Plato {
  id: number
  nombre: string
  temporadas: Temporada[]
  etiquetas: string[]
  notas: string
  activo: boolean
}

export interface Ingrediente {
  id: number
  nombre: string
  proveedor: string
  unidadBase: string
  temporadas: Temporada[]
  kcal100?: number
  prot100?: number
  carb100?: number
  grasa100?: number
}

export interface IngredientePlato {
  id: number
  idPlato: number
  idIngrediente: number
  cantidad: number
  unidad: string
}

export type Turno = 'COMIDA'

export type Orden = 1 | 2

export interface PlanEntry {
  id: number
  fecha: string
  turno: Turno
  orden: Orden
  idPlato: number
  notas: string
}

export type TipoRegla = 'MAX_SEMANA' | 'MIN_SEMANA' | 'NO_CONSECUTIVO'

export interface Regla {
  id: number
  etiqueta: string
  tipo: TipoRegla
  valor: number
  activa: boolean
}

export interface Proveedor {
  nombre: string
  orden: number
}

export interface Catalogo {
  platos: Plato[]
  ingredientes: Ingrediente[]
  ingredientesPlatos: IngredientePlato[]
  reglas: Regla[]
  proveedores: Proveedor[]
}
