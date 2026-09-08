# Diseño: Planificador de menú familiar

## Contexto y objetivo

App doméstica para planificar el menú semanal familiar desde una tablet fija
en la cocina. Sin servidor propio: una hoja de Google Sheets hace de base de
datos, servida a través de un Google Apps Script Web App como API JSON.

Objetivo v1: ver de un vistazo qué se come cada día, generar la lista de la
compra a partir del plan, y avisar (sin bloquear) cuando el menú incumple
reglas de equilibrio o pone un plato fuera de temporada.

Fuera de alcance v1: macros nutricionales, envío de la compra por
Telegram/WhatsApp, sugerencia automática de menú.

## Decisiones de producto

| Decisión | Elección |
|---|---|
| Comensales | Menú único para todos (Rafa + hijas). Sin platos por persona. |
| Estructura del día | Un único turno, `COMIDA`, lunes a viernes. Modelado con campo `turno` para poder añadir `CENA` sin migrar datos. |
| Restricciones | Etiquetas en los platos + reglas sobre etiquetas (`MAX_SEMANA`, `MIN_SEMANA`, `NO_CONSECUTIVO`). Avisos visuales, nunca bloqueo. |
| Acceso a datos | Google Apps Script publicado como Web App = API JSON. Sin OAuth ni login en la tablet. |
| Hosting frontend | Netlify o Vercel, build estática. |

## Esquema de la hoja de Google

| Pestaña | Columnas |
|---|---|
| `platos` | `id_plato, nombre, temporada, etiquetas, notas, activo` |
| `ingredientes` | `id_ingrediente, nombre, proveedor, unidad_base, temporada, kcal_100, prot_100, carb_100, grasa_100` |
| `ingredientes_platos` | `id, id_plato, id_ingrediente, cantidad, unidad` |
| `plan` | `id, fecha, turno, orden, id_plato, notas` |
| `reglas` | `id, etiqueta, tipo, valor, activa` |
| `proveedores` | `nombre, orden` |

Convenciones:
- `temporada`: lista separada por comas de `TODAS|PRIMAVERA|VERANO|OTOÑO|INVIERNO`.
- `etiquetas`: lista separada por comas, minúsculas sin acentos (`pasta,legumbre,pescado`).
- `unidad` / `unidad_base`: vocabulario cerrado `g | ml | ud | paquete`.
- `cantidad`: numérica (`0.5`, no `"1/2"`).
- Columnas de macros (`kcal_100`, `prot_100`, `carb_100`, `grasa_100`) creadas vacías desde v1
  para no volver a migrar el esquema cuando llegue la fase nutricional.

Limpieza de datos pendiente sobre la hoja actual: `Moozzarela`→`Mozzarella`,
`Huevoss`→`Huevos`, `Garbanzzos`→`Garbanzos`, `Arrroz basmati`→`Arroz basmati`,
`Mira al talll`→`Mira al tall`; unificar `ud`/`unidad`→`ud`; ignorar filas de
`ingredientes_platos` sin `id_plato`.

## API (Google Apps Script)

Implementada en `apps-script/Codigo.gs`. Un helper genérico
(`sheetToObjects_`) mapea cualquier pestaña a objetos usando sus cabeceras
reales — las lecturas no dependen de que la migración ya se haya
ejecutado. `ensureSchema_()` corre en cada request y normaliza cabeceras y
formato de la columna `fecha` de forma idempotente.

**Lectura (`GET`, sin token)**
- `?action=bootstrap` → `{ok:true, platos, ingredientes, ingredientesPlatos, reglas, proveedores}`
- `?action=plan&desde=YYYY-MM-DD&hasta=YYYY-MM-DD` → `{ok:true, entries}`

Cada objeto incluye un campo interno `_row` que el frontend debe ignorar.

**Escritura (`POST`, body `{action, token, payload}`, `Content-Type: text/plain`)**

