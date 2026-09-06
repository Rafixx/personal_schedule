# Planificador de menú familiar (UI) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el planificador semanal en React: calendario de 5 días × 2 huecos por comida, recetario con búsqueda, selector táctil para asignar platos, tira de avisos de reglas, vista de mes de solo lectura, y persistencia offline — todo sobre la capa de dominio/datos ya construida y verificada (`domain/`, `data/`).

**Architecture:** Nueva carpeta `web/src/features/planner/` con un componente por responsabilidad (`Toolbar`, `RulesStrip`, `WeekBoard`/`DayCell`/`Slot`/`DishTile`, `Recetario`/`DishChip`, `PlatoPicker`, `MonthView`) compuestos por `PlannerPage`. Dos hooks de integración (`useWeekPlan`, `useMonthPlan`) traducen `usePlan`/`useCatalogo`/las mutaciones de `data/queries.ts` a una vista por día ya lista para pintar, usando una nueva capa de dominio pura (`domain/semana.ts`) que construye esa vista y alimenta `evaluarSemana`. `main.tsx` monta `QueryClientProvider` con persistencia offline (`persistQueryClient` + `idb-keyval`). Estilos con Tailwind v4 (ya instalado), usando la paleta de colores por etiqueta ya validada (7 tonos, `--tag-color-0`…`--tag-color-6` en `index.css`) y el layout/interacción validados en la maqueta de UX aprobada por Rafa (Artifact "Tablero de Comidas": 🥘, `04022d40-ccef-4b1c-9745-1ab3909565b7`) — la maqueta es la referencia de interacción y estructura, no un CSS literal a copiar.

**Interacción de este plan: solo toque (tap), sin arrastrar.** Añadir un plato: tocar el hueco vacío → selector → elegir. Quitar: botón «×» en la tarjeta. Esto ya es una experiencia completa y usable en tablet por sí sola (coincide con el requisito original de que el tacto nunca dependa del arrastre). El arrastrar-y-soltar de la maqueta se añade en un plan posterior, como capa aditiva sobre estos mismos componentes — no se toca en este plan.

**Tech Stack:** React 19, TypeScript, TanStack Query 5 (+ `@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister`), `idb-keyval`, `date-fns` 4, Tailwind v4, Vitest 5, Testing Library (`@testing-library/react`, `@testing-library/user-event`), MSW 2. Todas estas dependencias ya están instaladas en `web/package.json` — no se añade ninguna nueva.

**Spec:** `docs/specs/2026-09-06-menu-familiar-design.md` (secciones "Arquitectura del frontend" y "Dominio y capa de datos del frontend (implementado)").

## Global Constraints

- Solo interacción por toque en este plan: cada acción (asignar, quitar, navegar semana/mes) debe funcionar con un click/tap, sin arrastrar nada. El drag-and-drop es un plan posterior.
- `orden` es siempre el tipo `Orden` (`1 | 2`) importado de `domain/types.ts` — nunca el literal `1 | 2` repetido a mano en las firmas de componentes.
- `turno` vale siempre `'COMIDA'` en v1 — se referencia como literal solo dentro de `useWeekPlan.ts`, igual que ya hace `data/queries.ts`.
- Ninguna llamada directa a `sheetsClient` desde `features/planner/`: toda lectura/escritura pasa por los hooks ya existentes y testeados de `web/src/data/queries.ts` (`useCatalogo`, `usePlan`, `useSetPlanEntry`, `useDeletePlanEntry`).
- Toda función de cálculo puro nueva (fechas de semana, construcción de la vista día-a-día) vive en `domain/` o `shared/`, no importa React, y se testea sin renderizar nada.
- Estilos con clases de utilidad Tailwind v4 (ya configurado vía `@tailwindcss/vite` en `vite.config.ts` e `@import 'tailwindcss'` en `index.css`) — no se crean ficheros `.css` nuevos por componente. Los únicos valores dinámicos que no puede expresar una clase de Tailwind (el tono de una etiqueta, que depende del texto) se aplican vía `style` inline referenciando una variable CSS.
- La paleta de 7 colores por etiqueta ya validada (CVD-safe, usada en la maqueta aprobada) se define una sola vez como variables CSS en `index.css` y se consume vía `shared/tagColors.ts` — ningún componente hardcodea un color hexadecimal de etiqueta.
- Fuera de alcance de este plan (no crear archivos ni código para esto): arrastrar-y-soltar, lista de la compra, CRUD de catálogo/reglas, edición de `notas`, PWA/manifest/kiosco.

---

### Task 1: Utilidades de fecha de semana y paleta de color por etiqueta

**Files:**
- Create: `web/src/shared/semanaDates.ts`
- Create: `web/src/shared/semanaDates.test.ts`
- Create: `web/src/shared/tagColors.ts`
- Create: `web/src/shared/tagColors.test.ts`
- Modify: `web/src/index.css`
- Delete: `web/src/shared/.gitkeep`

**Interfaces:**
- Consumes: nada nuevo (usa `date-fns`, ya instalado)
- Produces: `DIAS_SEMANA`, `lunesDe(fecha)`, `fechasSemana(lunes)`, `formatearRangoSemana(lunes)`, `hoyIso()`, `colorVarDeEtiqueta(etiqueta)` — usados por `domain/semana.ts`, `useWeekPlan.ts`, y todos los componentes de `features/planner/` (Tasks 2–11)

- [ ] **Step 1: Escribir el test de `semanaDates.ts`**

Crear `web/src/shared/semanaDates.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { fechasSemana, formatearRangoSemana, hoyIso, lunesDe } from './semanaDates'

describe('lunesDe', () => {
  it('devuelve el lunes de la semana para cualquier día de esa semana', () => {
    const miercoles = new Date('2026-09-09T12:00:00')
    const lunes = lunesDe(miercoles)
    expect(lunes.getFullYear()).toBe(2026)
    expect(lunes.getMonth()).toBe(8)
    expect(lunes.getDate()).toBe(7)
  })
})

describe('fechasSemana', () => {
  it('devuelve las 5 fechas ISO de lunes a viernes', () => {
    const lunes = new Date(2026, 8, 7)
    expect(fechasSemana(lunes)).toEqual([
      '2026-09-07',
      '2026-09-08',
      '2026-09-09',
      '2026-09-10',
      '2026-09-11'
    ])
  })
})

describe('formatearRangoSemana', () => {
  it('usa solo el día para el inicio cuando ambos extremos caen en el mismo mes', () => {
    const lunes = new Date(2026, 8, 7)
    expect(formatearRangoSemana(lunes)).toBe('7–11 sep')
  })

  it('usa día y mes en el inicio cuando la semana cruza un cambio de mes', () => {
    const lunes = new Date(2026, 7, 31)
    expect(formatearRangoSemana(lunes)).toBe('31 ago–4 sep')
  })
})

describe('hoyIso', () => {
  it('devuelve la fecha de hoy en formato ISO yyyy-MM-dd', () => {
    expect(hoyIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/shared/semanaDates.test.ts`
Expected: FAIL — el módulo `./semanaDates` no existe todavía.

- [ ] **Step 3: Implementar `semanaDates.ts`**

Crear `web/src/shared/semanaDates.ts`:

```typescript
import { addDays, format, startOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'

export const DIAS_SEMANA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'] as const

export function lunesDe(fecha: Date): Date {
  return startOfWeek(fecha, { weekStartsOn: 1 })
}

export function fechasSemana(lunes: Date): string[] {
  return Array.from({ length: 5 }, (_, i) => format(addDays(lunes, i), 'yyyy-MM-dd'))
}

export function formatearRangoSemana(lunes: Date): string {
  const viernes = addDays(lunes, 4)
  const mismoMes = lunes.getMonth() === viernes.getMonth()
  const inicio = mismoMes ? format(lunes, 'd') : format(lunes, 'd MMM', { locale: es })
  return `${inicio}–${format(viernes, 'd MMM', { locale: es })}`
}

export function hoyIso(): string {
  return format(new Date(), 'yyyy-MM-dd')
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/shared/semanaDates.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Escribir el test de `tagColors.ts`**

Crear `web/src/shared/tagColors.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { colorVarDeEtiqueta } from './tagColors'

describe('colorVarDeEtiqueta', () => {
  it('asigna el mismo color a la misma etiqueta siempre', () => {
    expect(colorVarDeEtiqueta('pasta')).toBe(colorVarDeEtiqueta('pasta'))
  })

  it('devuelve una variable CSS del rango de 7 colores validados', () => {
    expect(colorVarDeEtiqueta('pasta')).toBe('var(--tag-color-4)')
    expect(colorVarDeEtiqueta('carne')).toBe('var(--tag-color-6)')
    expect(colorVarDeEtiqueta('pescado')).toBe('var(--tag-color-0)')
    expect(colorVarDeEtiqueta('verdura')).toBe('var(--tag-color-5)')
  })
})
```

- [ ] **Step 6: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/shared/tagColors.test.ts`
Expected: FAIL — el módulo `./tagColors` no existe todavía.

- [ ] **Step 7: Implementar `tagColors.ts`**

Crear `web/src/shared/tagColors.ts`:

```typescript
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
```

- [ ] **Step 8: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/shared/tagColors.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 9: Añadir las variables CSS de la paleta a `index.css`**

Reemplazar el contenido completo de `web/src/index.css` (actualmente solo `@import 'tailwindcss';`) por:

