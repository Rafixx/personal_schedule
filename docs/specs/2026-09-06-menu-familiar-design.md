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

Pendiente: Recetario interactivo, navegación real de mes en la vista Mes del
planificador. El catálogo (CRUD de platos/ingredientes/reglas) y la lista de
la compra ya están construidos — ver las secciones siguientes.

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

## Lista de la compra (implementada)

Primer uso real de `react-router-dom` (dependencia instalada desde el scaffolding
original pero nunca usada hasta ahora) — necesario porque, a partir de esta
funcionalidad, la app deja de tener una única pantalla.

**Navegación:** `App.tsx` monta `BrowserRouter` con `<Routes>` para `/` →
`PlannerPage` y `/compra` → `ShoppingListPage`; también posee el estado de
semana/vista del planificador (`lunes`/`vista`) para que sobreviva a navegar a
`/compra` y volver (`PlannerPage` los recibe como props en vez de tenerlos como
estado propio, ya que al pasar a routing deja de ser un componente que nunca se
desmonta). La navegación entre herramientas vive en `shared/AppBar.tsx` — ver
la nota "Barra unificada" más abajo, añadida en un ajuste posterior a como se
construyó originalmente esta funcionalidad.

**`features/shopping/`:**
- `useShoppingList(lunesActual: Date, rango: 'actual' | 'siguiente')` — calcula
  `desde`/`hasta` a partir de la fecha de referencia recibida como parámetro
  (nunca `new Date()` dentro del hook, mismo patrón que
  `useWeekPlan`/`useMonthPlan`): `fechasSemana(lunesActual)` para "actual", o
  `fechasSemana(addWeeks(lunesActual, 1))` para "siguiente". `ShoppingListPage`
  calcula `lunesActual = lunesDe(new Date())` una sola vez al montar (vía
  `useState` perezoso) y ancla así el rango a hoy, independientemente de la
  semana que esté viendo el planificador (son páginas independientes). Llama a
  `usePlan(desde,hasta)` + `useCatalogo()` y pasa el resultado a `calcularCompra`
  (`domain/compra.ts`, sin cambios). Devuelve `{listas: ListaCompra[], cargando,
  error, comprado(idIngrediente, unidad), marcarComprado(idIngrediente, unidad,
  valor)}` — `error` refleja fallos de `useCatalogo`/`usePlan` y
  `ShoppingListPage` lo muestra como un aviso de "Sin conexión" distinto del
  estado "sin platos".
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

**Implementado:** todo lo descrito arriba, construido tal cual. `App.tsx`
monta `BrowserRouter` con rutas `/` (planificador) y `/compra` (lista de la
compra) — primer uso real de `react-router-dom` en el proyecto. Verificado
manualmente contra la API real: agregación por proveedor, persistencia de "ya
comprado" tras refrescar, checklists independientes entre "esta semana" y "la
semana que viene", y copiar al portapapeles.

**Barra unificada (ajuste posterior):** el `NavBar` inicial (una barra propia
con los enlaces "Planificador"/"Compra", separada del `Toolbar` del
planificador) se sustituyó por `shared/AppBar.tsx` — una única barra
compartida que lleva el selector de herramienta (enlaces de texto subrayados,
para distinguirlo visualmente de los controles de vista en pastilla ámbar) y
un hueco (`children`) donde cada página coloca sus propios controles:
`PlannerPage` pasa `<Toolbar>` (que dejó de renderizar su propia `<header>`,
ahora solo aporta el contenido), y `ShoppingListPage` pasa su selector de
rango + botón "Copiar", re-vestidos con el mismo lenguaje visual (pastillas
`bg-white/10`, activa en ámbar) para encajar en la barra oscura.

Pendiente (plan posterior): catálogo (CRUD de platos/ingredientes/reglas),
Recetario interactivo, navegación real de mes en la vista Mes del planificador.

## Catálogo — CRUD de platos, ingredientes y reglas (implementado)