| action | payload | result |
|---|---|---|
| `plan.set` | `{fecha, turno, orden, id_plato, notas?}` | `{id}` |
| `plan.delete` | `{fecha, turno, orden}` | `{deleted}` |
| `plan.move` | `{from:{fecha,turno,orden}, to:{fecha,turno,orden}}` | `{ok:true}` |
| `plato.upsert` | `{id_plato?, nombre, temporada, etiquetas, notas?, activo?}` | `{id_plato}` |
| `plato.delete` | `{id_plato}` | `{deleted}` |
| `ingrediente.upsert` | `{id_ingrediente?, nombre, proveedor?, unidad_base?, temporada?, kcal_100?, prot_100?, carb_100?, grasa_100?}` | `{id_ingrediente}` |
| `ingrediente.delete` | `{id_ingrediente}` | `{deleted}` |
| `platoIngredientes.replace` | `{id_plato, ingredientes:[{id_ingrediente,cantidad,unidad}]}` | `{id_plato, count}` |
| `regla.upsert` | `{id?, etiqueta, tipo, valor, activa?}` | `{id}` |
| `regla.delete` | `{id}` | `{deleted}` |
| `admin.migrate` | `{}` | `{activoBackfilled, nombresCorregidos, cantidadesNormalizadas, unidadesNormalizadas, filasIngredientesPlatosEliminadas}` |

Respuesta de error (cualquier acción): `{ok:false, error:"..."}`.

Reglas de implementación: todas las escrituras bajo `LockService.getScriptLock()`;
ids asignados por el servidor (`max(id)+1` bajo lock); token compartido
comparado contra `PropertiesService`; **POST siempre `text/plain`** — un
`Content-Type: application/json` dispara un preflight `OPTIONS` que Apps
Script no responde y el navegador bloquea la petición.

Nota de contrato: `plato.upsert` asume `activo:true` si se omite. El
cliente debe enviar siempre `activo` explícito al editar un plato
existente, o reactivará por accidente uno borrado.

**Dos huecos por comida.** Cada día tiene hasta dos platos dentro del mismo
`turno` (`orden: 1` = primero, `2` = segundo), validado en una maqueta de UX
antes de tocar código (ver Artifact del planificador). `plan.move` con el
mismo `fecha` en `from` y `to` pero distinto `orden` intercambia primero y
segundo del mismo día, usando el mismo mecanismo que mover entre días.

`admin.migrate` es una acción de mantenimiento idempotente (backfill de
`activo`, corrección de nombres con erratas, `cantidad` de texto tipo
`"1/2"` a numérico, normalización de `unidad`, borrado de filas huérfanas
de `ingredientes_platos`). Se puede volver a llamar sin riesgo.

## Arquitectura del frontend

```
web/src/
  domain/    tipos + reglas puras + cálculo de compra + temporadas (sin React)
  data/      cliente HTTP, validación zod, mappers, hooks TanStack Query
  features/  planner · shopping · catalog
  shared/    ui, hooks, utils
```

TanStack Query es la única fuente de verdad para datos de servidor — sin
Zustand duplicando lo mismo. Estado de UI (semana visible, filtros) en
`useState` o en la URL. Persistencia offline vía `persistQueryClient` sobre
`idb-keyval`.

## Riesgo a validar antes de construir la API real

Apps Script + CORS es la única pieza no probada de esta arquitectura. Antes
de implementar la API completa (siguiente plan), un spike mínimo debe
confirmar desde un navegador real que:
- `GET` al Web App funciona sin fricción.
- `POST` con `Content-Type: text/plain` funciona sin preflight bloqueado.
- La latencia de arranque en frío es asumible para uso doméstico (objetivo
  informal: por debajo de 3 s).

Si el `POST` no pasa, la alternativa es tunelizar escrituras por `GET` con
parámetros, o sustituir Apps Script por Sheets API v4 + OAuth (con el coste
de login recurrente en la tablet que se quería evitar).

## Resultado del spike de conectividad

Verificado el 2026-09-06 desde un navegador real (Chrome, vía Chrome
DevTools MCP) contra el Web App desplegado por Rafa, con el código de
`apps-script/Codigo.gs`:

| Prueba | Resultado |
|---|---|
| `GET ?probe=1` (primera llamada) | `200`, `1168 ms`, JSON correcto |
| `POST` con `Content-Type: text/plain;charset=utf-8` | `200`, `953 ms`, `echoed` igual al body enviado |
| `GET ?probe=warm` (segunda llamada) | `200`, `820 ms` |
| Errores de CORS / preflight en consola | Ninguno |

**Conclusión: API Apps Script confirmada.** GET y POST funcionan sin
fricción de CORS con `Content-Type: text/plain`, y la latencia (820 ms –
1.2 s) está muy por debajo del umbral informal de 3 s, incluso en la
primera llamada tras el despliegue. No se midió un arranque en frío tras
inactividad prolongada (horas); si en uso real la primera petición del día
se siente lenta, se puede añadir una función `keepWarm` programada con un
disparador horario de Apps Script, pero no se considera necesario a priori.

