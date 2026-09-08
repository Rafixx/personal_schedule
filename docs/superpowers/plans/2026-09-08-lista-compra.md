# Lista de la compra — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir una pantalla de lista de la compra (agrupada por proveedor, con checkboxes "ya comprado" y copiar al portapapeles) para la semana actual o la siguiente, accesible desde una nueva ruta `/compra`.

**Architecture:** `domain/compra.ts` (ya existe, puro y testeado) gana una función de formateo de texto. Un nuevo hook `useShoppingList` en `features/shopping/` ancla el rango de fechas a una fecha de referencia que le pasa la página (mismo patrón que `useWeekPlan`/`useMonthPlan`), llama a los hooks de datos ya existentes (`useCatalogo`/`usePlan`) y gestiona el estado "ya comprado" en `localStorage`. `App.tsx` pasa a montar `react-router-dom` (primer uso real de esa dependencia) con dos rutas y una barra de navegación mínima.

**Tech Stack:** React 19, TypeScript, TanStack Query v5 (hooks ya existentes, sin cambios), `react-router-dom` v7 (ya instalado, sin usar hasta ahora), `date-fns`, Tailwind v4, Vitest + Testing Library + MSW.

**Spec:** `docs/specs/2026-09-06-menu-familiar-design.md` (sección "Lista de la compra (diseño)")

## Global Constraints

- TypeScript estricto: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax: true` (imports solo-tipo con `import type`).
- Todo lo que viva en `domain/` es puro, sin imports de React.
- Ninguna llamada directa a `sheetsClient` desde `features/` — todo pasa por los hooks de `data/queries.ts`.
- El rango de fechas de la lista de la compra siempre se ancla a una fecha de referencia recibida como parámetro (nunca `new Date()` dentro del hook) — mismo patrón que `useWeekPlan(lunes: Date)`/`useMonthPlan(mesReferencia: Date)`, necesario tanto por consistencia como para que los tests sean deterministas.
- El estado "ya comprado" vive solo en `localStorage` (nunca se escribe en la hoja de Google) y está separado por rango de fechas (`compra:${desde}:${hasta}`), así "esta semana" y "la semana que viene" no comparten ni acumulan marcados.
- La ruta por defecto (`/`) sigue siendo el planificador; los dos tests existentes de `App.test.tsx` no deben necesitar cambios de lógica, solo seguir pasando tal cual bajo el nuevo `App.tsx`.

---

### Task 1: `formatoTextoCompra` en el dominio + hook `useShoppingList`

**Files:**
- Modify: `web/src/domain/compra.ts`
- Modify: `web/src/domain/compra.test.ts`
- Create: `web/src/features/shopping/useShoppingList.ts`
- Test: `web/src/features/shopping/useShoppingList.test.tsx`

**Interfaces:**
- Consumes: `calcularCompra(plan, catalogo)` y los tipos `ListaCompra`/`LineaCompra` de `domain/compra.ts` (sin cambios); `useCatalogo()`/`usePlan(desde, hasta)` de `data/queries.ts` (sin cambios); `lunesDe(fecha)`/`fechasSemana(lunes)` de `shared/semanaDates.ts` (sin cambios); `addWeeks` de `date-fns`.
- Produces: `formatoTextoCompra(listas: ListaCompra[]): string` desde `domain/compra.ts`. `RangoCompra = 'actual' | 'siguiente'` y `useShoppingList(lunesActual: Date, rango: RangoCompra) → {listas: ListaCompra[], cargando: boolean, comprado(idIngrediente: number, unidad: string): boolean, marcarComprado(idIngrediente: number, unidad: string, valor: boolean): void}` desde `features/shopping/useShoppingList.ts`.

- [ ] **Step 1: Escribir el test de `formatoTextoCompra`**

La cabecera actual de `web/src/domain/compra.test.ts` es:

```typescript
import { describe, expect, it } from 'vitest'
import { calcularCompra } from './compra'
import type { Catalogo, PlanEntry } from './types'
```

Cambiar la segunda línea a `import { calcularCompra, formatoTextoCompra } from './compra'` y añadir debajo
una línea `import type { ListaCompra } from './compra'`. El resto de la cabecera y de los tests existentes
no cambia.

Añadir al final del fichero (después del último `})` de cierre):

```typescript
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
```

Asegúrate de que `formatoTextoCompra` y `ListaCompra` están importados en la cabecera de `compra.test.ts` desde `./compra` (añade `formatoTextoCompra` al import existente de `calcularCompra`, y `ListaCompra` como `import type` si el fichero usa `verbatimModuleSyntax` — comprueba cómo importa el resto del fichero los tipos y sigue el mismo estilo).

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/domain/compra.test.ts`
Expected: FAIL — `formatoTextoCompra` no existe.

