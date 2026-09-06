# Dominio puro y capa de datos del frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir `web/src/domain/` (tipos, temporadas, reglas, cálculo de la compra — sin React, 100% puro) y `web/src/data/` (esquemas zod, mappers, cliente HTTP y hooks de TanStack Query) contra el contrato de la API ya confirmado en producción, sin necesidad de tocar la hoja real ni redesplegar nada.

**Architecture:** `domain/` no importa nada de `data/` ni de React — recibe objetos de dominio ya mapeados y no sabe que existe una hoja de Google detrás. `data/` traduce entre las filas crudas de la API (nombres de columna en español, todo texto/`_row`) y los tipos de dominio; valida fila a fila con zod para que una fila mal escrita a mano en la hoja no rompa toda la app — se descarta esa fila y se cuenta, el resto sigue funcionando. Los tests de `data/` usan `msw` con fixtures inspirados en los datos reales ya verificados en el plan anterior; no se necesita red real para este plan.

**Tech Stack:** TypeScript puro (`domain/`), Zod 4, TanStack Query 5, `msw` 2 + Vitest + Testing Library (`renderHook`).

**Spec:** `docs/specs/2026-09-06-menu-familiar-design.md` (sección "Arquitectura del frontend" y "API (Google Apps Script)", ya verificada end-to-end).

## Global Constraints

- `domain/` no importa React ni nada de `data/`. Solo tipos y funciones puras.
- Cada fila de la API se valida individualmente con zod; una fila inválida se descarta (no revienta el resto). Ver `parseRows` en la Task 4.
- `activo`/`activa` nunca se validan con `z.coerce.boolean()` a secas — `Boolean("false")` da `true` en JS, un fallo clásico. Se usa un preprocesador explícito (Task 4).
- `unidad`/`unidad_base` se validan como texto libre no vacío, no como enum cerrado — los datos reales de la hoja usan `"grs"` además de `"g"`, y forzar un enum estricto descartaría filas válidas.
- No se monta `QueryClientProvider` ni persistencia offline (`persistQueryClient`) en este plan — eso se conecta cuando el siguiente plan (planificador) sustituya la página de arranque de Vite por la app real. Este plan deja `queries.ts` listo para ese momento.
- No se tocan `apps-script/` ni la hoja real — este plan es enteramente frontend y offline-testeable.

---

### Task 1: Tipos de dominio y temporadas

**Files:**
- Create: `web/src/domain/types.ts`
- Create: `web/src/domain/temporadas.ts`
- Test: `web/src/domain/temporadas.test.ts`
- Delete: `web/src/domain/.gitkeep`

**Interfaces:**
- Consumes: nada
- Produces: `Temporada`, `Plato`, `Ingrediente`, `IngredientePlato`, `PlanEntry`, `Turno`, `TipoRegla`, `Regla`, `Proveedor`, `Catalogo` (usados por el resto de este plan y por el planificador); `temporadaDe(fechaIso)`, `estaEnTemporada(temporadas, fechaIso)`.

- [ ] **Step 1: Escribir `domain/types.ts`**

```typescript
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

export interface PlanEntry {
  id: number
  fecha: string
  turno: Turno
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
```

- [ ] **Step 2: Escribir el test de `temporadas.ts`**

Crear `web/src/domain/temporadas.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { estaEnTemporada, temporadaDe } from './temporadas'

describe('temporadaDe', () => {
  it('devuelve INVIERNO en enero y diciembre', () => {
    expect(temporadaDe('2026-01-15')).toBe('INVIERNO')
    expect(temporadaDe('2026-12-24')).toBe('INVIERNO')
  })

  it('devuelve VERANO en julio', () => {
    expect(temporadaDe('2026-07-01')).toBe('VERANO')
  })

  it('devuelve PRIMAVERA en abril y OTOÑO en octubre', () => {
    expect(temporadaDe('2026-04-10')).toBe('PRIMAVERA')
    expect(temporadaDe('2026-10-10')).toBe('OTOÑO')
  })
})

describe('estaEnTemporada', () => {
  it('es true si la lista está vacía (sin restricción)', () => {
    expect(estaEnTemporada([], '2026-01-15')).toBe(true)
  })

  it('es true si incluye TODAS', () => {
    expect(estaEnTemporada(['TODAS'], '2026-01-15')).toBe(true)
  })

  it('es true solo si la temporada actual está en la lista', () => {
    expect(estaEnTemporada(['VERANO'], '2026-07-15')).toBe(true)
    expect(estaEnTemporada(['VERANO'], '2026-01-15')).toBe(false)
  })

  it('admite varias temporadas', () => {
    expect(estaEnTemporada(['VERANO', 'OTOÑO'], '2026-10-01')).toBe(true)
    expect(estaEnTemporada(['VERANO', 'OTOÑO'], '2026-01-01')).toBe(false)
  })
})
```

- [ ] **Step 3: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/domain/temporadas.test.ts`
Expected: FAIL — `Cannot find module './temporadas'`

- [ ] **Step 4: Escribir `domain/temporadas.ts`**

```typescript
import type { Temporada } from './types'