La API de Apps Script ya soporta todo esto desde el plan original (`plato.upsert`,
`plato.delete`, `ingrediente.upsert`, `ingrediente.delete`,
`platoIngredientes.replace`, `regla.upsert`, `regla.delete` — verificado en
`apps-script/Codigo.gs`). Este plan es solo frontend: hooks de mutación +
formularios. Primer uso real de `react-hook-form` + `@hookform/resolvers` + `zod`
para validación de formularios (instalados desde el scaffolding original, nunca
usados hasta ahora).

**Navegación:** tercera ruta `/catalogo` → `CatalogPage`, con pestañas internas
"Platos"/"Ingredientes"/"Reglas" (mismo patrón que el planificador ya usa para
alternar Semana/Mes — pestaña interna, no sub-rutas). `shared/AppBar.tsx`
(ver la sección de la lista de la compra) gana un tercer enlace "Catálogo";
`CatalogPage` le pasa sus pestañas Platos/Ingredientes/Reglas como `children`,
igual que `PlannerPage` le pasa `Toolbar` y `ShoppingListPage` le pasa su
selector de rango.

**Borrado — respeta la asimetría real de la API:**
- Platos: `plato.delete` es borrado lógico (pone `activo=false`, la fila sigue
  en la hoja) → en la UI es "Desactivar"/"Reactivar", reversible, sin
  confirmación destructiva.
- Ingredientes y Reglas: `ingrediente.delete`/`regla.delete` son borrado físico
  real, sin deshacer → llevan un diálogo de confirmación explícito. Si un
  ingrediente borrado seguía referenciado por algún `ingredientesPlatos`, la
  API no lo impide, pero `calcularCompra` (`domain/compra.ts`) ya ignora en
  silencio las referencias que no resuelven — no rompe nada, solo desaparece
  de la lista de la compra. No se comprueba de antemano en qué platos se usa
  antes de borrar (mejora posible para más adelante, no bloqueante ahora).

**Sin actualización optimista aquí** (a diferencia de las mutaciones del plan
semanal): editar el catálogo es una acción deliberada vía botón "Guardar", no
un toque frecuente que necesite sentirse instantáneo — invalidar `['catalogo']`
al terminar y mostrar un estado de guardando normal es suficiente y más simple.

**`data/queries.ts`** gana 7 hooks nuevos, todos con
`onSuccess: () => queryClient.invalidateQueries({queryKey:['catalogo']})`:
- `usePlatoUpsert()` → POST `plato.upsert`
- `usePlatoDelete()` → POST `plato.delete`
- `useIngredienteUpsert()` → POST `ingrediente.upsert`
- `useIngredienteDelete()` → POST `ingrediente.delete`
- `usePlatoIngredientesReplace()` → POST `platoIngredientes.replace`
  (payload `{id_plato, ingredientes: [{id_ingrediente, cantidad, unidad}, ...]}`)
- `useReglaUpsert()` → POST `regla.upsert`
- `useReglaDelete()` → POST `regla.delete`

**`features/catalog/`:**
- `CatalogPage.tsx` — pestañas Platos/Ingredientes/Reglas.
- `PlatoList.tsx` + `PlatoForm.tsx` — el formulario de plato incluye un editor
  de ingredientes anidado (añadir/quitar líneas de `{ingrediente, cantidad,
  unidad}`). Al guardar dispara `usePlatoUpsert` y, después,
  `usePlatoIngredientesReplace` con la lista completa de líneas del editor tal
  cual esté en ese momento (siempre, sin detectar si cambió — `platoIngredientes.replace`
  ya es un reemplazo completo idempotente, así que no hace falta esa lógica).
- `IngredienteList.tsx` + `IngredienteForm.tsx` — formulario plano (nombre,
  proveedor, unidad base, temporadas, macros opcionales).
- `ReglaList.tsx` + `ReglaForm.tsx` — formulario plano (etiqueta, tipo, valor,
  activa).

