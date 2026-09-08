# Catálogo (CRUD) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar de alta, editar y borrar platos, ingredientes y reglas desde la app (hoy solo se puede a mano en la hoja de Google), en una nueva ruta `/catalogo` con pestañas Platos/Ingredientes/Reglas.

**Architecture:** La API de Apps Script ya soporta todas estas mutaciones (`plato.upsert/delete`, `ingrediente.upsert/delete`, `platoIngredientes.replace`, `regla.upsert/delete`) — este plan es solo frontend. `data/queries.ts` gana 7 hooks de mutación que invalidan `['catalogo']`. `features/catalog/` gana un formulario y una lista por entidad (primer uso real de `react-hook-form`+`@hookform/resolvers/zod`), más un editor anidado de ingredientes dentro del formulario de plato. `CatalogPage` compone las tres pestañas y se integra en `shared/AppBar.tsx` (tercer enlace) y en `App.tsx` (tercera ruta).

**Tech Stack:** React 19, TypeScript, TanStack Query v5, `react-hook-form` v7.87 + `@hookform/resolvers/zod` v5.9 + `zod` v4.5 (todos ya instalados, sin usar hasta ahora), Tailwind v4, Vitest + Testing Library + MSW.

**Spec:** `docs/specs/2026-09-06-menu-familiar-design.md` (sección "Catálogo — CRUD de platos, ingredientes y reglas (diseño)")

## Global Constraints

- TypeScript estricto: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax: true` (imports solo-tipo con `import type`).
- Ninguna llamada directa a `sheetsClient` desde `features/` — todo pasa por los hooks de `data/queries.ts`.
- Las 7 mutaciones nuevas invalidan `queryKey: ['catalogo']` al terminar (`onSuccess`). Ninguna usa actualización optimista (es una acción deliberada vía botón "Guardar", no un toque frecuente — ver la spec).
- Borrado: `plato.delete` es lógico (`activo=false`, reversible, sin confirmación) — en la UI es un toggle "Desactivar"/"Reactivar" en la fila de la lista, no en el formulario. `ingrediente.delete`/`regla.delete` son físicos y sin deshacer — llevan `window.confirm` antes de enviarse.
- Los payloads que viajan a la API usan las claves en español de la hoja (`id_plato`, `unidad_base`, `temporada` como string separado por comas, etc. — igual que el resto de `data/queries.ts`); los componentes y hooks manejan siempre los tipos de dominio (`Plato`, `Ingrediente`, `Regla`, `Temporada[]`).
- Los formularios usan `zodResolver` de `@hookform/resolvers/zod` contra un schema en `features/catalog/schemas.ts` — un schema de formulario, distinto de los schemas de `data/schemas.ts` (esos validan filas crudas de la API; estos validan lo que teclea el usuario).

---

### Task 1: hooks de mutación del catálogo

**Files:**
- Modify: `web/src/data/queries.ts`
- Modify: `web/src/data/queries.test.tsx`

**Interfaces:**
- Consumes: `sheetsClient.apiPost` (`data/client.ts`, sin cambios); tipos `Plato`, `Ingrediente`, `Regla`, `Temporada`, `TipoRegla` de `domain/types.ts`.
- Produces: `usePlatoUpsert()`, `usePlatoDelete()`, `useIngredienteUpsert()`, `useIngredienteDelete()`, `usePlatoIngredientesReplace()`, `useReglaUpsert()`, `useReglaDelete()` desde `data/queries.ts` — los consumen las Tasks 2-5.

- [ ] **Step 1: Escribir los tests de los 7 hooks**

Añadir al final de `web/src/data/queries.test.tsx` (después del `describe('useSetPlanEntry', ...)` ya existente; el import de la cabecera pasa de `import { useCatalogo, useSetPlanEntry } from './queries'` a incluir los 7 hooks nuevos):

```typescript
describe('usePlatoUpsert', () => {
  it('crea un plato nuevo con temporadas y etiquetas unidas por comas', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_plato: 9 } })
      })
    )
    const { result } = renderHook(() => usePlatoUpsert(), { wrapper })
    result.current.mutate({
      nombre: 'Lentejas',
      temporadas: ['OTOÑO', 'INVIERNO'],
      etiquetas: ['legumbre'],
      notas: '',
      activo: true
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'plato.upsert',
      token: 'test-token',
      payload: { nombre: 'Lentejas', temporada: 'OTOÑO,INVIERNO', etiquetas: 'legumbre', notas: '', activo: true }
    })
    expect(result.current.data).toEqual({ id_plato: 9 })
  })

  it('incluye el id al editar un plato existente', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_plato: 3 } })
      })
    )
    const { result } = renderHook(() => usePlatoUpsert(), { wrapper })
    result.current.mutate({
      id: 3,
      nombre: 'Gazpacho',
      temporadas: ['VERANO'],
      etiquetas: [],
      notas: '',
      activo: true
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'plato.upsert',
      token: 'test-token',
      payload: { id_plato: 3, nombre: 'Gazpacho', temporada: 'VERANO', etiquetas: '', notas: '', activo: true }
    })
  })
})

describe('usePlatoDelete', () => {
  it('llama a plato.delete con el id', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    const { result } = renderHook(() => usePlatoDelete(), { wrapper })
    result.current.mutate({ id: 3 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({ action: 'plato.delete', token: 'test-token', payload: { id_plato: 3 } })
  })
})

describe('useIngredienteUpsert', () => {
  it('crea un ingrediente nuevo con macros opcionales', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_ingrediente: 12 } })
      })
    )
    const { result } = renderHook(() => useIngredienteUpsert(), { wrapper })
    result.current.mutate({
      nombre: 'Lenteja',
      proveedor: 'Mercadona',
      unidadBase: 'g',
      temporadas: ['TODAS'],
      kcal100: 350
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'ingrediente.upsert',
      token: 'test-token',
      payload: {
        nombre: 'Lenteja',
        proveedor: 'Mercadona',
        unidad_base: 'g',
        temporada: 'TODAS',
        kcal_100: 350
      }
    })
  })
})

describe('useIngredienteDelete', () => {
  it('llama a ingrediente.delete con el id', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    const { result } = renderHook(() => useIngredienteDelete(), { wrapper })
    result.current.mutate({ id: 12 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'ingrediente.delete',
      token: 'test-token',
      payload: { id_ingrediente: 12 }
    })
  })
})

describe('usePlatoIngredientesReplace', () => {
  it('envía id_plato y la lista de líneas con las claves de la API', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_plato: 3, count: 2 } })
      })
    )
    const { result } = renderHook(() => usePlatoIngredientesReplace(), { wrapper })
    result.current.mutate({
      idPlato: 3,
      ingredientes: [
        { idIngrediente: 1, cantidad: 500, unidad: 'g' },
        { idIngrediente: 2, cantidad: 1, unidad: 'ud' }
      ]
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'platoIngredientes.replace',
      token: 'test-token',
      payload: {
        id_plato: 3,
        ingredientes: [
          { id_ingrediente: 1, cantidad: 500, unidad: 'g' },
          { id_ingrediente: 2, cantidad: 1, unidad: 'ud' }
        ]
      }
    })
  })
})

describe('useReglaUpsert', () => {
  it('crea una regla nueva', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id: 4 } })
      })
    )
    const { result } = renderHook(() => useReglaUpsert(), { wrapper })
    result.current.mutate({ etiqueta: 'pescado', tipo: 'MIN_SEMANA', valor: 2, activa: true })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({
      action: 'regla.upsert',
      token: 'test-token',
      payload: { etiqueta: 'pescado', tipo: 'MIN_SEMANA', valor: 2, activa: true }
    })
  })
})

describe('useReglaDelete', () => {
  it('llama a regla.delete con el id', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    const { result } = renderHook(() => useReglaDelete(), { wrapper })
    result.current.mutate({ id: 4 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(payloadRecibido).toEqual({ action: 'regla.delete', token: 'test-token', payload: { id: 4 } })
  })
})
```

Cambiar la línea de import de `./queries` en la cabecera del fichero a:

```typescript
import {
  useCatalogo,
  useIngredienteDelete,
  useIngredienteUpsert,
  usePlatoDelete,
  usePlatoIngredientesReplace,
  usePlatoUpsert,
  useReglaDelete,
  useReglaUpsert,
  useSetPlanEntry
} from './queries'
```

- [ ] **Step 2: Ejecutar los tests y ver que fallan**

Run: `cd web && npx vitest run src/data/queries.test.tsx`
Expected: FAIL — ninguno de los 7 hooks existe todavía.

- [ ] **Step 3: Implementar los 7 hooks**

Añadir al final de `web/src/data/queries.ts` (después de `useDeletePlanEntry`; añadir `Ingrediente`, `Plato`, `Regla`, `Temporada`, `TipoRegla` al import de tipos ya existente en la cabecera del fichero, que pasa de `import type { Catalogo, Orden, PlanEntry, Turno } from '../domain/types'` a incluirlos todos):

```typescript
interface PlatoInput {
  id?: number
  nombre: string
  temporadas: Temporada[]
  etiquetas: string[]
  notas: string
  activo: boolean
}

export function usePlatoUpsert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (plato: PlatoInput) => {
      const resultado = await sheetsClient.apiPost('plato.upsert', {
        id_plato: plato.id,
        nombre: plato.nombre,
        temporada: plato.temporadas.join(','),
        etiquetas: plato.etiquetas.join(','),
        notas: plato.notas,
        activo: plato.activo
      })
      return resultado as { id_plato: number }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}

export function usePlatoDelete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number }) => sheetsClient.apiPost('plato.delete', { id_plato: args.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}

interface IngredienteInput {
  id?: number
  nombre: string
  proveedor: string
  unidadBase: string
  temporadas: Temporada[]
  kcal100?: number
  prot100?: number
  carb100?: number
  grasa100?: number
}

export function useIngredienteUpsert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (ingrediente: IngredienteInput) => {
      const resultado = await sheetsClient.apiPost('ingrediente.upsert', {
        id_ingrediente: ingrediente.id,
        nombre: ingrediente.nombre,
        proveedor: ingrediente.proveedor,
        unidad_base: ingrediente.unidadBase,
        temporada: ingrediente.temporadas.join(','),
        kcal_100: ingrediente.kcal100,
        prot_100: ingrediente.prot100,
        carb_100: ingrediente.carb100,
        grasa_100: ingrediente.grasa100
      })
      return resultado as { id_ingrediente: number }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}

export function useIngredienteDelete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number }) =>
      sheetsClient.apiPost('ingrediente.delete', { id_ingrediente: args.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}

interface LineaIngredientePlatoInput {
  idIngrediente: number
  cantidad: number
  unidad: string
}

export function usePlatoIngredientesReplace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { idPlato: number; ingredientes: LineaIngredientePlatoInput[] }) =>
      sheetsClient.apiPost('platoIngredientes.replace', {
        id_plato: args.idPlato,
        ingredientes: args.ingredientes.map((linea) => ({
          id_ingrediente: linea.idIngrediente,
          cantidad: linea.cantidad,
          unidad: linea.unidad
        }))
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}

interface ReglaInput {
  id?: number
  etiqueta: string
  tipo: TipoRegla
  valor: number
  activa: boolean
}

export function useReglaUpsert() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (regla: ReglaInput) => {
      const resultado = await sheetsClient.apiPost('regla.upsert', {
        id: regla.id,
        etiqueta: regla.etiqueta,
        tipo: regla.tipo,
        valor: regla.valor,
        activa: regla.activa
      })
      return resultado as { id: number }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}

export function useReglaDelete() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: number }) => sheetsClient.apiPost('regla.delete', { id: args.id }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalogo'] })
  })
}
```

Nota: `Plato`, `Ingrediente`, `Regla` no se usan como tipo directo en estas firmas (se usan interfaces `*Input` locales) — no hace falta importarlos si `noUnusedLocals` los marca como no usados; importar solo `Temporada` y `TipoRegla` además de los ya existentes `Catalogo, Orden, PlanEntry, Turno`.

- [ ] **Step 4: Ejecutar los tests y ver que pasan**

Run: `cd web && npx vitest run src/data/queries.test.tsx`
Expected: PASS (9/9: 2 ya existentes + 7 nuevos, contando ambos tests de `usePlatoUpsert` como 2)

- [ ] **Step 5: Ejecutar el build**

Run: `cd web && npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 6: Commit**

