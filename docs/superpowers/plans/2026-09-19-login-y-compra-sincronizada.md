# Login por usuarios y lista de la compra sincronizada — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

## Context

Dos necesidades que aparecieron a la vez y comparten solución:

1. **La lista de la compra no se comparte.** El estado "ya comprado" vive hoy en `localStorage` (`web/src/features/shopping/useShoppingList.ts:10-47`), con clave `compra:${desde}:${hasta}`. Es estado por dispositivo: si Lourdes marca "tomates" desde su móvil, Rafa no lo ve. Comprar en pareja con dos móviles es justo el caso que falla. La spec lo decidió así deliberadamente (`docs/specs/2026-09-06-menu-familiar-design.md:320-323`: *"es estado del momento, no dato del dominio, no se escribe en la hoja"*) — esa decisión se revierte aquí.

2. **No hay control de acceso, y el que parece haber es falso.** `VITE_API_TOKEN` se inlina literalmente en el bundle que Netlify sirve público (verificado: el token aparece en claro en `web/dist/assets/index-*.js`), así que cualquiera que abra el código de la página tiene permiso de escritura completo. Y `doGet` (`apps-script/Codigo.gs:124-136`) no valida nada: `bootstrap` y `plan` son públicos para quien conozca la URL. La spec asumía un único dispositivo fijo en la cocina (`docs/specs/...:23`: *"Sin OAuth ni login en la tablet"*); con la app en varios móviles eso ya no se sostiene.

**Resultado buscado:** cada miembro de la familia (Rafa, Lourdes, Paula, Laia) entra con su nombre y un PIN; el token de sesión que recibe sustituye al token compartido del bundle, y tanto lectura como escritura pasan a exigir sesión. Sobre esa identidad, el estado "comprado" se mueve a la hoja y se comparte entre dispositivos, con las marcas hechas sin cobertura encoladas hasta recuperar conexión.

**Decisiones ya tomadas con el usuario:**
- Login = nombre (elegido de una lista) + PIN numérico de **6 dígitos**.
- Control de acceso = **solo puerta de entrada**: todo usuario validado ve y edita lo mismo. Sin roles, sin datos por usuario.
- El token de sesión **no caduca** (requisito explícito), pero es revocable.
- El token de sesión **sustituye** a `VITE_API_TOKEN`, que desaparece del bundle; `doGet` pasa a exigir sesión.
- Alta de usuarios y PINs con una función admin ejecutada a mano desde el editor de Apps Script; en la hoja solo queda el hash.
- La pantalla de login pide la lista de nombres sin autenticar (solo nombres de pila).
- El estado "comprado" es **compartido**, no por usuario.
- Las marcas hechas **sin cobertura se encolan** y se reenvían al recuperar conexión.

**Goal:** tres hojas nuevas (`usuarios`, `sesiones`, `compra_marcas`), autenticación real en toda la API de Apps Script, pantalla de login por PIN delante de la app, y checklist de la compra sincronizado entre dispositivos con escritura optimista y resistente a cortes de red.

**Architecture:** el backend (`apps-script/Codigo.gs`, ES5, fichero único) gana un bloque de auth que resuelve el token a un usuario **antes** de `ensureSchema_` y de `routeAction_`, con dos acciones exentas (`auth.usuarios` por GET, `auth.login` por POST). En el frontend, la sesión vive en un módulo sin React (`web/src/data/session.ts`) al que `sheetsClient` pregunta el token en cada petición — hoy lo recibe fijo en el constructor (`sheetsClient.ts:8`), pasa a recibir un `getToken()`. Un `AuthGate` envuelve las rutas en `App.tsx`. La compra sigue el patrón optimista ya maduro del planificador (`queries.ts:90-145`) y reutiliza el contrato de props de `ProviderGroup.tsx`, que no cambia.

**Tech Stack:** sin dependencias nuevas. React 19.2, TS ~6.0, Vite ^8.2, TanStack Query ^5.102 con persistencia en IndexedDB vía `idb-keyval` (ya montada en `main.tsx:19-31`, y es la pieza sobre la que se apoya el encolado offline), react-router-dom ^7.18, zod ^4.5, Vitest ^5 + MSW ^2.15, Tailwind v4, oxlint. Backend: Apps Script V8, `Utilities.computeHmacSignature`, `Utilities.getUuid`, `PropertiesService`, `CacheService`, `LockService`. Gestor: **npm**.

**Spec:** `docs/specs/2026-09-06-menu-familiar-design.md` — este plan **contradice** dos decisiones vigentes (L23 "sin login", L320-323 "comprado no se escribe en la hoja"). La última tarea las reescribe como decisiones revertidas, no como implementación de algo previsto.