**Implementado:** todo lo descrito arriba, construido tal cual. Tercera ruta
`/catalogo` en `App.tsx`; `shared/AppBar.tsx` gana el enlace "Catálogo".
Verificado manualmente (solo lectura, sin mutar datos reales) contra la API
real: las tres pestañas cargan datos reales del catálogo, y el formulario de
un plato existente (Gazpacho) precarga correctamente sus 4 ingredientes
reales en el editor anidado. La creación/edición/borrado reales (que sí
mutan la hoja) quedan pendientes de que el usuario las pruebe en su propio
dispositivo, siguiendo la lista de comprobación del plan.

## Arrastrar y soltar en el planificador (implementado)

Capa aditiva sobre el planificador táctil ya construido — el tap sigue
funcionando exactamente igual en todos los casos; el arrastre nunca es la
única vía. Primer uso real de `@dnd-kit/core` (instalado desde el scaffolding
original, nunca usado hasta ahora). Recupera la intención original de la
maqueta (el Recetario era la fuente de arrastre) que quedó pendiente al
diferir esta funcionalidad durante el plan del planificador.

**Alcance de las tres interacciones:**
1. Desde una tarjeta del Recetario a cualquier hueco (vacío u ocupado) →
   asigna ese plato al hueco, reemplazando lo que hubiera.
2. De un hueco ocupado a otro hueco distinto → mueve el plato a ese hueco
   (`plan.move`, acción ya construida y verificada en la API, sin ningún
   consumidor en la UI hasta ahora). Si el hueco de destino estaba ocupado,
   el resultado es un intercambio de los dos platos; si estaba vacío, es un
   simple traslado. `plan.move` ya resuelve ambos casos con la misma
   llamada (confirmado leyendo `planMove_` en `Codigo.gs`: si la posición de
   destino no tenía fila, la de origen se borra en vez de recibir el plato
   que había en destino), así que el frontend no necesita distinguirlos.
3. Arrastrar un plato asignado fuera de cualquier hueco válido → lo quita
   (equivalente a pulsar su botón "×").

Soltar sobre el propio hueco de origen, o fuera de cualquier zona válida
cuando el arrastre viene del Recetario, no hace nada.

**Sensores:** `TouchSensor` con `activationConstraint: {delay: 200, tolerance:
8}` (necesario para que el scroll táctil y el arrastre no compitan en la
tablet de cocina) + `MouseSensor` (no `PointerSensor`) con
`activationConstraint: {distance: 8}` (ratón/trackpad en desarrollo).
**No usar `PointerSensor` junto a `TouchSensor`**: un toque real dispara
tanto `pointerdown` como `touchstart` para el mismo gesto, así que ambos
sensores compiten por él — `PointerSensor`, sin espera, gana casi siempre
antes de que `TouchSensor` llegue a activarse, rompiendo el "mantener
pulsado" en dispositivos táctiles reales (la documentación oficial de
`dnd-kit` ya avisa de esto: Mouse+Touch es la alternativa a usar **en vez
de** Pointer, no junto a él). Los elementos arrastrables llevan además
`touch-action: manipulation` (recomendación oficial para `TouchSensor`),
para que nada bloquee de forma poco fiable el scroll nativo. Un único
`<DndContext>` envuelve el `<main>`
de `PlannerPage` que ya contiene `WeekBoard` y `Recetario` lado a lado —
necesario porque el arrastre cruza de uno a otro.

**Feedback visual:** `DragOverlay` de dnd-kit muestra una copia flotante del
plato mientras se arrastra. El hueco sobre el que se está arrastrando en ese
momento se resalta con `ring-2 ring-amber-500` (mismo acento ámbar que ya usa
el resto de la app) vía el `isOver` que devuelve `useDroppable`. No se añade
ningún aviso nuevo de reglas/temporada durante el arrastre — `RulesStrip` y
`DishTile` ya se recalculan en vivo tras soltar, así que el aviso aparece
justo después de aplicarse el cambio, igual que hoy con el selector táctil.

**`data/queries.ts`:** `useMovePlanEntry()` (ya existe) gana el mismo patrón
de actualización optimista que ya usan `useSetPlanEntry`/`useDeletePlanEntry`
(`onMutate` intercambia los `idPlato` de las dos entradas al instante,
`onError` revierte, `onSettled` invalida `['plan']`) — un intercambio
arrastrado tiene que sentirse tan instantáneo como un tap.