const MES_A_TEMPORADA: Record<number, Temporada> = {
  1: 'INVIERNO',
  2: 'INVIERNO',
  3: 'PRIMAVERA',
  4: 'PRIMAVERA',
  5: 'PRIMAVERA',
  6: 'VERANO',
  7: 'VERANO',
  8: 'VERANO',
  9: 'OTOÑO',
  10: 'OTOÑO',
  11: 'OTOÑO',
  12: 'INVIERNO'
}

export function temporadaDe(fechaIso: string): Temporada {
  const mes = Number(fechaIso.slice(5, 7))
  return MES_A_TEMPORADA[mes]
}

export function estaEnTemporada(temporadas: Temporada[], fechaIso: string): boolean {
  if (temporadas.length === 0 || temporadas.includes('TODAS')) return true
  return temporadas.includes(temporadaDe(fechaIso))
}
```

- [ ] **Step 5: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/domain/temporadas.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Borrar el `.gitkeep` de `domain/`, ya innecesario**

```bash
git rm web/src/domain/.gitkeep
```

- [ ] **Step 7: Commit**

```bash
git add web/src/domain/types.ts web/src/domain/temporadas.ts web/src/domain/temporadas.test.ts
git commit -m "feat: tipos de dominio y cálculo de temporadas"
```

---

### Task 2: Reglas de equilibrio semanal

**Files:**
- Create: `web/src/domain/reglas.ts`
- Test: `web/src/domain/reglas.test.ts`

**Interfaces:**
- Consumes: `Plato`, `Regla` de `domain/types.ts` (Task 1)
- Produces: `AsignacionSemana`, `EstadoRegla`, `evaluarSemana(asignaciones, reglas)` — usado por la barra de chips del planificador (plan futuro).

- [ ] **Step 1: Escribir el test**

Crear `web/src/domain/reglas.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { evaluarSemana } from './reglas'
import type { AsignacionSemana } from './reglas'
import type { Plato, Regla } from './types'

function plato(nombre: string, etiquetas: string[]): Plato {
  return { id: 1, nombre, temporadas: ['TODAS'], etiquetas, notas: '', activo: true }
}

function regla(parcial: Partial<Regla>): Regla {
  return { id: 1, etiqueta: 'pasta', tipo: 'MAX_SEMANA', valor: 1, activa: true, ...parcial }
}