```bash
git add web/src/data/queries.ts web/src/data/queries.test.tsx
git commit -m "feat: hooks de mutación del catálogo (platos, ingredientes, reglas)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VdDPpz83MW4Kxs3UwHFrhG"
```

---

### Task 2: Reglas — formulario y lista

**Files:**
- Create: `web/src/features/catalog/schemas.ts`
- Create: `web/src/features/catalog/ReglaForm.tsx`
- Create: `web/src/features/catalog/ReglaForm.test.tsx`
- Create: `web/src/features/catalog/ReglaList.tsx`
- Create: `web/src/features/catalog/ReglaList.test.tsx`

**Interfaces:**
- Consumes: `useReglaUpsert()`, `useReglaDelete()` de Task 1; tipo `Regla`/`TipoRegla` de `domain/types.ts`.
- Produces: `reglaFormSchema`/`ReglaFormValues` desde `features/catalog/schemas.ts` (Tasks 3-4 añaden más schemas al mismo fichero). `ReglaForm` (`ReglaFormProps { regla?: Regla; onGuardado: () => void; onCancelar: () => void }`) y `ReglaList` (`ReglaListProps { reglas: Regla[] }`) desde `features/catalog/` — los consume Task 6 (`CatalogPage`).

- [ ] **Step 1: Escribir el test del schema y del formulario**

Crear `web/src/features/catalog/ReglaForm.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import { ReglaForm } from './ReglaForm'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('ReglaForm', () => {
  it('crea una regla nueva con los valores por defecto y llama a onGuardado', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id: 5 } })
      })
    )
    const onGuardado = vi.fn()
    render(<ReglaForm onGuardado={onGuardado} onCancelar={vi.fn()} />, { wrapper })

    await userEvent.type(screen.getByLabelText('Etiqueta'), 'pasta')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(onGuardado).toHaveBeenCalledOnce())
    expect(payloadRecibido).toEqual({
      action: 'regla.upsert',
      token: 'test-token',
      payload: { etiqueta: 'pasta', tipo: 'MAX_SEMANA', valor: 1, activa: true }
    })
  })

  it('muestra un error de validación si la etiqueta está vacía', async () => {
    render(<ReglaForm onGuardado={vi.fn()} onCancelar={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(await screen.findByText('La etiqueta es obligatoria')).toBeInTheDocument()
  })

  it('precarga los valores de una regla existente y envía su id al guardar', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id: 3 } })
      })
    )
    const onGuardado = vi.fn()
    render(
      <ReglaForm
        regla={{ id: 3, etiqueta: 'pescado', tipo: 'MIN_SEMANA', valor: 2, activa: true }}
        onGuardado={onGuardado}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByLabelText('Etiqueta')).toHaveValue('pescado')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() => expect(onGuardado).toHaveBeenCalledOnce())
    expect(payloadRecibido).toEqual({
      action: 'regla.upsert',
      token: 'test-token',
      payload: { id: 3, etiqueta: 'pescado', tipo: 'MIN_SEMANA', valor: 2, activa: true }
    })
  })

  it('llama a onCancelar al pulsar Cancelar', async () => {
    const onCancelar = vi.fn()
    render(<ReglaForm onGuardado={vi.fn()} onCancelar={onCancelar} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(onCancelar).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/catalog/ReglaForm.test.tsx`
Expected: FAIL — `./ReglaForm` no existe.

- [ ] **Step 3: Implementar el schema y el formulario**

Crear `web/src/features/catalog/schemas.ts`:

```typescript
import { z } from 'zod'

export const reglaFormSchema = z.object({
  etiqueta: z.string().trim().min(1, 'La etiqueta es obligatoria'),
  tipo: z.enum(['MAX_SEMANA', 'MIN_SEMANA', 'NO_CONSECUTIVO']),
  valor: z.coerce.number().int().min(0, 'El valor no puede ser negativo'),
  activa: z.boolean()
})

export type ReglaFormValues = z.infer<typeof reglaFormSchema>
```

Crear `web/src/features/catalog/ReglaForm.tsx`:

```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Regla } from '../../domain/types'
import { useReglaUpsert } from '../../data/queries'
import { reglaFormSchema, type ReglaFormValues } from './schemas'

export interface ReglaFormProps {
  regla?: Regla
  onGuardado: () => void
  onCancelar: () => void
}

const CAMPO =
  'w-full rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-base dark:border-neutral-600 dark:bg-neutral-900'

export function ReglaForm({ regla, onGuardado, onCancelar }: ReglaFormProps) {
  const reglaUpsert = useReglaUpsert()
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ReglaFormValues>({
    resolver: zodResolver(reglaFormSchema),
    defaultValues: regla
      ? { etiqueta: regla.etiqueta, tipo: regla.tipo, valor: regla.valor, activa: regla.activa }
      : { etiqueta: '', tipo: 'MAX_SEMANA', valor: 1, activa: true }
  })

  function onSubmit(valores: ReglaFormValues) {
    reglaUpsert.mutate({ id: regla?.id, ...valores }, { onSuccess: onGuardado })
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
    >
      <div>
        <label htmlFor="regla-etiqueta" className="mb-1 block text-sm font-semibold">
          Etiqueta
        </label>
        <input id="regla-etiqueta" {...register('etiqueta')} className={CAMPO} />
        {errors.etiqueta && <p className="mt-1 text-sm text-red-600">{errors.etiqueta.message}</p>}
      </div>
      <div>
        <label htmlFor="regla-tipo" className="mb-1 block text-sm font-semibold">
          Tipo
        </label>
        <select id="regla-tipo" {...register('tipo')} className={CAMPO}>
          <option value="MAX_SEMANA">Máximo por semana</option>
          <option value="MIN_SEMANA">Mínimo por semana</option>
          <option value="NO_CONSECUTIVO">No consecutivo</option>
        </select>
      </div>
      <div>
        <label htmlFor="regla-valor" className="mb-1 block text-sm font-semibold">
          Valor
        </label>
        <input id="regla-valor" type="number" {...register('valor')} className={CAMPO} />
        {errors.valor && <p className="mt-1 text-sm text-red-600">{errors.valor.message}</p>}
      </div>
      <label className="flex items-center gap-2 text-sm font-semibold">
        <input type="checkbox" {...register('activa')} className="h-5 w-5" />
        Activa
      </label>
      {reglaUpsert.isError && <p className="text-sm text-red-600">No se pudo guardar. Inténtalo de nuevo.</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-full px-4.5 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={reglaUpsert.isPending}
          className="rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {reglaUpsert.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/catalog/ReglaForm.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 5: Escribir el test de la lista**

Crear `web/src/features/catalog/ReglaList.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import type { Regla } from '../../domain/types'
import { ReglaList } from './ReglaList'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const reglas: Regla[] = [
  { id: 1, etiqueta: 'pasta', tipo: 'MAX_SEMANA', valor: 1, activa: true },
  { id: 2, etiqueta: 'pescado', tipo: 'MIN_SEMANA', valor: 2, activa: false }
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('ReglaList', () => {
  it('muestra cada regla con su tipo, valor y estado', () => {
    render(<ReglaList reglas={reglas} />, { wrapper })
    expect(screen.getByText('pasta')).toBeInTheDocument()
    expect(screen.getByText(/Máximo por semana.*1.*Activa/)).toBeInTheDocument()
    expect(screen.getByText('pescado')).toBeInTheDocument()
    expect(screen.getByText(/Mínimo por semana.*2.*Inactiva/)).toBeInTheDocument()
  })

  it('abre el formulario de nueva regla al pulsar "+ Nueva regla"', async () => {
    render(<ReglaList reglas={reglas} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /nueva regla/i }))
    expect(screen.getByLabelText('Etiqueta')).toHaveValue('')
  })

  it('abre el formulario precargado al pulsar "Editar" en una fila', async () => {
    render(<ReglaList reglas={reglas} />, { wrapper })
    const filaPasta = screen.getByText('pasta').closest('li')
    if (!filaPasta) throw new Error('no se encontró la fila de pasta')
    await userEvent.click(within(filaPasta).getByRole('button', { name: /editar/i }))
    expect(screen.getByLabelText('Etiqueta')).toHaveValue('pasta')
  })

  it('pide confirmación y llama a regla.delete al pulsar "Eliminar"', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    render(<ReglaList reglas={reglas} />, { wrapper })
    const filaPasta = screen.getByText('pasta').closest('li')
    if (!filaPasta) throw new Error('no se encontró la fila de pasta')
    await userEvent.click(within(filaPasta).getByRole('button', { name: /eliminar/i }))
    expect(window.confirm).toHaveBeenCalledOnce()
    await waitFor(() =>
      expect(payloadRecibido).toEqual({ action: 'regla.delete', token: 'test-token', payload: { id: 1 } })
    )
  })

  it('no llama a regla.delete si se cancela la confirmación', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    let seLlamoAlApi = false
    server.use(
      http.post(API_URL, () => {
        seLlamoAlApi = true
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    render(<ReglaList reglas={reglas} />, { wrapper })
    const filaPasta = screen.getByText('pasta').closest('li')
    if (!filaPasta) throw new Error('no se encontró la fila de pasta')
    await userEvent.click(within(filaPasta).getByRole('button', { name: /eliminar/i }))
    expect(seLlamoAlApi).toBe(false)
  })
})
```

Añadir `within` al import de `@testing-library/react` en la cabecera (`import { render, screen, waitFor, within } from '@testing-library/react'`).

- [ ] **Step 6: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/catalog/ReglaList.test.tsx`
Expected: FAIL — `./ReglaList` no existe.

