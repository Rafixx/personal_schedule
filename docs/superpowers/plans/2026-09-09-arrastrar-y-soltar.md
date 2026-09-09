# Arrastrar y soltar en el planificador — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir arrastrar y soltar al planificador semanal — desde el Recetario a un hueco, entre dos huecos, y fuera de cualquier hueco para quitar — como capa aditiva sobre el tap que ya funciona.

**Architecture:** Una función pura (`resolverArrastre`) decide qué acción de dominio aplica a partir del origen y destino del arrastre; `@dnd-kit/core` conecta esa función con la UI vía un único `<DndContext>` en `PlannerPage`, con `DishChip`/`DishTile` envueltos como arrastrables y `Slot` como zona de destino.

**Tech Stack:** React 19, TypeScript, `@dnd-kit/core` 6.3.1 (ya instalado, primer uso real), TanStack Query v5, Vitest + Testing Library + msw.

**Spec:** `docs/specs/2026-09-06-menu-familiar-design.md`, sección "Arrastrar y soltar en el planificador (diseño)".

## Global Constraints

- `TouchSensor` con `activationConstraint: {delay: 200, tolerance: 8}`; `PointerSensor` con `activationConstraint: {distance: 8}`.
- Un único `<DndContext>` envuelve el `<main>` de `PlannerPage` que contiene `WeekBoard` y `Recetario` — el arrastre cruza de uno a otro.
- El tap sigue funcionando exactamente igual en todos los casos; el arrastre nunca es la única vía.
- `DragOverlay` muestra una copia flotante del plato; el hueco sobre el que se arrastra se resalta con `ring-2 ring-amber-500` vía `isOver`.
- No se añade ningún aviso nuevo de reglas/temporada durante el arrastre — `RulesStrip`/`DishTile` ya se recalculan en vivo tras soltar.
- La lógica de decisión de `onDragEnd` se extrae a una función pura testeable, por separado de la integración visual con `dnd-kit`, que no se simula con mocks en los tests.
- `plan.move` (backend, ya construido) resuelve tanto el intercambio (destino ocupado) como el traslado simple (destino vacío) con la misma llamada — el frontend no distingue los casos.

---

### Task 1: `dragDrop.ts` — lógica pura de decisión

**Files:**
- Create: `src/features/planner/dragDrop.ts`
- Test: `src/features/planner/dragDrop.test.ts`

**Interfaces:**
- Consumes: `Orden`, `Plato` de `../../domain/types`.
- Produces: `OrigenArrastre`, `DestinoArrastre`, `AccionArrastre`, `resolverArrastre(origen, destino)` — usados por `Recetario.tsx`, `Slot.tsx` y `PlannerPage.tsx` en las Tasks 3-5.

- [ ] **Step 1: Escribir los tests, que fallarán porque `dragDrop.ts` no existe**

`src/features/planner/dragDrop.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { resolverArrastre } from './dragDrop'
import type { Plato } from '../../domain/types'

function plato(id: number): Plato {
  return { id, nombre: `Plato ${id}`, temporadas: ['TODAS'], etiquetas: [], notas: '', activo: true }
}

describe('resolverArrastre', () => {
  it('desde el Recetario a un hueco vacío: asigna', () => {
    const accion = resolverArrastre({ tipo: 'recetario', plato: plato(5) }, { fecha: '2026-09-07', orden: 1 })
    expect(accion).toEqual({ tipo: 'asignar', fecha: '2026-09-07', orden: 1, idPlato: 5 })
  })

  it('desde el Recetario a un hueco ocupado: asigna igualmente (reemplaza)', () => {
    const accion = resolverArrastre({ tipo: 'recetario', plato: plato(5) }, { fecha: '2026-09-07', orden: 2 })
    expect(accion).toEqual({ tipo: 'asignar', fecha: '2026-09-07', orden: 2, idPlato: 5 })
  })

  it('desde el Recetario sin destino válido: no hace nada', () => {
    const accion = resolverArrastre({ tipo: 'recetario', plato: plato(5) }, null)
    expect(accion).toEqual({ tipo: 'ninguna' })
  })

  it('un plato asignado soltado fuera de cualquier hueco: quita', () => {
    const accion = resolverArrastre({ tipo: 'asignado', fecha: '2026-09-07', orden: 1, plato: plato(5) }, null)
    expect(accion).toEqual({ tipo: 'quitar', fecha: '2026-09-07', orden: 1 })
  })

  it('un plato asignado soltado sobre su propio hueco: no hace nada', () => {
    const accion = resolverArrastre(
      { tipo: 'asignado', fecha: '2026-09-07', orden: 1, plato: plato(5) },
      { fecha: '2026-09-07', orden: 1 }
    )
    expect(accion).toEqual({ tipo: 'ninguna' })
  })

  it('un plato asignado soltado sobre otro hueco: mueve', () => {
    const accion = resolverArrastre(
      { tipo: 'asignado', fecha: '2026-09-07', orden: 1, plato: plato(5) },
      { fecha: '2026-09-08', orden: 2 }
    )
    expect(accion).toEqual({
      tipo: 'mover',
      origen: { fecha: '2026-09-07', orden: 1 },
      destino: { fecha: '2026-09-08', orden: 2 }
    })
  })
})
```

