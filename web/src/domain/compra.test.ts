import { describe, expect, it } from 'vitest'
import { calcularCompra, formatoTextoCompra } from './compra'
import type { ListaCompra } from './compra'
import type { Catalogo, PlanEntry } from './types'

const catalogo: Catalogo = {
  platos: [
    { id: 1, nombre: 'Gazpacho', temporadas: ['VERANO'], etiquetas: [], notas: '', activo: true },
    { id: 2, nombre: 'Ensalada', temporadas: ['TODAS'], etiquetas: [], notas: '', activo: true }
  ],
  ingredientes: [
    { id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: [] },
    { id: 2, nombre: 'Cebolla', proveedor: 'Frutería', unidadBase: 'ud', temporadas: [] },
    { id: 3, nombre: 'Lechuga', proveedor: 'Mercadona', unidadBase: 'ud', temporadas: [] }
  ],
  ingredientesPlatos: [
    { id: 1, idPlato: 1, idIngrediente: 1, cantidad: 500, unidad: 'g' },
    { id: 2, idPlato: 1, idIngrediente: 2, cantidad: 1, unidad: 'ud' },
    { id: 3, idPlato: 2, idIngrediente: 1, cantidad: 1, unidad: 'ud' },
    { id: 4, idPlato: 2, idIngrediente: 3, cantidad: 1, unidad: 'ud' }
  ],
  reglas: [],
  proveedores: [
    { nombre: 'Frutería', orden: 1 },
    { nombre: 'Mercadona', orden: 2 }
  ]
}

function entrada(fecha: string, idPlato: number): PlanEntry {
  return { id: 1, fecha, turno: 'COMIDA', orden: 1, idPlato, notas: '' }
}

describe('calcularCompra', () => {
  it('devuelve una lista vacía si no hay plan', () => {
    expect(calcularCompra([], catalogo)).toEqual([])
  })

  it('suma cantidades del mismo ingrediente y unidad entre varios días', () => {
    const plan = [entrada('2026-09-07', 1), entrada('2026-09-08', 1)]
    const [fruteria] = calcularCompra(plan, catalogo)
    const tomate = fruteria.lineas.find((l) => l.nombre === 'Tomate')
    expect(tomate?.cantidad).toBe(1000)
  })

  it('mantiene separadas cantidades del mismo ingrediente en unidades distintas', () => {
    const plan = [entrada('2026-09-07', 1), entrada('2026-09-08', 2)]
    const [fruteria] = calcularCompra(plan, catalogo)
    const lineasTomate = fruteria.lineas.filter((l) => l.nombre === 'Tomate')
    expect(lineasTomate).toHaveLength(2)
    expect(lineasTomate.map((l) => l.unidad).sort()).toEqual(['g', 'ud'])
  })

  it('agrupa por proveedor en el orden de proveedores.orden', () => {
    const plan = [entrada('2026-09-07', 1), entrada('2026-09-08', 2)]
    const resultado = calcularCompra(plan, catalogo)
    expect(resultado.map((r) => r.proveedor)).toEqual(['Frutería', 'Mercadona'])
  })
})

describe('formatoTextoCompra', () => {
  it('agrupa por proveedor en mayúsculas con una línea por ingrediente', () => {
    const listas: ListaCompra[] = [
      {
        proveedor: 'Mercadona',
        lineas: [
          { idIngrediente: 1, nombre: 'Tomate', proveedor: 'Mercadona', cantidad: 500, unidad: 'g' },
          { idIngrediente: 2, nombre: 'Pasta', proveedor: 'Mercadona', cantidad: 2, unidad: 'paquete' }
        ]
      },
      {
        proveedor: 'Carnicería',
        lineas: [{ idIngrediente: 3, nombre: 'Pollo', proveedor: 'Carnicería', cantidad: 1, unidad: 'kg' }]
      }
    ]
    expect(formatoTextoCompra(listas)).toBe(
      'MERCADONA\n- Tomate: 500 g\n- Pasta: 2 paquete\n\nCARNICERÍA\n- Pollo: 1 kg'
    )
  })

  it('devuelve cadena vacía si no hay listas', () => {
    expect(formatoTextoCompra([])).toBe('')
  })
})