```css
@import 'tailwindcss';

:root {
  --tag-color-0: #eda100;
  --tag-color-1: #eb6834;
  --tag-color-2: #1baf7a;
  --tag-color-3: #008300;
  --tag-color-4: #2a78d6;
  --tag-color-5: #4a3aa7;
  --tag-color-6: #e87ba4;
}

@media (prefers-color-scheme: dark) {
  :root {
    --tag-color-0: #c98500;
    --tag-color-1: #d95926;
    --tag-color-2: #199e70;
    --tag-color-3: #3fae3f;
    --tag-color-4: #3987e5;
    --tag-color-5: #9085e9;
    --tag-color-6: #d55181;
  }
}
```

Estos son los 7 tonos ya validados (CVD-safe) y usados en la maqueta de UX aprobada (`--tag-pasta`, `--tag-carne`, etc. en el Artifact) — aquí se indexan por número porque las etiquetas reales del catálogo son texto libre (`Plato.etiquetas: string[]`), no un enum fijo; `colorVarDeEtiqueta` reparte cualquier etiqueta entre estos 7 tonos de forma determinista.

- [ ] **Step 10: Borrar el placeholder de la carpeta `shared/`**

```bash
rm web/src/shared/.gitkeep
```

- [ ] **Step 11: Verificar que todo compila y los tests pasan**

Run: `cd web && npx vitest run src/shared/ && npm run lint`
Expected: 7 tests PASS, lint sin errores.

- [ ] **Step 12: Commit**

```bash
git add web/src/shared/semanaDates.ts web/src/shared/semanaDates.test.ts web/src/shared/tagColors.ts web/src/shared/tagColors.test.ts web/src/index.css
git rm web/src/shared/.gitkeep
git commit -m "feat: utilidades de fechas de semana y paleta de color por etiqueta"
```

---

### Task 2: Vista de dominio para la semana (`domain/semana.ts`)

**Files:**
- Create: `web/src/domain/semana.ts`
- Create: `web/src/domain/semana.test.ts`

**Interfaces:**
- Consumes: `PlanEntry`, `Plato` de `domain/types.ts`; `AsignacionSemana` de `domain/reglas.ts` (ya existen)
- Produces: `DiaSemana`, `construirSemana(fechas, entries, platos)`, `aAsignaciones(dias)`, `platosDelDia(fecha, entries, platos)` — usados por `useWeekPlan.ts` (Task 3) y `useMonthPlan.ts` (Task 10)

- [ ] **Step 1: Escribir el test**

Crear `web/src/domain/semana.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { aAsignaciones, construirSemana, platosDelDia } from './semana'
import type { Plato, PlanEntry } from './types'

function plato(id: number, nombre: string): Plato {
  return { id, nombre, temporadas: ['TODAS'], etiquetas: [], notas: '', activo: true }
}

function entrada(fecha: string, orden: 1 | 2, idPlato: number): PlanEntry {
  return { id: 1, fecha, turno: 'COMIDA', orden, idPlato, notas: '' }
}

describe('construirSemana', () => {
  it('coloca cada plato en su fecha y hueco correctos', () => {
    const platos = [plato(5, 'Pasta'), plato(8, 'Salmón')]
    const entries = [entrada('2026-09-07', 1, 5), entrada('2026-09-07', 2, 8)]
    const dias = construirSemana(['2026-09-07', '2026-09-08'], entries, platos)
    expect(dias).toHaveLength(2)
    expect(dias[0].huecos[0]).toEqual({ fecha: '2026-09-07', orden: 1, plato: platos[0] })
    expect(dias[0].huecos[1]).toEqual({ fecha: '2026-09-07', orden: 2, plato: platos[1] })
    expect(dias[1].huecos[0].plato).toBeNull()
    expect(dias[1].huecos[1].plato).toBeNull()
  })

  it('deja el hueco en null si el plato referenciado ya no existe en el catálogo', () => {
    const entries = [entrada('2026-09-07', 1, 999)]
    const dias = construirSemana(['2026-09-07'], entries, [])
    expect(dias[0].huecos[0].plato).toBeNull()
  })
})

describe('aAsignaciones', () => {
  it('aplana los huecos de todos los días en una sola lista', () => {
    const platos = [plato(5, 'Pasta')]
    const entries = [entrada('2026-09-07', 1, 5)]
    const dias = construirSemana(['2026-09-07', '2026-09-08'], entries, platos)
    const asignaciones = aAsignaciones(dias)
    expect(asignaciones).toHaveLength(4)
    expect(asignaciones[0]).toEqual({ fecha: '2026-09-07', orden: 1, plato: platos[0] })
  })
})

describe('platosDelDia', () => {
  it('devuelve los platos asignados a una fecha, ignorando otras fechas', () => {
    const platos = [plato(5, 'Pasta'), plato(8, 'Salmón')]
    const entries = [entrada('2026-09-07', 1, 5), entrada('2026-09-07', 2, 8), entrada('2026-09-08', 1, 5)]
    const resultado = platosDelDia('2026-09-07', entries, platos)
    expect(resultado).toEqual([platos[0], platos[1]])
  })

  it('devuelve una lista vacía si no hay asignaciones ese día', () => {
    expect(platosDelDia('2026-09-09', [], [])).toEqual([])
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/domain/semana.test.ts`
Expected: FAIL — el módulo `./semana` no existe todavía.

- [ ] **Step 3: Implementar `semana.ts`**

Crear `web/src/domain/semana.ts`:

```typescript
import type { PlanEntry, Plato } from './types'
import type { AsignacionSemana } from './reglas'

export interface DiaSemana {
  fecha: string
  huecos: [AsignacionSemana, AsignacionSemana]
}

export function construirSemana(fechas: string[], entries: PlanEntry[], platos: Plato[]): DiaSemana[] {
  const platoPorId = new Map(platos.map((p) => [p.id, p]))
  return fechas.map((fecha) => {
    const huecos = ([1, 2] as const).map((orden): AsignacionSemana => {
      const entrada = entries.find((e) => e.fecha === fecha && e.orden === orden)
      const plato = entrada ? (platoPorId.get(entrada.idPlato) ?? null) : null
      return { fecha, orden, plato }
    })
    return { fecha, huecos: huecos as [AsignacionSemana, AsignacionSemana] }
  })
}

export function aAsignaciones(dias: DiaSemana[]): AsignacionSemana[] {
  return dias.flatMap((dia) => dia.huecos)
}

export function platosDelDia(fecha: string, entries: PlanEntry[], platos: Plato[]): Plato[] {
  const platoPorId = new Map(platos.map((p) => [p.id, p]))
  return entries
    .filter((e) => e.fecha === fecha)
    .map((e) => platoPorId.get(e.idPlato))
    .filter((p): p is Plato => p !== undefined)
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/domain/semana.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add web/src/domain/semana.ts web/src/domain/semana.test.ts
git commit -m "feat: construir la vista de dominio de una semana a partir del plan y el catálogo"
```

---

### Task 3: Hook de integración `useWeekPlan`

**Files:**
- Create: `web/src/features/planner/useWeekPlan.ts`
- Create: `web/src/features/planner/useWeekPlan.test.tsx`
- Delete: `web/src/features/planner/.gitkeep`

**Interfaces:**
- Consumes: `useCatalogo`, `usePlan`, `useSetPlanEntry`, `useDeletePlanEntry` de `data/queries.ts`; `construirSemana`, `aAsignaciones` de `domain/semana.ts`; `evaluarSemana` de `domain/reglas.ts`; `fechasSemana` de `shared/semanaDates.ts`; `Orden` de `domain/types.ts`
- Produces: `useWeekPlan(lunes): { dias, estadosRegla, platosActivos, cargando, error, guardando, asignarPlato, quitarPlato }` — usado por `PlannerPage.tsx` (Task 11)

- [ ] **Step 1: Escribir el test**

Crear `web/src/features/planner/useWeekPlan.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/mswServer'
import { useWeekPlan } from './useWeekPlan'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function mockApi(entries: unknown[]) {
  server.use(
    http.get(API_URL, ({ request }) => {
      const url = new URL(request.url)
      if (url.searchParams.get('action') === 'bootstrap') {
        return HttpResponse.json({
          ok: true,
          platos: [
            { id_plato: 5, nombre: 'Pasta', temporada: 'TODAS', etiquetas: 'pasta', notas: '', activo: true }
          ],
          ingredientes: [],
          ingredientesPlatos: [],
          reglas: [{ id: 1, etiqueta: 'pasta', tipo: 'MAX_SEMANA', valor: 0, activa: true }],
          proveedores: []
        })
      }
      return HttpResponse.json({ ok: true, entries })
    })
  )
}

describe('useWeekPlan', () => {
  it('construye los días de la semana y evalúa las reglas sobre ellos', async () => {
    mockApi([{ id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 5, notas: '' }])
    const { result } = renderHook(() => useWeekPlan(new Date(2026, 8, 7)), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.dias).toHaveLength(5)
    expect(result.current.dias[0].huecos[0].plato?.nombre).toBe('Pasta')
    expect(result.current.estadosRegla).toHaveLength(1)
    expect(result.current.estadosRegla[0].estado).toBe('aviso')
  })

  it('asignarPlato llama a plan.set con fecha, turno, orden e id_plato correctos', async () => {
    mockApi([])
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id: 1 } })
      })
    )
    const { result } = renderHook(() => useWeekPlan(new Date(2026, 8, 7)), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    result.current.asignarPlato('2026-09-07', 1, 5)
    await waitFor(() => expect(result.current.guardando).toBe(false))
    expect(payloadRecibido).toEqual({
      action: 'plan.set',
      token: 'test-token',
      payload: { fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 5, notas: '' }
    })
  })

  it('quitarPlato llama a plan.delete con fecha, turno y orden correctos', async () => {
    mockApi([])
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    const { result } = renderHook(() => useWeekPlan(new Date(2026, 8, 7)), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    result.current.quitarPlato('2026-09-07', 2)
    await waitFor(() => expect(result.current.guardando).toBe(false))
    expect(payloadRecibido).toEqual({
      action: 'plan.delete',
      token: 'test-token',
      payload: { fecha: '2026-09-07', turno: 'COMIDA', orden: 2 }
    })
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/planner/useWeekPlan.test.tsx`
Expected: FAIL — el módulo `./useWeekPlan` no existe todavía.