- [ ] **Step 2: Confirmar que fallan**

Run: `npm test -- dragDrop`
Expected: FAIL — `Failed to resolve import "./dragDrop"`.

- [ ] **Step 3: Implementar `dragDrop.ts`**

```typescript
import type { Orden, Plato } from '../../domain/types'

export type OrigenArrastre =
  | { tipo: 'recetario'; plato: Plato }
  | { tipo: 'asignado'; fecha: string; orden: Orden; plato: Plato }

export interface DestinoArrastre {
  fecha: string
  orden: Orden
}

export type AccionArrastre =
  | { tipo: 'asignar'; fecha: string; orden: Orden; idPlato: number }
  | { tipo: 'mover'; origen: { fecha: string; orden: Orden }; destino: { fecha: string; orden: Orden } }
  | { tipo: 'quitar'; fecha: string; orden: Orden }
  | { tipo: 'ninguna' }

export function resolverArrastre(origen: OrigenArrastre, destino: DestinoArrastre | null): AccionArrastre {
  if (destino === null) {
    if (origen.tipo === 'asignado') return { tipo: 'quitar', fecha: origen.fecha, orden: origen.orden }
    return { tipo: 'ninguna' }
  }
  if (origen.tipo === 'recetario') {
    return { tipo: 'asignar', fecha: destino.fecha, orden: destino.orden, idPlato: origen.plato.id }
  }
  if (origen.fecha === destino.fecha && origen.orden === destino.orden) {
    return { tipo: 'ninguna' }
  }
  return {
    tipo: 'mover',
    origen: { fecha: origen.fecha, orden: origen.orden },
    destino: { fecha: destino.fecha, orden: destino.orden }
  }
}
```

- [ ] **Step 4: Confirmar que pasan**