**`features/planner/useWeekPlan.ts`:** gana `moverPlato(origen: {fecha,
orden}, destino: {fecha, orden})`, que llama a `useMovePlanEntry`.

**Componentes:**
- `Recetario.tsx` y `Slot.tsx` envuelven cada `DishChip`/`DishTile` en un
  elemento arrastrable vía `useDraggable`, pasando como `data` el propio
  `OrigenArrastre` de `dragDrop.ts` (`{tipo: 'recetario', plato}` o
  `{tipo: 'asignado', fecha, orden, plato}`, con el `Plato` completo, no
  solo su id) — así `onDragEnd` no necesita buscar el plato por id.
  `DishChip.tsx` y `DishTile.tsx` en sí no cambian: siguen siendo
  puramente presentacionales, precisamente para poder reutilizar
  `DishChip` sin envolver dentro de `DragOverlay` sin arriesgar un id de
  arrastre duplicado (si `DishChip` llamara a `useDraggable` sobre sí
  mismo, la copia flotante del `DragOverlay` registraría el mismo id que
  la tarjeta de origen mientras ambas están montadas a la vez).
- `Slot.tsx` se convierte además en zona de destino vía `useDroppable`
  (vacío y ocupado), con datos de destino el propio `DestinoArrastre`
  (`{fecha, orden}`).
- `PlannerPage.tsx` monta el `DndContext` y traduce `onDragEnd` a las tres
  interacciones descritas arriba, llamando a `asignarPlato`/`moverPlato`/
  `quitarPlato` de `useWeekPlan` según corresponda.

**Tests:** la lógica de decisión de `onDragEnd` (qué interacción aplica según
el tipo de arrastre y destino) se extrae a una función pura testeable por
separado de la integración visual con `dnd-kit` (que no se simula con
mocks). Un test de integración mínimo confirma que `DndContext` envuelve
correctamente `WeekBoard` y `Recetario` dentro de `PlannerPage`.

**Estado:** implementado. Lógica de decisión en `features/planner/dragDrop.ts`
(`resolverArrastre`, testeada); `useMovePlanEntry` optimista y `moverPlato` en
`useWeekPlan`; `Recetario`/`Slot` como arrastrable/destino vía `@dnd-kit/core`;
`DndContext`/`DragOverlay`/sensores en `PlannerPage`.

**Corrección (2026-09-10):** verificado en tablet real que el arrastre no
funcionaba en táctil (sí con ratón). Causa raíz: `PointerSensor` y
`TouchSensor` registrados a la vez competían por el mismo gesto táctil —
ver el detalle en "Sensores" más arriba. Corregido sustituyendo
`PointerSensor` por `MouseSensor` y añadiendo `touch-action: manipulation`
a los elementos arrastrables. Pendiente de que el usuario reverifique en
la tablet real.

## Pendiente (ideas anotadas para después)

- **Autocompletado de etiquetas en `PlatoForm` con pills como sugerencia,
  no como única opción.** Surgió al plantear si el campo "Etiquetas" de
  `PlatoForm.tsx` (hoy texto libre) debería restringirse a pills de las
  etiquetas que ya tienen una regla en Reglas. Restringirlo así perdería
  funcionalidad real: hoy se puede etiquetar un plato para organizarlo o
  colorearlo (vía `colorVarDePlato`) sin que exista todavía una regla
  sobre esa etiqueta, y si más adelante se borra una regla (borrado
  físico, ya implementado así) los platos que ya tenían esa etiqueta la
  conservarían pero dejaría de poder asignarse a platos nuevos —una
  etiqueta huérfana confusa. La mejora real es añadir autocompletado con
  pills sugeridas (etiquetas ya usadas por otros platos + las de las
  reglas existentes) sin dejar de permitir texto libre, para reducir
  errores de typo/inconsistencia (`"verdura"` vs `"verduras"`) que
  `normalizarEtiqueta` no cubre (solo normaliza mayúsculas/acentos, no
  sinónimos), sin perder la libertad de crear categorías nuevas antes de
  que exista una regla sobre ellas.