Con esto queda despejado el único riesgo técnico de la arquitectura. El
siguiente plan puede construir la API completa (todas las acciones de
lectura/escritura descritas arriba) y la capa de datos del frontend sin
más validaciones previas.

## Resultado de la migración y verificación E2E de la API

Verificado el 2026-09-06 contra la hoja real de Rafa, con la API completa
de `apps-script/Codigo.gs` ya desplegada.

**Migración de datos (`admin.migrate`)** — informe final tras corregir dos
problemas encontrados durante la ejecución (ver más abajo):

| Corrección | Cantidad |
|---|---|
| `activo` rellenado en platos | 9 |
| Nombres/proveedores con erratas corregidos | 3 (`Moozzarela fresca`, `Huevoss`, `Garbanzzos`, `Arrroz basmati`) |
| Cantidades normalizadas a numérico | 1 (`"1/2"` → `0.5`) |
| Unidades `"unidad"` → `"ud"` | 5 |
| Filas huérfanas de `ingredientes_platos` eliminadas | 15 |

**Dos problemas reales encontrados y corregidos en el propio código**
(no eran errores de despliegue, sino casos que el diseño original no
contemplaba):

1. **Validación de datos en `proveedor`.** La celda de "Mira al talll"
   tiene una lista desplegable que solo admite ese valor exacto (con la
   errata). Corregir el nombre a "Mira al tall" lo viola. Se dejó sin
   corregir por código — pendiente de arreglo manual en Sheets (editar la
   validación) si se quiere, fuera del alcance de este plan.
2. **`"1/2"` interpretado como fecha.** Google Sheets convirtió el texto
   `"1/2"` a una fecha (1 de febrero) en vez de mantenerlo como texto. La
   migración ahora detecta también valores `Date` en `cantidad` y
   reconstruye la fracción a partir del día/mes (`fraccionDesdeFecha_`),
   fijando además el formato de esa celda a numérico para que no vuelva a
   pasar con ese valor.

**Verificación end-to-end de las 12 acciones**, todas `{ok:true}` con el
resultado esperado:

| Acción | Resultado |
|---|---|
| `bootstrap` | Esquema migrado visible (`etiquetas`, `activo`, cantidades numéricas) |
| `plan.set` / `plan.move` / `plan.delete` | Intercambio de dos días confirmado vía `plan` tras el `move`; ambos `delete` limpiaron las filas |
| `plato.upsert` (alta y edición) / `plato.delete` | Alta con id nuevo (10), edición reflejada, borrado lógico (`activo:false`) confirmado en `bootstrap` |
| `ingrediente.upsert` / `ingrediente.delete` | Alta con id nuevo (16), borrado confirmado |
| `regla.upsert` / `regla.delete` | Alta con id 1 (primera regla), borrado confirmado |
| `platoIngredientes.replace` | Reemplazo probado sobre el Gazpacho (id_plato 1) y restaurado a sus 4 ingredientes originales en la misma sesión de pruebas |

**Conclusión: API completa confirmada y datos migrados.** El siguiente
plan puede construir el dominio puro (temporadas, reglas, cálculo de la
compra) y la capa de datos del frontend (zod, mappers, cliente HTTP, hooks
de TanStack Query) contra este contrato sin más cambios en Apps Script.

## Dominio y capa de datos del frontend (implementado)

`web/src/domain/` (sin React, 100% puro y testeado):
- `types.ts` — `Plato`, `Ingrediente`, `IngredientePlato`, `PlanEntry`, `Regla`, `Proveedor`, `Catalogo`.
- `temporadas.ts` — `temporadaDe(fechaIso)`, `estaEnTemporada(temporadas, fechaIso)`.
- `reglas.ts` — `evaluarSemana(asignaciones, reglas)` → `EstadoRegla[]`. Cubre `MAX_SEMANA`,
  `MIN_SEMANA` y `NO_CONSECUTIVO`. Cada día puede tener hasta dos huecos (`orden` 1/2);
  `NO_CONSECUTIVO` se incumple tanto entre días calendario seguidos como entre el
  primero y el segundo del mismo día (distancia en días `<= 1`).
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
  `useSetPlanEntry()`, `useMovePlanEntry()`, `useDeletePlanEntry()`. `useSetPlanEntry`/
  `useDeletePlanEntry` son optimistas: `onMutate` parchea al instante todas las queries
  `['plan', ...]` cacheadas (semana y mes pueden estar montadas a la vez), `onError` revierte
  la instantánea guardada y `onSettled` invalida para reconciliar con el servidor.
  `useMovePlanEntry` queda sin optimismo — no lo usa ninguna UI todavía (reservado para el
  plan de arrastrar-y-soltar).