- [ ] **Step 3: Implementar `formatoTextoCompra`**

Añadir al final de `web/src/domain/compra.ts`:

```typescript
export function formatoTextoCompra(listas: ListaCompra[]): string {
  return listas
    .map((lista) => {
      const lineas = lista.lineas.map((l) => `- ${l.nombre}: ${l.cantidad} ${l.unidad}`).join('\n')
      return `${lista.proveedor.toUpperCase()}\n${lineas}`
    })
    .join('\n\n')
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/domain/compra.test.ts`
Expected: PASS

- [ ] **Step 5: Escribir los tests de `useShoppingList`**

Crear `web/src/features/shopping/useShoppingList.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { server } from '../../test/mswServer'
import { useShoppingList } from './useShoppingList'

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
          platos: [{ id_plato: 1, nombre: 'Gazpacho', temporada: 'TODAS', etiquetas: '', notas: '', activo: true }],
          ingredientes: [
            {
              id_ingrediente: 1,
              nombre: 'Tomate',
              proveedor: 'Mercadona',
              unidad_base: 'g',
              temporada: 'TODAS',
              kcal_100: '',
              prot_100: '',
              carb_100: '',
              grasa_100: ''
            }
          ],
          ingredientesPlatos: [{ id: 1, id_plato: 1, id_ingrediente: 1, cantidad: 500, unidad: 'g' }],
          reglas: [],
          proveedores: [{ nombre: 'Mercadona', orden: 1 }]
        })
      }
      return HttpResponse.json({ ok: true, entries })
    })
  )
}

beforeEach(() => localStorage.clear())

describe('useShoppingList', () => {
  it('agrega los ingredientes del plan de la semana actual por proveedor', async () => {
    mockApi([{ id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    const { result } = renderHook(() => useShoppingList(new Date(2026, 8, 7), 'actual'), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.listas).toEqual([
      {
        proveedor: 'Mercadona',
        lineas: [{ idIngrediente: 1, nombre: 'Tomate', proveedor: 'Mercadona', cantidad: 500, unidad: 'g' }]
      }
    ])
  })

  it('la semana siguiente consulta el rango de la semana después de la actual', async () => {
    mockApi([{ id: 1, fecha: '2026-09-14', turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    const { result } = renderHook(() => useShoppingList(new Date(2026, 8, 7), 'siguiente'), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.listas).toHaveLength(1)
  })

  it('marcarComprado persiste el estado y comprado lo refleja', async () => {
    mockApi([{ id: 1, fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    const { result } = renderHook(() => useShoppingList(new Date(2026, 8, 7), 'actual'), { wrapper })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    expect(result.current.comprado(1, 'g')).toBe(false)

    result.current.marcarComprado(1, 'g', true)

    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(true))
    expect(localStorage.getItem('compra:2026-09-07:2026-09-11')).toContain('"1|g":true')
  })

  it('actual y siguiente tienen checklists de comprado independientes', async () => {
    mockApi([])
    const { result, rerender } = renderHook(({ rango }: { rango: 'actual' | 'siguiente' }) => useShoppingList(new Date(2026, 8, 7), rango), {
      wrapper,
      initialProps: { rango: 'actual' }
    })
    await waitFor(() => expect(result.current.cargando).toBe(false))
    result.current.marcarComprado(1, 'g', true)
    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(true))

    rerender({ rango: 'siguiente' })

    await waitFor(() => expect(result.current.comprado(1, 'g')).toBe(false))
  })
})
```