- [ ] **Step 3: Implementar `useWeekPlan.ts`**

Crear `web/src/features/planner/useWeekPlan.ts`:

```typescript
import type { Orden } from '../../domain/types'
import { aAsignaciones, construirSemana } from '../../domain/semana'
import { evaluarSemana } from '../../domain/reglas'
import { useCatalogo, useDeletePlanEntry, usePlan, useSetPlanEntry } from '../../data/queries'
import { fechasSemana } from '../../shared/semanaDates'

export function useWeekPlan(lunes: Date) {
  const fechas = fechasSemana(lunes)
  const catalogo = useCatalogo()
  const plan = usePlan(fechas[0], fechas[4])
  const setPlanEntry = useSetPlanEntry()
  const deletePlanEntry = useDeletePlanEntry()

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

  return {
    dias,
    estadosRegla,
    platosActivos,
    cargando: catalogo.isLoading || plan.isLoading,
    error: catalogo.isError || plan.isError || setPlanEntry.isError || deletePlanEntry.isError,
    guardando: setPlanEntry.isPending || deletePlanEntry.isPending,
    asignarPlato,
    quitarPlato
  }
}
```

`error` incluye los errores de las mutaciones, no solo de las lecturas: si guardar o borrar falla (p. ej. sin conexión), la tira de estado de sincronización debe poder reflejarlo.

- [ ] **Step 4: Borrar el placeholder de la carpeta `features/planner/`**

```bash
rm web/src/features/planner/.gitkeep
```

- [ ] **Step 5: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/planner/useWeekPlan.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add web/src/features/planner/useWeekPlan.ts web/src/features/planner/useWeekPlan.test.tsx
git rm web/src/features/planner/.gitkeep
git commit -m "feat: hook useWeekPlan que conecta el plan y el catálogo con la vista de semana"
```

---

### Task 4: `QueryClientProvider` con persistencia offline en `main.tsx`

**Files:**
- Modify: `web/src/main.tsx`

**Interfaces:**
- Consumes: `createAsyncStoragePersister` de `@tanstack/query-async-storage-persister`; `get`/`set`/`del` de `idb-keyval`; `PersistQueryClientProvider` de `@tanstack/react-query-persist-client` (todas ya instaladas)
- Produces: contexto de `QueryClient` disponible para toda la app — requerido por `useWeekPlan`/`useMonthPlan`/`useCatalogo`/`usePlan`, que ya asumen estar dentro de un `QueryClientProvider` (los tests existentes lo envuelven a mano; en producción faltaba)

- [ ] **Step 1: Reemplazar `main.tsx`**

Reemplazar el contenido completo de `web/src/main.tsx` por:

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { del, get, set } from 'idb-keyval'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000
    }
  }
})

const persister = createAsyncStoragePersister({
  storage: {
    getItem: get,
    setItem: set,
    removeItem: del
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}>
      <App />
    </PersistQueryClientProvider>
  </StrictMode>
)
```

`staleTime` de 5 minutos evita refrescos innecesarios en cada montaje; `gcTime`/`maxAge` de 24 horas es lo que permite que el plan de ayer siga visible en la tablet si se abre sin conexión por la mañana antes de que responda la API.

- [ ] **Step 2: Verificar que compila**

Run: `cd web && npm run build`
Expected: build sin errores (no hay test unitario para `main.tsx` en este repo — es el punto de entrada, sin lógica propia que testear; la cobertura real llega vía los tests de los hooks que ya asumen `QueryClientProvider`, y vía la verificación manual del Task 12).

- [ ] **Step 3: Commit**

```bash
git add web/src/main.tsx
git commit -m "feat: montar QueryClientProvider con persistencia offline en idb-keyval"
```

---

### Task 5: `RulesStrip` y `Toolbar`

**Files:**
- Create: `web/src/features/planner/RulesStrip.tsx`
- Create: `web/src/features/planner/RulesStrip.test.tsx`
- Create: `web/src/features/planner/Toolbar.tsx`
- Create: `web/src/features/planner/Toolbar.test.tsx`

**Interfaces:**
- Consumes: `EstadoRegla` de `domain/reglas.ts` (ya existe)
- Produces: `RulesStrip({estados})`, `Toolbar({...})`, `VistaPlanner` (`'semana' | 'mes'`) — usados por `PlannerPage.tsx` (Task 11)

- [ ] **Step 1: Escribir el test de `RulesStrip`**

Crear `web/src/features/planner/RulesStrip.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RulesStrip } from './RulesStrip'
import type { EstadoRegla } from '../../domain/reglas'

describe('RulesStrip', () => {
  it('muestra un chip por regla con su etiqueta y estado', () => {
    const estados: EstadoRegla[] = [
      { etiqueta: 'pasta', tipo: 'MAX_SEMANA', actual: 1, objetivo: 1, estado: 'ok' },
      { etiqueta: 'pescado', tipo: 'MIN_SEMANA', actual: 0, objetivo: 2, estado: 'aviso' }
    ]
    render(<RulesStrip estados={estados} />)
    expect(screen.getByText('Pasta 1/1')).toBeInTheDocument()
    expect(screen.getByText('Pescado 0/2')).toBeInTheDocument()
  })

  it('describe las reglas NO_CONSECUTIVO sin fracción', () => {
    const estados: EstadoRegla[] = [
      { etiqueta: 'carne', tipo: 'NO_CONSECUTIVO', actual: 1, objetivo: 0, estado: 'aviso' }
    ]
    render(<RulesStrip estados={estados} />)
    expect(screen.getByText('Carne en días seguidos')).toBeInTheDocument()
  })

  it('no renderiza nada si no hay reglas activas', () => {
    const { container } = render(<RulesStrip estados={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/planner/RulesStrip.test.tsx`
Expected: FAIL — el módulo `./RulesStrip` no existe todavía.

- [ ] **Step 3: Implementar `RulesStrip.tsx`**

Crear `web/src/features/planner/RulesStrip.tsx`:

```typescript
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
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/planner/RulesStrip.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Escribir el test de `Toolbar`**

Crear `web/src/features/planner/Toolbar.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Toolbar } from './Toolbar'

function setup(overrides: Partial<Parameters<typeof Toolbar>[0]> = {}) {
  const props = {
    rangoSemana: '7–11 sep',
    vista: 'semana' as const,
    guardando: false,
    error: false,
    onSemanaAnterior: vi.fn(),
    onSemanaSiguiente: vi.fn(),
    onCambiarVista: vi.fn(),
    ...overrides
  }
  render(<Toolbar {...props} />)
  return props
}