Run: `npm test -- dragDrop`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/dragDrop.ts src/features/planner/dragDrop.test.ts
git commit -m "feat: lógica pura de decisión para arrastrar y soltar en el planificador"
```

---

### Task 2: `useMovePlanEntry` optimista + `moverPlato`

**Files:**
- Modify: `src/data/queries.ts:141-153` (interfaz `ExtremoPlan` y `useMovePlanEntry`)
- Modify: `src/data/queries.test.tsx` (import + nuevo `describe('useMovePlanEntry', ...)`)
- Modify: `src/features/planner/useWeekPlan.ts`
- Modify: `src/features/planner/useWeekPlan.test.tsx`

**Interfaces:**
- Consumes: patrón existente `instantaneaPlan(queryClient)` / `revertirPlan(queryClient, previas)` de `src/data/queries.ts:84-91`; `PlanEntry`, `ExtremoPlan` ya definidos.
- Produces: `useMovePlanEntry()` sigue devolviendo la mutación de siempre (sin cambio de firma pública); `useWeekPlan(lunes)` gana `moverPlato(origen: {fecha: string; orden: Orden}, destino: {fecha: string; orden: Orden}): void`, usado por `PlannerPage.tsx` en la Task 5.

- [ ] **Step 1: Escribir los tests, que fallarán**

En `src/data/queries.test.tsx`, añadir `useMovePlanEntry` a la lista de imports de `./queries` (orden alfabético, entre `useIngredienteUpsert` y `usePlatoDelete`), y añadir este bloque justo después de `describe('useSetPlanEntry', ...)` (línea 66):

```typescript
describe('useMovePlanEntry', () => {
  it('llama a plan.move con los dos extremos', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { ok: true } })
      })
    )
    const { result } = renderHook(() => useMovePlanEntry(), { wrapper })
    result.current.mutate({
      from: { fecha: '2026-09-07', turno: 'COMIDA', orden: 1 },
      to: { fecha: '2026-09-08', turno: 'COMIDA', orden: 2 }
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'plan.move',
      token: 'test-token',
      payload: {
        from: { fecha: '2026-09-07', turno: 'COMIDA', orden: 1 },
        to: { fecha: '2026-09-08', turno: 'COMIDA', orden: 2 }
      }
    })
  })
})
```

En `src/features/planner/useWeekPlan.test.tsx`, añadir este test al final del `describe('useWeekPlan', ...)`, después del test "revierte el tablero si el POST de quitarPlato falla":

```typescript
  it('moverPlato intercambia los platos de los dos huecos al instante', async () => {
    server.use(
      http.get(API_URL, ({ request }) => {
        const url = new URL(request.url)
        if (url.searchParams.get('action') === 'bootstrap') {
          return HttpResponse.json({
            ok: true,
            platos: [
              { id_plato: 5, nombre: 'Pasta', temporada: 'TODAS', etiquetas: 'pasta', notas: '', activo: true },
              { id_plato: 6, nombre: 'Pollo', temporada: 'TODAS', etiquetas: 'carne', notas: '', activo: true }
            ],
            ingredientes: [],
            ingredientesPlatos: [],
            reglas: [],
            proveedores: []
          })
        }
        return HttpResponse.json({
          ok: true,
          entries: [
            { id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 5, notas: '' },
            { id: 2, fecha: '2026-09-08', turno: 'COMIDA', orden: 2, id_plato: 6, notas: '' }
          ]
        })
      })
    )
    let resolverPost: (() => void) | undefined
    server.use(
      http.post(API_URL, async () => {
        await new Promise<void>((resolve) => {
          resolverPost = resolve
        })
        return HttpResponse.json({ ok: true, result: { ok: true } })
      })
    )
    const { result } = renderHook(() => useWeekPlan(new Date(2026, 8, 7)), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.dias[0].huecos[0].plato?.nombre).toBe('Pasta')
    expect(result.current.dias[1].huecos[1].plato?.nombre).toBe('Pollo')

    result.current.moverPlato({ fecha: '2026-09-07', orden: 1 }, { fecha: '2026-09-08', orden: 2 })

    await waitFor(() => expect(result.current.dias[0].huecos[0].plato?.nombre).toBe('Pollo'))
    expect(result.current.dias[1].huecos[1].plato?.nombre).toBe('Pasta')
    expect(resolverPost).toBeDefined()

    resolverPost?.()
    await waitFor(() => expect(result.current.guardando).toBe(false))
  })
```

- [ ] **Step 2: Confirmar que fallan**

Run: `npm test -- queries.test useWeekPlan.test`
Expected: FAIL — `useMovePlanEntry is not defined` en `queries.test.tsx`; `moverPlato is not a function` en `useWeekPlan.test.tsx`.

- [ ] **Step 3: Implementar**

En `src/data/queries.ts`, sustituir el bloque actual (líneas 141-153):

```typescript
interface ExtremoPlan {
  fecha: string
  turno: Turno
  orden: Orden
}

export function useMovePlanEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { from: ExtremoPlan; to: ExtremoPlan }) => sheetsClient.apiPost('plan.move', args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan'] })
  })
}
```

por:

```typescript
interface ExtremoPlan {
  fecha: string
  turno: Turno
  orden: Orden
}

function mismoExtremo(entrada: PlanEntry, extremo: ExtremoPlan): boolean {
  return entrada.fecha === extremo.fecha && entrada.turno === extremo.turno && entrada.orden === extremo.orden
}

export function useMovePlanEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { from: ExtremoPlan; to: ExtremoPlan }) => sheetsClient.apiPost('plan.move', args),
    retry: 2,
    onMutate: async (args) => {
      const previas = await instantaneaPlan(queryClient)
      queryClient.setQueriesData<PlanEntry[]>({ queryKey: ['plan'] }, (anteriores) => {
        if (!anteriores) return anteriores
        const entradaFrom = anteriores.find((e) => mismoExtremo(e, args.from))
        const entradaTo = anteriores.find((e) => mismoExtremo(e, args.to))
        const sinExtremos = anteriores.filter((e) => !mismoExtremo(e, args.from) && !mismoExtremo(e, args.to))
        const resultado = [...sinExtremos]
        if (entradaFrom) {
          resultado.push({ ...entradaFrom, fecha: args.to.fecha, turno: args.to.turno, orden: args.to.orden })
        }
        if (entradaTo) {
          resultado.push({ ...entradaTo, fecha: args.from.fecha, turno: args.from.turno, orden: args.from.orden })
        }
        return resultado
      })
      return { previas }
    },
    onError: (_err, _args, context) => {
      if (context) revertirPlan(queryClient, context.previas)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['plan'] })
  })
}
```

Nota: esto refleja el comportamiento real de `planMove_` en `apps-script/Codigo.gs` — si el destino no tenía entrada, el origen queda vacío (no se empuja nada para `entradaTo`); si el destino tenía entrada, se produce un intercambio completo.

En `src/features/planner/useWeekPlan.ts`, sustituir el contenido completo por:

```typescript
import type { Orden } from '../../domain/types'
import { aAsignaciones, construirSemana } from '../../domain/semana'
import { evaluarSemana } from '../../domain/reglas'
import { useCatalogo, useDeletePlanEntry, useMovePlanEntry, usePlan, useSetPlanEntry } from '../../data/queries'
import { fechasSemana } from '../../shared/semanaDates'