- [ ] **Step 7: Implementar la lista**

Crear `web/src/features/catalog/ReglaList.tsx`:

```typescript
import { useState } from 'react'
import type { Regla, TipoRegla } from '../../domain/types'
import { useReglaDelete } from '../../data/queries'
import { ReglaForm } from './ReglaForm'

export interface ReglaListProps {
  reglas: Regla[]
}

const NOMBRE_TIPO: Record<TipoRegla, string> = {
  MAX_SEMANA: 'Máximo por semana',
  MIN_SEMANA: 'Mínimo por semana',
  NO_CONSECUTIVO: 'No consecutivo'
}

export function ReglaList({ reglas }: ReglaListProps) {
  const [editando, setEditando] = useState<Regla | 'nueva' | null>(null)
  const reglaDelete = useReglaDelete()

  function eliminar(regla: Regla) {
    if (!window.confirm(`¿Eliminar la regla "${regla.etiqueta}"? Esta acción no se puede deshacer.`)) return
    reglaDelete.mutate({ id: regla.id })
  }

  if (editando) {
    return (
      <ReglaForm
        regla={editando === 'nueva' ? undefined : editando}
        onGuardado={() => setEditando(null)}
        onCancelar={() => setEditando(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setEditando('nueva')}
        className="self-start rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900"
      >
        + Nueva regla
      </button>
      <ul className="flex flex-col gap-2">
        {reglas.map((regla) => (
          <li
            key={regla.id}
            className="flex items-center justify-between gap-3 rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-900"
          >
            <div>
              <p className="font-semibold">{regla.etiqueta}</p>
              <p className="text-sm text-neutral-500">
                {NOMBRE_TIPO[regla.tipo]} · {regla.valor} · {regla.activa ? 'Activa' : 'Inactiva'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditando(regla)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => eliminar(regla)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 8: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/catalog/ReglaList.test.tsx`
Expected: PASS (5/5)

- [ ] **Step 9: Commit**

```bash
git add web/src/features/catalog/schemas.ts web/src/features/catalog/ReglaForm.tsx web/src/features/catalog/ReglaForm.test.tsx web/src/features/catalog/ReglaList.tsx web/src/features/catalog/ReglaList.test.tsx
git commit -m "feat: formulario y lista de reglas del catálogo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VdDPpz83MW4Kxs3UwHFrhG"
```

---

### Task 3: Ingredientes — formulario y lista

**Files:**
- Modify: `web/src/features/catalog/schemas.ts`
- Create: `web/src/features/catalog/IngredienteForm.tsx`
- Create: `web/src/features/catalog/IngredienteForm.test.tsx`
- Create: `web/src/features/catalog/IngredienteList.tsx`
- Create: `web/src/features/catalog/IngredienteList.test.tsx`

**Interfaces:**
- Consumes: `useIngredienteUpsert()`, `useIngredienteDelete()` de Task 1; tipo `Ingrediente`/`Temporada` de `domain/types.ts`; `reglaFormSchema` ya existente en `schemas.ts` (no se toca, solo se añade `ingredienteFormSchema` al mismo fichero).
- Produces: `ingredienteFormSchema`/`IngredienteFormValues` desde `features/catalog/schemas.ts`. `IngredienteForm` (`IngredienteFormProps { ingrediente?: Ingrediente; onGuardado: () => void; onCancelar: () => void }`) y `IngredienteList` (`IngredienteListProps { ingredientes: Ingrediente[] }`) — los consume Task 6.

- [ ] **Step 1: Escribir el test del formulario**

Crear `web/src/features/catalog/IngredienteForm.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import { IngredienteForm } from './IngredienteForm'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('IngredienteForm', () => {
  it('crea un ingrediente nuevo con la temporada TODAS marcada por defecto', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_ingrediente: 8 } })
      })
    )
    const onGuardado = vi.fn()
    render(<IngredienteForm onGuardado={onGuardado} onCancelar={vi.fn()} />, { wrapper })

    await userEvent.type(screen.getByLabelText('Nombre'), 'Lenteja')
    await userEvent.type(screen.getByLabelText('Proveedor'), 'Mercadona')
    await userEvent.type(screen.getByLabelText('Unidad base'), 'g')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(onGuardado).toHaveBeenCalledOnce())
    expect(payloadRecibido).toEqual({
      action: 'ingrediente.upsert',
      token: 'test-token',
      payload: { nombre: 'Lenteja', proveedor: 'Mercadona', unidad_base: 'g', temporada: 'TODAS' }
    })
  })

  it('muestra errores de validación si nombre, proveedor o unidad están vacíos', async () => {
    render(<IngredienteForm onGuardado={vi.fn()} onCancelar={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('El proveedor es obligatorio')).toBeInTheDocument()
    expect(screen.getByText('La unidad es obligatoria')).toBeInTheDocument()
  })

  it('envía los macros solo cuando se rellenan', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_ingrediente: 8 } })
      })
    )
    render(<IngredienteForm onGuardado={vi.fn()} onCancelar={vi.fn()} />, { wrapper })
    await userEvent.type(screen.getByLabelText('Nombre'), 'Lenteja')
    await userEvent.type(screen.getByLabelText('Proveedor'), 'Mercadona')
    await userEvent.type(screen.getByLabelText('Unidad base'), 'g')
    await userEvent.type(screen.getByLabelText('Kcal / 100g'), '350')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() =>
      expect(payloadRecibido).toEqual({
        action: 'ingrediente.upsert',
        token: 'test-token',
        payload: {
          nombre: 'Lenteja',
          proveedor: 'Mercadona',
          unidad_base: 'g',
          temporada: 'TODAS',
          kcal_100: 350
        }
      })
    )
  })

  it('precarga los valores de un ingrediente existente', async () => {
    render(
      <IngredienteForm
        ingrediente={{
          id: 5,
          nombre: 'Tomate',
          proveedor: 'Frutería',
          unidadBase: 'g',
          temporadas: ['VERANO'],
          kcal100: 18
        }}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByLabelText('Nombre')).toHaveValue('Tomate')
    expect(screen.getByLabelText('Kcal / 100g')).toHaveValue(18)
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/catalog/IngredienteForm.test.tsx`
Expected: FAIL — `./IngredienteForm` no existe.

- [ ] **Step 3: Añadir el schema de ingrediente**

Añadir al final de `web/src/features/catalog/schemas.ts`:

```typescript
const numeroFormOpcional = z.preprocess((valor) => {
  if (valor === '' || valor === null || valor === undefined) return undefined
  return valor
}, z.coerce.number().optional())

export const ingredienteFormSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  proveedor: z.string().trim().min(1, 'El proveedor es obligatorio'),
  unidadBase: z.string().trim().min(1, 'La unidad es obligatoria'),
  temporadas: z
    .array(z.enum(['TODAS', 'PRIMAVERA', 'VERANO', 'OTOÑO', 'INVIERNO']))
    .min(1, 'Elige al menos una temporada'),
  kcal100: numeroFormOpcional,
  prot100: numeroFormOpcional,
  carb100: numeroFormOpcional,
  grasa100: numeroFormOpcional
})

export type IngredienteFormValues = z.infer<typeof ingredienteFormSchema>
```

- [ ] **Step 4: Implementar el formulario**

Crear `web/src/features/catalog/IngredienteForm.tsx`:

```typescript
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Ingrediente, Temporada } from '../../domain/types'
import { useIngredienteUpsert } from '../../data/queries'
import { ingredienteFormSchema, type IngredienteFormValues } from './schemas'

export interface IngredienteFormProps {
  ingrediente?: Ingrediente
  onGuardado: () => void
  onCancelar: () => void
}

const CAMPO =
  'w-full rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-base dark:border-neutral-600 dark:bg-neutral-900'

const TEMPORADAS: Temporada[] = ['TODAS', 'PRIMAVERA', 'VERANO', 'OTOÑO', 'INVIERNO']
const NOMBRE_TEMPORADA: Record<Temporada, string> = {
  TODAS: 'Todas',
  PRIMAVERA: 'Primavera',
  VERANO: 'Verano',
  OTOÑO: 'Otoño',
  INVIERNO: 'Invierno'
}

export function IngredienteForm({ ingrediente, onGuardado, onCancelar }: IngredienteFormProps) {
  const ingredienteUpsert = useIngredienteUpsert()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors }
  } = useForm<IngredienteFormValues>({
    resolver: zodResolver(ingredienteFormSchema),
    defaultValues: ingrediente
      ? {
          nombre: ingrediente.nombre,
          proveedor: ingrediente.proveedor,
          unidadBase: ingrediente.unidadBase,
          temporadas: ingrediente.temporadas,
          kcal100: ingrediente.kcal100,
          prot100: ingrediente.prot100,
          carb100: ingrediente.carb100,
          grasa100: ingrediente.grasa100
        }
      : { nombre: '', proveedor: '', unidadBase: '', temporadas: ['TODAS'] }
  })

  function onSubmit(valores: IngredienteFormValues) {
    ingredienteUpsert.mutate({ id: ingrediente?.id, ...valores }, { onSuccess: onGuardado })
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
    >
      <div>
        <label htmlFor="ingrediente-nombre" className="mb-1 block text-sm font-semibold">
          Nombre
        </label>
        <input id="ingrediente-nombre" {...register('nombre')} className={CAMPO} />
        {errors.nombre && <p className="mt-1 text-sm text-red-600">{errors.nombre.message}</p>}
      </div>
      <div>
        <label htmlFor="ingrediente-proveedor" className="mb-1 block text-sm font-semibold">
          Proveedor
        </label>
        <input id="ingrediente-proveedor" {...register('proveedor')} className={CAMPO} />
        {errors.proveedor && <p className="mt-1 text-sm text-red-600">{errors.proveedor.message}</p>}
      </div>
      <div>
        <label htmlFor="ingrediente-unidad" className="mb-1 block text-sm font-semibold">
          Unidad base
        </label>
        <input id="ingrediente-unidad" {...register('unidadBase')} className={CAMPO} placeholder="g, ml, ud…" />
        {errors.unidadBase && <p className="mt-1 text-sm text-red-600">{errors.unidadBase.message}</p>}
      </div>
      <div>
        <span className="mb-1 block text-sm font-semibold">Temporadas</span>
        <Controller
          name="temporadas"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-3">
              {TEMPORADAS.map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={field.value.includes(t)}
                    onChange={(e) => {
                      field.onChange(
                        e.target.checked ? [...field.value, t] : field.value.filter((v) => v !== t)
                      )
                    }}
                  />
                  {NOMBRE_TEMPORADA[t]}
                </label>
              ))}
            </div>
          )}
        />
        {errors.temporadas && <p className="mt-1 text-sm text-red-600">{errors.temporadas.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label htmlFor="ingrediente-kcal" className="mb-1 block text-sm font-semibold">
            Kcal / 100g
          </label>
          <input id="ingrediente-kcal" type="number" {...register('kcal100')} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="ingrediente-prot" className="mb-1 block text-sm font-semibold">
            Proteína / 100g
          </label>
          <input id="ingrediente-prot" type="number" {...register('prot100')} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="ingrediente-carb" className="mb-1 block text-sm font-semibold">
            Carbohidrato / 100g
          </label>
          <input id="ingrediente-carb" type="number" {...register('carb100')} className={CAMPO} />
        </div>
        <div>
          <label htmlFor="ingrediente-grasa" className="mb-1 block text-sm font-semibold">
            Grasa / 100g
          </label>
          <input id="ingrediente-grasa" type="number" {...register('grasa100')} className={CAMPO} />
        </div>
      </div>
      {ingredienteUpsert.isError && <p className="text-sm text-red-600">No se pudo guardar. Inténtalo de nuevo.</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-full px-4.5 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={ingredienteUpsert.isPending}
          className="rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {ingredienteUpsert.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/catalog/IngredienteForm.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 6: Escribir el test de la lista**

Crear `web/src/features/catalog/IngredienteList.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import type { Ingrediente } from '../../domain/types'
import { IngredienteList } from './IngredienteList'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const ingredientes: Ingrediente[] = [
  { id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['VERANO'] }
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('IngredienteList', () => {
  it('muestra cada ingrediente con su proveedor y unidad', () => {
    render(<IngredienteList ingredientes={ingredientes} />, { wrapper })
    expect(screen.getByText('Tomate')).toBeInTheDocument()
    expect(screen.getByText(/Frutería.*g/)).toBeInTheDocument()
  })

  it('abre el formulario precargado al pulsar "Editar"', async () => {
    render(<IngredienteList ingredientes={ingredientes} />, { wrapper })
    const fila = screen.getByText('Tomate').closest('li')
    if (!fila) throw new Error('no se encontró la fila de Tomate')
    await userEvent.click(within(fila).getByRole('button', { name: /editar/i }))
    expect(screen.getByLabelText('Nombre')).toHaveValue('Tomate')
  })

  it('pide confirmación y llama a ingrediente.delete al pulsar "Eliminar"', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    render(<IngredienteList ingredientes={ingredientes} />, { wrapper })
    const fila = screen.getByText('Tomate').closest('li')
    if (!fila) throw new Error('no se encontró la fila de Tomate')
    await userEvent.click(within(fila).getByRole('button', { name: /eliminar/i }))
    expect(window.confirm).toHaveBeenCalledOnce()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(payloadRecibido).toEqual({
      action: 'ingrediente.delete',
      token: 'test-token',
      payload: { id_ingrediente: 1 }
    })
  })
})
```

- [ ] **Step 7: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/catalog/IngredienteList.test.tsx`
Expected: FAIL — `./IngredienteList` no existe.