describe('evaluarSemana', () => {
  it('MAX_SEMANA en ok cuando no se supera el límite', () => {
    const asignaciones: AsignacionSemana[] = [
      { fecha: '2026-09-07', plato: plato('Pasta', ['pasta']) },
      { fecha: '2026-09-08', plato: plato('Ensalada', ['verdura']) }
    ]
    const [estado] = evaluarSemana(asignaciones, [regla({ tipo: 'MAX_SEMANA', valor: 1 })])
    expect(estado).toMatchObject({ actual: 1, objetivo: 1, estado: 'ok' })
  })

  it('MAX_SEMANA en aviso cuando se supera el límite', () => {
    const asignaciones: AsignacionSemana[] = [
      { fecha: '2026-09-07', plato: plato('Pasta', ['pasta']) },
      { fecha: '2026-09-09', plato: plato('Macarrones', ['pasta']) }
    ]
    const [estado] = evaluarSemana(asignaciones, [regla({ tipo: 'MAX_SEMANA', valor: 1 })])
    expect(estado).toMatchObject({ actual: 2, objetivo: 1, estado: 'aviso' })
  })

  it('MIN_SEMANA en aviso cuando no se llega al mínimo', () => {
    const asignaciones: AsignacionSemana[] = [{ fecha: '2026-09-07', plato: plato('Pasta', ['pasta']) }]
    const [estado] = evaluarSemana(asignaciones, [
      regla({ etiqueta: 'pescado', tipo: 'MIN_SEMANA', valor: 2 })
    ])
    expect(estado).toMatchObject({ actual: 0, objetivo: 2, estado: 'aviso' })
  })

  it('NO_CONSECUTIVO en aviso cuando dos días seguidos llevan la etiqueta', () => {
    const asignaciones: AsignacionSemana[] = [
      { fecha: '2026-09-07', plato: plato('Hamburguesa', ['carne']) },
      { fecha: '2026-09-08', plato: plato('Pollo', ['carne']) }
    ]
    const [estado] = evaluarSemana(asignaciones, [
      regla({ etiqueta: 'carne', tipo: 'NO_CONSECUTIVO', valor: 0 })
    ])
    expect(estado.estado).toBe('aviso')
  })

  it('NO_CONSECUTIVO en ok cuando el hueco entre fechas no es de 1 día (viernes y el lunes siguiente)', () => {
    const asignaciones: AsignacionSemana[] = [
      { fecha: '2026-09-11', plato: plato('Hamburguesa', ['carne']) }, // viernes
      { fecha: '2026-09-14', plato: plato('Pollo', ['carne']) } // lunes siguiente
    ]
    const [estado] = evaluarSemana(asignaciones, [
      regla({ etiqueta: 'carne', tipo: 'NO_CONSECUTIVO', valor: 0 })
    ])
    expect(estado.estado).toBe('ok')
  })

  it('ignora reglas inactivas', () => {
    const asignaciones: AsignacionSemana[] = [{ fecha: '2026-09-07', plato: plato('Pasta', ['pasta']) }]
    const resultado = evaluarSemana(asignaciones, [regla({ activa: false })])
    expect(resultado).toEqual([])
  })

  it('cuenta días sin plato asignado como ausencia de la etiqueta', () => {
    const asignaciones: AsignacionSemana[] = [{ fecha: '2026-09-07', plato: null }]
    const [estado] = evaluarSemana(asignaciones, [regla({ tipo: 'MAX_SEMANA', valor: 1 })])
    expect(estado.actual).toBe(0)
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/domain/reglas.test.ts`
Expected: FAIL — `Cannot find module './reglas'`

- [ ] **Step 3: Escribir `domain/reglas.ts`**

```typescript
import type { Plato, Regla } from './types'

export interface AsignacionSemana {
  fecha: string
  plato: Plato | null
}

export interface EstadoRegla {
  etiqueta: string
  tipo: Regla['tipo']
  actual: number
  objetivo: number
  estado: 'ok' | 'aviso'
}

function tienEtiqueta(asignacion: AsignacionSemana, etiqueta: string): boolean {
  return asignacion.plato !== null && asignacion.plato.etiquetas.includes(etiqueta)
}

function contarPorEtiqueta(asignaciones: AsignacionSemana[], etiqueta: string): number {
  return asignaciones.filter((a) => tienEtiqueta(a, etiqueta)).length
}

function diasEntre(fechaA: string, fechaB: string): number {
  const a = new Date(`${fechaA}T00:00:00Z`).getTime()
  const b = new Date(`${fechaB}T00:00:00Z`).getTime()
  return Math.round((b - a) / 86400000)
}

function hayConsecutivos(asignaciones: AsignacionSemana[], etiqueta: string): boolean {
  const ordenadas = [...asignaciones].sort((a, b) => a.fecha.localeCompare(b.fecha))
  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1]
    const actual = ordenadas[i]
    const sonDiaSiguiente = diasEntre(anterior.fecha, actual.fecha) === 1
    if (sonDiaSiguiente && tienEtiqueta(anterior, etiqueta) && tienEtiqueta(actual, etiqueta)) {
      return true
    }
  }
  return false
}

export function evaluarSemana(asignaciones: AsignacionSemana[], reglas: Regla[]): EstadoRegla[] {
  return reglas
    .filter((regla) => regla.activa)
    .map((regla) => {
      if (regla.tipo === 'NO_CONSECUTIVO') {
        const incumple = hayConsecutivos(asignaciones, regla.etiqueta)
        return {
          etiqueta: regla.etiqueta,
          tipo: regla.tipo,
          actual: incumple ? 1 : 0,
          objetivo: 0,
          estado: incumple ? 'aviso' : 'ok'
        }
      }
      const actual = contarPorEtiqueta(asignaciones, regla.etiqueta)
      const cumple = regla.tipo === 'MAX_SEMANA' ? actual <= regla.valor : actual >= regla.valor
      return {
        etiqueta: regla.etiqueta,
        tipo: regla.tipo,
        actual,
        objetivo: regla.valor,
        estado: cumple ? 'ok' : 'aviso'
      }
    })
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/domain/reglas.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add web/src/domain/reglas.ts web/src/domain/reglas.test.ts
git commit -m "feat: evaluación de reglas de equilibrio semanal"
```

---

### Task 3: Cálculo de la lista de la compra

**Files:**
- Create: `web/src/domain/compra.ts`
- Test: `web/src/domain/compra.test.ts`

**Interfaces:**
- Consumes: `Catalogo`, `PlanEntry` de `domain/types.ts` (Task 1)
- Produces: `LineaCompra`, `ListaCompra`, `calcularCompra(plan, catalogo)` — el caller filtra `plan` al rango de fechas deseado antes de llamar; esta función no filtra por fecha.

- [ ] **Step 1: Escribir el test**

Crear `web/src/domain/compra.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { calcularCompra } from './compra'
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
  return { id: 1, fecha, turno: 'COMIDA', idPlato, notas: '' }
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
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/domain/compra.test.ts`
Expected: FAIL — `Cannot find module './compra'`

- [ ] **Step 3: Escribir `domain/compra.ts`**

```typescript
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
      lineas: lineas.sort((a, b) => a.nombre.localeCompare(b.nombre))
    }))
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/domain/compra.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add web/src/domain/compra.ts web/src/domain/compra.test.ts
git commit -m "feat: cálculo de la lista de la compra"
```

---

### Task 4: Esquemas zod y validación tolerante fila a fila

**Files:**
- Create: `web/src/data/schemas.ts`
- Test: `web/src/data/schemas.test.ts`
- Delete: `web/src/data/.gitkeep`

**Interfaces:**
- Consumes: ninguna dependencia de dominio (los esquemas trabajan sobre las filas crudas tal cual las devuelve la API — nombres de columna en español)
- Produces: `platoRowSchema`, `ingredienteRowSchema`, `ingredientePlatoRowSchema`, `planEntryRowSchema`, `reglaRowSchema`, `proveedorRowSchema`, `bootstrapEnvelopeSchema`, `planEnvelopeSchema`, `parseRows<T>(schema, rows)` → `{valid: T[], invalid: {row, error}[]}`. Usados por `mappers.ts` (Task 5) y `queries.ts` (Task 7).

- [ ] **Step 1: Escribir el test**

Crear `web/src/data/schemas.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import {
  bootstrapEnvelopeSchema,
  ingredienteRowSchema,
  parseRows,
  platoRowSchema
} from './schemas'