export function useWeekPlan(lunes: Date) {
  const fechas = fechasSemana(lunes)
  const catalogo = useCatalogo()
  const plan = usePlan(fechas[0], fechas[4])
  const setPlanEntry = useSetPlanEntry()
  const deletePlanEntry = useDeletePlanEntry()
  const movePlanEntry = useMovePlanEntry()

  const platos = catalogo.data?.catalogo.platos ?? []
  const platosActivos = platos.filter((p) => p.activo)
  const entries = plan.data ?? []
  const dias = construirSemana(fechas, entries, platos)
  const reglas = catalogo.data?.catalogo.reglas ?? []
  const estadosRegla = evaluarSemana(aAsignaciones(dias), reglas)

  function asignarPlato(fecha: string, orden: Orden, idPlato: number) {
    setPlanEntry.mutate({ fecha, turno: 'COMIDA', orden, idPlato })
  }

  function quitarPlato(fecha: string, orden: Orden) {
    deletePlanEntry.mutate({ fecha, turno: 'COMIDA', orden })
  }

  function moverPlato(origen: { fecha: string; orden: Orden }, destino: { fecha: string; orden: Orden }) {
    movePlanEntry.mutate({
      from: { fecha: origen.fecha, turno: 'COMIDA', orden: origen.orden },
      to: { fecha: destino.fecha, turno: 'COMIDA', orden: destino.orden }
    })
  }

  return {
    dias,
    estadosRegla,
    platosActivos,
    cargando: catalogo.isLoading || plan.isLoading,
    error:
      catalogo.isError || plan.isError || setPlanEntry.isError || deletePlanEntry.isError || movePlanEntry.isError,
    guardando:
      setPlanEntry.isPending || deletePlanEntry.isPending || movePlanEntry.isPending || plan.isFetching,
    asignarPlato,
    quitarPlato,
    moverPlato
  }
}
```

- [ ] **Step 4: Confirmar que pasan**

Run: `npm test -- queries.test useWeekPlan.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/data/queries.ts src/data/queries.test.tsx src/features/planner/useWeekPlan.ts src/features/planner/useWeekPlan.test.tsx
git commit -m "feat: actualización optimista para mover una entrada del plan"
```

---

### Task 3: `Recetario.tsx` — cada plato se convierte en arrastrable

**Files:**
- Modify: `src/features/planner/Recetario.tsx`
- Modify: `src/features/planner/Recetario.test.tsx`

**Interfaces:**
- Consumes: `OrigenArrastre` de `./dragDrop` (Task 1).
- Produces: cada tarjeta del Recetario es un `useDraggable` con `id: \`recetario-\${plato.id}\`` y `data: OrigenArrastre` de tipo `'recetario'`. `DishChip.tsx` no se modifica — sigue siendo el componente puramente presentacional que también usará `DragOverlay` en la Task 5.

- [ ] **Step 1: Escribir el test, que fallará**

Añadir a `src/features/planner/Recetario.test.tsx`, dentro del `describe('Recetario', ...)`:

```typescript
  it('envuelve cada plato en un elemento arrastrable', () => {
    render(<Recetario platos={[plato(1, 'Gazpacho')]} />)
    const arrastrable = screen.getByRole('button', { name: 'Arrastrar Gazpacho' })
    expect(arrastrable).toHaveAttribute('aria-roledescription', 'draggable')
  })
```

- [ ] **Step 2: Confirmar que falla**

Run: `npm test -- Recetario.test`
Expected: FAIL — no se encuentra ningún elemento con ese nombre accesible.

- [ ] **Step 3: Implementar**

Sustituir el contenido completo de `src/features/planner/Recetario.tsx` por:

```typescript
import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import type { Plato } from '../../domain/types'
import { DishChip } from './DishChip'
import type { OrigenArrastre } from './dragDrop'

export interface RecetarioProps {
  platos: Plato[]
}

export function Recetario({ platos }: RecetarioProps) {
  const [busqueda, setBusqueda] = useState('')
  const filtrados = platos.filter((p) => p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))

  return (
    <aside className="sticky top-3.5 flex max-h-[calc(100vh-200px)] flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      <div>
        <h2 className="mb-2.5 text-base font-semibold">Recetario</h2>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar plato…"
          className="w-full rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-base dark:border-neutral-600 dark:bg-neutral-900"
        />
      </div>
      <div className="flex flex-col gap-2 overflow-y-auto pr-0.5">
        {filtrados.length === 0 && <p className="py-3.5 text-center text-sm text-neutral-500">Ningún plato coincide</p>}
        {filtrados.map((plato) => (
          <DishChipArrastrable key={plato.id} plato={plato} />
        ))}
      </div>
    </aside>
  )
}

function DishChipArrastrable({ plato }: { plato: Plato }) {
  const origen: OrigenArrastre = { tipo: 'recetario', plato }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `recetario-${plato.id}`,
    data: origen
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Arrastrar ${plato.nombre}`}
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <DishChip plato={plato} />
    </div>
  )
}
```

- [ ] **Step 4: Confirmar que pasan**

Run: `npm test -- Recetario.test`
Expected: PASS — el nuevo test y los 3 existentes (que no dependen de la estructura interna del envoltorio).

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/Recetario.tsx src/features/planner/Recetario.test.tsx
git commit -m "feat: las tarjetas del Recetario son arrastrables"
```

---

### Task 4: `Slot.tsx` — zona de destino, y envuelve el plato asignado como arrastrable

**Files:**
- Modify: `src/features/planner/Slot.tsx`
- Modify: `src/features/planner/Slot.test.tsx`

**Interfaces:**
- Consumes: `OrigenArrastre`, `DestinoArrastre` de `./dragDrop` (Task 1).
- Produces: cada `Slot` es un `useDroppable` con `id: \`hueco-\${fecha}-\${orden}\`` y `data: DestinoArrastre`; cuando está ocupado, envuelve `DishTile` en un `useDraggable` con `id: \`asignado-\${fecha}-\${orden}\`` y `data: OrigenArrastre` de tipo `'asignado'`. `DishTile.tsx` no se modifica.

- [ ] **Step 1: Escribir los tests, que fallarán**

Añadir a `src/features/planner/Slot.test.tsx` (import `DndContext` de `@dnd-kit/core` al principio del archivo), dentro del `describe('Slot', ...)`:

```typescript
  it('el hueco ocupado es arrastrable', () => {
    const asignacion: AsignacionSemana = { fecha: '2026-09-07', orden: 1, plato: plato() }
    render(<Slot asignacion={asignacion} etiquetaHueco="Primero" onAbrirPicker={vi.fn()} onQuitar={vi.fn()} />)
    const arrastrable = screen.getByRole('button', { name: 'Arrastrar Pasta' })
    expect(arrastrable).toHaveAttribute('aria-roledescription', 'draggable')
  })

  it('el botón de quitar sigue funcionando envuelto en el arrastrable, dentro de un DndContext real', async () => {
    const asignacion: AsignacionSemana = { fecha: '2026-09-07', orden: 1, plato: plato() }
    const onQuitar = vi.fn()
    render(
      <DndContext>
        <Slot asignacion={asignacion} etiquetaHueco="Primero" onAbrirPicker={vi.fn()} onQuitar={onQuitar} />
      </DndContext>
    )
    await userEvent.click(screen.getByRole('button', { name: /quitar pasta/i }))
    expect(onQuitar).toHaveBeenCalledOnce()
  })

  it('el botón de añadir sigue funcionando en un hueco vacío, dentro de un DndContext real', async () => {
    const asignacion: AsignacionSemana = { fecha: '2026-09-07', orden: 2, plato: null }
    const onAbrirPicker = vi.fn()
    render(
      <DndContext>
        <Slot asignacion={asignacion} etiquetaHueco="Segundo" onAbrirPicker={onAbrirPicker} onQuitar={vi.fn()} />
      </DndContext>
    )
    await userEvent.click(screen.getByRole('button', { name: /añadir/i }))
    expect(onAbrirPicker).toHaveBeenCalledOnce()
  })
```