## Global Constraints

- TypeScript estricto: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `verbatimModuleSyntax` → `import type` obligatorio para tipos.
- `domain/` es puro: sin imports de React ni de `data/`.
- Ningún componente de `features/` llama a `sheetsClient` directamente — todo pasa por hooks de `data/queries.ts`.
- Las fechas entran como parámetro; nunca `new Date()` dentro de un hook.
- `Codigo.gs` es ES5 (`var`, `function`, sin arrow functions, sin template literals) para mantener la coherencia del fichero.
- Los payloads POST usan snake_case igual que las columnas; la traducción camelCase→snake_case se hace en `queries.ts`.
- MSW corre con `onUnhandledRequest: 'error'`: **cada acción nueva de la API rompe los tests que mockean la API hasta que se añade su handler**.
- No commitear secretos: PINs, pepper y tokens quedan fuera de git y fuera del código del editor.
- Los 37 ficheros de test actuales deben seguir pasando al terminar.

### Restricciones del runtime de Apps Script que condicionan el diseño

Verificadas antes de diseñar; descartan varias soluciones estándar:

- **`ContentService` no puede fijar el código HTTP**: todo sale 200. No hay 401 posible → el motivo del rechazo viaja en un campo `code` dentro del sobre JSON.
- **No hay acceso a cabeceras ni a la IP del cliente** en `doGet`/`doPost`. El rate limiting solo puede ser **por usuario**, nunca por IP, y el token no puede ir en `Authorization` (además, una cabecera personalizada dispararía un preflight OPTIONS que Apps Script no responde).
- **No hay `crypto.subtle`, PBKDF2, bcrypt ni scrypt.** Solo `Utilities.computeDigest` y `Utilities.computeHmacSignature`. El KDF hay que construirlo iterando HMAC a mano.
- **Los `Byte[]` de Apps Script son bytes con signo** (-128..127): sin normalizar con `(b + 256) % 256` el hex sale corrupto. Es el fallo clásico de este entorno.
- **`CacheService`**: TTL máximo 6 h y desalojable en cualquier momento sin aviso. Sirve como camino rápido, nunca como fuente de verdad.
- El estado de módulo (`var` global) vive solo durante una ejecución: suficiente para memoizar el pepper y evitar mil lecturas de `PropertiesService` por login.

---

### Task 1: Backend — primitivas de auth, hojas de usuarios y sesiones

**Files:**
- Modify: `apps-script/Codigo.gs`

**Esquema nuevo** (añadir a `SHEET_NAMES` y `SCHEMA`, `Codigo.gs:8-27`; `ensureSchema_` crea las hojas solas):

| Hoja | Columnas |
|---|---|
| `usuarios` | `id_usuario, nombre, pin_hash, pin_salt, pin_iteraciones, activo, intentos_fallidos, bloqueado_hasta, ultimo_login` |
| `sesiones` | `id_sesion, id_usuario, token_hash, dispositivo, creado_en, ultimo_uso, activa, revocado_en` |

En la hoja **nunca** se guarda el token en claro, solo su hash: si alguien lee `sesiones` no obtiene sesiones vivas. `bloqueado_hasta` es epoch en ms (0 = no bloqueado), para no pelear con la coerción a `Date` al leer.

- [x] **Step 1: Hojas y formato de columnas.** Añadir las entradas a `SHEET_NAMES`/`SCHEMA`. Extender el forzado de formato texto `'@'` que ya existe para `plan.fecha` (`Codigo.gs:48-51`) a `usuarios.pin_hash`, `usuarios.pin_salt` y `sesiones.token_hash`: un hash que por azar salga todo dígitos lo convertiría Sheets en número y perdería los ceros a la izquierda. Extraer un helper `formatearColumnaTexto_(hoja, columna)` en vez de repetir el bloque.

- [x] **Step 2: Primitivas criptográficas.** `bytesAHex_` con la normalización de bytes con signo; `hmacHex_` sobre `Utilities.MacAlgorithm.HMAC_SHA_256` usando el pepper como clave; `getPepper_()` leyendo `AUTH_PEPPER` de Script Properties **memoizado en una variable de módulo** (sin memoizar, la derivación haría una llamada RPC a `PropertiesService` por iteración); `derivarPin_(pin, salt, iteraciones)` iterando HMAC; `hashToken_(token)` de una sola pasada (el token tiene ~244 bits, no hay nada que fuerza-brutear); `nuevoSecreto_()` = dos `Utilities.getUuid()` sin guiones; `comparaSegura_`; `esVerdadero_` (Sheets devuelve `true`, `'TRUE'` o `''` según cómo se escribiera); `ahoraIso_`.