describe('platoRowSchema', () => {
  it('acepta una fila real de la hoja', () => {
    const fila = {
      id_plato: 1,
      nombre: 'Gazpacho',
      temporada: 'VERANO',
      etiquetas: '',
      notas: '',
      activo: true,
      _row: 2
    }
    const resultado = platoRowSchema.safeParse(fila)
    expect(resultado.success).toBe(true)
  })

  it('interpreta correctamente activo como texto "false" (no usa Boolean() a secas)', () => {
    const resultado = platoRowSchema.safeParse({
      id_plato: 1,
      nombre: 'Test',
      temporada: 'TODAS',
      etiquetas: '',
      notas: '',
      activo: 'false'
    })
    expect(resultado.success).toBe(true)
    expect(resultado.success && resultado.data.activo).toBe(false)
  })

  it('rechaza una fila sin nombre', () => {
    const resultado = platoRowSchema.safeParse({
      id_plato: 1,
      nombre: '',
      temporada: 'TODAS',
      etiquetas: '',
      notas: '',
      activo: true
    })
    expect(resultado.success).toBe(false)
  })
})

describe('ingredienteRowSchema', () => {
  it('acepta macros vacíos (columnas todavía sin rellenar)', () => {
    const resultado = ingredienteRowSchema.safeParse({
      id_ingrediente: 1,
      nombre: 'Tomate',
      proveedor: 'Frutería/verdulería',
      unidad_base: '',
      temporada: '',
      kcal_100: '',
      prot_100: '',
      carb_100: '',
      grasa_100: ''
    })
    expect(resultado.success).toBe(true)
    expect(resultado.success && resultado.data.kcal_100).toBeUndefined()
  })
})

describe('parseRows', () => {
  it('descarta filas inválidas sin romper las válidas', () => {
    const filas = [
      { id_plato: 1, nombre: 'Gazpacho', temporada: 'VERANO', etiquetas: '', notas: '', activo: true },
      { id_plato: 2, nombre: '', temporada: 'TODAS', etiquetas: '', notas: '', activo: true }
    ]
    const { valid, invalid } = parseRows(platoRowSchema, filas)
    expect(valid).toHaveLength(1)
    expect(invalid).toHaveLength(1)
  })
})

