# Segundo hueco por comida (primero/segundo) — Dominio y datos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Propagar el campo `orden` (1=primero, 2=segundo), ya soportado por la API de Apps Script y verificado en producción, a través de `domain/` y `data/`: tipos, evaluación de reglas (que ahora debe considerar hasta dos platos por día), esquemas zod, mappers y hooks de mutación.

**Architecture:** `AsignacionSemana` deja de ser "un plato por día" y pasa a ser una entrada plana `{fecha, orden, plato}` — el caller (la futura UI del planificador) construye hasta 10 entradas para una semana de 5 días × 2 huecos. `NO_CONSECUTIVO` pasa a incumplirse tanto entre días calendario consecutivos como entre el primero y el segundo del **mismo** día (distancia 0), exactamente como ya se validó en la maqueta de UX aprobada por Rafa (Artifact del planificador).

**Tech Stack:** TypeScript, Zod 4, TanStack Query 5 (mismo stack que los planes anteriores de dominio/datos).

**Spec:** `docs/specs/2026-09-06-menu-familiar-design.md` (secciones "Dominio y capa de datos del frontend" y "Resultado de la verificación del segundo hueco").

## Global Constraints

- `orden` es `1 | 2`, nunca otro valor.
- `NO_CONSECUTIVO` compara **pares consecutivos en la lista ordenada por `fecha` y luego `orden`**, marcando aviso cuando la distancia en días es `<= 1` (0 = mismo día, distinto hueco; 1 = día siguiente).
- No se toca `apps-script/` en este plan — la API ya está verificada con `orden`.
- No se monta ninguna UI en este plan — eso es el plan siguiente, que consumirá estos tipos y hooks ya actualizados.

---

### Task 1: `orden` en los tipos de dominio y en la evaluación de reglas

**Files:**
- Modify: `web/src/domain/types.ts`
- Modify: `web/src/domain/reglas.ts`
- Modify: `web/src/domain/reglas.test.ts`

**Interfaces:**
- Consumes: nada nuevo
- Produces: `Orden` (`1 | 2`), `PlanEntry.orden`, `AsignacionSemana{fecha, orden, plato}` — usados por `mappers.ts` (Task 2) y por el futuro plan de la UI del planificador.

- [ ] **Step 1: Añadir el tipo `Orden` y el campo `orden` a `PlanEntry` en `types.ts`**

En `web/src/domain/types.ts`, añadir antes de `export interface PlanEntry` la línea:

```typescript
export type Orden = 1 | 2
```

Y dentro de `PlanEntry`, añadir el campo `orden: Orden` (junto a `turno`):

```typescript
export interface PlanEntry {
  id: number
  fecha: string
  turno: Turno
  orden: Orden
  idPlato: number
  notas: string
}
```

- [ ] **Step 2: Reescribir `reglas.test.ts` con la nueva forma de `AsignacionSemana` y el caso del mismo día**