- [x] **Step 3: Calibrar las iteraciones.** Función `benchPin()` que mide 100/500/1000/2000/5000 iteraciones con `Logger.log`. Ejecutarla desde el editor y fijar `AUTH.ITERACIONES_PIN` en el mayor valor que deje la derivación por debajo de ~400 ms (el punto de partida es 1000). Guardar el número en la columna `pin_iteraciones` para poder subirlo después sin invalidar los PIN existentes. Ver *Notas de seguridad* para qué aporta y qué no.

- [x] **Step 4: Bloqueo por intentos fallidos.** Fuente de verdad en la hoja (`intentos_fallidos`, `bloqueado_hasta`); camino rápido en `CacheService` con clave `bloq:<id_usuario>`, que permite rechazar un bloqueo vigente **sin abrir el spreadsheet** — eso es lo que evita que un bombardeo te queme la cuota diaria de ejecución y tire la app para la familia. A partir de 5 fallos, bloqueo de 15 min con backoff exponencial y **tope de 1 hora**: con 10⁶ candidatos, un tope de 1 h es tan disuasorio como uno de 24 h y reduce mucho el daño si alguien usa el bloqueo como arma contra la familia. Éxito → contador a 0 y entrada de caché borrada.

- [x] **Step 5: Sesiones.** `crearSesion_(usuario, token, dispositivo)` inserta la fila con `token_hash` y cachea `ses:<token_hash>` (TTL 5 min). `autenticar_(token)` resuelve token → `{id_sesion, id_usuario, nombre}` consultando primero la caché y cayendo a la hoja solo si falla; comprueba `activa` y que el usuario siga `activo`. `tocarSesion_` actualiza `ultimo_uso` como mucho una vez cada 6 h por sesión (con clave de caché de guarda), porque escribirlo en cada petición sería una escritura por request y contención del lock.

- [x] **Step 6: `auth.login`.** Payload `{ id_usuario, pin, dispositivo }` — identifica por id, no por nombre. Valida `/^[0-9]{6}$/`, comprueba bloqueo, deriva el PIN con el salt e iteraciones de la fila, y compara. Mismo mensaje genérico (`INVALID_CREDENTIALS`) para usuario inexistente y PIN erróneo. Al acertar: `registrarExito_`, genera token, crea sesión y devuelve `{ token, usuario: { id_usuario, nombre }, id_sesion }`. El token se devuelve **una sola vez**.

- [x] **Step 7: `auth.usuarios` (GET, público) y `auth.logout`.** `auth.usuarios` devuelve solo `{id_usuario, nombre}` de los activos, cacheado 5 min para que un bombardeo anónimo no abra el spreadsheet. `auth.logout` marca `activa = false`, pone `revocado_en` y **borra la clave de caché** `ses:<token_hash>` — como la clave se deriva del hash que está en la hoja, la revocación es inmediata en vez de esperar al TTL.

- [x] **Step 8: Funciones admin (ejecutar a mano desde el editor).** `adminInicializarAuth()` crea el pepper si no existe (y avisa de que regenerarlo invalida todos los PIN y sesiones). `adminSetPin()` lee `ADMIN_NOMBRE` y `ADMIN_PIN` de Propiedades del script, crea o actualiza el usuario, y **borra ambas propiedades en un `finally`** para que el PIN no quede dando vueltas; al cambiar un PIN revoca las sesiones de ese usuario. `adminDesbloquearUsuario()`, `adminDesactivarUsuario()` y `adminPurgarSesiones()` (la hoja `sesiones` solo crece) completan el juego. Ninguna acepta argumentos: el editor de Apps Script ejecuta funciones sin parámetros.

- [x] **Step 9: Commit.** `git add apps-script/Codigo.gs && git commit -m "feat: usuarios, sesiones y login por PIN en Apps Script"`

---

### Task 2: Backend — exigir sesión en toda la API y añadir las marcas de compra

**Files:**
- Modify: `apps-script/Codigo.gs`

**Esquema nuevo:** hoja `compra_marcas` con `id, semana, id_ingrediente, unidad`. **La presencia de la fila significa "comprado"**: marcar añade fila, desmarcar la borra. Evita acumular filas `FALSE` y refleja el par `plan.set`/`plan.delete` ya existente. `semana` es el lunes en ISO y necesita el mismo formato texto `'@'` que `plan.fecha`.