- [ ] **Step 6: Ejecutar los tests y ver que fallan**

Run: `cd web && npx vitest run src/features/shopping/useShoppingList.test.tsx`
Expected: FAIL — el módulo `./useShoppingList` no existe.

- [ ] **Step 7: Implementar `useShoppingList`**

Crear `web/src/features/shopping/useShoppingList.ts`:

```typescript
import { useEffect, useState } from 'react'
import { addWeeks } from 'date-fns'
import type { ListaCompra } from '../../domain/compra'
import { calcularCompra } from '../../domain/compra'
import { useCatalogo, usePlan } from '../../data/queries'
import { fechasSemana } from '../../shared/semanaDates'

export type RangoCompra = 'actual' | 'siguiente'

function claveComprado(desde: string, hasta: string): string {
  return `compra:${desde}:${hasta}`
}

function leerComprado(desde: string, hasta: string): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(claveComprado(desde, hasta))
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

export function useShoppingList(lunesActual: Date, rango: RangoCompra) {
  const lunes = rango === 'actual' ? lunesActual : addWeeks(lunesActual, 1)
  const fechas = fechasSemana(lunes)
  const desde = fechas[0]
  const hasta = fechas[4]

  const catalogo = useCatalogo()
  const plan = usePlan(desde, hasta)
  const [comprados, setComprados] = useState<Record<string, boolean>>(() => leerComprado(desde, hasta))

  useEffect(() => {
    setComprados(leerComprado(desde, hasta))
  }, [desde, hasta])

  function comprado(idIngrediente: number, unidad: string): boolean {
    return comprados[`${idIngrediente}|${unidad}`] === true
  }

  function marcarComprado(idIngrediente: number, unidad: string, valor: boolean): void {
    setComprados((anteriores) => {
      const siguientes = { ...anteriores, [`${idIngrediente}|${unidad}`]: valor }
      try {
        localStorage.setItem(claveComprado(desde, hasta), JSON.stringify(siguientes))
      } catch {
        // localStorage puede fallar (modo privado, cuota agotada); el estado en memoria sigue
        // funcionando el resto de la sesión aunque no sobreviva a un refresco.
      }
      return siguientes
    })
  }

  const listas: ListaCompra[] = catalogo.data && plan.data ? calcularCompra(plan.data, catalogo.data.catalogo) : []

  return {
    listas,
    cargando: catalogo.isLoading || plan.isLoading,
    comprado,
    marcarComprado
  }
}
```

- [ ] **Step 8: Ejecutar los tests y ver que pasan**

Run: `cd web && npx vitest run src/features/shopping/useShoppingList.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 9: Commit**

```bash
git add web/src/domain/compra.ts web/src/domain/compra.test.ts web/src/features/shopping/useShoppingList.ts web/src/features/shopping/useShoppingList.test.tsx
git commit -m "feat: formatoTextoCompra y hook useShoppingList

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VdDPpz83MW4Kxs3UwHFrhG"
```

---

### Task 2: Componente `ProviderGroup`

**Files:**
- Create: `web/src/features/shopping/ProviderGroup.tsx`
- Test: `web/src/features/shopping/ProviderGroup.test.tsx`

**Interfaces:**
- Consumes: tipo `ListaCompra` de `domain/compra.ts` (Task 1, sin cambios en este task).
- Produces: `ProviderGroupProps { lista: ListaCompra; comprado: (idIngrediente: number, unidad: string) => boolean; onMarcar: (idIngrediente: number, unidad: string, valor: boolean) => void }` y el componente `ProviderGroup` desde `features/shopping/ProviderGroup.tsx` — lo consume Task 3.

- [ ] **Step 1: Escribir el test**

Crear `web/src/features/shopping/ProviderGroup.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ProviderGroup } from './ProviderGroup'
import type { ListaCompra } from '../../domain/compra'