Reemplazar el contenido completo de `web/src/domain/reglas.test.ts` por:

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
      { fecha: '2026-09-07', orden: 1, plato: plato('Pasta', ['pasta']) },
      { fecha: '2026-09-08', orden: 1, plato: plato('Ensalada', ['verdura']) }
    ]
    const [estado] = evaluarSemana(asignaciones, [regla({ tipo: 'MAX_SEMANA', valor: 1 })])
    expect(estado).toMatchObject({ actual: 1, objetivo: 1, estado: 'ok' })
  })

  it('MAX_SEMANA en aviso cuando se supera el límite (contando ambos huecos del día)', () => {
    const asignaciones: AsignacionSemana[] = [
      { fecha: '2026-09-07', orden: 1, plato: plato('Ensalada', ['verdura']) },
      { fecha: '2026-09-07', orden: 2, plato: plato('Pasta', ['pasta']) },
      { fecha: '2026-09-09', orden: 1, plato: plato('Macarrones', ['pasta']) }
    ]
    const [estado] = evaluarSemana(asignaciones, [regla({ tipo: 'MAX_SEMANA', valor: 1 })])
    expect(estado).toMatchObject({ actual: 2, objetivo: 1, estado: 'aviso' })
  })

  it('MIN_SEMANA en aviso cuando no se llega al mínimo', () => {
    const asignaciones: AsignacionSemana[] = [{ fecha: '2026-09-07', orden: 1, plato: plato('Pasta', ['pasta']) }]
    const [estado] = evaluarSemana(asignaciones, [
      regla({ etiqueta: 'pescado', tipo: 'MIN_SEMANA', valor: 2 })
    ])
    expect(estado).toMatchObject({ actual: 0, objetivo: 2, estado: 'aviso' })
  })

  it('NO_CONSECUTIVO en aviso cuando dos días seguidos llevan la etiqueta', () => {
    const asignaciones: AsignacionSemana[] = [
      { fecha: '2026-09-07', orden: 1, plato: plato('Hamburguesa', ['carne']) },
      { fecha: '2026-09-08', orden: 1, plato: plato('Pollo', ['carne']) }
    ]
    const [estado] = evaluarSemana(asignaciones, [
      regla({ etiqueta: 'carne', tipo: 'NO_CONSECUTIVO', valor: 0 })
    ])
    expect(estado.estado).toBe('aviso')
  })

  it('NO_CONSECUTIVO en aviso cuando el primero y el segundo del MISMO día llevan la etiqueta', () => {
    const asignaciones: AsignacionSemana[] = [
      { fecha: '2026-09-07', orden: 1, plato: plato('Hamburguesa', ['carne']) },
      { fecha: '2026-09-07', orden: 2, plato: plato('Pollo con cebolla', ['carne']) }
    ]
    const [estado] = evaluarSemana(asignaciones, [
      regla({ etiqueta: 'carne', tipo: 'NO_CONSECUTIVO', valor: 0 })
    ])
    expect(estado.estado).toBe('aviso')
  })

  it('NO_CONSECUTIVO en ok cuando el hueco entre fechas no es de 1 día (viernes y el lunes siguiente)', () => {
    const asignaciones: AsignacionSemana[] = [
      { fecha: '2026-09-11', orden: 1, plato: plato('Hamburguesa', ['carne']) }, // viernes
      { fecha: '2026-09-14', orden: 1, plato: plato('Pollo', ['carne']) } // lunes siguiente
    ]
    const [estado] = evaluarSemana(asignaciones, [
      regla({ etiqueta: 'carne', tipo: 'NO_CONSECUTIVO', valor: 0 })
    ])
    expect(estado.estado).toBe('ok')
  })

  it('ignora reglas inactivas', () => {
    const asignaciones: AsignacionSemana[] = [{ fecha: '2026-09-07', orden: 1, plato: plato('Pasta', ['pasta']) }]
    const resultado = evaluarSemana(asignaciones, [regla({ activa: false })])
    expect(resultado).toEqual([])
  })

  it('cuenta huecos sin plato asignado como ausencia de la etiqueta', () => {
    const asignaciones: AsignacionSemana[] = [
      { fecha: '2026-09-07', orden: 1, plato: null },
      { fecha: '2026-09-07', orden: 2, plato: null }
    ]
    const [estado] = evaluarSemana(asignaciones, [regla({ tipo: 'MAX_SEMANA', valor: 1 })])
    expect(estado.actual).toBe(0)
  })
})
```

- [ ] **Step 3: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/domain/reglas.test.ts`
Expected: FAIL — los literales `AsignacionSemana` ya incluyen `orden`, que la interfaz actual no declara (error de tipos) y el caso "mismo día" no está contemplado por `hayConsecutivos`.

- [ ] **Step 4: Reescribir `reglas.ts`**

Reemplazar el contenido completo de `web/src/domain/reglas.ts` por:

```typescript
import type { Orden, Plato, Regla } from './types'

export interface AsignacionSemana {
  fecha: string
  orden: Orden
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

// Dos asignaciones se consideran "seguidas" si están en el mismo día
// (distinto hueco, distancia 0) o en días calendario consecutivos
// (distancia 1) — así una regla NO_CONSECUTIVO detecta tanto carne dos
// días seguidos como carne de primero y segundo el mismo día.
function hayConsecutivos(asignaciones: AsignacionSemana[], etiqueta: string): boolean {
  const ordenadas = [...asignaciones].sort((a, b) => {
    const porFecha = a.fecha.localeCompare(b.fecha)
    return porFecha !== 0 ? porFecha : a.orden - b.orden
  })
  for (let i = 1; i < ordenadas.length; i++) {
    const anterior = ordenadas[i - 1]
    const actual = ordenadas[i]
    const distancia = diasEntre(anterior.fecha, actual.fecha)
    if (distancia <= 1 && tienEtiqueta(anterior, etiqueta) && tienEtiqueta(actual, etiqueta)) {
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

- [ ] **Step 5: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/domain/reglas.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Commit**

```bash
git add web/src/domain/types.ts web/src/domain/reglas.ts web/src/domain/reglas.test.ts
git commit -m "feat: soportar dos huecos por comida en tipos y evaluación de reglas"
```

---

### Task 2: `orden` en esquemas zod y mappers

**Files:**
- Modify: `web/src/data/schemas.ts`
- Modify: `web/src/data/schemas.test.ts`
- Modify: `web/src/data/mappers.ts`
- Modify: `web/src/data/mappers.test.ts`

**Interfaces:**
- Consumes: `Orden`, `PlanEntry` de `domain/types.ts` (Task 1)
- Produces: `planEntryRowSchema` con `orden`; `mapPlanEntry` con `orden` — usados por `queries.ts` (Task 3)

- [ ] **Step 1: Escribir el test de `schemas.ts` para `orden`**

Añadir a `web/src/data/schemas.test.ts`, dentro de un nuevo bloque `describe('planEntryRowSchema', ...)` (añadir el import de `planEntryRowSchema` al `import { ... } from './schemas'` existente):

```typescript
describe('planEntryRowSchema', () => {
  it('coacciona orden a número', () => {
    const resultado = planEntryRowSchema.safeParse({
      id: 1,
      fecha: '2026-09-07',
      turno: 'COMIDA',
      orden: '2',
      id_plato: 3,
      notas: ''
    })
    expect(resultado.success).toBe(true)
    expect(resultado.success && resultado.data.orden).toBe(2)
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/data/schemas.test.ts`
Expected: FAIL — `planEntryRowSchema` no tiene campo `orden` todavía (zod lo ignora silenciosamente, así que `resultado.data.orden` es `undefined`, no `2`).

- [ ] **Step 3: Añadir `orden` a `planEntryRowSchema`**

En `web/src/data/schemas.ts`, dentro de `planEntryRowSchema`, añadir el campo (junto a `turno`):

```typescript
export const planEntryRowSchema = z.object({
  id: z.coerce.number().int(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  turno: textoFlexible.pipe(z.string().min(1)),
  orden: z.coerce.number().int().min(1).max(2),
  id_plato: z.coerce.number().int(),
  notas: textoFlexible
})
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/data/schemas.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Escribir el test de `mapPlanEntry`**

Añadir a `web/src/data/mappers.test.ts` (añadir `mapPlanEntry` al import existente `import { mapIngrediente, mapPlato } from './mappers'`):

```typescript
describe('mapPlanEntry', () => {
  it('mapea orden e id_plato a idPlato', () => {
    const resultado = mapPlanEntry({
      id: 5,
      fecha: '2026-09-07',
      turno: 'COMIDA',
      orden: 2,
      id_plato: 3,
      notas: ''
    })
    expect(resultado).toEqual({
      id: 5,
      fecha: '2026-09-07',
      turno: 'COMIDA',
      orden: 2,
      idPlato: 3,
      notas: ''
    })
  })
})
```

- [ ] **Step 6: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/data/mappers.test.ts`
Expected: FAIL — `mapPlanEntry` todavía no incluye `orden` en el objeto que devuelve.

- [ ] **Step 7: Añadir `orden` a `mapPlanEntry`**

En `web/src/data/mappers.ts`, reemplazar la función `mapPlanEntry`:

```typescript
export function mapPlanEntry(row: z.infer<typeof planEntryRowSchema>): PlanEntry {
  return {
    id: row.id,
    fecha: row.fecha,
    turno: row.turno as PlanEntry['turno'],
    orden: row.orden as PlanEntry['orden'],
    idPlato: row.id_plato,
    notas: row.notas
  }
}
```

- [ ] **Step 8: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/data/mappers.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 9: Commit**

```bash
git add web/src/data/schemas.ts web/src/data/schemas.test.ts web/src/data/mappers.ts web/src/data/mappers.test.ts
git commit -m "feat: soportar orden en esquemas zod y mappers de plan"
```

---

### Task 3: `orden` en los hooks de mutación y verificación final

**Files:**
- Modify: `web/src/data/queries.ts`
- Modify: `web/src/data/queries.test.tsx`
- Modify: `docs/specs/2026-09-06-menu-familiar-design.md`

**Interfaces:**
- Consumes: `PlanEntry.orden` (Task 1), `planEntryRowSchema`/`mapPlanEntry` con `orden` (Task 2)
- Produces: `useSetPlanEntry`, `useMovePlanEntry`, `useDeletePlanEntry` con `orden` en su payload — contrato final que consumirá la UI del planificador (siguiente plan)

- [ ] **Step 1: Actualizar el test de `useSetPlanEntry`**

En `web/src/data/queries.test.tsx`, dentro de `describe('useSetPlanEntry', ...)`, cambiar el `body.payload` esperado y la llamada a `mutate`:

```typescript
describe('useSetPlanEntry', () => {
  it('llama a plan.set con el payload correcto', async () => {
    server.use(
      http.post(API_URL, async ({ request }) => {
        const body = (await request.json()) as { action: string; payload: unknown }
        expect(body.action).toBe('plan.set')
        expect(body.payload).toEqual({ fecha: '2026-09-07', turno: 'COMIDA', orden: 1, id_plato: 1, notas: '' })
        return HttpResponse.json({ ok: true, result: { id: 1 } })
      })
    )
    const { result } = renderHook(() => useSetPlanEntry(), { wrapper })
    result.current.mutate({ fecha: '2026-09-07', turno: 'COMIDA', orden: 1, idPlato: 1 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
```

- [ ] **Step 2: Ejecutar el test y ver que falla**

Run: `cd web && npx vitest run src/data/queries.test.tsx`
Expected: FAIL — `NuevaAsignacion` no acepta `orden` todavía (error de tipos) y el payload real enviado no lo incluye.

- [ ] **Step 3: Añadir `orden` a `NuevaAsignacion` y `ExtremoPlan` en `queries.ts`**

En `web/src/data/queries.ts`, reemplazar las dos interfaces y la función `useSetPlanEntry`:

```typescript
interface NuevaAsignacion {
  fecha: string
  turno: Turno
  orden: Orden
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
        orden: entrada.orden,
        id_plato: entrada.idPlato,
        notas: entrada.notas ?? ''
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan'] })
  })
}

interface ExtremoPlan {
  fecha: string
  turno: Turno
  orden: Orden
}
```

`useMovePlanEntry` y `useDeletePlanEntry` no cambian de código — ya reenvían `args`/`{from, to}` completos, así que heredan `orden` automáticamente al ampliarse `ExtremoPlan`. Añadir `Orden` al import existente de tipos:

```typescript
import type { Catalogo, Orden, PlanEntry, Turno } from '../domain/types'
```

- [ ] **Step 4: Ejecutar el test y ver que pasa**

Run: `cd web && npx vitest run src/data/queries.test.tsx`
Expected: PASS (2 tests)

- [ ] **Step 5: Verificación completa**

```bash
cd web
npm run lint
npm run test
npm run build
```

Expected: los tres comandos terminan sin error. El recuento de tests debe subir en 3 respecto al plan anterior (reglas +1, schemas +1, mappers +1) menos los que se sobrescribieron uno a uno — el total exacto lo confirma la salida de `npm run test`.

- [ ] **Step 6: Actualizar la spec**

En `docs/specs/2026-09-06-menu-familiar-design.md`, en la sección "Dominio y capa de datos del frontend (implementado)", actualizar la línea de `reglas.ts` y añadir una línea sobre `orden`:

```markdown
- `reglas.ts` — `evaluarSemana(asignaciones, reglas)` → `EstadoRegla[]`. Cubre `MAX_SEMANA`,
  `MIN_SEMANA` y `NO_CONSECUTIVO`. Cada día puede tener hasta dos huecos (`orden` 1/2);
  `NO_CONSECUTIVO` se incumple tanto entre días calendario seguidos como entre el
  primero y el segundo del mismo día (distancia en días `<= 1`).
```

Y sustituir el párrafo final "Pendiente para el plan del planificador..." por:

```markdown
Pendiente para el plan del planificador: montar `QueryClientProvider` (con
`persistQueryClient` + `idb-keyval` para offline) en `main.tsx`, y las mutaciones de
`plato`/`ingrediente`/`regla` para la página de catálogo. `orden` ya está soportado de
punta a punta (API, dominio, esquemas, mappers, hooks) — la UI del planificador puede
construirse directamente sobre `useSetPlanEntry`/`useMovePlanEntry`/`useDeletePlanEntry`.
```

- [ ] **Step 7: Commit y push**

```bash
git add web/src/data/queries.ts web/src/data/queries.test.tsx docs/specs/2026-09-06-menu-familiar-design.md
git commit -m "feat: soportar orden en los hooks de mutación de plan"
git push origin main
```