- [ ] **Step 8: Implementar la lista**

Crear `web/src/features/catalog/IngredienteList.tsx`:

```typescript
import { useState } from 'react'
import type { Ingrediente } from '../../domain/types'
import { useIngredienteDelete } from '../../data/queries'
import { IngredienteForm } from './IngredienteForm'

export interface IngredienteListProps {
  ingredientes: Ingrediente[]
}

export function IngredienteList({ ingredientes }: IngredienteListProps) {
  const [editando, setEditando] = useState<Ingrediente | 'nuevo' | null>(null)
  const ingredienteDelete = useIngredienteDelete()

  function eliminar(ingrediente: Ingrediente) {
    if (!window.confirm(`¿Eliminar "${ingrediente.nombre}"? Esta acción no se puede deshacer.`)) return
    ingredienteDelete.mutate({ id: ingrediente.id })
  }

  if (editando) {
    return (
      <IngredienteForm
        ingrediente={editando === 'nuevo' ? undefined : editando}
        onGuardado={() => setEditando(null)}
        onCancelar={() => setEditando(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setEditando('nuevo')}
        className="self-start rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900"
      >
        + Nuevo ingrediente
      </button>
      <ul className="flex flex-col gap-2">
        {ingredientes.map((ingrediente) => (
          <li
            key={ingrediente.id}
            className="flex items-center justify-between gap-3 rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-600 dark:bg-neutral-900"
          >
            <div>
              <p className="font-semibold">{ingrediente.nombre}</p>
              <p className="text-sm text-neutral-500">
                {ingrediente.proveedor} · {ingrediente.unidadBase}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditando(ingrediente)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => eliminar(ingrediente)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Eliminar
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 9: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/catalog/IngredienteList.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 10: Commit**

```bash
git add web/src/features/catalog/schemas.ts web/src/features/catalog/IngredienteForm.tsx web/src/features/catalog/IngredienteForm.test.tsx web/src/features/catalog/IngredienteList.tsx web/src/features/catalog/IngredienteList.test.tsx
git commit -m "feat: formulario y lista de ingredientes del catálogo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VdDPpz83MW4Kxs3UwHFrhG"
```

---

### Task 4: Platos — formulario base y lista

**Files:**
- Modify: `web/src/features/catalog/schemas.ts`
- Create: `web/src/features/catalog/PlatoForm.tsx`
- Create: `web/src/features/catalog/PlatoForm.test.tsx`
- Create: `web/src/features/catalog/PlatoList.tsx`
- Create: `web/src/features/catalog/PlatoList.test.tsx`

**Interfaces:**
- Consumes: `usePlatoUpsert()`, `usePlatoDelete()` de Task 1; tipo `Plato`/`Temporada` de `domain/types.ts`.
- Produces: `platoFormSchema`/`PlatoFormValues` desde `features/catalog/schemas.ts`. `PlatoForm` (`PlatoFormProps { plato?: Plato; onGuardado: () => void; onCancelar: () => void }` — Task 5 AMPLÍA esta interfaz para añadir el editor de ingredientes, ver la nota al final de este task) y `PlatoList` (`PlatoListProps { platos: Plato[] }`) — los consume Task 6.

Nota importante: este task deja `PlatoForm` SIN editor de ingredientes todavía (solo los campos propios del plato). Task 5 añade `PlatoIngredientesEditor` y AMPLÍA `PlatoForm`/`PlatoFormProps` para incluirlo — los tests de este task solo cubren los campos que existen en este momento, y Task 5 los deja intactos (añade tests nuevos, no reescribe estos).

- [ ] **Step 1: Escribir el test del formulario**

Crear `web/src/features/catalog/PlatoForm.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import { PlatoForm } from './PlatoForm'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

describe('PlatoForm', () => {
  it('crea un plato nuevo con TODAS marcada por defecto y sin etiquetas', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_plato: 11 } })
      })
    )
    const onGuardado = vi.fn()
    render(<PlatoForm onGuardado={onGuardado} onCancelar={vi.fn()} />, { wrapper })

    await userEvent.type(screen.getByLabelText('Nombre'), 'Lentejas')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))

    await waitFor(() => expect(onGuardado).toHaveBeenCalledOnce())
    expect(payloadRecibido).toEqual({
      action: 'plato.upsert',
      token: 'test-token',
      payload: { nombre: 'Lentejas', temporada: 'TODAS', etiquetas: '', notas: '', activo: true }
    })
  })

  it('convierte el texto de etiquetas separado por comas en minúsculas y sin espacios', async () => {
    let payloadRecibido: unknown = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        payloadRecibido = await request.json()
        return HttpResponse.json({ ok: true, result: { id_plato: 11 } })
      })
    )
    render(<PlatoForm onGuardado={vi.fn()} onCancelar={vi.fn()} />, { wrapper })
    await userEvent.type(screen.getByLabelText('Nombre'), 'Lentejas')
    await userEvent.type(screen.getByLabelText('Etiquetas (separadas por comas)'), ' Legumbre,  Guiso ')
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    await waitFor(() =>
      expect(payloadRecibido).toEqual({
        action: 'plato.upsert',
        token: 'test-token',
        payload: { nombre: 'Lentejas', temporada: 'TODAS', etiquetas: 'legumbre,guiso', notas: '', activo: true }
      })
    )
  })

  it('muestra un error de validación si el nombre está vacío', async () => {
    render(<PlatoForm onGuardado={vi.fn()} onCancelar={vi.fn()} />, { wrapper })
    await userEvent.click(screen.getByRole('button', { name: /guardar/i }))
    expect(await screen.findByText('El nombre es obligatorio')).toBeInTheDocument()
  })

  it('precarga los valores de un plato existente', async () => {
    render(
      <PlatoForm
        plato={{
          id: 3,
          nombre: 'Gazpacho',
          temporadas: ['VERANO'],
          etiquetas: ['verdura'],
          notas: 'Sin sal',
          activo: true
        }}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByLabelText('Nombre')).toHaveValue('Gazpacho')
    expect(screen.getByLabelText('Etiquetas (separadas por comas)')).toHaveValue('verdura')
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/catalog/PlatoForm.test.tsx`
Expected: FAIL — `./PlatoForm` no existe.

- [ ] **Step 3: Añadir el schema de plato**

Añadir al final de `web/src/features/catalog/schemas.ts`:

```typescript
export const platoFormSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  temporadas: z
    .array(z.enum(['TODAS', 'PRIMAVERA', 'VERANO', 'OTOÑO', 'INVIERNO']))
    .min(1, 'Elige al menos una temporada'),
  etiquetas: z.string(),
  notas: z.string(),
  activo: z.boolean()
})

export type PlatoFormValues = z.infer<typeof platoFormSchema>
```

- [ ] **Step 4: Implementar el formulario**

Crear `web/src/features/catalog/PlatoForm.tsx`:

```typescript
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Plato, Temporada } from '../../domain/types'
import { usePlatoUpsert } from '../../data/queries'
import { platoFormSchema, type PlatoFormValues } from './schemas'

export interface PlatoFormProps {
  plato?: Plato
  onGuardado: () => void
  onCancelar: () => void
}

const CAMPO =
  'w-full rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-base dark:border-neutral-600 dark:bg-neutral-900'

const TEMPORADAS: Temporada[] = ['TODAS', 'PRIMAVERA', 'VERANO', 'OTOÑO', 'INVIERNO']
const NOMBRE_TEMPORADA: Record<Temporada, string> = {
  TODAS: 'Todas',
  PRIMAVERA: 'Primavera',
  VERANO: 'Verano',
  OTOÑO: 'Otoño',
  INVIERNO: 'Invierno'
}

function etiquetasATexto(etiquetas: string[]): string {
  return etiquetas.join(', ')
}

function textoAEtiquetas(texto: string): string[] {
  return texto
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
}