describe('Toolbar', () => {
  it('muestra el rango de la semana', () => {
    setup()
    expect(screen.getByText('7–11 sep')).toBeInTheDocument()
  })

  it('llama a onSemanaAnterior y onSemanaSiguiente al pulsar las flechas', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('button', { name: /semana anterior/i }))
    await userEvent.click(screen.getByRole('button', { name: /semana siguiente/i }))
    expect(props.onSemanaAnterior).toHaveBeenCalledOnce()
    expect(props.onSemanaSiguiente).toHaveBeenCalledOnce()
  })

  it('llama a onCambiarVista al pulsar "Mes"', async () => {
    const props = setup()
    await userEvent.click(screen.getByRole('tab', { name: 'Mes' }))
    expect(props.onCambiarVista).toHaveBeenCalledWith('mes')
  })

  it('muestra "Guardando…" mientras guardando es true', () => {
    setup({ guardando: true })
    expect(screen.getByText('Guardando…')).toBeInTheDocument()
  })

  it('muestra "Sin conexión" cuando error es true', () => {
    setup({ error: true })
    expect(screen.getByText('Sin conexión')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/planner/Toolbar.test.tsx`
Expected: FAIL — el módulo `./Toolbar` no existe todavía.

- [ ] **Step 7: Implementar `Toolbar.tsx`**

Crear `web/src/features/planner/Toolbar.tsx`:

```typescript
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
```

- [ ] **Step 8: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/planner/Toolbar.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 9: Commit**

```bash
git add web/src/features/planner/RulesStrip.tsx web/src/features/planner/RulesStrip.test.tsx web/src/features/planner/Toolbar.tsx web/src/features/planner/Toolbar.test.tsx
git commit -m "feat: componentes RulesStrip y Toolbar del planificador"
```

---

### Task 6: `DishTile` y `Slot`

**Files:**
- Create: `web/src/features/planner/DishTile.tsx`
- Create: `web/src/features/planner/DishTile.test.tsx`
- Create: `web/src/features/planner/Slot.tsx`
- Create: `web/src/features/planner/Slot.test.tsx`

**Interfaces:**
- Consumes: `Plato` de `domain/types.ts`; `AsignacionSemana` de `domain/reglas.ts`; `estaEnTemporada`/`temporadaDe` de `domain/temporadas.ts`; `colorVarDeEtiqueta` de `shared/tagColors.ts` (todos ya existen)
- Produces: `DishTile({plato, fecha, onQuitar})`, `Slot({asignacion, etiquetaHueco, onAbrirPicker, onQuitar})` — usados por `DayCell.tsx` (Task 8)

- [ ] **Step 1: Escribir el test de `DishTile`**

Crear `web/src/features/planner/DishTile.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DishTile } from './DishTile'
import type { Plato } from '../../domain/types'

function plato(overrides: Partial<Plato> = {}): Plato {
  return { id: 1, nombre: 'Gazpacho', temporadas: ['TODAS'], etiquetas: ['verdura'], notas: '', activo: true, ...overrides }
}

describe('DishTile', () => {
  it('muestra el nombre y la etiqueta del plato', () => {
    render(<DishTile plato={plato()} fecha="2026-09-07" onQuitar={vi.fn()} />)
    expect(screen.getByText('Gazpacho')).toBeInTheDocument()
    expect(screen.getByText('verdura')).toBeInTheDocument()
  })

  it('llama a onQuitar al pulsar el botón de quitar', async () => {
    const onQuitar = vi.fn()
    render(<DishTile plato={plato()} fecha="2026-09-07" onQuitar={onQuitar} />)
    await userEvent.click(screen.getByRole('button', { name: /quitar gazpacho/i }))
    expect(onQuitar).toHaveBeenCalledOnce()
  })

  it('avisa cuando la fecha cae fuera de la temporada del plato', () => {
    render(<DishTile plato={plato({ temporadas: ['VERANO'] })} fecha="2026-09-07" onQuitar={vi.fn()} />)
    expect(screen.getByText(/fuera de temporada/i)).toBeInTheDocument()
  })

  it('no avisa cuando el plato vale para todas las temporadas', () => {
    render(<DishTile plato={plato({ temporadas: ['TODAS'] })} fecha="2026-09-07" onQuitar={vi.fn()} />)
    expect(screen.queryByText(/fuera de temporada/i)).not.toBeInTheDocument()
  })
})
```

`fecha="2026-09-07"` cae en el mes 9 → `temporadaDe` (ya existente) la clasifica como `OTOÑO`; por eso un plato marcado solo para `VERANO` debe avisar, y uno marcado `TODAS` no.

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/planner/DishTile.test.tsx`
Expected: FAIL — el módulo `./DishTile` no existe todavía.

- [ ] **Step 3: Implementar `DishTile.tsx`**

Crear `web/src/features/planner/DishTile.tsx`:

```typescript
import type { Plato } from '../../domain/types'
import { estaEnTemporada, temporadaDe } from '../../domain/temporadas'
import { colorVarDeEtiqueta } from '../../shared/tagColors'

export interface DishTileProps {
  plato: Plato
  fecha: string
  onQuitar: () => void
}

export function DishTile({ plato, fecha, onQuitar }: DishTileProps) {
  const etiqueta = plato.etiquetas[0]
  const colorVar = etiqueta ? colorVarDeEtiqueta(etiqueta) : 'var(--tag-color-0)'
  const fueraDeTemporada = !estaEnTemporada(plato.temporadas, fecha)

  return (
    <div
      className="relative flex min-h-12 flex-1 flex-col justify-center gap-1 rounded-xl border-[1.5px] border-neutral-200 bg-white p-2.5 pl-3 dark:border-neutral-700 dark:bg-neutral-800"
      style={{ borderLeft: `6px solid ${colorVar}` }}
    >
      {etiqueta && (
        <span className="text-[0.7rem] font-bold uppercase tracking-wide" style={{ color: colorVar }}>
          {etiqueta}
        </span>
      )}
      <span className="font-semibold leading-tight">{plato.nombre}</span>
      {fueraDeTemporada && (
        <span className="mt-auto flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400">
          🌿 Fuera de temporada ({temporadaDe(fecha).toLowerCase()})
        </span>
      )}
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar ${plato.nombre}`}
        className="absolute right-2 top-2 grid h-6.5 w-6.5 place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-700 dark:hover:bg-neutral-600"
      >
        ×
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/planner/DishTile.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Escribir el test de `Slot`**

Crear `web/src/features/planner/Slot.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Slot } from './Slot'
import type { AsignacionSemana } from '../../domain/reglas'
import type { Plato } from '../../domain/types'

function plato(): Plato {
  return { id: 1, nombre: 'Pasta', temporadas: ['TODAS'], etiquetas: ['pasta'], notas: '', activo: true }
}

describe('Slot', () => {
  it('muestra el plato de dentro cuando el hueco está ocupado', () => {
    const asignacion: AsignacionSemana = { fecha: '2026-09-07', orden: 1, plato: plato() }
    render(<Slot asignacion={asignacion} etiquetaHueco="Primero" onAbrirPicker={vi.fn()} onQuitar={vi.fn()} />)
    expect(screen.getByText('Pasta')).toBeInTheDocument()
    expect(screen.getByText('Primero')).toBeInTheDocument()
  })

  it('llama a onQuitar cuando se pulsa quitar en un hueco ocupado', async () => {
    const asignacion: AsignacionSemana = { fecha: '2026-09-07', orden: 1, plato: plato() }
    const onQuitar = vi.fn()
    render(<Slot asignacion={asignacion} etiquetaHueco="Primero" onAbrirPicker={vi.fn()} onQuitar={onQuitar} />)
    await userEvent.click(screen.getByRole('button', { name: /quitar pasta/i }))
    expect(onQuitar).toHaveBeenCalledOnce()
  })

  it('muestra el botón de añadir cuando el hueco está vacío', () => {
    const asignacion: AsignacionSemana = { fecha: '2026-09-07', orden: 2, plato: null }
    render(<Slot asignacion={asignacion} etiquetaHueco="Segundo" onAbrirPicker={vi.fn()} onQuitar={vi.fn()} />)
    expect(screen.getByRole('button', { name: /añadir/i })).toBeInTheDocument()
  })

  it('llama a onAbrirPicker al pulsar añadir en un hueco vacío', async () => {
    const asignacion: AsignacionSemana = { fecha: '2026-09-07', orden: 2, plato: null }
    const onAbrirPicker = vi.fn()
    render(<Slot asignacion={asignacion} etiquetaHueco="Segundo" onAbrirPicker={onAbrirPicker} onQuitar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /añadir/i }))
    expect(onAbrirPicker).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 6: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/planner/Slot.test.tsx`
Expected: FAIL — el módulo `./Slot` no existe todavía.

- [ ] **Step 7: Implementar `Slot.tsx`**

Crear `web/src/features/planner/Slot.tsx`:

```typescript
import type { AsignacionSemana } from '../../domain/reglas'
import { DishTile } from './DishTile'

export interface SlotProps {
  asignacion: AsignacionSemana
  etiquetaHueco: string
  onAbrirPicker: () => void
  onQuitar: () => void
}

export function Slot({ asignacion, etiquetaHueco, onAbrirPicker, onQuitar }: SlotProps) {
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <span className="pl-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-neutral-400">{etiquetaHueco}</span>
      <div className="flex flex-1">
        {asignacion.plato ? (
          <DishTile plato={asignacion.plato} fecha={asignacion.fecha} onQuitar={onQuitar} />
        ) : (
          <button
            type="button"
            onClick={onAbrirPicker}
            className="flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-neutral-300 text-sm font-semibold text-neutral-400 hover:border-amber-500 hover:bg-amber-50 hover:text-amber-800 dark:border-neutral-600 dark:hover:bg-amber-950"
          >
            <span className="text-xl font-normal leading-none">+</span>
            <span>Añadir</span>
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/planner/Slot.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 9: Commit**

```bash
git add web/src/features/planner/DishTile.tsx web/src/features/planner/DishTile.test.tsx web/src/features/planner/Slot.tsx web/src/features/planner/Slot.test.tsx
git commit -m "feat: componentes DishTile y Slot del planificador"
```

---

### Task 7: `PlatoPicker`

**Files:**
- Create: `web/src/features/planner/PlatoPicker.tsx`
- Create: `web/src/features/planner/PlatoPicker.test.tsx`

**Interfaces:**
- Consumes: `Plato` de `domain/types.ts`; `colorVarDeEtiqueta` de `shared/tagColors.ts`
- Produces: `PlatoPicker({abierto, tituloHueco, platos, onElegir, onCerrar})` — usado por `PlannerPage.tsx` (Task 11)

- [ ] **Step 1: Escribir el test**

Crear `web/src/features/planner/PlatoPicker.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PlatoPicker } from './PlatoPicker'
import type { Plato } from '../../domain/types'

function plato(id: number, nombre: string): Plato {
  return { id, nombre, temporadas: ['TODAS'], etiquetas: [], notas: '', activo: true }
}