describe('bootstrapEnvelopeSchema', () => {
  it('valida la forma general de la respuesta sin validar cada fila todavía', () => {
    const resultado = bootstrapEnvelopeSchema.safeParse({
      ok: true,
      platos: [{ cualquierCosa: true }],
      ingredientes: [],
      ingredientesPlatos: [],
      reglas: [],
      proveedores: []
    })
    expect(resultado.success).toBe(true)
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/data/schemas.test.ts`
Expected: FAIL — `Cannot find module './schemas'`

- [ ] **Step 3: Escribir `data/schemas.ts`**

```typescript
import { z } from 'zod'

const booleanFlexible = z.preprocess((valor) => {
  if (typeof valor === 'boolean') return valor
  if (typeof valor === 'string') {
    const texto = valor.trim().toLowerCase()
    return texto !== '' && texto !== 'false'
  }
  return Boolean(valor)
}, z.boolean())

const numeroOpcional = z.preprocess((valor) => {
  if (valor === '' || valor === null || valor === undefined) return undefined
  return valor
}, z.coerce.number().optional())

export const platoRowSchema = z.object({
  id_plato: z.coerce.number().int(),
  nombre: z.string().min(1),
  temporada: z.string(),
  etiquetas: z.string().default(''),
  notas: z.string().default(''),
  activo: booleanFlexible
})

export const ingredienteRowSchema = z.object({
  id_ingrediente: z.coerce.number().int(),
  nombre: z.string().min(1),
  proveedor: z.string().default(''),
  unidad_base: z.string().default(''),
  temporada: z.string().default(''),
  kcal_100: numeroOpcional,
  prot_100: numeroOpcional,
  carb_100: numeroOpcional,
  grasa_100: numeroOpcional
})

export const ingredientePlatoRowSchema = z.object({
  id: z.coerce.number().int(),
  id_plato: z.coerce.number().int(),
  id_ingrediente: z.coerce.number().int(),
  cantidad: z.coerce.number().positive(),
  unidad: z.string().min(1)
})

export const planEntryRowSchema = z.object({
  id: z.coerce.number().int(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turno: z.string().min(1),
  id_plato: z.coerce.number().int(),
  notas: z.string().default('')
})

export const reglaRowSchema = z.object({
  id: z.coerce.number().int(),
  etiqueta: z.string().min(1),
  tipo: z.enum(['MAX_SEMANA', 'MIN_SEMANA', 'NO_CONSECUTIVO']),
  valor: z.coerce.number(),
  activa: booleanFlexible
})

export const proveedorRowSchema = z.object({
  nombre: z.string().min(1),
  orden: z.coerce.number()
})

export const bootstrapEnvelopeSchema = z.object({
  ok: z.literal(true),
  platos: z.array(z.unknown()),
  ingredientes: z.array(z.unknown()),
  ingredientesPlatos: z.array(z.unknown()),
  reglas: z.array(z.unknown()),
  proveedores: z.array(z.unknown())
})

export const planEnvelopeSchema = z.object({
  ok: z.literal(true),
  entries: z.array(z.unknown())
})

export interface FilaInvalida {
  row: unknown
  error: string
}

export function parseRows<T>(
  schema: z.ZodType<T>,
  rows: unknown[]
): { valid: T[]; invalid: FilaInvalida[] } {
  const valid: T[] = []
  const invalid: FilaInvalida[] = []
  for (const row of rows) {
    const resultado = schema.safeParse(row)
    if (resultado.success) {
      valid.push(resultado.data)
    } else {
      invalid.push({ row, error: resultado.error.message })
    }
  }
  return { valid, invalid }
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/data/schemas.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Borrar el `.gitkeep` de `data/`**

```bash
git rm web/src/data/.gitkeep
```

- [ ] **Step 6: Commit**

```bash
git add web/src/data/schemas.ts web/src/data/schemas.test.ts
git commit -m "feat: esquemas zod con validación tolerante fila a fila"
```

---

### Task 5: Mappers — de fila cruda a objeto de dominio

**Files:**
- Create: `web/src/data/mappers.ts`
- Test: `web/src/data/mappers.test.ts`

**Interfaces:**
- Consumes: los esquemas de la Task 4 (vía `z.infer`) y los tipos de dominio de la Task 1
- Produces: `mapPlato`, `mapIngrediente`, `mapIngredientePlato`, `mapPlanEntry`, `mapRegla`, `mapProveedor` — usados por `queries.ts` (Task 7)

- [ ] **Step 1: Escribir el test**

Crear `web/src/data/mappers.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { mapIngrediente, mapPlato } from './mappers'

describe('mapPlato', () => {
  it('convierte temporada y etiquetas en listas, e ignora _row', () => {
    const resultado = mapPlato({
      id_plato: 1,
      nombre: 'Pasta',
      temporada: 'TODAS',
      etiquetas: 'pasta,rapido',
      notas: '',
      activo: true
    })
    expect(resultado).toEqual({
      id: 1,
      nombre: 'Pasta',
      temporadas: ['TODAS'],
      etiquetas: ['pasta', 'rapido'],
      notas: '',
      activo: true
    })
  })

  it('devuelve lista vacía de etiquetas cuando la columna está vacía', () => {
    const resultado = mapPlato({
      id_plato: 1,
      nombre: 'Ensalada',
      temporada: 'TODAS',
      etiquetas: '',
      notas: '',
      activo: true
    })
    expect(resultado.etiquetas).toEqual([])
  })
})

describe('mapIngrediente', () => {
  it('deja los macros como undefined si no había valor', () => {
    const resultado = mapIngrediente({
      id_ingrediente: 1,
      nombre: 'Tomate',
      proveedor: 'Frutería',
      unidad_base: '',
      temporada: '',
      kcal_100: undefined,
      prot_100: undefined,
      carb_100: undefined,
      grasa_100: undefined
    })
    expect(resultado.kcal100).toBeUndefined()
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/data/mappers.test.ts`
Expected: FAIL — `Cannot find module './mappers'`

- [ ] **Step 3: Escribir `data/mappers.ts`**

```typescript
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

export function mapPlato(row: z.infer<typeof platoRowSchema>): Plato {
  return {
    id: row.id_plato,
    nombre: row.nombre,
    temporadas: parseLista(row.temporada) as Temporada[],
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
    temporadas: parseLista(row.temporada) as Temporada[],
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
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/data/mappers.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add web/src/data/mappers.ts web/src/data/mappers.test.ts
git commit -m "feat: mappers de fila cruda a objeto de dominio"
```

---

### Task 6: Cliente HTTP hacia Apps Script

**Files:**
- Create: `web/src/data/sheetsClient.ts`
- Create: `web/src/test/mswServer.ts`
- Modify: `web/src/test/setup.ts`
- Test: `web/src/data/sheetsClient.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `createSheetsClient({baseUrl, token})` → `{apiGet, apiPost}`, `ApiError`. Usado por `data/client.ts` (Task 7).

- [ ] **Step 1: Configurar el servidor `msw` compartido para tests**

Crear `web/src/test/mswServer.ts`:

```typescript
import { setupServer } from 'msw/node'

export const server = setupServer()
```

Editar `web/src/test/setup.ts` (añadir a lo ya existente):

```typescript
import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './mswServer'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

- [ ] **Step 2: Escribir el test**

Crear `web/src/data/sheetsClient.test.ts`:

```typescript
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from '../test/mswServer'
import { ApiError, createSheetsClient } from './sheetsClient'

const client = createSheetsClient({ baseUrl: 'https://script.example.com/exec', token: 't0k3n' })

describe('apiGet', () => {
  it('añade action y params como query string y devuelve el JSON', async () => {
    server.use(
      http.get('https://script.example.com/exec', ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('action')).toBe('plan')
        expect(url.searchParams.get('desde')).toBe('2026-09-07')
        return HttpResponse.json({ ok: true, entries: [] })
      })
    )
    const resultado = await client.apiGet('plan', { desde: '2026-09-07', hasta: '2026-09-11' })
    expect(resultado).toEqual({ ok: true, entries: [] })
  })

  it('lanza ApiError si la API responde ok:false', async () => {
    server.use(
      http.get('https://script.example.com/exec', () => HttpResponse.json({ ok: false, error: 'boom' }))
    )
    await expect(client.apiGet('bootstrap')).rejects.toThrow(ApiError)
  })
})

describe('apiPost', () => {
  it('envía Content-Type text/plain con action, token y payload, y devuelve result', async () => {
    server.use(
      http.post('https://script.example.com/exec', async ({ request }) => {
        expect(request.headers.get('content-type')).toContain('text/plain')
        const body = (await request.json()) as { action: string; token: string; payload: unknown }
        expect(body).toEqual({ action: 'plan.set', token: 't0k3n', payload: { fecha: '2026-09-07' } })
        return HttpResponse.json({ ok: true, result: { id: 1 } })
      })
    )
    const resultado = await client.apiPost('plan.set', { fecha: '2026-09-07' })
    expect(resultado).toEqual({ id: 1 })
  })

  it('lanza ApiError si la API responde ok:false', async () => {
    server.use(
      http.post('https://script.example.com/exec', () =>
        HttpResponse.json({ ok: false, error: 'token inválido' })
      )
    )
    await expect(client.apiPost('plan.set', {})).rejects.toThrow('token inválido')
  })
})
```

- [ ] **Step 3: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/data/sheetsClient.test.ts`
Expected: FAIL — `Cannot find module './sheetsClient'`

- [ ] **Step 4: Escribir `data/sheetsClient.ts`**

```typescript
export class ApiError extends Error {}

export interface SheetsClient {
  apiGet: (action: string, params?: Record<string, string>) => Promise<unknown>
  apiPost: (action: string, payload?: unknown) => Promise<unknown>
}

export function createSheetsClient(config: { baseUrl: string; token: string }): SheetsClient {
  async function apiGet(action: string, params: Record<string, string> = {}): Promise<unknown> {
    const url = new URL(config.baseUrl)
    url.searchParams.set('action', action)
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
    const res = await fetch(url.toString())
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`)
    const json = (await res.json()) as { ok: boolean; error?: string }
    if (json.ok === false) throw new ApiError(json.error ?? 'error desconocido')
    return json
  }

  async function apiPost(action: string, payload: unknown = {}): Promise<unknown> {
    const res = await fetch(config.baseUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: config.token, payload })
    })
    if (!res.ok) throw new ApiError(`HTTP ${res.status}`)
    const json = (await res.json()) as { ok: boolean; error?: string; result?: unknown }
    if (json.ok === false) throw new ApiError(json.error ?? 'error desconocido')
    return json.result
  }

  return { apiGet, apiPost }
}
```

- [ ] **Step 5: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/data/sheetsClient.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add web/src/data/sheetsClient.ts web/src/data/sheetsClient.test.ts web/src/test/mswServer.ts web/src/test/setup.ts
git commit -m "feat: cliente HTTP hacia Apps Script con msw en tests"
```

---

### Task 7: Hooks de TanStack Query

**Files:**
- Create: `web/src/data/client.ts`
- Create: `web/src/data/queries.ts`
- Test: `web/src/data/queries.test.tsx`
- Create: `web/.env.example`
- Modify: `web/vite.config.ts` (añade `define` con valores de test para `VITE_API_URL`/`VITE_API_TOKEN`)

**Interfaces:**
- Consumes: `createSheetsClient` (Task 6), esquemas y `parseRows` (Task 4), mappers (Task 5), tipos de dominio (Task 1)
- Produces: `useCatalogo()` → `{catalogo: Catalogo, filasInvalidas: number}` envuelto en `UseQueryResult`; `usePlan(desde, hasta)` → `UseQueryResult<PlanEntry[]>`; `useSetPlanEntry()`, `useMovePlanEntry()`, `useDeletePlanEntry()` → mutaciones que invalidan `['plan']`. El planificador (plan futuro) monta el `QueryClientProvider`; este plan no lo monta.

- [ ] **Step 1: Escribir `data/client.ts`**

```typescript
import { createSheetsClient } from './sheetsClient'

export const sheetsClient = createSheetsClient({
  baseUrl: import.meta.env.VITE_API_URL,
  token: import.meta.env.VITE_API_TOKEN
})
```

- [ ] **Step 2: Escribir `web/.env.example`**

```bash
VITE_API_URL=https://script.google.com/macros/s/TU_ID_DE_DESPLIEGUE/exec
VITE_API_TOKEN=el-mismo-valor-que-API_TOKEN-en-Apps-Script
```

- [ ] **Step 3: Escribir el test de los hooks**

Crear `web/src/data/queries.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '../test/mswServer'
import { useCatalogo, useSetPlanEntry } from './queries'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useCatalogo', () => {
  it('mapea las filas válidas y cuenta las inválidas por separado', async () => {
    server.use(
      http.get(API_URL, () =>
        HttpResponse.json({
          ok: true,
          platos: [
            { id_plato: 1, nombre: 'Gazpacho', temporada: 'VERANO', etiquetas: '', notas: '', activo: true },
            { id_plato: 2, nombre: '', temporada: 'TODAS', etiquetas: '', notas: '', activo: true }
          ],
          ingredientes: [],
          ingredientesPlatos: [],
          reglas: [],
          proveedores: []
        })
      )
    )
    const { result } = renderHook(() => useCatalogo(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.catalogo.platos).toHaveLength(1)
    expect(result.current.data?.catalogo.platos[0].nombre).toBe('Gazpacho')
    expect(result.current.data?.filasInvalidas).toBe(1)
  })
})

describe('useSetPlanEntry', () => {
  it('llama a plan.set con el payload correcto', async () => {
    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { action: string; payload: unknown }
        expect(body.action).toBe('plan.set')
        expect(body.payload).toEqual({ fecha: '2026-09-07', turno: 'COMIDA', id_plato: 1, notas: '' })
        return HttpResponse.json({ ok: true, result: { id: 1 } })
      })
    )
    const { result } = renderHook(() => useSetPlanEntry(), { wrapper })
    result.current.mutate({ fecha: '2026-09-07', turno: 'COMIDA', idPlato: 1 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
```

Nota: este test requiere que `web/vite.config.ts` procese JSX en archivos `.test.tsx` — ya lo hace, usa el mismo plugin `@vitejs/plugin-react` que el resto del proyecto. Como `VITE_API_URL`/`VITE_API_TOKEN` no están definidas en el entorno de test, añadir a `web/vite.config.ts` un valor de prueba con `define` (Step 5).

- [ ] **Step 4: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/data/queries.test.tsx`
Expected: FAIL — `Cannot find module './queries'`

- [ ] **Step 5: Definir variables de entorno de test en `vite.config.ts`**

Editar `web/vite.config.ts`, añadiendo `define` dentro de `defineConfig`:

```typescript
/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(
      process.env.VITE_API_URL ?? 'https://script.example.com/exec'
    ),
    'import.meta.env.VITE_API_TOKEN': JSON.stringify(process.env.VITE_API_TOKEN ?? 'test-token')
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts']
  }
})
```

- [ ] **Step 6: Escribir `data/queries.ts`**

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Catalogo, PlanEntry, Turno } from '../domain/types'
import { sheetsClient } from './client'
import {
  bootstrapEnvelopeSchema,
  ingredientePlatoRowSchema,
  ingredienteRowSchema,
  parseRows,
  planEnvelopeSchema,
  planEntryRowSchema,
  platoRowSchema,
  proveedorRowSchema,
  reglaRowSchema
} from './schemas'
import {
  mapIngrediente,
  mapIngredientePlato,
  mapPlanEntry,
  mapPlato,
  mapProveedor,
  mapRegla
} from './mappers'

export interface CatalogoConAvisos {
  catalogo: Catalogo
  filasInvalidas: number
}

async function fetchCatalogo(): Promise<CatalogoConAvisos> {
  const raw = await sheetsClient.apiGet('bootstrap')
  const envelope = bootstrapEnvelopeSchema.parse(raw)
  const platos = parseRows(platoRowSchema, envelope.platos)
  const ingredientes = parseRows(ingredienteRowSchema, envelope.ingredientes)
  const ingredientesPlatos = parseRows(ingredientePlatoRowSchema, envelope.ingredientesPlatos)
  const reglas = parseRows(reglaRowSchema, envelope.reglas)
  const proveedores = parseRows(proveedorRowSchema, envelope.proveedores)
  return {
    catalogo: {
      platos: platos.valid.map(mapPlato),
      ingredientes: ingredientes.valid.map(mapIngrediente),
      ingredientesPlatos: ingredientesPlatos.valid.map(mapIngredientePlato),
      reglas: reglas.valid.map(mapRegla),
      proveedores: proveedores.valid.map(mapProveedor)
    },
    filasInvalidas:
      platos.invalid.length +
      ingredientes.invalid.length +
      ingredientesPlatos.invalid.length +
      reglas.invalid.length +
      proveedores.invalid.length
  }
}

export function useCatalogo() {
  return useQuery({ queryKey: ['catalogo'], queryFn: fetchCatalogo })
}

async function fetchPlan(desde: string, hasta: string): Promise<PlanEntry[]> {
  const raw = await sheetsClient.apiGet('plan', { desde, hasta })
  const envelope = planEnvelopeSchema.parse(raw)
  const { valid } = parseRows(planEntryRowSchema, envelope.entries)
  return valid.map(mapPlanEntry)
}

export function usePlan(desde: string, hasta: string) {
  return useQuery({ queryKey: ['plan', desde, hasta], queryFn: () => fetchPlan(desde, hasta) })
}

interface NuevaAsignacion {
  fecha: string
  turno: Turno
  idPlato: number
  notas?: string
}

export function useSetPlanEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (entrada: NuevaAsignacion) =>
      sheetsClient.apiPost('plan.set', {
        fecha: entrada.fecha,
        turno: entrada.turno,
        id_plato: entrada.idPlato,
        notas: entrada.notas ?? ''
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan'] })
  })
}

interface ExtremoPlan {
  fecha: string
  turno: Turno
}

export function useMovePlanEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { from: ExtremoPlan; to: ExtremoPlan }) => sheetsClient.apiPost('plan.move', args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan'] })
  })
}

export function useDeletePlanEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: ExtremoPlan) => sheetsClient.apiPost('plan.delete', args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan'] })
  })
}
```

- [ ] **Step 7: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/data/queries.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 8: Commit**

```bash
git add web/src/data/client.ts web/src/data/queries.ts web/src/data/queries.test.tsx web/.env.example web/vite.config.ts
git commit -m "feat: hooks de TanStack Query para catálogo y plan"
```

---

### Task 8: Verificación final y actualización de la spec

**Files:**
- Modify: `docs/specs/2026-09-06-menu-familiar-design.md`

**Interfaces:**
- Consumes: todo lo anterior
- Produces: sección de spec que el plan del planificador (siguiente) usará como referencia de qué hooks y funciones de dominio ya existen

- [ ] **Step 1: Verificar lint, test y build completos**

```bash
cd web
npm run lint
npm run test
npm run build
```

Expected: los tres comandos terminan sin error. El recuento de tests debe incluir los añadidos en las Tasks 1-7 (7+7+4+6+3+4+2 = 33 tests nuevos) más el test de humo existente.

- [ ] **Step 2: Añadir la sección a la spec**

Añadir al final de `docs/specs/2026-09-06-menu-familiar-design.md`:

```markdown
## Dominio y capa de datos del frontend (implementado)

`web/src/domain/` (sin React, 100% puro y testeado):
- `types.ts` — `Plato`, `Ingrediente`, `IngredientePlato`, `PlanEntry`, `Regla`, `Proveedor`, `Catalogo`.
- `temporadas.ts` — `temporadaDe(fechaIso)`, `estaEnTemporada(temporadas, fechaIso)`.
- `reglas.ts` — `evaluarSemana(asignaciones, reglas)` → `EstadoRegla[]`. Cubre `MAX_SEMANA`,
  `MIN_SEMANA` y `NO_CONSECUTIVO` (con distancia real en días, no solo orden en el array).
- `compra.ts` — `calcularCompra(plan, catalogo)` → `ListaCompra[]` agrupada por proveedor. El
  caller filtra `plan` al rango de fechas antes de llamar.

`web/src/data/`:
- `schemas.ts` — un esquema zod por pestaña + `parseRows()`, que valida fila a fila y descarta
  las inválidas sin romper el resto. `activo`/`activa` usan un preprocesador propio en vez de
  `z.coerce.boolean()` (evita el caso `Boolean("false") === true`).
- `mappers.ts` — fila cruda (columnas en español, `_row` incluido) → objeto de dominio.
- `sheetsClient.ts` — `createSheetsClient({baseUrl, token})`, POST siempre `text/plain`.
- `client.ts` — instancia única leyendo `VITE_API_URL`/`VITE_API_TOKEN` (ver `web/.env.example`).
- `queries.ts` — `useCatalogo()` (devuelve también `filasInvalidas`), `usePlan(desde, hasta)`,
  `useSetPlanEntry()`, `useMovePlanEntry()`, `useDeletePlanEntry()`.

Pendiente para el plan del planificador: montar `QueryClientProvider` (con
`persistQueryClient` + `idb-keyval` para offline) en `main.tsx`, y las mutaciones de
`plato`/`ingrediente`/`regla` para la página de catálogo.
```

- [ ] **Step 3: Commit y push**

```bash
git add docs/specs/2026-09-06-menu-familiar-design.md
git commit -m "docs: dominio y capa de datos del frontend implementados"
git push origin main
```