- [x] **Step 1: Sobre de error con `code`.** Helper `errorOutput_(code, mensaje)` sobre el `jsonOutput_` actual. Códigos: `BAD_REQUEST`, `UNAUTHENTICATED`, `INVALID_CREDENTIALS`, `LOCKED_OUT`, `UNKNOWN_ACTION`, `BUSY`, `INTERNAL`. El HTTP sigue siendo 200 siempre porque `ContentService` no permite otra cosa; `code` es lo que deja al frontend distinguir "vuelve a entrar" de un error reintentable.

- [x] **Step 2: Cerrar `doGet`.** `auth.usuarios` queda exenta; el resto resuelve `params.token` con `autenticar_` y devuelve `UNAUTHENTICATED` si falla. **Mover `ensureSchema_()` detrás de la autenticación**: hoy se ejecuta antes de validar nada, o sea que un anónimo te hace escribir cabeceras y formatos en la hoja. No hace falta para autenticar, porque `getSheet_` crea la hoja que falte y `sheetToObjects_` devuelve `[]`.

- [x] **Step 3: Cerrar `doPost`.** `auth.login` se atiende antes de exigir sesión (bajo su propio lock corto, devolviendo `BUSY` si no lo consigue); el resto resuelve `body.token` y rechaza con `UNAUTHENTICATED`. Eliminar la comprobación del token compartido (`Codigo.gs:167-169`) y la función `getToken_`. `routeAction_` pasa a recibir un tercer argumento `sesion`: los 11 handlers actuales son funciones de un argumento, así que **ninguno necesita cambios** — un argumento extra es inocuo en ES5.

- [x] **Step 4: Acción GET `compra`.** Filtra `compra_marcas` por `semana`, calcado de `getPlan_` (`Codigo.gs:149-156`) y normalizando con `normalizeFecha_`.

- [x] **Step 5: Acción POST `compra.marcar`.** Payload `{ semana, id_ingrediente, unidad, comprado }`: si `comprado` y no existe la fila, `appendRow_` con `nextId_`; si no `comprado` y existe, `deleteRow_`. **Idempotente en ambos sentidos**, que es justo lo que necesita el reintento y el encolado offline de la Task 6.

- [x] **Step 6 (opcional, recomendado): cachear `ensureSchema_`.** Corre en cada petición y ahora recorre 8 hojas leyendo cabeceras y fijando formatos. Guardarlo con una clave de caché de 1 h (`ensureSchemaForzado_` sigue disponible para las funciones admin). Contrapartida: una cabecera editada a mano tarda hasta 1 h en repararse.

- [x] **Step 7: Commit.** `git add apps-script/Codigo.gs && git commit -m "feat: la API exige sesión y guarda las marcas de la compra"`

---

### Task 3: Frontend — sesión en local y cliente con token dinámico

**Files:**
- Create: `web/src/data/session.ts` + test
- Modify: `web/src/data/sheetsClient.ts`, `web/src/data/client.ts`, `web/src/main.tsx`, `web/vite.config.ts`, `web/.env.example`
- Test: `web/src/data/sheetsClient.test.ts`, `web/src/data/queries.test.tsx` (ajustar)

**Interfaces:**
- Produces: `interface Sesion { token: string; idUsuario: number; nombre: string }`, `leerSesion()`, `guardarSesion()`, `borrarSesion()`, `suscribirSesion(cb)`
- Produces: `class SesionInvalidaError extends ApiError` (se lanza cuando `code === 'UNAUTHENTICATED'`)
- Changes: `createSheetsClient({ baseUrl, getToken: () => string | null })` — antes `token: string`

- [x] **Step 1 (TDD): tests de `session.ts`.** Guardar/leer/borrar en `localStorage` (clave `sesion`), tolerancia a JSON corrupto y a un `localStorage` que lanza (modo privado), y notificación a los suscriptores al escribir. `Run: cd web && npx vitest run src/data/session.test.ts` · `Expected: FAIL — el módulo no existe`.

- [x] **Step 2: Implementar `session.ts`.** Accesos envueltos en `try/catch` como ya se hace en `useShoppingList.ts:14-21`. **Detalle crítico:** mantener el objeto parseado en una variable de módulo y devolver *siempre la misma referencia* hasta que haya una escritura. `useSesion()` usará `useSyncExternalStore`, y si `leerSesion()` devolviera un objeto nuevo en cada llamada el render entraría en bucle infinito.

- [x] **Step 3 (TDD): cliente con `getToken` y `code`.** Tests: `apiGet` añade `?token=` cuando hay sesión y lo omite si no; `apiPost` mete el token en el body; un `{ ok: false, code: 'UNAUTHENTICATED' }` lanza `SesionInvalidaError` y no `ApiError` genérico. Propagar `json.code` al error en ambos métodos.