describe('PlatoPicker', () => {
  it('no renderiza nada cuando abierto es false', () => {
    const { container } = render(
      <PlatoPicker abierto={false} tituloHueco="Primero" platos={[]} onElegir={vi.fn()} onCerrar={vi.fn()} />
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('muestra la lista de platos y el título del hueco', () => {
    render(
      <PlatoPicker abierto tituloHueco="Primero" platos={[plato(1, 'Gazpacho'), plato(2, 'Pasta')]} onElegir={vi.fn()} onCerrar={vi.fn()} />
    )
    expect(screen.getByText('Elegir plato · Primero')).toBeInTheDocument()
    expect(screen.getByText('Gazpacho')).toBeInTheDocument()
    expect(screen.getByText('Pasta')).toBeInTheDocument()
  })

  it('filtra la lista al escribir en el buscador', async () => {
    render(
      <PlatoPicker abierto tituloHueco="Primero" platos={[plato(1, 'Gazpacho'), plato(2, 'Pasta')]} onElegir={vi.fn()} onCerrar={vi.fn()} />
    )
    await userEvent.type(screen.getByPlaceholderText('Buscar plato…'), 'pas')
    expect(screen.queryByText('Gazpacho')).not.toBeInTheDocument()
    expect(screen.getByText('Pasta')).toBeInTheDocument()
  })

  it('llama a onElegir con el id del plato pulsado', async () => {
    const onElegir = vi.fn()
    render(<PlatoPicker abierto tituloHueco="Primero" platos={[plato(1, 'Gazpacho')]} onElegir={onElegir} onCerrar={vi.fn()} />)
    await userEvent.click(screen.getByText('Gazpacho'))
    expect(onElegir).toHaveBeenCalledWith(1)
  })

  it('llama a onCerrar al pulsar el botón de cerrar', async () => {
    const onCerrar = vi.fn()
    render(<PlatoPicker abierto tituloHueco="Primero" platos={[]} onElegir={vi.fn()} onCerrar={onCerrar} />)
    await userEvent.click(screen.getByRole('button', { name: /cerrar/i }))
    expect(onCerrar).toHaveBeenCalledOnce()
  })

  it('muestra un mensaje cuando ningún plato coincide con la búsqueda', async () => {
    render(<PlatoPicker abierto tituloHueco="Primero" platos={[plato(1, 'Gazpacho')]} onElegir={vi.fn()} onCerrar={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('Buscar plato…'), 'zzz')
    expect(screen.getByText('Ningún plato coincide')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/planner/PlatoPicker.test.tsx`
Expected: FAIL — el módulo `./PlatoPicker` no existe todavía.

- [ ] **Step 3: Implementar `PlatoPicker.tsx`**

Crear `web/src/features/planner/PlatoPicker.tsx`:

```typescript
import { useState } from 'react'
import type { Plato } from '../../domain/types'
import { colorVarDeEtiqueta } from '../../shared/tagColors'

export interface PlatoPickerProps {
  abierto: boolean
  tituloHueco: string
  platos: Plato[]
  onElegir: (idPlato: number) => void
  onCerrar: () => void
}

export function PlatoPicker({ abierto, tituloHueco, platos, onElegir, onCerrar }: PlatoPickerProps) {
  const [busqueda, setBusqueda] = useState('')

  if (!abierto) return null

  const filtrados = platos.filter((p) => p.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()))

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar()
      }}
    >
      <div className="flex max-h-[80vh] w-full max-w-md flex-col gap-3 rounded-2xl bg-white p-4.5 shadow-xl dark:bg-neutral-800">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Elegir plato · {tituloHueco}</h3>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="grid h-8.5 w-8.5 place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-700"
          >
            ×
          </button>
        </div>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar plato…"
          autoFocus
          className="w-full rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-base dark:border-neutral-600 dark:bg-neutral-900"
        />
        <div className="flex flex-col gap-2 overflow-y-auto">
          {filtrados.length === 0 && <p className="py-3.5 text-center text-sm text-neutral-400">Ningún plato coincide</p>}
          {filtrados.map((plato) => {
            const etiqueta = plato.etiquetas[0]
            const colorVar = etiqueta ? colorVarDeEtiqueta(etiqueta) : 'var(--tag-color-0)'
            return (
              <button
                key={plato.id}
                type="button"
                onClick={() => onElegir(plato.id)}
                style={{ borderLeft: `6px solid ${colorVar}` }}
                className="flex min-h-12 items-center gap-2.5 rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 p-3 text-left hover:border-amber-500 dark:border-neutral-600 dark:bg-neutral-900"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="font-semibold">{plato.nombre}</span>
                  {etiqueta && (
                    <span className="text-[0.7rem] font-bold uppercase" style={{ color: colorVar }}>
                      {etiqueta}
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/planner/PlatoPicker.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add web/src/features/planner/PlatoPicker.tsx web/src/features/planner/PlatoPicker.test.tsx
git commit -m "feat: componente PlatoPicker (selector táctil de plato)"
```

---

### Task 8: `DayCell` y `WeekBoard`

**Files:**
- Create: `web/src/features/planner/DayCell.tsx`
- Create: `web/src/features/planner/DayCell.test.tsx`
- Create: `web/src/features/planner/WeekBoard.tsx`
- Create: `web/src/features/planner/WeekBoard.test.tsx`

**Interfaces:**
- Consumes: `DiaSemana` de `domain/semana.ts` (Task 2); `Orden` de `domain/types.ts`; `DIAS_SEMANA` de `shared/semanaDates.ts`; `Slot` de `Slot.tsx` (Task 6)
- Produces: `DayCell({...})`, `WeekBoard({dias, hoyIso, onAbrirPicker, onQuitar})` — usado por `PlannerPage.tsx` (Task 11)

- [ ] **Step 1: Escribir el test de `DayCell`**

Crear `web/src/features/planner/DayCell.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { DayCell } from './DayCell'
import type { DiaSemana } from '../../domain/semana'
import type { Plato } from '../../domain/types'

function plato(): Plato {
  return { id: 1, nombre: 'Pasta', temporadas: ['TODAS'], etiquetas: ['pasta'], notas: '', activo: true }
}

function dia(): DiaSemana {
  return {
    fecha: '2026-09-07',
    huecos: [
      { fecha: '2026-09-07', orden: 1, plato: plato() },
      { fecha: '2026-09-07', orden: 2, plato: null }
    ]
  }
}

describe('DayCell', () => {
  it('muestra el nombre y el número del día, y los dos huecos', () => {
    render(<DayCell dia={dia()} nombreDia="Lunes" numeroDia={7} esHoy={false} onAbrirPicker={vi.fn()} onQuitar={vi.fn()} />)
    expect(screen.getByText('Lunes')).toBeInTheDocument()
    expect(screen.getByText('7')).toBeInTheDocument()
    expect(screen.getByText('Pasta')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /añadir/i })).toBeInTheDocument()
  })

  it('marca la celda de hoy con data-today', () => {
    const { container } = render(
      <DayCell dia={dia()} nombreDia="Lunes" numeroDia={7} esHoy onAbrirPicker={vi.fn()} onQuitar={vi.fn()} />
    )
    expect(container.querySelector('[data-today="true"]')).not.toBeNull()
  })

  it('propaga el orden correcto al abrir el picker del segundo hueco', async () => {
    const onAbrirPicker = vi.fn()
    render(<DayCell dia={dia()} nombreDia="Lunes" numeroDia={7} esHoy={false} onAbrirPicker={onAbrirPicker} onQuitar={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /añadir/i }))
    expect(onAbrirPicker).toHaveBeenCalledWith(2)
  })

  it('propaga el orden correcto al quitar el plato del primer hueco', async () => {
    const onQuitar = vi.fn()
    render(<DayCell dia={dia()} nombreDia="Lunes" numeroDia={7} esHoy={false} onAbrirPicker={vi.fn()} onQuitar={onQuitar} />)
    await userEvent.click(screen.getByRole('button', { name: /quitar pasta/i }))
    expect(onQuitar).toHaveBeenCalledWith(1)
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/planner/DayCell.test.tsx`
Expected: FAIL — el módulo `./DayCell` no existe todavía.

- [ ] **Step 3: Implementar `DayCell.tsx`**

Crear `web/src/features/planner/DayCell.tsx`:

```typescript
import type { DiaSemana } from '../../domain/semana'
import type { Orden } from '../../domain/types'
import { Slot } from './Slot'

const NOMBRE_HUECO: Record<Orden, string> = { 1: 'Primero', 2: 'Segundo' }

export interface DayCellProps {
  dia: DiaSemana
  nombreDia: string
  numeroDia: number
  esHoy: boolean
  onAbrirPicker: (orden: Orden) => void
  onQuitar: (orden: Orden) => void
}

export function DayCell({ dia, nombreDia, numeroDia, esHoy, onAbrirPicker, onQuitar }: DayCellProps) {
  return (
    <div
      data-today={esHoy}
      className="flex min-h-[328px] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-700 dark:bg-neutral-800"
    >
      <div className={`border-b border-neutral-200 px-3.5 pb-2.5 pt-3 dark:border-neutral-700 ${esHoy ? 'bg-amber-50 dark:bg-amber-950' : ''}`}>
        <div className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{nombreDia}</div>
        <div className="text-2xl font-bold tabular-nums">{numeroDia}</div>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2.5">
        {dia.huecos.map((asignacion) => (
          <Slot
            key={asignacion.orden}
            asignacion={asignacion}
            etiquetaHueco={NOMBRE_HUECO[asignacion.orden]}
            onAbrirPicker={() => onAbrirPicker(asignacion.orden)}
            onQuitar={() => onQuitar(asignacion.orden)}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/planner/DayCell.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Escribir el test de `WeekBoard`**

Crear `web/src/features/planner/WeekBoard.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { WeekBoard } from './WeekBoard'
import type { DiaSemana } from '../../domain/semana'

function diaVacio(fecha: string): DiaSemana {
  return {
    fecha,
    huecos: [
      { fecha, orden: 1, plato: null },
      { fecha, orden: 2, plato: null }
    ]
  }
}

const FECHAS = ['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11']

describe('WeekBoard', () => {
  it('renderiza los 5 días de la semana con sus nombres', () => {
    render(<WeekBoard dias={FECHAS.map(diaVacio)} hoyIso="2026-09-09" onAbrirPicker={vi.fn()} onQuitar={vi.fn()} />)
    ;['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].forEach((nombre) => {
      expect(screen.getByText(nombre)).toBeInTheDocument()
    })
  })

  it('marca como hoy solo el día que coincide con hoyIso', () => {
    const { container } = render(
      <WeekBoard dias={FECHAS.map(diaVacio)} hoyIso="2026-09-09" onAbrirPicker={vi.fn()} onQuitar={vi.fn()} />
    )
    expect(container.querySelectorAll('[data-today="true"]')).toHaveLength(1)
  })

  it('pasa la fecha del día correcto a onAbrirPicker', async () => {
    const onAbrirPicker = vi.fn()
    render(<WeekBoard dias={FECHAS.map(diaVacio)} hoyIso="2026-09-09" onAbrirPicker={onAbrirPicker} onQuitar={vi.fn()} />)
    const botones = screen.getAllByRole('button', { name: /añadir/i })
    await userEvent.click(botones[2])
    expect(onAbrirPicker).toHaveBeenCalledWith('2026-09-08', 1)
  })
})
```

- [ ] **Step 6: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/planner/WeekBoard.test.tsx`
Expected: FAIL — el módulo `./WeekBoard` no existe todavía.

- [ ] **Step 7: Implementar `WeekBoard.tsx`**

Crear `web/src/features/planner/WeekBoard.tsx`:

```typescript
import type { DiaSemana } from '../../domain/semana'
import type { Orden } from '../../domain/types'
import { DIAS_SEMANA } from '../../shared/semanaDates'
import { DayCell } from './DayCell'

export interface WeekBoardProps {
  dias: DiaSemana[]
  hoyIso: string
  onAbrirPicker: (fecha: string, orden: Orden) => void
  onQuitar: (fecha: string, orden: Orden) => void
}

export function WeekBoard({ dias, hoyIso, onAbrirPicker, onQuitar }: WeekBoardProps) {
  return (
    <section aria-label="Días de la semana" className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      {dias.map((dia, i) => (
        <DayCell
          key={dia.fecha}
          dia={dia}
          nombreDia={DIAS_SEMANA[i]}
          numeroDia={Number(dia.fecha.slice(8, 10))}
          esHoy={dia.fecha === hoyIso}
          onAbrirPicker={(orden) => onAbrirPicker(dia.fecha, orden)}
          onQuitar={(orden) => onQuitar(dia.fecha, orden)}
        />
      ))}
    </section>
  )
}
```

- [ ] **Step 8: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/planner/WeekBoard.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add web/src/features/planner/DayCell.tsx web/src/features/planner/DayCell.test.tsx web/src/features/planner/WeekBoard.tsx web/src/features/planner/WeekBoard.test.tsx
git commit -m "feat: componentes DayCell y WeekBoard del planificador"
```

---

### Task 9: `DishChip` y `Recetario`

**Files:**
- Create: `web/src/features/planner/DishChip.tsx`
- Create: `web/src/features/planner/DishChip.test.tsx`
- Create: `web/src/features/planner/Recetario.tsx`
- Create: `web/src/features/planner/Recetario.test.tsx`

**Interfaces:**
- Consumes: `Plato` de `domain/types.ts`; `colorVarDeEtiqueta` de `shared/tagColors.ts`
- Produces: `DishChip({plato})`, `Recetario({platos})` — usado por `PlannerPage.tsx` (Task 11)

- [ ] **Step 1: Escribir el test de `DishChip`**

Crear `web/src/features/planner/DishChip.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DishChip } from './DishChip'

describe('DishChip', () => {
  it('muestra el nombre y la etiqueta del plato', () => {
    render(
      <DishChip plato={{ id: 1, nombre: 'Gazpacho', temporadas: ['VERANO'], etiquetas: ['verdura'], notas: '', activo: true }} />
    )
    expect(screen.getByText('Gazpacho')).toBeInTheDocument()
    expect(screen.getByText('verdura')).toBeInTheDocument()
  })

  it('muestra el icono de temporada cuando el plato no vale para todas', () => {
    render(<DishChip plato={{ id: 1, nombre: 'Gazpacho', temporadas: ['VERANO'], etiquetas: [], notas: '', activo: true }} />)
    expect(screen.getByTitle('Temporada: VERANO')).toBeInTheDocument()
  })

  it('no muestra el icono de temporada cuando el plato vale para todas', () => {
    render(<DishChip plato={{ id: 1, nombre: 'Gazpacho', temporadas: ['TODAS'], etiquetas: [], notas: '', activo: true }} />)
    expect(screen.queryByTitle(/temporada/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/planner/DishChip.test.tsx`
Expected: FAIL — el módulo `./DishChip` no existe todavía.

- [ ] **Step 3: Implementar `DishChip.tsx`**

Crear `web/src/features/planner/DishChip.tsx`:

```typescript
import type { Plato } from '../../domain/types'
import { colorVarDeEtiqueta } from '../../shared/tagColors'

export interface DishChipProps {
  plato: Plato
}

export function DishChip({ plato }: DishChipProps) {
  const etiqueta = plato.etiquetas[0]
  const colorVar = etiqueta ? colorVarDeEtiqueta(etiqueta) : 'var(--tag-color-0)'
  const fueraDeTodas = !plato.temporadas.includes('TODAS') && plato.temporadas.length > 0

  return (
    <div
      style={{ borderLeft: `6px solid ${colorVar}` }}
      className="flex min-h-12 items-center gap-2.5 rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-900"
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-semibold">{plato.nombre}</span>
        {etiqueta && (
          <span className="text-[0.7rem] font-bold uppercase tracking-wide" style={{ color: colorVar }}>
            {etiqueta}
          </span>
        )}
      </div>
      {fueraDeTodas && (
        <span className="ml-auto text-sm opacity-70" title={`Temporada: ${plato.temporadas.join(', ')}`}>
          🌿
        </span>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/planner/DishChip.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Escribir el test de `Recetario`**

Crear `web/src/features/planner/Recetario.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { Recetario } from './Recetario'
import type { Plato } from '../../domain/types'

function plato(id: number, nombre: string): Plato {
  return { id, nombre, temporadas: ['TODAS'], etiquetas: [], notas: '', activo: true }
}

describe('Recetario', () => {
  it('muestra todos los platos recibidos', () => {
    render(<Recetario platos={[plato(1, 'Gazpacho'), plato(2, 'Pasta')]} />)
    expect(screen.getByText('Gazpacho')).toBeInTheDocument()
    expect(screen.getByText('Pasta')).toBeInTheDocument()
  })

  it('filtra por nombre al escribir en el buscador', async () => {
    render(<Recetario platos={[plato(1, 'Gazpacho'), plato(2, 'Pasta')]} />)
    await userEvent.type(screen.getByPlaceholderText('Buscar plato…'), 'gaz')
    expect(screen.getByText('Gazpacho')).toBeInTheDocument()
    expect(screen.queryByText('Pasta')).not.toBeInTheDocument()
  })

  it('muestra un mensaje cuando ningún plato coincide', async () => {
    render(<Recetario platos={[plato(1, 'Gazpacho')]} />)
    await userEvent.type(screen.getByPlaceholderText('Buscar plato…'), 'zzz')
    expect(screen.getByText('Ningún plato coincide')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/planner/Recetario.test.tsx`
Expected: FAIL — el módulo `./Recetario` no existe todavía.

- [ ] **Step 7: Implementar `Recetario.tsx`**

Crear `web/src/features/planner/Recetario.tsx`:

```typescript
import { useState } from 'react'
import type { Plato } from '../../domain/types'
import { DishChip } from './DishChip'

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
        {filtrados.length === 0 && <p className="py-3.5 text-center text-sm text-neutral-400">Ningún plato coincide</p>}
        {filtrados.map((plato) => (
          <DishChip key={plato.id} plato={plato} />
        ))}
      </div>
    </aside>
  )
}
```

- [ ] **Step 8: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/planner/Recetario.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add web/src/features/planner/DishChip.tsx web/src/features/planner/DishChip.test.tsx web/src/features/planner/Recetario.tsx web/src/features/planner/Recetario.test.tsx
git commit -m "feat: componentes DishChip y Recetario del planificador"
```

---

### Task 10: `useMonthPlan` y `MonthView`

**Files:**
- Create: `web/src/features/planner/useMonthPlan.ts`
- Create: `web/src/features/planner/useMonthPlan.test.tsx`
- Create: `web/src/features/planner/MonthView.tsx`
- Create: `web/src/features/planner/MonthView.test.tsx`

**Interfaces:**
- Consumes: `useCatalogo`, `usePlan` de `data/queries.ts`; `platosDelDia` de `domain/semana.ts` (Task 2); `lunesDe` de `shared/semanaDates.ts`; `colorVarDeEtiqueta` de `shared/tagColors.ts`
- Produces: `DiaMes`, `useMonthPlan(mesReferencia): {dias, cargando}`, `MonthView({dias, fechasSemanaActual, onSeleccionarDia})` — usados por `PlannerPage.tsx` (Task 11)

- [ ] **Step 1: Escribir el test de `useMonthPlan`**

Crear `web/src/features/planner/useMonthPlan.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/mswServer'
import { useMonthPlan } from './useMonthPlan'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('useMonthPlan', () => {
  it('devuelve 42 celdas cubriendo el mes visible, marcando los días fuera de mes', async () => {
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
    const { result } = renderHook(() => useMonthPlan(new Date(2026, 8, 15)), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.dias).toHaveLength(42)
    const dia7 = result.current.dias.find((d) => d.fecha === '2026-09-07')
    expect(dia7?.platos[0]?.nombre).toBe('Pasta')
    expect(dia7?.esOtroMes).toBe(false)
    const diaAgosto = result.current.dias.find((d) => d.fecha === '2026-08-31')
    expect(diaAgosto?.esOtroMes).toBe(true)
  })
})
```

Nota: septiembre de 2026 empieza en martes, así que la rejilla de 42 celdas del mes de referencia (15 de septiembre) arranca el lunes 31 de agosto — por eso `2026-08-31` debe existir en la lista y estar marcado como `esOtroMes: true`.

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/planner/useMonthPlan.test.tsx`
Expected: FAIL — el módulo `./useMonthPlan` no existe todavía.

- [ ] **Step 3: Implementar `useMonthPlan.ts`**

Crear `web/src/features/planner/useMonthPlan.ts`:

```typescript
import { addDays, format, startOfMonth } from 'date-fns'
import type { Plato } from '../../domain/types'
import { platosDelDia } from '../../domain/semana'
import { useCatalogo, usePlan } from '../../data/queries'
import { lunesDe } from '../../shared/semanaDates'

export interface DiaMes {
  fecha: string
  esOtroMes: boolean
  platos: Plato[]
}

export function useMonthPlan(mesReferencia: Date) {
  const inicio = lunesDe(startOfMonth(mesReferencia))
  const desde = format(inicio, 'yyyy-MM-dd')
  const hasta = format(addDays(inicio, 41), 'yyyy-MM-dd')
  const catalogo = useCatalogo()
  const plan = usePlan(desde, hasta)

  const platos = catalogo.data?.catalogo.platos ?? []
  const entries = plan.data ?? []
  const mes = mesReferencia.getMonth()

  const dias: DiaMes[] = Array.from({ length: 42 }, (_, i) => {
    const fecha = addDays(inicio, i)
    const iso = format(fecha, 'yyyy-MM-dd')
    return { fecha: iso, esOtroMes: fecha.getMonth() !== mes, platos: platosDelDia(iso, entries, platos) }
  })

  return { dias, cargando: catalogo.isLoading || plan.isLoading }
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/planner/useMonthPlan.test.tsx`
Expected: PASS (1 test)

- [ ] **Step 5: Escribir el test de `MonthView`**

Crear `web/src/features/planner/MonthView.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { MonthView } from './MonthView'
import type { DiaMes } from './useMonthPlan'
import type { Plato } from '../../domain/types'

function plato(): Plato {
  return { id: 1, nombre: 'Pasta', temporadas: ['TODAS'], etiquetas: ['pasta'], notas: '', activo: true }
}

function diasDeEjemplo(): DiaMes[] {
  return Array.from({ length: 42 }, (_, i) => ({
    fecha: `2026-08-${String(i + 1).padStart(2, '0')}`,
    esOtroMes: i < 1,
    platos: i === 7 ? [plato()] : []
  }))
}

describe('MonthView', () => {
  it('renderiza 7 cabeceras de día de la semana y una celda con punto por cada día con plato', () => {
    render(<MonthView dias={diasDeEjemplo()} fechasSemanaActual={[]} onSeleccionarDia={vi.fn()} />)
    ;['L', 'M', 'X', 'J', 'V', 'S', 'D'].forEach((d) => expect(screen.getAllByText(d).length).toBeGreaterThan(0))
    expect(screen.getAllByTestId('dia-punto')).toHaveLength(1)
  })

  it('llama a onSeleccionarDia con la fecha de la celda pulsada', async () => {
    const dias = diasDeEjemplo()
    const onSeleccionarDia = vi.fn()
    render(<MonthView dias={dias} fechasSemanaActual={[]} onSeleccionarDia={onSeleccionarDia} />)
    const celdas = screen.getAllByRole('button')
    await userEvent.click(celdas[10])
    expect(onSeleccionarDia).toHaveBeenCalledWith(dias[10].fecha)
  })

  it('marca las celdas fuera de mes con data-other-month', () => {
    const { container } = render(<MonthView dias={diasDeEjemplo()} fechasSemanaActual={[]} onSeleccionarDia={vi.fn()} />)
    expect(container.querySelectorAll('[data-other-month="true"]')).toHaveLength(1)
  })
})
```

- [ ] **Step 6: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/planner/MonthView.test.tsx`
Expected: FAIL — el módulo `./MonthView` no existe todavía.

- [ ] **Step 7: Implementar `MonthView.tsx`**

Crear `web/src/features/planner/MonthView.tsx`:

```typescript
import type { DiaMes } from './useMonthPlan'
import { colorVarDeEtiqueta } from '../../shared/tagColors'

const DIAS_CORTOS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export interface MonthViewProps {
  dias: DiaMes[]
  fechasSemanaActual: string[]
  onSeleccionarDia: (fecha: string) => void
}

export function MonthView({ dias, fechasSemanaActual, onSeleccionarDia }: MonthViewProps) {
  return (
    <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 shadow-sm dark:border-neutral-700 dark:bg-neutral-700">
      {DIAS_CORTOS.map((d) => (
        <div key={d} className="bg-neutral-50 py-2 text-center text-xs font-bold uppercase text-neutral-400 dark:bg-neutral-900">
          {d}
        </div>
      ))}
      {dias.map((dia) => {
        const enSemanaActual = fechasSemanaActual.includes(dia.fecha)
        return (
          <button
            type="button"
            key={dia.fecha}
            onClick={() => onSeleccionarDia(dia.fecha)}
            data-other-month={dia.esOtroMes}
            data-current-week={enSemanaActual}
            className={`relative min-h-[76px] p-2 text-left ${dia.esOtroMes ? 'bg-neutral-50 dark:bg-neutral-900' : 'bg-white dark:bg-neutral-800'} ${enSemanaActual ? 'ring-2 ring-inset ring-amber-500' : ''}`}
          >
            <span className={`text-sm font-bold tabular-nums ${dia.esOtroMes ? 'text-neutral-400' : ''}`}>{Number(dia.fecha.slice(8, 10))}</span>
            {dia.platos.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {dia.platos.map((plato, i) => (
                  <span
                    key={i}
                    data-testid="dia-punto"
                    className="h-1.75 w-1.75 rounded-full"
                    style={{ backgroundColor: colorVarDeEtiqueta(plato.etiquetas[0] ?? '') }}
                  />
                ))}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 8: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/planner/MonthView.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 9: Commit**

```bash
git add web/src/features/planner/useMonthPlan.ts web/src/features/planner/useMonthPlan.test.tsx web/src/features/planner/MonthView.tsx web/src/features/planner/MonthView.test.tsx
git commit -m "feat: hook useMonthPlan y componente MonthView (vista de mes de solo lectura)"
```

---

### Task 11: `PlannerPage` — integración completa

**Files:**
- Create: `web/src/features/planner/PlannerPage.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.test.tsx`
- Delete: `web/src/App.css`
- Delete: `web/src/assets/hero.png`
- Delete: `web/src/assets/react.svg`
- Delete: `web/src/assets/vite.svg`

**Interfaces:**
- Consumes: todo lo producido por las Tasks 1–10 (`useWeekPlan`, `useMonthPlan`, `Toolbar`+`VistaPlanner`, `RulesStrip`, `WeekBoard`, `Recetario`, `PlatoPicker`, `MonthView`, `lunesDe`/`fechasSemana`/`formatearRangoSemana`/`hoyIso`, `Orden`)
- Produces: `PlannerPage` — punto de entrada del planificador, montado por `App.tsx`

- [ ] **Step 1: Escribir el test de integración en `App.test.tsx`**

Reemplazar el contenido completo de `web/src/App.test.tsx` (actualmente prueba el scaffold de Vite, que ya no existe tras este task) por:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { server } from './test/mswServer'
import App from './App'

const API_URL = 'https://script.example.com/exec'

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  )
}

function mockBootstrapYPlan() {
  server.use(
    http.get(API_URL, ({ request }) => {
      const url = new URL(request.url)
      if (url.searchParams.get('action') === 'bootstrap') {
        return HttpResponse.json({
          ok: true,
          platos: [{ id_plato: 1, nombre: 'Gazpacho', temporada: 'TODAS', etiquetas: 'verdura', notas: '', activo: true }],
          ingredientes: [],
          ingredientesPlatos: [],
          reglas: [],
          proveedores: []
        })
      }
      return HttpResponse.json({ ok: true, entries: [] })
    })
  )
}

describe('App', () => {
  it('renderiza el planificador con el recetario y la semana vacía', async () => {
    mockBootstrapYPlan()
    renderApp()
    expect(await screen.findByText('Recetario')).toBeInTheDocument()
    expect(await screen.findByText('Gazpacho')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /añadir/i }).length).toBeGreaterThan(0)
  })

  it('permite asignar un plato a un hueco vacío mediante el selector', async () => {
    mockBootstrapYPlan()
    let accionRecibida: string | null = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { action: string }
        accionRecibida = body.action
        return HttpResponse.json({ ok: true, result: { id: 1 } })
      })
    )
    renderApp()
    const botonesAñadir = await screen.findAllByRole('button', { name: /añadir/i })
    await userEvent.click(botonesAñadir[0])
    await userEvent.click(await screen.findByRole('button', { name: /gazpacho/i }))
    await waitFor(() => expect(screen.queryByText('Elegir plato · Primero')).not.toBeInTheDocument())
    await waitFor(() => expect(accionRecibida).toBe('plan.set'))
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/App.test.tsx`
Expected: FAIL — `App` sigue renderizando el scaffold de Vite, no el planificador.

- [ ] **Step 3: Implementar `PlannerPage.tsx`**

Crear `web/src/features/planner/PlannerPage.tsx`:

```typescript
import { useState } from 'react'
import { addWeeks } from 'date-fns'
import type { Orden } from '../../domain/types'
import { fechasSemana, formatearRangoSemana, hoyIso, lunesDe } from '../../shared/semanaDates'
import { useWeekPlan } from './useWeekPlan'
import { useMonthPlan } from './useMonthPlan'
import { Toolbar } from './Toolbar'
import type { VistaPlanner } from './Toolbar'
import { RulesStrip } from './RulesStrip'
import { WeekBoard } from './WeekBoard'
import { Recetario } from './Recetario'
import { PlatoPicker } from './PlatoPicker'
import { MonthView } from './MonthView'

const NOMBRE_HUECO: Record<Orden, string> = { 1: 'Primero', 2: 'Segundo' }

export function PlannerPage() {
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [vista, setVista] = useState<VistaPlanner>('semana')
  const [picker, setPicker] = useState<{ fecha: string; orden: Orden } | null>(null)

  const semana = useWeekPlan(lunes)
  const mes = useMonthPlan(lunes)

  return (
    <div className="mx-auto max-w-[1560px] pb-7">
      <Toolbar
        rangoSemana={formatearRangoSemana(lunes)}
        vista={vista}
        guardando={semana.guardando}
        error={semana.error}
        onSemanaAnterior={() => setLunes((actual) => addWeeks(actual, -1))}
        onSemanaSiguiente={() => setLunes((actual) => addWeeks(actual, 1))}
        onCambiarVista={setVista}
      />

      {vista === 'semana' && <RulesStrip estados={semana.estadosRegla} />}

      {vista === 'semana' ? (
        <main className="grid grid-cols-1 gap-4 px-5 pt-3.5 lg:grid-cols-[1fr_300px]">
          <WeekBoard
            dias={semana.dias}
            hoyIso={hoyIso()}
            onAbrirPicker={(fecha, orden) => setPicker({ fecha, orden })}
            onQuitar={(fecha, orden) => semana.quitarPlato(fecha, orden)}
          />
          <Recetario platos={semana.platosActivos} />
        </main>
      ) : (
        <div className="px-5 pt-3.5">
          <MonthView
            dias={mes.dias}
            fechasSemanaActual={fechasSemana(lunes)}
            onSeleccionarDia={(fecha) => {
              setLunes(lunesDe(new Date(`${fecha}T00:00:00`)))
              setVista('semana')
            }}
          />
        </div>
      )}

      <PlatoPicker
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

- [ ] **Step 4: Reemplazar `App.tsx`**

Reemplazar el contenido completo de `web/src/App.tsx` por:

```typescript
import { PlannerPage } from './features/planner/PlannerPage'

function App() {
  return <PlannerPage />
}

export default App
```

- [ ] **Step 5: Borrar los archivos de la plantilla de Vite ya no usados**

```bash
rm web/src/App.css web/src/assets/hero.png web/src/assets/react.svg web/src/assets/vite.svg
```

- [ ] **Step 6: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/App.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 7: Commit**

```bash
git add web/src/features/planner/PlannerPage.tsx web/src/App.tsx web/src/App.test.tsx
git rm web/src/App.css web/src/assets/hero.png web/src/assets/react.svg web/src/assets/vite.svg
git commit -m "feat: PlannerPage — integrar el planificador completo como página principal"
```

---

### Task 12: Verificación final, actualización de la spec y publicación

**Files:**
- Modify: `docs/specs/2026-09-06-menu-familiar-design.md`

**Interfaces:**
- Consumes: nada nuevo
- Produces: nada — cierre del plan

- [ ] **Step 1: Verificación completa**

```bash
cd web
npm run lint
npm run test
npm run build
```

Expected: los tres comandos terminan sin error. El recuento de tests debe subir en unos 55 respecto al final del plan anterior (42), menos el test del scaffold de Vite que se sustituyó en `App.test.tsx` — el total exacto lo confirma la salida de `npm run test`.

- [ ] **Step 2: Verificación manual en el navegador**

```bash
cd web && npm run dev
```

Abrir la URL que imprime Vite y comprobar a mano:
- El recetario de la derecha muestra los platos reales del catálogo (o el mensaje de "Ningún plato coincide" si el catálogo está vacío) — confirma que `VITE_API_URL`/`VITE_API_TOKEN` de `web/.env.local` llegan hasta la API real.
- Tocar «Añadir» en un hueco vacío abre el selector; elegir un plato lo asigna y aparece en el hueco.
- Refrescar la página: el plato asignado sigue ahí (confirma que se escribió en la hoja de Google, no solo en memoria).
- Pulsar «×» en una tarjeta la quita.
- Si el catálogo tiene una regla activa y se asignan platos suficientes para incumplirla, aparece el chip de aviso correspondiente encima del tablero.
- Cambiar a la vista «Mes» muestra la rejilla de solo lectura con puntos en los días con plan; tocar un día vuelve a la vista de semana de esa fecha.
- Las flechas ‹ › cambian de semana y refrescan el tablero.
- Sin haber tocado nada, abrir las DevTools, activar el modo sin conexión (offline) y refrescar la página: el plan de la semana visitada más recientemente sigue apareciendo (confirma la persistencia de `PersistQueryClientProvider`).

Si algo de esto falla, anotarlo y arreglarlo antes de continuar — es la única verificación end-to-end de todo el plan contra la API real.

- [ ] **Step 3: Actualizar la spec**

En `docs/specs/2026-09-06-menu-familiar-design.md`, sustituir el párrafo final de la sección "Dominio y capa de datos del frontend (implementado)" (que empieza con "Pendiente para el plan del planificador...") por:

```markdown
Pendiente: las mutaciones de `plato`/`ingrediente`/`regla` para la página de
catálogo, y la lista de la compra (`compra.ts` ya existe y está testeado,
falta la UI). El planificador (calendario, recetario, selector, avisos de
reglas, vista de mes, persistencia offline) ya está construido — ver la
siguiente sección.
```

Y añadir, al final del fichero, una nueva sección:

```markdown
## Planificador (UI implementada)

`web/src/features/planner/` — interacción solo por toque (sin arrastrar; el
arrastrar-y-soltar de la maqueta queda para un plan posterior, como capa
aditiva sobre estos mismos componentes):

- `PlannerPage.tsx` — página principal, monta todo lo demás.
- `Toolbar.tsx` — navegación de semana, alternar semana/mes, indicador de
  sincronización (refleja también errores de las mutaciones, no solo de las
  lecturas).
- `RulesStrip.tsx` — chips con el resultado de `evaluarSemana` en vivo.
- `WeekBoard.tsx`/`DayCell.tsx`/`Slot.tsx`/`DishTile.tsx` — rejilla de 5 días
  × 2 huecos; hueco vacío abre `PlatoPicker`, hueco ocupado tiene botón de
  quitar. `DishTile` avisa si la fecha cae fuera de la temporada del plato
  (`domain/temporadas.ts`).
- `Recetario.tsx`/`DishChip.tsx` — búsqueda por nombre sobre los platos
  activos del catálogo.
- `PlatoPicker.tsx` — selector modal con búsqueda, única vía para asignar un
  plato en este plan.
- `MonthView.tsx` + `useMonthPlan.ts` — vista de solo lectura de 42 celdas
  con un punto de color por plato asignado; tocar un día salta a esa semana.
- `useWeekPlan.ts` — conecta `usePlan`/`useCatalogo`/`useSetPlanEntry`/
  `useDeletePlanEntry` con `domain/semana.ts` y `domain/reglas.ts`.
- `domain/semana.ts` — `construirSemana`, `aAsignaciones`, `platosDelDia`:
  puro, sin React, testeado.
- `shared/semanaDates.ts` / `shared/tagColors.ts` — utilidades de fecha
  (`date-fns`) y la paleta de 7 colores por etiqueta (variables CSS en
  `index.css`, ya validada como CVD-safe).
- `main.tsx` monta `PersistQueryClientProvider` con `idb-keyval` — el plan
  de la semana visitada sobrevive a un refresco sin conexión.

Pendiente (plan posterior): arrastrar-y-soltar sobre estos mismos
componentes.
```

- [ ] **Step 4: Commit y push**

```bash
git add docs/specs/2026-09-06-menu-familiar-design.md
git commit -m "docs: registrar el planificador (UI) en la spec"
git push origin main
```