export function PlatoForm({ plato, onGuardado, onCancelar }: PlatoFormProps) {
  const platoUpsert = usePlatoUpsert()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors }
  } = useForm<PlatoFormValues>({
    resolver: zodResolver(platoFormSchema),
    defaultValues: plato
      ? {
          nombre: plato.nombre,
          temporadas: plato.temporadas,
          etiquetas: etiquetasATexto(plato.etiquetas),
          notas: plato.notas,
          activo: plato.activo
        }
      : { nombre: '', temporadas: ['TODAS'], etiquetas: '', notas: '', activo: true }
  })

  function onSubmit(valores: PlatoFormValues) {
    platoUpsert.mutate(
      {
        id: plato?.id,
        nombre: valores.nombre,
        temporadas: valores.temporadas,
        etiquetas: textoAEtiquetas(valores.etiquetas),
        notas: valores.notas,
        activo: valores.activo
      },
      { onSuccess: onGuardado }
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
    >
      <div>
        <label htmlFor="plato-nombre" className="mb-1 block text-sm font-semibold">
          Nombre
        </label>
        <input id="plato-nombre" {...register('nombre')} className={CAMPO} />
        {errors.nombre && <p className="mt-1 text-sm text-red-600">{errors.nombre.message}</p>}
      </div>
      <div>
        <span className="mb-1 block text-sm font-semibold">Temporadas</span>
        <Controller
          name="temporadas"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-3">
              {TEMPORADAS.map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={field.value.includes(t)}
                    onChange={(e) => {
                      field.onChange(
                        e.target.checked ? [...field.value, t] : field.value.filter((v) => v !== t)
                      )
                    }}
                  />
                  {NOMBRE_TEMPORADA[t]}
                </label>
              ))}
            </div>
          )}
        />
        {errors.temporadas && <p className="mt-1 text-sm text-red-600">{errors.temporadas.message}</p>}
      </div>
      <div>
        <label htmlFor="plato-etiquetas" className="mb-1 block text-sm font-semibold">
          Etiquetas (separadas por comas)
        </label>
        <input id="plato-etiquetas" {...register('etiquetas')} className={CAMPO} placeholder="pasta, carne…" />
      </div>
      <div>
        <label htmlFor="plato-notas" className="mb-1 block text-sm font-semibold">
          Notas
        </label>
        <textarea id="plato-notas" {...register('notas')} rows={2} className={CAMPO} />
      </div>
      {platoUpsert.isError && <p className="text-sm text-red-600">No se pudo guardar. Inténtalo de nuevo.</p>}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-full px-4.5 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={platoUpsert.isPending}
          className="rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {platoUpsert.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 5: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/catalog/PlatoForm.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 6: Escribir el test de la lista**

Crear `web/src/features/catalog/PlatoList.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { server } from '../../test/mswServer'
import type { Plato } from '../../domain/types'
import { PlatoList } from './PlatoList'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

const platos: Plato[] = [
  { id: 1, nombre: 'Gazpacho', temporadas: ['VERANO'], etiquetas: ['verdura'], notas: '', activo: true },
  { id: 2, nombre: 'Cocido', temporadas: ['INVIERNO'], etiquetas: [], notas: '', activo: false }
]

describe('PlatoList', () => {
  it('muestra cada plato con su estado activo/inactivo', () => {
    render(<PlatoList platos={platos} />, { wrapper })
    const filaGazpacho = screen.getByText('Gazpacho').closest('li')
    const filaCocido = screen.getByText('Cocido').closest('li')
    if (!filaGazpacho || !filaCocido) throw new Error('no se encontraron las filas')
    expect(within(filaGazpacho).getByText('Activo')).toBeInTheDocument()
    expect(within(filaCocido).getByText('Inactivo')).toBeInTheDocument()
  })

  it('abre el formulario precargado al pulsar "Editar"', async () => {
    render(<PlatoList platos={platos} />, { wrapper })
    const fila = screen.getByText('Gazpacho').closest('li')
    if (!fila) throw new Error('no se encontró la fila')
    await userEvent.click(within(fila).getByRole('button', { name: /editar/i }))
    expect(screen.getByLabelText('Nombre')).toHaveValue('Gazpacho')
  })

  it('desactiva un plato activo llamando a plato.delete, sin pedir confirmación', async () => {
    let cuerpoRecibido: { action: string; payload: unknown } | null = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        cuerpoRecibido = (await request.json()) as { action: string; payload: unknown }
        return HttpResponse.json({ ok: true, result: { deleted: true } })
      })
    )
    const confirmSpy = vi.spyOn(window, 'confirm')
    render(<PlatoList platos={platos} />, { wrapper })
    const fila = screen.getByText('Gazpacho').closest('li')
    if (!fila) throw new Error('no se encontró la fila')
    await userEvent.click(within(fila).getByRole('button', { name: /desactivar/i }))
    expect(confirmSpy).not.toHaveBeenCalled()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cuerpoRecibido).toEqual({ action: 'plato.delete', token: 'test-token', payload: { id_plato: 1 } })
  })

  it('reactiva un plato inactivo llamando a plato.upsert con activo:true', async () => {
    let cuerpoRecibido: { action: string; payload: unknown } | null = null
    server.use(
      http.post(API_URL, async ({ request }) => {
        cuerpoRecibido = (await request.json()) as { action: string; payload: unknown }
        return HttpResponse.json({ ok: true, result: { id_plato: 2 } })
      })
    )
    render(<PlatoList platos={platos} />, { wrapper })
    const fila = screen.getByText('Cocido').closest('li')
    if (!fila) throw new Error('no se encontró la fila')
    await userEvent.click(within(fila).getByRole('button', { name: /reactivar/i }))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(cuerpoRecibido).toEqual({
      action: 'plato.upsert',
      token: 'test-token',
      payload: { id_plato: 2, nombre: 'Cocido', temporada: 'INVIERNO', etiquetas: '', notas: '', activo: true }
    })
  })
})
```

- [ ] **Step 7: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/catalog/PlatoList.test.tsx`
Expected: FAIL — `./PlatoList` no existe.

- [ ] **Step 8: Implementar la lista**

Crear `web/src/features/catalog/PlatoList.tsx`:

```typescript
import { useState } from 'react'
import type { Plato } from '../../domain/types'
import { usePlatoDelete, usePlatoUpsert } from '../../data/queries'
import { PlatoForm } from './PlatoForm'

export interface PlatoListProps {
  platos: Plato[]
}