- [x] **Step 4: Retirar `VITE_API_TOKEN` del frontend.** `client.ts` pasa a `createSheetsClient({ baseUrl, getToken: () => leerSesion()?.token ?? null })` y solo exige `VITE_API_URL`. Quitar la variable de `.env.example` y del bloque `test.env` de `vite.config.ts:13-16`, y actualizar los tests que asertan `token: 'test-token'` en el body (`queries.test.tsx:114-122`).

- [x] **Step 5: Cierre de sesión global ante token inválido.** En `main.tsx`, dar al `QueryClient` un `QueryCache` y un `MutationCache` con `onError` que, ante `SesionInvalidaError`, llame a `borrarSesion()` y `queryClient.clear()`. Así un token revocado desde la hoja devuelve al login en la siguiente petición, sin comprobaciones repartidas por la app.

- [x] **Step 6: Commit.** `git add web/src/data web/src/main.tsx web/vite.config.ts web/.env.example && git commit -m "feat: la sesión del usuario provee el token de la API"`

---

### Task 4: Frontend — pantalla de login y puerta de acceso

**Files:**
- Create: `web/src/features/auth/LoginPage.tsx`, `AuthGate.tsx`, `useSesion.ts` + tests
- Modify: `web/src/App.tsx`, `web/src/shared/AppBar.tsx`, `web/src/data/queries.ts`, `web/src/App.test.tsx`, `web/src/test/` (helper)

**Interfaces:**
- Produces: `useUsuarios()` (query `['usuarios']`), `useLogin()` (mutación que guarda la sesión al acertar), `useLogout()`, `useSesion(): Sesion | null`

- [x] **Step 1 (TDD): hooks de auth en `queries.ts`.** Con MSW: `useUsuarios` mapea `auth.usuarios`; `useLogin` manda `{ id_usuario, pin, dispositivo }` y al responder `ok` deja la sesión en `localStorage`; un `LOCKED_OUT` se propaga con su `code` para que la pantalla lo distinga. Patrón no optimista del catálogo (`queries.ts:214-230`).

- [x] **Step 2 (TDD): `LoginPage`.** Nombres como botones grandes (vienen del servidor, no hardcodeados); al elegir uno, campo de PIN de 6 dígitos (`type="password"`, `inputMode="numeric"`, `maxLength={6}`, autofocus) y botón Entrar. Tests: pinta los nombres, envía id+PIN, muestra "Usuario o PIN incorrectos" al fallar, deshabilita el formulario mientras `isPending`, y muestra el mensaje de bloqueo con los minutos restantes ante `LOCKED_OUT`.

- [x] **Step 3 (TDD): `AuthGate`.** `useSesion()` con `useSyncExternalStore` sobre `suscribirSesion`/`leerSesion`; sin sesión renderiza `LoginPage`, con sesión renderiza `children`. Test: sin sesión no aparece la navegación principal; con sesión sembrada en `localStorage` sí.

- [x] **Step 4: Montar la puerta.** En `App.tsx`, envolver `<Routes>` con `<AuthGate>` dentro de `<BrowserRouter>`. En `shared/AppBar.tsx`, añadir el nombre del usuario y un botón "Salir" que llame a `auth.logout` y después a `borrarSesion()` + `queryClient.clear()`.

- [x] **Step 5: Arreglar los tests que ahora topan con el login.** Solo afecta a `web/src/App.test.tsx` (verificado: es el único fichero que renderiza `App`; los tests de página montan la página directamente y no pasan por el gate). Añadir un helper `sembrarSesion()` en `web/src/test/` y llamarlo en su `beforeEach`, junto al `pushState` que ya hay. `Run: cd web && npm test` · `Expected: PASS`.

- [x] **Step 6: Commit.** `git add web/src && git commit -m "feat: pantalla de login por PIN delante de la app"`

---

### Task 5: Frontend — lista de la compra sincronizada

**Files:**
- Modify: `web/src/data/queries.ts`, `web/src/data/schemas.ts`, `web/src/features/shopping/useShoppingList.ts`, `ShoppingListPage.tsx`, `web/src/features/planner/Toolbar.tsx`
- Create: `web/src/shared/SyncPill.tsx` + test
- Test: `useShoppingList.test.tsx`, `ShoppingListPage.test.tsx`

**Interfaces:**
- Produces: `useMarcasCompra(semana: string)` → query `['compra', semana]`; `useMarcarCompra()` → mutación optimista
- Unchanged: la API pública de `useShoppingList` (`{ listas, cargando, error, comprado, marcarComprado }`), así que **`ProviderGroup.tsx` no se toca** — su contrato de props ya es el adecuado.