La función `plato()` del archivo ya devuelve `{ id: 1, nombre: 'Pasta', ... }`, así que `'Arrastrar Pasta'` y `/quitar pasta/i` coinciden con los tests existentes.

- [ ] **Step 2: Confirmar que fallan**

Run: `npm test -- Slot.test`
Expected: FAIL — no se encuentra ningún elemento con nombre accesible `'Arrastrar Pasta'`.

- [ ] **Step 3: Implementar**

Sustituir el contenido completo de `src/features/planner/Slot.tsx` por:

```typescript
import { useDraggable, useDroppable } from '@dnd-kit/core'
import type { AsignacionSemana } from '../../domain/reglas'
import type { DestinoArrastre, OrigenArrastre } from './dragDrop'
import { DishTile } from './DishTile'

export interface SlotProps {
  asignacion: AsignacionSemana
  etiquetaHueco: string
  onAbrirPicker: () => void
  onQuitar: () => void
}

export function Slot({ asignacion, etiquetaHueco, onAbrirPicker, onQuitar }: SlotProps) {
  const destino: DestinoArrastre = { fecha: asignacion.fecha, orden: asignacion.orden }
  const { setNodeRef, isOver } = useDroppable({
    id: `hueco-${asignacion.fecha}-${asignacion.orden}`,
    data: destino
  })

  return (
    <div ref={setNodeRef} className="flex flex-1 flex-col gap-0.5">
      <span className="pl-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-neutral-500">{etiquetaHueco}</span>
      <div className={`flex flex-1 rounded-xl ${isOver ? 'ring-2 ring-amber-500' : ''}`}>
        {asignacion.plato ? (
          <DishTileArrastrable asignacion={asignacion} onQuitar={onQuitar} />
        ) : (
          <button
            type="button"
            onClick={onAbrirPicker}
            className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-neutral-300 text-sm font-semibold text-neutral-500 hover:border-amber-500 hover:bg-amber-50 hover:text-amber-800 dark:border-neutral-600 dark:hover:bg-amber-950"
          >
            <span className="text-xl font-normal leading-none">+</span>
            <span>Añadir</span>
          </button>
        )}
      </div>
    </div>
  )
}

interface DishTileArrastrableProps {
  asignacion: AsignacionSemana
  onQuitar: () => void
}

function DishTileArrastrable({ asignacion, onQuitar }: DishTileArrastrableProps) {
  const plato = asignacion.plato
  if (!plato) return null
  const origen: OrigenArrastre = { tipo: 'asignado', fecha: asignacion.fecha, orden: asignacion.orden, plato }
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `asignado-${asignacion.fecha}-${asignacion.orden}`,
    data: origen
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      aria-label={`Arrastrar ${plato.nombre}`}
      className="flex flex-1"
      style={{ opacity: isDragging ? 0.4 : 1 }}
    >
      <DishTile plato={plato} fecha={asignacion.fecha} onQuitar={onQuitar} />
    </div>
  )
}
```

- [ ] **Step 4: Confirmar que pasan**

Run: `npm test -- Slot.test`
Expected: PASS — los 3 nuevos tests y los 4 existentes.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/Slot.tsx src/features/planner/Slot.test.tsx
git commit -m "feat: los huecos del planificador son zona de destino del arrastre"
```

---

### Task 5: `PlannerPage.tsx` — `DndContext`, sensores, `DragOverlay` y `onDragEnd`

**Files:**
- Modify: `src/features/planner/PlannerPage.tsx`
- Create: `src/features/planner/PlannerPage.test.tsx`

**Interfaces:**
- Consumes: `resolverArrastre`, `OrigenArrastre`, `DestinoArrastre` de `./dragDrop` (Task 1); `semana.asignarPlato`, `semana.moverPlato`, `semana.quitarPlato` de `useWeekPlan` (ya existente + Task 2); `DishChip` para el `DragOverlay`.
- Produces: ningún cambio en `PlannerPageProps` (sigue siendo `{lunes, setLunes, vista, setVista}`).

- [ ] **Step 1: Escribir el test, que fallará porque el archivo no existe**

Crear `src/features/planner/PlannerPage.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import { PlannerPage } from './PlannerPage'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function mockPlanner() {
  server.use(
    http.get(API_URL, ({ request }) => {
      const url = new URL(request.url)
      if (url.searchParams.get('action') === 'bootstrap') {
        return HttpResponse.json({
          ok: true,
          platos: [{ id_plato: 5, nombre: 'Pasta', temporada: 'TODAS', etiquetas: 'pasta', notas: '', activo: true }],
          ingredientes: [],
          ingredientesPlatos: [],
          reglas: [],
          proveedores: []
        })
      }
      return HttpResponse.json({
        ok: true,
        entries: [{ id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 5, notas: '' }]
      })
    })
  )
}