export function PlatoList({ platos }: PlatoListProps) {
  const [editando, setEditando] = useState<Plato | 'nuevo' | null>(null)
  const platoDelete = usePlatoDelete()
  const platoUpsert = usePlatoUpsert()

  function alternarActivo(plato: Plato) {
    if (plato.activo) {
      platoDelete.mutate({ id: plato.id })
    } else {
      platoUpsert.mutate({
        id: plato.id,
        nombre: plato.nombre,
        temporadas: plato.temporadas,
        etiquetas: plato.etiquetas,
        notas: plato.notas,
        activo: true
      })
    }
  }

  if (editando) {
    return (
      <PlatoForm
        plato={editando === 'nuevo' ? undefined : editando}
        onGuardado={() => setEditando(null)}
        onCancelar={() => setEditando(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setEditando('nuevo')}
        className="self-start rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900"
      >
        + Nuevo plato
      </button>
      <ul className="flex flex-col gap-2">
        {platos.map((plato) => (
          <li
            key={plato.id}
            className={`flex items-center justify-between gap-3 rounded-lg border-[1.5px] p-3 ${
              plato.activo
                ? 'border-neutral-200 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900'
                : 'border-neutral-200 bg-neutral-100 opacity-60 dark:border-neutral-700 dark:bg-neutral-800'
            }`}
          >
            <div>
              <p className="font-semibold">{plato.nombre}</p>
              <p className="text-sm text-neutral-500">{plato.activo ? 'Activo' : 'Inactivo'}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditando(plato)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => alternarActivo(plato)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300"
              >
                {plato.activo ? 'Desactivar' : 'Reactivar'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 9: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/catalog/PlatoList.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 10: Commit**

```bash
git add web/src/features/catalog/schemas.ts web/src/features/catalog/PlatoForm.tsx web/src/features/catalog/PlatoForm.test.tsx web/src/features/catalog/PlatoList.tsx web/src/features/catalog/PlatoList.test.tsx
git commit -m "feat: formulario base y lista de platos del catálogo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VdDPpz83MW4Kxs3UwHFrhG"
```

---

### Task 5: editor de ingredientes del plato

**Files:**
- Create: `web/src/features/catalog/PlatoIngredientesEditor.tsx`
- Create: `web/src/features/catalog/PlatoIngredientesEditor.test.tsx`
- Modify: `web/src/features/catalog/PlatoForm.tsx`
- Modify: `web/src/features/catalog/PlatoForm.test.tsx`
- Modify: `web/src/features/catalog/PlatoList.tsx`
- Modify: `web/src/features/catalog/PlatoList.test.tsx`

**Interfaces:**
- Consumes: `usePlatoIngredientesReplace()` de Task 1; tipo `Ingrediente`/`IngredientePlato` de `domain/types.ts`.
- Produces: `PlatoIngredientesEditor` (`LineaEditor { idIngrediente: number; cantidad: number; unidad: string }`, `PlatoIngredientesEditorProps { ingredientesDisponibles: Ingrediente[]; lineas: LineaEditor[]; onCambiar: (lineas: LineaEditor[]) => void }`). `PlatoForm` amplía su interfaz a `PlatoFormProps { plato?: Plato; ingredientesDisponibles: Ingrediente[]; ingredientesPlato: IngredientePlato[]; onGuardado: () => void; onCancelar: () => void }` — Task 6 (`CatalogPage`) le pasa `catalogo.ingredientes` y `catalogo.ingredientesPlatos.filter(...)`.

- [ ] **Step 1: Escribir el test del editor**

Crear `web/src/features/catalog/PlatoIngredientesEditor.test.tsx`:

```typescript
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Ingrediente } from '../../domain/types'
import { PlatoIngredientesEditor } from './PlatoIngredientesEditor'

const ingredientesDisponibles: Ingrediente[] = [
  { id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] },
  { id: 2, nombre: 'Cebolla', proveedor: 'Frutería', unidadBase: 'ud', temporadas: ['TODAS'] }
]

describe('PlatoIngredientesEditor', () => {
  it('muestra un mensaje cuando no hay líneas', () => {
    render(
      <PlatoIngredientesEditor ingredientesDisponibles={ingredientesDisponibles} lineas={[]} onCambiar={vi.fn()} />
    )
    expect(screen.getByText('Ningún ingrediente añadido.')).toBeInTheDocument()
  })

  it('añade una línea con el primer ingrediente disponible al pulsar "+ Añadir ingrediente"', async () => {
    const onCambiar = vi.fn()
    render(
      <PlatoIngredientesEditor
        ingredientesDisponibles={ingredientesDisponibles}
        lineas={[]}
        onCambiar={onCambiar}
      />
    )
    await userEvent.click(screen.getByRole('button', { name: /añadir ingrediente/i }))
    expect(onCambiar).toHaveBeenCalledWith([{ idIngrediente: 1, cantidad: 1, unidad: 'g' }])
  })

  it('muestra una fila por línea con su ingrediente, cantidad y unidad', () => {
    render(
      <PlatoIngredientesEditor
        ingredientesDisponibles={ingredientesDisponibles}
        lineas={[{ idIngrediente: 2, cantidad: 3, unidad: 'ud' }]}
        onCambiar={vi.fn()}
      />
    )
    expect(screen.getByRole('combobox')).toHaveValue('2')
    expect(screen.getByDisplayValue('3')).toBeInTheDocument()
    expect(screen.getByDisplayValue('ud')).toBeInTheDocument()
  })

  it('actualiza la cantidad de una línea al editarla', async () => {
    const onCambiar = vi.fn()
    render(
      <PlatoIngredientesEditor
        ingredientesDisponibles={ingredientesDisponibles}
        lineas={[{ idIngrediente: 1, cantidad: 1, unidad: 'g' }]}
        onCambiar={onCambiar}
      />
    )
    const campoCantidad = screen.getByDisplayValue('1')
    await userEvent.clear(campoCantidad)
    await userEvent.type(campoCantidad, '500')
    expect(onCambiar).toHaveBeenLastCalledWith([{ idIngrediente: 1, cantidad: 500, unidad: 'g' }])
  })

  it('quita una línea al pulsar su botón de quitar', async () => {
    const onCambiar = vi.fn()
    render(
      <PlatoIngredientesEditor
        ingredientesDisponibles={ingredientesDisponibles}
        lineas={[
          { idIngrediente: 1, cantidad: 500, unidad: 'g' },
          { idIngrediente: 2, cantidad: 1, unidad: 'ud' }
        ]}
        onCambiar={onCambiar}
      />
    )
    const filas = screen.getAllByRole('button', { name: /quitar ingrediente/i })
    await userEvent.click(filas[0])
    expect(onCambiar).toHaveBeenCalledWith([{ idIngrediente: 2, cantidad: 1, unidad: 'ud' }])
  })
})
```

Nota: en el test de "muestra una fila por línea", `screen.getByRole('combobox')` da por hecho que solo hay una línea (un único `<select>` en pantalla) — coherente con el resto de tests de esta suite. Elimina el import `within` si no lo usas en el fichero final (no hace falta en este test file).

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/catalog/PlatoIngredientesEditor.test.tsx`
Expected: FAIL — `./PlatoIngredientesEditor` no existe.

- [ ] **Step 3: Implementar el editor**

Crear `web/src/features/catalog/PlatoIngredientesEditor.tsx`:

```typescript
import type { Ingrediente } from '../../domain/types'

export interface LineaEditor {
  idIngrediente: number
  cantidad: number
  unidad: string
}

export interface PlatoIngredientesEditorProps {
  ingredientesDisponibles: Ingrediente[]
  lineas: LineaEditor[]
  onCambiar: (lineas: LineaEditor[]) => void
}

const CAMPO =
  'rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3 py-2 text-sm dark:border-neutral-600 dark:bg-neutral-900'

export function PlatoIngredientesEditor({
  ingredientesDisponibles,
  lineas,
  onCambiar
}: PlatoIngredientesEditorProps) {
  function añadirLinea() {
    const primero = ingredientesDisponibles[0]
    if (!primero) return
    onCambiar([...lineas, { idIngrediente: primero.id, cantidad: 1, unidad: primero.unidadBase }])
  }

  function quitarLinea(indice: number) {
    onCambiar(lineas.filter((_, i) => i !== indice))
  }

  function actualizarLinea(indice: number, cambios: Partial<LineaEditor>) {
    onCambiar(lineas.map((linea, i) => (i === indice ? { ...linea, ...cambios } : linea)))
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">Ingredientes</span>
        <button
          type="button"
          onClick={añadirLinea}
          className="rounded-full bg-neutral-100 px-3.5 py-1.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-200 dark:bg-neutral-700 dark:text-neutral-200"
        >
          + Añadir ingrediente
        </button>
      </div>
      {lineas.length === 0 && <p className="text-sm text-neutral-400">Ningún ingrediente añadido.</p>}
      {lineas.map((linea, indice) => (
        <div key={indice} className="flex items-center gap-2">
          <select
            value={linea.idIngrediente}
            onChange={(e) => actualizarLinea(indice, { idIngrediente: Number(e.target.value) })}
            className={`flex-1 ${CAMPO}`}
          >
            {ingredientesDisponibles.map((ing) => (
              <option key={ing.id} value={ing.id}>
                {ing.nombre}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={linea.cantidad}
            onChange={(e) => actualizarLinea(indice, { cantidad: Number(e.target.value) })}
            className={`w-20 ${CAMPO}`}
          />
          <input
            type="text"
            value={linea.unidad}
            onChange={(e) => actualizarLinea(indice, { unidad: e.target.value })}
            className={`w-20 ${CAMPO}`}
          />
          <button
            type="button"
            onClick={() => quitarLinea(indice)}
            aria-label="Quitar ingrediente"
            className="grid h-8 w-8 place-items-center rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 dark:bg-neutral-700"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/catalog/PlatoIngredientesEditor.test.tsx`
Expected: PASS (5/5)

- [ ] **Step 5: Escribir los tests nuevos que amplían `PlatoForm.test.tsx`**

Añadir a `web/src/features/catalog/PlatoForm.test.tsx` (después del último test existente, dentro del mismo `describe`, antes de su `})` de cierre) — y cambiar TODOS los `render(<PlatoForm ...>)` ya existentes en el fichero para añadir las dos props nuevas obligatorias `ingredientesDisponibles={[]}` e `ingredientesPlato={[]}` (los 4 tests ya escritos en Task 4 no comprueban nada del editor, así que una lista vacía es correcta y no cambia su comportamiento):

```typescript
  it('incluye las líneas del editor de ingredientes al guardar, tras el upsert del plato', async () => {
    let segundoCuerpo: unknown = null
    let llamadas = 0
    server.use(
      http.post(API_URL, async ({ request }) => {
        llamadas += 1
        const cuerpo = (await request.json()) as { action: string }
        if (llamadas === 1) {
          expect(cuerpo.action).toBe('plato.upsert')
          return HttpResponse.json({ ok: true, result: { id_plato: 11 } })
        }
        segundoCuerpo = cuerpo
        return HttpResponse.json({ ok: true, result: { id_plato: 11, count: 1 } })
      })
    )
    const onGuardado = vi.fn()
    render(
      <PlatoForm
        ingredientesDisponibles={[{ id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] }]}
        ingredientesPlato={[]}
        onGuardado={onGuardado}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    await userEvent.type(screen.getByLabelText('Nombre'), 'Gazpacho')
    await userEvent.click(screen.getByRole('button', { name: /añadir ingrediente/i }))
    await userEvent.click(screen.getByRole('button', { name: /^guardar$/i }))

    await waitFor(() => expect(onGuardado).toHaveBeenCalledOnce())
    expect(segundoCuerpo).toEqual({
      action: 'platoIngredientes.replace',
      token: 'test-token',
      payload: { id_plato: 11, ingredientes: [{ id_ingrediente: 1, cantidad: 1, unidad: 'g' }] }
    })
  })

  it('precarga las líneas de ingredientesPlato en el editor', () => {
    render(
      <PlatoForm
        plato={{ id: 3, nombre: 'Gazpacho', temporadas: ['VERANO'], etiquetas: [], notas: '', activo: true }}
        ingredientesDisponibles={[{ id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] }]}
        ingredientesPlato={[{ id: 1, idPlato: 3, idIngrediente: 1, cantidad: 500, unidad: 'g' }]}
        onGuardado={vi.fn()}
        onCancelar={vi.fn()}
      />,
      { wrapper }
    )
    expect(screen.getByDisplayValue('500')).toBeInTheDocument()
  })
```

En los 4 `render(<PlatoForm ...>)` ya existentes en el fichero (Task 4), añadir `ingredientesDisponibles={[]}` e `ingredientesPlato={[]}` a cada uno.

- [ ] **Step 6: Ejecutar los tests y ver que fallan**

Run: `cd web && npx vitest run src/features/catalog/PlatoForm.test.tsx`
Expected: FAIL — `PlatoFormProps` no tiene `ingredientesDisponibles`/`ingredientesPlato` todavía, y el editor no está integrado.

- [ ] **Step 7: Ampliar `PlatoForm` con el editor de ingredientes**

Reemplazar el contenido completo de `web/src/features/catalog/PlatoForm.tsx` por:

```typescript
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Ingrediente, IngredientePlato, Plato, Temporada } from '../../domain/types'
import { usePlatoIngredientesReplace, usePlatoUpsert } from '../../data/queries'
import { platoFormSchema, type PlatoFormValues } from './schemas'
import { PlatoIngredientesEditor, type LineaEditor } from './PlatoIngredientesEditor'

export interface PlatoFormProps {
  plato?: Plato
  ingredientesDisponibles: Ingrediente[]
  ingredientesPlato: IngredientePlato[]
  onGuardado: () => void
  onCancelar: () => void
}

const CAMPO =
  'w-full rounded-lg border-[1.5px] border-neutral-200 bg-neutral-50 px-3.5 py-2.5 text-base dark:border-neutral-600 dark:bg-neutral-900'

const TEMPORADAS: Temporada[] = ['TODAS', 'PRIMAVERA', 'VERANO', 'OTOÑO', 'INVIERNO']
const NOMBRE_TEMPORADA: Record<Temporada, string> = {
  TODAS: 'Todas',
  PRIMAVERA: 'Primavera',
  VERANO: 'Verano',
  OTOÑO: 'Otoño',
  INVIERNO: 'Invierno'
}

function etiquetasATexto(etiquetas: string[]): string {
  return etiquetas.join(', ')
}

function textoAEtiquetas(texto: string): string[] {
  return texto
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0)
}

export function PlatoForm({
  plato,
  ingredientesDisponibles,
  ingredientesPlato,
  onGuardado,
  onCancelar
}: PlatoFormProps) {
  const platoUpsert = usePlatoUpsert()
  const platoIngredientesReplace = usePlatoIngredientesReplace()
  const [lineas, setLineas] = useState<LineaEditor[]>(
    ingredientesPlato.map((ip) => ({ idIngrediente: ip.idIngrediente, cantidad: ip.cantidad, unidad: ip.unidad }))
  )
  const {
    register,
    handleSubmit,
    control,
    formState: { errors }
  } = useForm<PlatoFormValues>({
    resolver: zodResolver(platoFormSchema),
    defaultValues: plato
      ? {
          nombre: plato.nombre,
          temporadas: plato.temporadas,
          etiquetas: etiquetasATexto(plato.etiquetas),
          notas: plato.notas,
          activo: plato.activo
        }
      : { nombre: '', temporadas: ['TODAS'], etiquetas: '', notas: '', activo: true }
  })

  function onSubmit(valores: PlatoFormValues) {
    platoUpsert.mutate(
      {
        id: plato?.id,
        nombre: valores.nombre,
        temporadas: valores.temporadas,
        etiquetas: textoAEtiquetas(valores.etiquetas),
        notas: valores.notas,
        activo: valores.activo
      },
      {
        onSuccess: (resultado) => {
          const idPlato = plato?.id ?? resultado.id_plato
          platoIngredientesReplace.mutate({ idPlato, ingredientes: lineas }, { onSuccess: onGuardado })
        }
      }
    )
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-700 dark:bg-neutral-800"
    >
      <div>
        <label htmlFor="plato-nombre" className="mb-1 block text-sm font-semibold">
          Nombre
        </label>
        <input id="plato-nombre" {...register('nombre')} className={CAMPO} />
        {errors.nombre && <p className="mt-1 text-sm text-red-600">{errors.nombre.message}</p>}
      </div>
      <div>
        <span className="mb-1 block text-sm font-semibold">Temporadas</span>
        <Controller
          name="temporadas"
          control={control}
          render={({ field }) => (
            <div className="flex flex-wrap gap-3">
              {TEMPORADAS.map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={field.value.includes(t)}
                    onChange={(e) => {
                      field.onChange(
                        e.target.checked ? [...field.value, t] : field.value.filter((v) => v !== t)
                      )
                    }}
                  />
                  {NOMBRE_TEMPORADA[t]}
                </label>
              ))}
            </div>
          )}
        />
        {errors.temporadas && <p className="mt-1 text-sm text-red-600">{errors.temporadas.message}</p>}
      </div>
      <div>
        <label htmlFor="plato-etiquetas" className="mb-1 block text-sm font-semibold">
          Etiquetas (separadas por comas)
        </label>
        <input id="plato-etiquetas" {...register('etiquetas')} className={CAMPO} placeholder="pasta, carne…" />
      </div>
      <div>
        <label htmlFor="plato-notas" className="mb-1 block text-sm font-semibold">
          Notas
        </label>
        <textarea id="plato-notas" {...register('notas')} rows={2} className={CAMPO} />
      </div>
      <PlatoIngredientesEditor
        ingredientesDisponibles={ingredientesDisponibles}
        lineas={lineas}
        onCambiar={setLineas}
      />
      {(platoUpsert.isError || platoIngredientesReplace.isError) && (
        <p className="text-sm text-red-600">No se pudo guardar. Inténtalo de nuevo.</p>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancelar}
          className="rounded-full px-4.5 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={platoUpsert.isPending || platoIngredientesReplace.isPending}
          className="rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900 disabled:opacity-50"
        >
          {platoUpsert.isPending || platoIngredientesReplace.isPending ? 'Guardando…' : 'Guardar'}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 8: Ejecutar los tests de `PlatoForm` y ver que pasan**

Run: `cd web && npx vitest run src/features/catalog/PlatoForm.test.tsx`
Expected: PASS (6/6)

- [ ] **Step 9: Actualizar `PlatoList` y su test para pasar las props nuevas**

`PlatoList` monta `PlatoForm` (al editar o crear un plato nuevo) y ahora debe pasarle `ingredientesDisponibles`/`ingredientesPlato`. Como `PlatoList` no recibe hoy ni el catálogo de ingredientes ni las relaciones plato-ingrediente, su interfaz también se amplía.

Añadir estos dos tests a `web/src/features/catalog/PlatoList.test.tsx` (después del último test existente, dentro del mismo `describe`, antes de su `})` de cierre), y añadir `ingredientesDisponibles={[]}` e `ingredientesPlato={[]}` a los 4 `render(<PlatoList ...>)` ya existentes en el fichero:

```typescript
  it('pasa los ingredientes disponibles y las líneas del plato al abrir su formulario', async () => {
    render(
      <PlatoList
        platos={platos}
        ingredientesDisponibles={[{ id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] }]}
        ingredientesPlato={[{ id: 1, idPlato: 1, idIngrediente: 1, cantidad: 500, unidad: 'g' }]}
      />,
      { wrapper }
    )
    const fila = screen.getByText('Gazpacho').closest('li')
    if (!fila) throw new Error('no se encontró la fila')
    await userEvent.click(within(fila).getByRole('button', { name: /editar/i }))
    expect(screen.getByDisplayValue('500')).toBeInTheDocument()
  })

  it('no incluye líneas de otros platos al abrir el formulario', async () => {
    render(
      <PlatoList
        platos={platos}
        ingredientesDisponibles={[{ id: 1, nombre: 'Tomate', proveedor: 'Frutería', unidadBase: 'g', temporadas: ['TODAS'] }]}
        ingredientesPlato={[{ id: 1, idPlato: 999, idIngrediente: 1, cantidad: 500, unidad: 'g' }]}
      />,
      { wrapper }
    )
    const fila = screen.getByText('Gazpacho').closest('li')
    if (!fila) throw new Error('no se encontró la fila')
    await userEvent.click(within(fila).getByRole('button', { name: /editar/i }))
    expect(screen.getByText('Ningún ingrediente añadido.')).toBeInTheDocument()
  })
```

- [ ] **Step 10: Ejecutar los tests y ver que fallan**

Run: `cd web && npx vitest run src/features/catalog/PlatoList.test.tsx`
Expected: FAIL — `PlatoListProps` no tiene `ingredientesDisponibles`/`ingredientesPlato` todavía.

- [ ] **Step 11: Ampliar `PlatoList`**

Reemplazar el contenido completo de `web/src/features/catalog/PlatoList.tsx` por:

```typescript
import { useState } from 'react'
import type { Ingrediente, IngredientePlato, Plato } from '../../domain/types'
import { usePlatoDelete, usePlatoUpsert } from '../../data/queries'
import { PlatoForm } from './PlatoForm'

export interface PlatoListProps {
  platos: Plato[]
  ingredientesDisponibles: Ingrediente[]
  ingredientesPlato: IngredientePlato[]
}

export function PlatoList({ platos, ingredientesDisponibles, ingredientesPlato }: PlatoListProps) {
  const [editando, setEditando] = useState<Plato | 'nuevo' | null>(null)
  const platoDelete = usePlatoDelete()
  const platoUpsert = usePlatoUpsert()

  function alternarActivo(plato: Plato) {
    if (plato.activo) {
      platoDelete.mutate({ id: plato.id })
    } else {
      platoUpsert.mutate({
        id: plato.id,
        nombre: plato.nombre,
        temporadas: plato.temporadas,
        etiquetas: plato.etiquetas,
        notas: plato.notas,
        activo: true
      })
    }
  }

  if (editando) {
    const plato = editando === 'nuevo' ? undefined : editando
    return (
      <PlatoForm
        plato={plato}
        ingredientesDisponibles={ingredientesDisponibles}
        ingredientesPlato={plato ? ingredientesPlato.filter((ip) => ip.idPlato === plato.id) : []}
        onGuardado={() => setEditando(null)}
        onCancelar={() => setEditando(null)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setEditando('nuevo')}
        className="self-start rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900"
      >
        + Nuevo plato
      </button>
      <ul className="flex flex-col gap-2">
        {platos.map((plato) => (
          <li
            key={plato.id}
            className={`flex items-center justify-between gap-3 rounded-lg border-[1.5px] p-3 ${
              plato.activo
                ? 'border-neutral-200 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900'
                : 'border-neutral-200 bg-neutral-100 opacity-60 dark:border-neutral-700 dark:bg-neutral-800'
            }`}
          >
            <div>
              <p className="font-semibold">{plato.nombre}</p>
              <p className="text-sm text-neutral-500">{plato.activo ? 'Activo' : 'Inactivo'}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditando(plato)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => alternarActivo(plato)}
                className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300"
              >
                {plato.activo ? 'Desactivar' : 'Reactivar'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 12: Ejecutar todos los tests de `features/catalog/` y ver que pasan**

Run: `cd web && npx vitest run src/features/catalog/`
Expected: PASS (todos)

- [ ] **Step 13: Ejecutar el build**

Run: `cd web && npm run build`
Expected: sin errores de TypeScript.

- [ ] **Step 14: Commit**

```bash
git add web/src/features/catalog/PlatoIngredientesEditor.tsx web/src/features/catalog/PlatoIngredientesEditor.test.tsx web/src/features/catalog/PlatoForm.tsx web/src/features/catalog/PlatoForm.test.tsx web/src/features/catalog/PlatoList.tsx web/src/features/catalog/PlatoList.test.tsx
git commit -m "feat: editor de ingredientes anidado en el formulario de plato

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VdDPpz83MW4Kxs3UwHFrhG"
```

---

### Task 6: `CatalogPage` — pestañas, ruta y `AppBar`

**Files:**
- Create: `web/src/features/catalog/CatalogPage.tsx`
- Create: `web/src/features/catalog/CatalogPage.test.tsx`
- Modify: `web/src/shared/AppBar.tsx`
- Modify: `web/src/shared/AppBar.test.tsx`
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.test.tsx`

**Interfaces:**
- Consumes: `useCatalogo()` de `data/queries.ts` (sin cambios); `ReglaList`, `IngredienteList`, `PlatoList` de Tasks 2-5; `AppBar` de `shared/AppBar.tsx`.
- Produces: `CatalogPage` (sin props, autocontenida) — la monta `App.tsx` en la ruta `/catalogo`.

- [ ] **Step 1: Escribir el test de navegación a "Catálogo" en `AppBar.test.tsx`**

El contenido actual completo de `web/src/shared/AppBar.test.tsx` es:

```typescript
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { AppBar } from './AppBar'

describe('AppBar', () => {
  it('muestra los enlaces de navegación y el contenido de la página', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppBar>
          <span>Contenido de la página</span>
        </AppBar>
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Planificador' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Compra' })).toBeInTheDocument()
    expect(screen.getByText('Contenido de la página')).toBeInTheDocument()
  })

  it('marca "Compra" como activo cuando la ruta es /compra, y "Planificador" no', () => {
    render(
      <MemoryRouter initialEntries={['/compra']}>
        <AppBar />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Compra' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Planificador' })).not.toHaveAttribute('aria-current')
  })
})
```

Añadir un tercer test, dentro del mismo `describe`, después del segundo, antes del `})` de cierre:

```typescript
  it('muestra el enlace a Catálogo', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppBar />
      </MemoryRouter>
    )
    expect(screen.getByRole('link', { name: 'Catálogo' })).toBeInTheDocument()
  })
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/shared/AppBar.test.tsx`
Expected: FAIL — no existe ningún `link` con nombre accesible "Catálogo".

- [ ] **Step 3: Añadir el enlace a `AppBar`**

En `web/src/shared/AppBar.tsx`, añadir un tercer `<NavLink>` dentro del `<nav>`, después del de "Compra":

```typescript
        <NavLink to="/catalogo" className={claseEnlace}>
          Catálogo
        </NavLink>
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/shared/AppBar.test.tsx`
Expected: PASS (3/3)

- [ ] **Step 5: Escribir el test de `CatalogPage`**

Crear `web/src/features/catalog/CatalogPage.test.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { server } from '../../test/mswServer'
import { CatalogPage } from './CatalogPage'

const API_URL = 'https://script.example.com/exec'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/catalogo']}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
}

function mockCatalogo() {
  server.use(
    http.get(API_URL, () =>
      HttpResponse.json({
        ok: true,
        platos: [{ id_plato: 1, nombre: 'Gazpacho', temporada: 'VERANO', etiquetas: '', notas: '', activo: true }],
        ingredientes: [
          { id_ingrediente: 1, nombre: 'Tomate', proveedor: 'Frutería', unidad_base: 'g', temporada: 'TODAS' }
        ],
        ingredientesPlatos: [],
        reglas: [{ id: 1, etiqueta: 'pasta', tipo: 'MAX_SEMANA', valor: 1, activa: true }],
        proveedores: []
      })
    )
  )
}

describe('CatalogPage', () => {
  it('muestra la pestaña de Platos por defecto', async () => {
    mockCatalogo()
    render(<CatalogPage />, { wrapper })
    expect(await screen.findByText('Gazpacho')).toBeInTheDocument()
  })

  it('cambia a la pestaña de Ingredientes al pulsarla', async () => {
    mockCatalogo()
    render(<CatalogPage />, { wrapper })
    await screen.findByText('Gazpacho')
    await userEvent.click(screen.getByRole('tab', { name: 'Ingredientes' }))
    expect(await screen.findByText('Tomate')).toBeInTheDocument()
    expect(screen.queryByText('Gazpacho')).not.toBeInTheDocument()
  })

  it('cambia a la pestaña de Reglas al pulsarla', async () => {
    mockCatalogo()
    render(<CatalogPage />, { wrapper })
    await screen.findByText('Gazpacho')
    await userEvent.click(screen.getByRole('tab', { name: 'Reglas' }))
    expect(await screen.findByText('pasta')).toBeInTheDocument()
  })

  it('muestra un estado de carga mientras llega el catálogo', () => {
    mockCatalogo()
    render(<CatalogPage />, { wrapper })
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
  })
})
```

- [ ] **Step 6: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/features/catalog/CatalogPage.test.tsx`
Expected: FAIL — `./CatalogPage` no existe.

- [ ] **Step 7: Implementar `CatalogPage`**

Crear `web/src/features/catalog/CatalogPage.tsx`:

```typescript
import { useState } from 'react'
import { useCatalogo } from '../../data/queries'
import { AppBar } from '../../shared/AppBar'
import { PlatoList } from './PlatoList'
import { IngredienteList } from './IngredienteList'
import { ReglaList } from './ReglaList'

type Pestaña = 'platos' | 'ingredientes' | 'reglas'

const NOMBRE_PESTAÑA: Record<Pestaña, string> = {
  platos: 'Platos',
  ingredientes: 'Ingredientes',
  reglas: 'Reglas'
}

export function CatalogPage() {
  const [pestaña, setPestaña] = useState<Pestaña>('platos')
  const catalogo = useCatalogo()

  return (
    <div className="mx-auto max-w-[1560px] pb-7">
      <AppBar>
        <div className="flex gap-0.5 rounded-full bg-white/10 p-1" role="tablist">
          {(['platos', 'ingredientes', 'reglas'] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="tab"
              aria-selected={pestaña === p}
              onClick={() => setPestaña(p)}
              className={
                pestaña === p
                  ? 'rounded-full bg-amber-500 px-4.5 py-2 text-sm font-semibold text-neutral-900'
                  : 'rounded-full px-4.5 py-2 text-sm font-semibold text-white/70 hover:bg-white/10'
              }
            >
              {NOMBRE_PESTAÑA[p]}
            </button>
          ))}
        </div>
      </AppBar>

      {catalogo.isLoading && <p className="px-5 pt-6 text-center text-neutral-500">Cargando…</p>}
      {catalogo.isError && (
        <p className="px-5 pt-6 text-center text-amber-700 dark:text-amber-500">
          Sin conexión — no se pudo cargar el catálogo.
        </p>
      )}

      {catalogo.data && (
        <div className="mx-auto max-w-3xl px-5 pt-4">
          {pestaña === 'platos' && (
            <PlatoList
              platos={catalogo.data.catalogo.platos}
              ingredientesDisponibles={catalogo.data.catalogo.ingredientes}
              ingredientesPlato={catalogo.data.catalogo.ingredientesPlatos}
            />
          )}
          {pestaña === 'ingredientes' && <IngredienteList ingredientes={catalogo.data.catalogo.ingredientes} />}
          {pestaña === 'reglas' && <ReglaList reglas={catalogo.data.catalogo.reglas} />}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 8: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/features/catalog/CatalogPage.test.tsx`
Expected: PASS (4/4)

- [ ] **Step 9: Añadir la ruta en `App.tsx`**

El contenido actual completo de `web/src/App.tsx` es:

```typescript
import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { PlannerPage } from './features/planner/PlannerPage'
import type { VistaPlanner } from './features/planner/Toolbar'
import { ShoppingListPage } from './features/shopping/ShoppingListPage'
import { lunesDe } from './shared/semanaDates'

function App() {
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [vista, setVista] = useState<VistaPlanner>('semana')

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlannerPage lunes={lunes} setLunes={setLunes} vista={vista} setVista={setVista} />} />
        <Route path="/compra" element={<ShoppingListPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

Reemplazarlo por:

```typescript
import { useState } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { PlannerPage } from './features/planner/PlannerPage'
import type { VistaPlanner } from './features/planner/Toolbar'
import { ShoppingListPage } from './features/shopping/ShoppingListPage'
import { CatalogPage } from './features/catalog/CatalogPage'
import { lunesDe } from './shared/semanaDates'

function App() {
  const [lunes, setLunes] = useState(() => lunesDe(new Date()))
  const [vista, setVista] = useState<VistaPlanner>('semana')

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PlannerPage lunes={lunes} setLunes={setLunes} vista={vista} setVista={setVista} />} />
        <Route path="/compra" element={<ShoppingListPage />} />
        <Route path="/catalogo" element={<CatalogPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 10: Escribir el test de navegación en `App.test.tsx`**

Añadir un test al final de `describe('App', ...)` en `web/src/App.test.tsx` (después del último test existente, dentro del mismo `describe`, antes de su `})` de cierre):

```typescript
  it('navega al catálogo desde la barra de navegación', async () => {
    mockBootstrapYPlan()
    renderApp()
    await screen.findByText('Recetario')

    await userEvent.click(screen.getByRole('link', { name: /catálogo/i }))

    expect(await screen.findByRole('tab', { name: 'Platos' })).toBeInTheDocument()
    expect(screen.queryByText('Recetario')).not.toBeInTheDocument()
  })
```

- [ ] **Step 11: Ejecutar todos los tests y ver que pasan**

Run: `cd web && npx vitest run src/App.test.tsx src/features/catalog/`
Expected: PASS (todos)

- [ ] **Step 12: Ejecutar la suite completa, lint y build**

```bash
cd web
npm run lint
npm run test -- --run --no-file-parallelism
npm run build
```

Expected: los tres comandos terminan sin error, `npm run lint` sin ningún warning.

- [ ] **Step 13: Commit**

```bash
git add web/src/features/catalog/CatalogPage.tsx web/src/features/catalog/CatalogPage.test.tsx web/src/shared/AppBar.tsx web/src/shared/AppBar.test.tsx web/src/App.tsx web/src/App.test.tsx
git commit -m "feat: CatalogPage — pestañas Platos/Ingredientes/Reglas, ruta /catalogo

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VdDPpz83MW4Kxs3UwHFrhG"
```

---

### Task 7: verificación manual, spec y publicación

**Files:**
- Modify: `docs/specs/2026-09-06-menu-familiar-design.md`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: nada — cierre del plan.

- [ ] **Step 1: Verificación manual en el navegador**

```bash
cd web && npm run dev
```

Abrir la URL que imprime Vite y comprobar a mano (contra la API real):
- La barra de navegación muestra "Planificador"/"Compra"/"Catálogo"; tocar "Catálogo" navega a `/catalogo` y muestra la pestaña "Platos" con los platos reales.
- Cambiar a "Ingredientes" y "Reglas" muestra sus listas reales.
- Crear una regla nueva ("+ Nueva regla"), guardarla, y comprobar que aparece en la lista y en la hoja de Google.
- Editar esa regla, cambiar su valor, guardar, y comprobar que se actualiza (no se duplica).
- Eliminarla — debe pedir confirmación — y comprobar que desaparece de la lista y de la hoja.
- Crear un ingrediente nuevo con algún macro relleno, comprobar que aparece.
- Eliminarlo (con confirmación) y comprobar que desaparece.
- Crear un plato nuevo, añadirle un ingrediente con cantidad y unidad desde el editor anidado, guardar, y comprobar en la hoja que se creó tanto la fila de `platos` como la fila de `ingredientes_platos`.
- Desactivar ese plato (sin confirmación) y comprobar que pasa a "Inactivo" y que en la hoja su columna `activo` es `FALSE`, no que la fila desaparezca.
- Reactivarlo y comprobar que vuelve a "Activo".
- Volver a "Planificador" y comprobar que el plato nuevo aparece en el Recetario (si está activo) y que las flechas de semana siguen funcionando.

Si algo de esto falla, anotarlo y arreglarlo antes de continuar — es la única verificación end-to-end de todo el plan contra la API real.

- [ ] **Step 2: Actualizar la spec**

En `docs/specs/2026-09-06-menu-familiar-design.md`, sustituir el título de la sección `## Catálogo — CRUD de platos, ingredientes y reglas (diseño)` por `## Catálogo — CRUD de platos, ingredientes y reglas (implementado)`, y añadir al final de esa sección (después del último punto de la lista de `features/catalog/`, antes de cualquier sección siguiente):

```markdown

**Implementado:** todo lo descrito arriba, construido tal cual. Tercera ruta
`/catalogo` en `App.tsx`; `shared/AppBar.tsx` gana el enlace "Catálogo".
Verificado manualmente contra la API real: alta/edición/borrado de reglas e
ingredientes, alta de un plato con su editor de ingredientes anidado
(confirmado que crea tanto la fila de `platos` como las de
`ingredientes_platos`), y el ciclo desactivar/reactivar de un plato (borrado
lógico, no desaparece de la hoja).
```

Además, en la sección "Dominio y capa de datos del frontend (implementado)", localizar el párrafo que empieza con "Pendiente: las mutaciones de `plato`/`ingrediente`/`regla` para la página de catálogo..." y sustituirlo por:

```markdown
Pendiente: Recetario interactivo, navegación real de mes en la vista Mes del
planificador. El catálogo (CRUD de platos/ingredientes/reglas) y la lista de
la compra ya están construidos — ver las secciones siguientes.
```

- [ ] **Step 3: Commit y push**

```bash
git add docs/specs/2026-09-06-menu-familiar-design.md
git commit -m "docs: marcar implementado el CRUD de catálogo en la spec

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VdDPpz83MW4Kxs3UwHFrhG"
git push origin main
```