- [x] **Step 1 (TDD): query y mutación de marcas.** `marcaCompraRowSchema` (`id, semana, id_ingrediente, unidad`) y su envelope, con los coercionadores flexibles y `parseRows` de `schemas.ts`. Mutación optimista calcada de `useDeletePlanEntry` (`queries.ts:186-203`): `onMutate` toma instantánea de `['compra', semana]` y aplica el cambio, `onError` revierte, `onSettled` invalida. `retry: 2` — `compra.marcar` es idempotente por diseño.

- [x] **Step 2 (TDD): `useShoppingList` sin localStorage.** La clave de marca sigue siendo `${idIngrediente}|${unidad}`, pero sale de la query. Desaparecen `leerComprado`, `claveComprado` y el truco de re-render `const [, setVersion] = useState(0)` (`useShoppingList.ts:31,47`): ahora re-renderiza `setQueryData`. El hook deriva además `semana` (el lunes ISO). Reescribir los dos tests acoplados a `localStorage` (`useShoppingList.test.tsx:69-79` y el de checklists independientes, :81-94) para asertar contra la petición MSW.

- [x] **Step 3: Extender los mocks.** `ShoppingListPage.test.tsx:24-60` y los demás `mockApi` deben responder a `action=compra`; con `onUnhandledRequest: 'error'` cualquier olvido rompe el test. Añadir el test de marcar comprado que hoy falta en `ShoppingListPage.test.tsx`.

- [x] **Step 4: Indicador de sincronización en la compra.** Extraer la píldora de `features/planner/Toolbar.tsx:24-25,71-82` a `shared/SyncPill.tsx` (props `guardando`, `error`, `onRefrescar`) y usarla en el Toolbar del planificador y en `ShoppingListPage`, que hoy no tiene ninguno. Sin esto, marcar en el súper no da ninguna señal de si se guardó.

- [x] **Step 5: Commit.** `git add web/src && git commit -m "feat: el estado de comprado se sincroniza con la hoja entre dispositivos"`

---

### Task 6: Frontend — encolar las marcas hechas sin cobertura

Sin esto, marcar en un súper con mala cobertura revierte la marca al fallar la escritura. TanStack Query ya trae las piezas y la app ya persiste su caché en IndexedDB (`main.tsx:19-31`), así que es cuestión de conectarlas.

**Files:**
- Modify: `web/src/main.tsx`, `web/src/data/queries.ts`
- Create: `web/src/data/mutationDefaults.ts` + test

- [x] **Step 1: Registrar la mutación por clave.** Las mutaciones rehidratadas desde IndexedDB no llevan su `mutationFn` dentro, así que hay que declararla con `queryClient.setMutationDefaults(['compra','marcar'], { mutationFn, retry, onMutate, onError, onSettled })` y dejar `useMarcarCompra()` como un `useMutation({ mutationKey: ['compra','marcar'] })` que hereda los defaults. Mover ahí la lógica optimista de la Task 5.

- [x] **Step 2: Reanudar al volver la conexión.** Pasar `onSuccess={() => queryClient.resumePausedMutations()}` al `PersistQueryClientProvider` de `main.tsx`: al rehidratar, reenvía lo que quedó pendiente. Con el `networkMode` por defecto, una mutación sin red se **pausa** después de ejecutar `onMutate`, así que la marca optimista se ve al instante y no se revierte.

- [x] **Step 3 (TDD): test del ciclo offline.** Con `onlineManager.setOnline(false)` de TanStack: marcar → la marca se ve y **no** llega ninguna petición a MSW → `onlineManager.setOnline(true)` → el POST llega con el payload correcto. Restaurar el estado online en un `afterEach` para no contaminar el resto de la suite.

- [x] **Step 4: Verificar la persistencia entre recargas.** Comprobar que la mutación pausada se deshidrata (por defecto se persisten las pausadas) y que `resumePausedMutations` la recupera tras recargar la página. Si el `dehydrateOptions` por defecto no la incluyera, fijar `shouldDehydrateMutation` explícitamente.

- [x] **Step 5: Commit.** `git add web/src && git commit -m "feat: las marcas de la compra sin cobertura se encolan y se reenvían"`

---

### Task 7: Despliegue, verificación manual y cierre

El despliegue es el punto delicado: `Codigo.gs` es un fichero único y publicar la versión nueva invalida al instante el token compartido que usa la app publicada. Durante el desarrollo, apuntar `web/.env.local` a la **implementación de prueba** (`/dev`, que ejecuta el código guardado sin publicar versión) para no tocar la app que la familia usa a diario; el corte real se hace de una vez en el Step 5 y dura lo que tarden los dos despliegues.