const lista: ListaCompra = {
  proveedor: 'Mercadona',
  lineas: [
    { idIngrediente: 1, nombre: 'Tomate', proveedor: 'Mercadona', cantidad: 500, unidad: 'g' },
    { idIngrediente: 2, nombre: 'Pasta', proveedor: 'Mercadona', cantidad: 2, unidad: 'paquete' }
  ]
}

describe('ProviderGroup', () => {
  it('muestra el proveedor y cada línea con su cantidad', () => {
    render(<ProviderGroup lista={lista} comprado={() => false} onMarcar={vi.fn()} />)
    expect(screen.getByText('Mercadona')).toBeInTheDocument()
    expect(screen.getByText('Tomate: 500 g')).toBeInTheDocument()
    expect(screen.getByText('Pasta: 2 paquete')).toBeInTheDocument()
  })

  it('marca el checkbox como marcado cuando comprado devuelve true para esa línea', () => {
    render(<ProviderGroup lista={lista} comprado={(id) => id === 1} onMarcar={vi.fn()} />)
    expect(screen.getByRole('checkbox', { name: /tomate/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /pasta/i })).not.toBeChecked()
  })

  it('llama a onMarcar con idIngrediente, unidad y el nuevo valor al marcar', async () => {
    const onMarcar = vi.fn()
    render(<ProviderGroup lista={lista} comprado={() => false} onMarcar={onMarcar} />)
    await userEvent.click(screen.getByRole('checkbox', { name: /tomate/i }))
    expect(onMarcar).toHaveBeenCalledWith(1, 'g', true)
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/shopping/ProviderGroup.test.tsx`
Expected: FAIL — el módulo `./ProviderGroup` no existe.

- [ ] **Step 3: Implementar `ProviderGroup`**

Crear `web/src/features/shopping/ProviderGroup.tsx`:

```typescript
import type { ListaCompra } from '../../domain/compra'

export interface ProviderGroupProps {
  lista: ListaCompra
  comprado: (idIngrediente: number, unidad: string) => boolean
  onMarcar: (idIngrediente: number, unidad: string, valor: boolean) => void
}

export function ProviderGroup({ lista, comprado, onMarcar }: ProviderGroupProps) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      <h3 className="mb-2.5 text-base font-semibold">{lista.proveedor}</h3>
      <ul className="flex flex-col gap-2">
        {lista.lineas.map((linea) => {
          const marcado = comprado(linea.idIngrediente, linea.unidad)
          return (
            <li key={`${linea.idIngrediente}-${linea.unidad}`}>
              <label className="flex min-h-11 items-center gap-2.5 rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3.5 py-2 dark:border-neutral-600 dark:bg-neutral-900">
                <input
                  type="checkbox"
                  checked={marcado}
                  onChange={(e) => onMarcar(linea.idIngrediente, linea.unidad, e.target.checked)}
                  className="h-5 w-5"
                />
                <span className={marcado ? 'text-neutral-400 line-through' : ''}>
                  {linea.nombre}: {linea.cantidad} {linea.unidad}
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/shopping/ProviderGroup.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 5: Commit**

```bash
git add web/src/features/shopping/ProviderGroup.tsx web/src/features/shopping/ProviderGroup.test.tsx
git commit -m "feat: componente ProviderGroup del listado de la compra

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VdDPpz83MW4Kxs3UwHFrhG"
```

---

### Task 3: `ShoppingListPage`

**Files:**
- Create: `web/src/features/shopping/ShoppingListPage.tsx`
- Test: `web/src/features/shopping/ShoppingListPage.test.tsx`
- Modify: `web/src/test/setup.ts`

**Interfaces:**
- Consumes: `useShoppingList(lunesActual, rango)` y `RangoCompra` de Task 1; `ProviderGroup` de Task 2; `formatoTextoCompra` de Task 1; `lunesDe` de `shared/semanaDates.ts`.
- Produces: el componente `ShoppingListPage` desde `features/shopping/ShoppingListPage.tsx` — lo consume Task 4.

- [ ] **Step 1: Añadir el mock de `navigator.clipboard` al setup de tests**

`jsdom` no implementa `navigator.clipboard`; sin este mock, cualquier test que llame a `clipboard.writeText` lanza un error. Reemplazar el contenido completo de `web/src/test/setup.ts` por:

```typescript
import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll, vi } from 'vitest'
import { server } from './mswServer'

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
  configurable: true
})
```

- [ ] **Step 2: Escribir el test de `ShoppingListPage`**

Crear `web/src/features/shopping/ShoppingListPage.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import { fechasSemana, lunesDe } from '../../shared/semanaDates'
import { ShoppingListPage } from './ShoppingListPage'

const API_URL = 'https://script.example.com/exec'
const fechaHoy = fechasSemana(lunesDe(new Date()))[0]

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
          platos: [{ id_plato: 1, nombre: 'Gazpacho', temporada: 'TODAS', etiquetas: '', notas: '', activo: true }],
          ingredientes: [
            {
              id_ingrediente: 1,
              nombre: 'Tomate',
              proveedor: 'Mercadona',
              unidad_base: 'g',
              temporada: 'TODAS',
              kcal_100: '',
              prot_100: '',
              carb_100: '',
              grasa_100: ''
            }
          ],
          ingredientesPlatos: [{ id: 1, id_plato: 1, id_ingrediente: 1, cantidad: 500, unidad: 'g' }],
          reglas: [],
          proveedores: [{ nombre: 'Mercadona', orden: 1 }]
        })
      }
      return HttpResponse.json({ ok: true, entries })
    })
  )
}

beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
})

describe('ShoppingListPage', () => {
  it('muestra la lista de la semana actual agrupada por proveedor', async () => {
    mockApi([{ id: 1, fecha: fechaHoy, turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    render(<ShoppingListPage />, { wrapper })
    expect(await screen.findByText('Mercadona')).toBeInTheDocument()
    expect(screen.getByText('Tomate: 500 g')).toBeInTheDocument()
  })

  it('muestra un mensaje cuando no hay platos planificados', async () => {
    mockApi([])
    render(<ShoppingListPage />, { wrapper })
    await waitFor(() => expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument())
    expect(screen.getByText('No hay platos planificados para esta semana.')).toBeInTheDocument()
  })

  it('copiar al portapapeles envía el texto formateado', async () => {
    mockApi([{ id: 1, fecha: fechaHoy, turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' }])
    render(<ShoppingListPage />, { wrapper })
    await screen.findByText('Mercadona')
    await userEvent.click(screen.getByRole('button', { name: /copiar/i }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('MERCADONA\n- Tomate: 500 g')
    expect(await screen.findByRole('button', { name: /copiado/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Ejecutar los tests y ver que fallan**

Run: `cd web && npx vitest run src/features/shopping/ShoppingListPage.test.tsx`
Expected: FAIL — el módulo `./ShoppingListPage` no existe.

- [ ] **Step 4: Implementar `ShoppingListPage`**

Crear `web/src/features/shopping/ShoppingListPage.tsx`:

```typescript
import { useState } from 'react'
import type { RangoCompra } from './useShoppingList'
import { useShoppingList } from './useShoppingList'
import { ProviderGroup } from './ProviderGroup'
import { formatoTextoCompra } from '../../domain/compra'
import { lunesDe } from '../../shared/semanaDates'

export function ShoppingListPage() {
  const [lunesActual] = useState(() => lunesDe(new Date()))
  const [rango, setRango] = useState<RangoCompra>('actual')
  const [copiado, setCopiado] = useState(false)
  const { listas, cargando, comprado, marcarComprado } = useShoppingList(lunesActual, rango)

  async function copiar() {
    await navigator.clipboard.writeText(formatoTextoCompra(listas))
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  return (
    <div className="mx-auto max-w-2xl px-5 pb-7 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2 rounded-full bg-neutral-100 p-1 dark:bg-neutral-800">
          <button
            type="button"
            onClick={() => setRango('actual')}
            aria-pressed={rango === 'actual'}
            className={
              rango === 'actual'
                ? 'rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900'
                : 'rounded-full px-4.5 py-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300'
            }
          >
            Esta semana
          </button>
          <button
            type="button"
            onClick={() => setRango('siguiente')}
            aria-pressed={rango === 'siguiente'}
            className={
              rango === 'siguiente'
                ? 'rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900'
                : 'rounded-full px-4.5 py-2 text-sm font-semibold text-neutral-600 dark:text-neutral-300'
            }
          >
            La semana que viene
          </button>
        </div>
        <button
          type="button"
          onClick={copiar}
          disabled={listas.length === 0}
          className="rounded-full bg-neutral-900 px-4.5 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
      </div>

      {cargando && <p className="pt-6 text-center text-neutral-500">Cargando…</p>}
      {!cargando && listas.length === 0 && (
        <p className="pt-6 text-center text-neutral-500">No hay platos planificados para esta semana.</p>
      )}

      <div className="flex flex-col gap-3 pt-4">
        {listas.map((lista) => (
          <ProviderGroup key={lista.proveedor} lista={lista} comprado={comprado} onMarcar={marcarComprado} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Ejecutar los tests y ver que pasan**

Run: `cd web && npx vitest run src/features/shopping/ShoppingListPage.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 6: Ejecutar la suite completa**

Run: `cd web && npm run test -- --run`
Expected: PASS — el mock de `navigator.clipboard` en `test/setup.ts` es global, así que también corre para el resto de ficheros; no debería romper ningún test existente (ninguno usa `navigator.clipboard` hasta ahora).

- [ ] **Step 7: Commit**

```bash
git add web/src/features/shopping/ShoppingListPage.tsx web/src/features/shopping/ShoppingListPage.test.tsx web/src/test/setup.ts
git commit -m "feat: página ShoppingListPage con copiar al portapapeles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VdDPpz83MW4Kxs3UwHFrhG"
```

---

### Task 4: Rutas, `NavBar` e integración en `App.tsx`

**Files:**
- Create: `web/src/NavBar.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.test.tsx`

**Interfaces:**
- Consumes: `PlannerPage` (ya existe); `ShoppingListPage` de Task 3; `BrowserRouter`/`Routes`/`Route`/`NavLink` de `react-router-dom`.
- Produces: `App` con routing — no tiene más consumidores dentro de este plan (es la página raíz que monta `main.tsx`, sin cambios ahí).

- [ ] **Step 1: Escribir el test de navegación**

El final actual de `web/src/App.test.tsx` es:

```typescript
    const botonesAñadirTrasCierre = await screen.findAllByRole('button', { name: /añadir/i })
    await userEvent.click(botonesAñadirTrasCierre[1])
    const dialogoDos = await screen.findByRole('dialog')
    expect(within(dialogoDos).getByPlaceholderText('Buscar plato…')).toHaveValue('')
  })
})
```

Insertar el nuevo test entre el `})` que cierra el `it(...)` anterior y el `})` final que cierra el `describe(...)`:

```typescript
  it('navega a la lista de la compra desde la barra de navegación', async () => {
    mockBootstrapYPlan()
    renderApp()
    await screen.findByText('Recetario')

    await userEvent.click(screen.getByRole('link', { name: /compra/i }))

    expect(await screen.findByRole('button', { name: /esta semana/i })).toBeInTheDocument()
    expect(screen.queryByText('Recetario')).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/App.test.tsx`
Expected: FAIL — no existe ningún `link` con nombre accesible "compra" (la app actual no tiene navegación ni ruta `/compra`).

- [ ] **Step 3: Implementar `NavBar`**

Crear `web/src/NavBar.tsx`:

```typescript
import { NavLink } from 'react-router-dom'

function claseEnlace({ isActive }: { isActive: boolean }): string {
  return isActive
    ? 'rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900'
    : 'rounded-full px-4.5 py-2 text-sm font-semibold text-white/70 hover:bg-white/10'
}

export function NavBar() {
  return (
    <nav className="flex justify-center gap-0.5 bg-neutral-900 p-2" aria-label="Navegación principal">
      <NavLink to="/" end className={claseEnlace}>
        Planificador
      </NavLink>
      <NavLink to="/compra" className={claseEnlace}>
        Compra
      </NavLink>
    </nav>
  )
}
```

- [ ] **Step 4: Reemplazar `App.tsx` con las rutas**

Reemplazar el contenido completo de `web/src/App.tsx` por:

```typescript
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { NavBar } from './NavBar'
import { PlannerPage } from './features/planner/PlannerPage'
import { ShoppingListPage } from './features/shopping/ShoppingListPage'

function App() {
  return (
    <BrowserRouter>
      <NavBar />
      <Routes>
        <Route path="/" element={<PlannerPage />} />
        <Route path="/compra" element={<ShoppingListPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 5: Ejecutar todos los tests de `App.test.tsx` y ver que pasan**

Run: `cd web && npx vitest run src/App.test.tsx`
Expected: PASS (4/4) — los tres tests existentes siguen pasando sin modificarlos (la ruta por defecto `/` sigue renderizando `PlannerPage`), más el nuevo test de navegación.

- [ ] **Step 6: Ejecutar la suite completa, lint y build**

```bash
cd web
npm run lint
npm run test -- --run
npm run build
```

Expected: los tres comandos terminan sin error.

- [ ] **Step 7: Commit**

```bash
git add web/src/NavBar.tsx web/src/App.tsx web/src/App.test.tsx
git commit -m "feat: rutas con react-router-dom y NavBar — integra la lista de la compra

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VdDPpz83MW4Kxs3UwHFrhG"
```

---

### Task 5: Verificación manual, actualizar la spec y publicar

**Files:**
- Modify: `docs/specs/2026-09-06-menu-familiar-design.md`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada — cierre del plan.

- [ ] **Step 1: Verificación manual en el navegador**

```bash
cd web && npm run dev
```

Abrir la URL que imprime Vite y comprobar a mano:
- La barra de navegación superior muestra "Planificador" y "Compra"; el planificador sigue funcionando igual que antes.
- Tocar "Compra" navega a `/compra` y muestra la lista agrupada por proveedor para la semana actual (contra la API real — usa el mismo `.env.local` que el resto de la app).
- Alternar a "La semana que viene" recalcula la lista para esa semana.
- Marcar un ingrediente como comprado lo tacha; refrescar la página y comprobar que sigue marcado (confirma la persistencia en `localStorage`).
- Cambiar entre "Esta semana" y "La semana que viene" y comprobar que los marcados de una no aparecen en la otra.
- Pulsar "Copiar" y pegar en cualquier campo de texto para comprobar el formato (proveedor en mayúsculas, una línea por ingrediente).
- Volver a "Planificador" desde la barra de navegación y comprobar que el estado de la semana visible no se ha perdido.

Si algo de esto falla, anotarlo y arreglarlo antes de continuar.

- [ ] **Step 2: Actualizar la spec**

En `docs/specs/2026-09-06-menu-familiar-design.md`, sustituir el título de la sección `## Lista de la compra (diseño)` por `## Lista de la compra (implementada)`, y añadir al final de esa sección (antes de la línea "Pendiente (plan posterior): catálogo..."):

```markdown

**Implementado:** todo lo descrito arriba, construido tal cual. `App.tsx`
monta `BrowserRouter` con `NavBar` + rutas `/` (planificador) y `/compra`
(lista de la compra) — primer uso real de `react-router-dom` en el proyecto.
```

- [ ] **Step 3: Commit y push**

```bash
git add docs/specs/2026-09-06-menu-familiar-design.md
git commit -m "docs: marcar implementada la lista de la compra en la spec

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VdDPpz83MW4Kxs3UwHFrhG"
git push origin main
```