describe('PlannerPage', () => {
  it('monta WeekBoard y Recetario juntos dentro del planificador', async () => {
    mockPlanner()
    render(
      <PlannerPage lunes={new Date(2026, 8, 7)} setLunes={vi.fn()} vista="semana" setVista={vi.fn()} />,
      { wrapper }
    )
    await screen.findByRole('region', { name: 'Días de la semana' })
    expect(screen.getByRole('heading', { name: 'Recetario' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Confirmar que falla**

Run: `npm test -- PlannerPage.test`
Expected: PASS ya en este punto para el montaje básico (el componente ya existe y ya monta ambos), pero conviene comprobarlo ahora como línea base antes de tocar `PlannerPage.tsx`, para aislar cualquier regresión introducida en el Step 3. Ejecutarlo y confirmar que pasa (no falla) es la comprobación de este paso.

- [ ] **Step 3: Implementar el `DndContext` en `PlannerPage.tsx`**

Sustituir el contenido completo de `src/features/planner/PlannerPage.tsx` por:

```typescript
import { useState } from 'react'
import { addWeeks } from 'date-fns'
import type { Dispatch, SetStateAction } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core'
import type { Orden } from '../../domain/types'
import { fechasSemanaCompleta, formatearRangoSemana, hoyIso, lunesDe } from '../../shared/semanaDates'
import { AppBar } from '../../shared/AppBar'
import { useWeekPlan } from './useWeekPlan'
import { useMonthPlan } from './useMonthPlan'
import { Toolbar } from './Toolbar'
import type { VistaPlanner } from './Toolbar'
import { RulesStrip } from './RulesStrip'
import { WeekBoard } from './WeekBoard'
import { Recetario } from './Recetario'
import { PlatoPicker } from './PlatoPicker'
import { MonthView } from './MonthView'
import { DishChip } from './DishChip'
import { resolverArrastre, type DestinoArrastre, type OrigenArrastre } from './dragDrop'

const NOMBRE_HUECO: Record<Orden, string> = { 1: 'Primero', 2: 'Segundo' }

export interface PlannerPageProps {
  lunes: Date
  setLunes: Dispatch<SetStateAction<Date>>
  vista: VistaPlanner
  setVista: Dispatch<SetStateAction<VistaPlanner>>
}

export function PlannerPage({ lunes, setLunes, vista, setVista }: PlannerPageProps) {
  const [picker, setPicker] = useState<{ fecha: string; orden: Orden } | null>(null)
  const [arrastreActivo, setArrastreActivo] = useState<OrigenArrastre | null>(null)

  const semana = useWeekPlan(lunes)
  const mes = useMonthPlan(lunes)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } })
  )

  function onDragStart(event: DragStartEvent) {
    setArrastreActivo((event.active.data.current as OrigenArrastre | undefined) ?? null)
  }

  function onDragEnd(event: DragEndEvent) {
    setArrastreActivo(null)
    const origen = event.active.data.current as OrigenArrastre | undefined
    if (!origen) return
    const destino = (event.over?.data.current as DestinoArrastre | undefined) ?? null
    const accion = resolverArrastre(origen, destino)
    if (accion.tipo === 'asignar') semana.asignarPlato(accion.fecha, accion.orden, accion.idPlato)
    else if (accion.tipo === 'mover') semana.moverPlato(accion.origen, accion.destino)
    else if (accion.tipo === 'quitar') semana.quitarPlato(accion.fecha, accion.orden)
  }

  return (
    <div className="mx-auto max-w-[1560px] pb-7">
      <AppBar>
        <Toolbar
          rangoSemana={formatearRangoSemana(lunes)}
          vista={vista}
          guardando={semana.guardando}
          error={semana.error}
          onSemanaAnterior={() => setLunes((actual) => addWeeks(actual, -1))}
          onSemanaSiguiente={() => setLunes((actual) => addWeeks(actual, 1))}
          onCambiarVista={setVista}
        />
      </AppBar>

      {vista === 'semana' && <RulesStrip estados={semana.estadosRegla} />}

      {vista === 'semana' ? (
        semana.cargando ? (
          <p className="px-5 pt-3.5 text-center text-neutral-500">Cargando…</p>
        ) : (
          <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
            <main className="grid grid-cols-1 gap-4 px-5 pt-3.5 lg:grid-cols-[1fr_300px]">
              <WeekBoard
                dias={semana.dias}
                hoyIso={hoyIso()}
                onAbrirPicker={(fecha, orden) => setPicker({ fecha, orden })}
                onQuitar={(fecha, orden) => semana.quitarPlato(fecha, orden)}
              />
              <Recetario platos={semana.platosActivos} />
            </main>
            <DragOverlay>{arrastreActivo && <DishChip plato={arrastreActivo.plato} />}</DragOverlay>
          </DndContext>
        )
      ) : (
        <div className="px-5 pt-3.5">
          <MonthView
            dias={mes.dias}
            fechasSemanaActual={fechasSemanaCompleta(lunes)}
            onSeleccionarDia={(fecha) => {
              setLunes(lunesDe(new Date(`${fecha}T00:00:00`)))
              setVista('semana')
            }}
          />
        </div>
      )}

      <PlatoPicker
        key={picker ? `${picker.fecha}-${picker.orden}` : 'cerrado'}
        abierto={picker !== null}
        tituloHueco={picker ? NOMBRE_HUECO[picker.orden] : ''}
        platos={semana.platosActivos}
        onElegir={(idPlato) => {
          if (!picker) return
          semana.asignarPlato(picker.fecha, picker.orden, idPlato)
          setPicker(null)
        }}
        onCerrar={() => setPicker(null)}
      />
    </div>
  )
}
```

- [ ] **Step 4: Confirmar que pasa**

Run: `npm test -- PlannerPage.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/planner/PlannerPage.tsx src/features/planner/PlannerPage.test.tsx
git commit -m "feat: DndContext, sensores y DragOverlay en el planificador"
```

---

### Task 6: Verificación completa, nota en la spec y push

**Files:**
- Modify: `docs/specs/2026-09-06-menu-familiar-design.md` (marcar la sección de arrastrar y soltar como implementada)

- [ ] **Step 1: Suite completa**

Run: `npm run lint && npm test && npm run build`
Expected: sin errores. Confirma en particular que `tsc -b` no señala ningún tipo incompatible en los `data.current` casteados de `PlannerPage.tsx`.

- [ ] **Step 2: Verificación manual en el navegador**

Con `npm run dev`:
1. Arrastrar una tarjeta del Recetario a un hueco vacío → se asigna.
2. Arrastrar una tarjeta del Recetario a un hueco ocupado → reemplaza el plato que había.
3. Arrastrar un plato asignado a otro hueco vacío → se traslada (el hueco de origen queda vacío).
4. Arrastrar un plato asignado a un hueco ocupado → se intercambian los dos platos.
5. Arrastrar un plato asignado fuera de cualquier hueco (p. ej. sobre la barra superior) → se quita, igual que pulsar su "×".
6. Comprobar que el hueco sobre el que se arrastra se resalta con el anillo ámbar (`isOver`), y que aparece la copia flotante del `DragOverlay`.
7. Comprobar que el tap (botón "Añadir", botón "×", `PlatoPicker`) sigue funcionando exactamente igual que antes en todos los casos.
8. Repetir 1-5 en la tablet real o con las herramientas táctiles de DevTools, para confirmar que el `TouchSensor` con `delay: 200` no compite con el scroll de la página.

Dado que la sesión ya tuvo un incidente de mutación real de datos al automatizar clics contra la hoja de Google real, esta verificación de arrastrar y soltar (que sí escribe en `plan` vía `plan.set`/`plan.move`/`plan.delete`) se hace a mano por el usuario en el navegador, no con automatización de clics.

- [ ] **Step 3: Marcar la sección de la spec como implementada**

En `docs/specs/2026-09-06-menu-familiar-design.md`, cambiar el título de la sección:

```markdown
## Arrastrar y soltar en el planificador (diseño)
```

por:

```markdown
## Arrastrar y soltar en el planificador (implementado)
```

y añadir, al final de la sección, una línea:

```markdown
**Estado:** implementado. Lógica de decisión en `features/planner/dragDrop.ts`
(`resolverArrastre`, testeada); `useMovePlanEntry` optimista y `moverPlato` en
`useWeekPlan`; `Recetario`/`Slot` como arrastrable/destino vía `@dnd-kit/core`;
`DndContext`/`DragOverlay`/sensores en `PlannerPage`.
```

- [ ] **Step 4: Commit y push**

```bash
git add docs/specs/2026-09-06-menu-familiar-design.md
git commit -m "docs: marcar implementado el arrastrar y soltar del planificador"
git push
```