- [x] **Step 1: Preparar el backend.** Pegar `Codigo.gs` y `appsscript.json` en el editor. Ejecutar `adminInicializarAuth()` (crea el pepper y las hojas). Ejecutar `benchPin()` y fijar las iteraciones. Ejecutar `adminSetPin()` una vez por persona (Rafa, Lourdes, Paula, Laia) vía Propiedades del script. Borrar la propiedad `API_TOKEN`, que ya no se usa.

- [x] **Step 2: Comprobar el esquema.** En la hoja: `usuarios`, `sesiones` y `compra_marcas` creadas con sus cabeceras; cuatro filas en `usuarios` con hash y salt (**nunca el PIN**), y `ADMIN_PIN`/`ADMIN_NOMBRE` ya borradas de Propiedades del script.

- [x] **Step 3: Suite completa.** `cd web && npm run lint && npm test && npm run build` · `Expected: los tres comandos terminan sin error`.

- [x] **Step 4: Verificación manual con `npm run dev`** contra la implementación de prueba:
  1. Sin sesión, sale el login con los cuatro nombres y ninguna ruta (`/`, `/compra`, `/catalogo`) deja ver datos.
  2. PIN incorrecto → mensaje genérico; cinco fallos → mensaje de bloqueo con el tiempo restante; `adminDesbloquearUsuario()` lo levanta.
  3. PIN correcto → entra, y al recargar sigue dentro.
  4. Planificador, catálogo y compra funcionan con el token de sesión.
  5. Marcar un ingrediente: aparece al instante y la fila llega a `compra_marcas`; desmarcar la borra.
  6. Segundo dispositivo con otro usuario: la marca del primero se ve tras refrescar.
  7. **Modo avión:** marcar dos ingredientes → se ven marcados y la píldora avisa; recargar la página con el avión puesto → siguen marcados; quitar el modo avión → las filas aparecen en la hoja sin volver a tocar nada.
  8. "Salir" vuelve al login y deja la sesión `activa = false` en la hoja.
  9. Revocar con `auth.logout` / función admin corta el acceso de inmediato; borrar la fila **a mano** en el Sheet tarda hasta 5 min en surtir efecto (la caché de sesiones sigue viva) — comprobarlo para no llevarse una sorpresa el día que haga falta.

- [x] **Step 5: Publicar (corte directo).** Crear **nueva versión** del despliegue de Apps Script (guardar no actualiza la URL publicada) y, seguido, eliminar `VITE_API_TOKEN` en Netlify y desplegar el frontend. Entre ambos despliegues la app da error a quien la tenga abierta: hacerlo de una sentada y avisar a la familia de que recarguen y entren con su PIN una vez. No se monta ningún puente de compatibilidad — decisión tomada: el corte dura un par de minutos y evita mantener código de migración que luego hay que desmontar.

- [x] **Step 6: Borrar el token quemado.** Eliminar `apps-script/API_TOKEN.txt` y el valor de `web/.env.local`. Ese token ha viajado en bundles publicados: darlo por comprometido, no reutilizarlo para nada.

- [x] **Step 7: Documentación.** En `docs/specs/2026-09-06-menu-familiar-design.md`, reescribir las decisiones de L23 ("sin login") y L320-323 ("comprado no se escribe en la hoja") como revertidas, con el porqué. Reescribir `apps-script/README.md`, cuyo encabezado sigue diciendo "spike de conectividad" y "este script no toca la hoja todavía", añadiendo administración de usuarios, pepper, revocación y el orden de despliegue. Guardar este plan como `docs/superpowers/plans/2026-09-19-login-y-compra-sincronizada.md`.

- [x] **Step 8: Commit y push.** `git add -A && git commit -m "docs: login por usuarios y compra compartida" && git push origin main`

---

## Notas de seguridad — qué protege esto y qué no

Conviene tenerlo explícito, porque el objetivo era seguridad real y no una puerta de cartón:

- **Lo que se arregla:** desaparece el token maestro de escritura del bundle público y la lectura deja de estar abierta a cualquiera con la URL. Para entrar hace falta un PIN válido, y cada dispositivo tiene un token revocable.
- **Contra fuerza bruta online, lo que protege es el bloqueo, no el hash.** Con 10⁶ combinaciones, el hash es irrelevante en este escenario; el bloqueo con backoff deja el ataque en decenas de intentos al día.
- **Contra una hoja filtrada, lo que protege es el pepper**, que vive en Script Properties y no en el documento. El número de iteraciones apenas mueve la aguja: 10⁶ candidatos × 1000 iteraciones son segundos de GPU. Por eso la recomendación es 1000 iteraciones y no perseguir cifras mayores.
- **Quien tenga acceso de *edición* al Sheet lo tiene todo:** el script está vinculado al documento, así que puede leer el pepper y añadir un `Logger.log` del PIN en el login. No hay separación entre usuario de la app y administrador del backend. Revisar con quién está compartida la hoja es, literalmente, el perímetro de seguridad.
- **El token no caduca, por requisito.** Un móvil perdido y desbloqueado mantiene el acceso hasta que se revoque. No se puede usar una cookie `HttpOnly` porque la API vive en otro origen, así que el token es por fuerza legible por JavaScript.
- **DoS y cuota:** el endpoint sigue siendo anónimo y no hay forma de filtrar por IP, ni CAPTCHA. Alguien con la URL puede consumir la cuota diaria de ejecución. Es un límite de la plataforma, no del diseño; los caminos rápidos con caché abaratan cada petición pero no lo evitan.
- **Sigue sin haber confidencialidad entre usuarios**, que es justo lo pedido: todos ven y editan lo mismo.

## Riesgo residual conocido: el token viaja en la query string de los GET

`doGet` no puede leer cabeceras, así que el token va como parámetro de query en `bootstrap`, `plan` y `compra`. No aparece en el historial (son XHR) ni en `Referer` cross-origin, pero sí en los registros del lado de Google. Eliminarlo del todo es posible y son ~10 líneas: registrar `bootstrap`/`plan`/`compra` en `routeAction_` y convertir `apiGet` en un POST. **Se deja fuera de este plan a propósito**, porque obligaría a reescribir los handlers `http.get` de los ocho ficheros de test que mockean la API, y el riesgo real es bajo para una app familiar. Queda anotado como siguiente paso natural, y es el momento de hacerlo si algún día hay que tocar `sheetsClient.ts` a fondo.

---

## Resultado de la ejecución (2026-09-19)

Ejecutado con `superpowers:subagent-driven-development`: un implementador y un revisor por tarea, con rondas de corrección cuando hizo falta, y una revisión final de rama sobre los 8 commits en conjunto. Ledger completo en `.superpowers/sdd/` del worktree usado (`worktree-login-compra-sync`) — no se conserva en el repo, pero queda resumido aquí lo que importa a futuro:

**Rulings tomados durante la ejecución** (decisiones que no estaban en el plan y hubo que resolver sobre la marcha):
- Los tests de los hooks nuevos de `queries.ts` (Tasks 4 y 5) se ubicaron en `web/src/data/queries.test.tsx`, que el plan no listaba explícitamente como fichero a tocar en esas tareas.
- Se amplió `ApiError` con un campo `reintentarEnS?: number` (Task 4): el backend manda los segundos de bloqueo (`reintentar_en_s`) pero el cliente HTTP de la Task 3 los descartaba, y la pantalla de login los necesitaba para mostrar los minutos restantes.

**Hallazgo Critical corregido en revisión** (Task 5): `onMutate` de `useMarcarCompra` usaba `anteriores ?? []`, lo que podía mostrar como "no comprado" un ingrediente realmente marcado por otro dispositivo si se tocaba el checkbox antes de que resolviera la carga inicial de esa semana — justo el escenario que esta feature existe para arreglar. Corregido con `if (!anteriores) return anteriores` y test de regresión.

**Hallazgo solo visible en la revisión final de rama**: la interacción entre la invalidación global de sesión (Task 3) y la cola de mutaciones offline (Task 6) ante una mutación reanudada que recibe `UNAUTHENTICATED` es autocorrectiva (sin crash, sin dato erróneo mostrado) pero no tiene test dedicado — queda anotado como siguiente paso, no bloqueó el despliegue.

**Descubrimiento operativo no anticipado por el plan**: las implementaciones de prueba (`/dev`) de Apps Script no sirven para validar el acceso anónimo real — exigen sesión de Google del desarrollador, así que un `fetch()` normal desde el frontend (diseñado para funcionar sin login, como accede la familia) rebota contra el login de Google incluso con "Cualquier usuario" configurado. Se verificó por otras vías (curl directo al `/dev` para la lógica del backend, y publicación real seguida de verificación inmediata en local contra el `/exec` de producción) en vez de un "ensayo" limpio antes del corte. Documentado en `apps-script/README.md`.

**Despliegue**: corte directo ejecutado tal y como se decidió, sin puente de compatibilidad. Verificado en producción: selector de nombres real, PIN incorrecto con mensaje genérico correcto, sesión persistente tras recargar, login/logout, y marcado de la compra sincronizado.