Pendiente: las mutaciones de `plato`/`ingrediente`/`regla` para la página de
catálogo, y la lista de la compra (`compra.ts` ya existe y está testeado,
falta la UI). El planificador (calendario, recetario, selector, avisos de
reglas, vista de mes, persistencia offline) ya está construido — ver la
siguiente sección.

## Resultado de la verificación del segundo hueco (orden)

Verificado el 2026-09-06 contra la API real ya desplegada, tras añadir `orden`
a la pestaña `plan` y a `plan.set`/`plan.delete`/`plan.move`:

| Prueba | Resultado |
|---|---|
| `bootstrap` tras redeploy | `ok:true`, catálogo intacto |
| `plan.set` primero y segundo el mismo día | Dos filas independientes (`orden:1` e `2`), sin pisarse |
| `plan.move` intercambiando primero↔segundo del mismo día | Confirmado vía lectura posterior: los `id_plato` quedan intercambiados |
| `plan.delete` de un solo hueco | Borra solo esa fila; el otro hueco del mismo día permanece |
| Limpieza final | `plan` queda vacío, sin residuos de la verificación |

**Conclusión: segundo hueco por comida confirmado en la API.** El siguiente
plan puede actualizar `domain/` y `data/` (tipos, `evaluarSemana`, esquemas,
mappers, hooks) para soportar `orden`, y después construir la UI del
planificador en React sobre la maqueta ya validada por Rafa.

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

## Lista de la compra (diseño)

Primer uso real de `react-router-dom` (dependencia instalada desde el scaffolding
original pero nunca usada hasta ahora) — necesario porque, a partir de esta
funcionalidad, la app deja de tener una única pantalla.

**Navegación:** `main.tsx` monta `BrowserRouter`; `App.tsx` define `<Routes>` con
`/` → `PlannerPage` y `/compra` → `ShoppingListPage`. Una barra de navegación
mínima y persistente (fuera de ambas páginas) enlaza "Planificador"/"Compra" —
separada del `Toolbar` del planificador, que sigue ocupándose solo de la
navegación por semana dentro de esa página.

**`features/shopping/`:**
- `useShoppingList(rango: 'actual' | 'siguiente')` — calcula `desde`/`hasta`
  siempre anclado a hoy (no al estado de navegación del planificador, son
  páginas independientes): `lunesDe(hoy)` + `fechasSemana` para "actual", o
  `addWeeks(lunesDe(hoy), 1)` + `fechasSemana` para "siguiente"; llama a
  `usePlan(desde,hasta)` +
  `useCatalogo()` y pasa el resultado a `calcularCompra` (`domain/compra.ts`,
  sin cambios). Devuelve `{listas: ListaCompra[], cargando, comprado(idIngrediente,
  unidad), marcarComprado(idIngrediente, unidad, valor)}`.
- Estado de "ya comprado" en `localStorage`, clave `compra:${desde}:${hasta}` →
  `{ "idIngrediente|unidad": true }`. Cada semana (actual/siguiente) tiene su
  propio checklist independiente — es estado del momento, no dato del dominio,
  no se escribe en la hoja.
- `ShoppingListPage.tsx` — orquesta el selector de rango, el hook y el layout;
  incluye el botón "Copiar" que serializa `listas` como texto plano agrupado
  por proveedor (`PROVEEDOR\n- Nombre: cantidad unidad\n...`) vía
  `navigator.clipboard.writeText`.
- `ProviderGroup.tsx` — una sección por proveedor con sus líneas y checkboxes,
  siguiendo el mismo patrón de descomposición que los componentes del
  planificador.

**Tests:** `useShoppingList.test.tsx` (MSW, cálculo del rango actual/siguiente);
test de integración de `ShoppingListPage` (navegar a `/compra`, ver proveedores,
marcar comprado, cambiar de semana, copiar). `navigator.clipboard` no existe en
jsdom por defecto — se añade un mock mínimo a `test/setup.ts`.

Pendiente (plan posterior): catálogo (CRUD de platos/ingredientes/reglas),
Recetario interactivo, navegación real de mes en la vista Mes del planificador.
