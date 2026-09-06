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
| `plan` | `id, fecha, turno, id_plato, notas` |
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

Un único script (`apps-script/Codigo.gs`) con enrutado por parámetro `action`.
Respuestas siempre `ContentService.createTextOutput(JSON.stringify(...)).setMimeType(JSON)`.

**Lectura (`doGet`)**
- `bootstrap` → `{platos, ingredientes, ingredientesPlatos, reglas, proveedores}` en una sola llamada.
- `plan&desde=YYYY-MM-DD&hasta=YYYY-MM-DD`

**Escritura (`doPost`, body `{action, token, payload}`, `Content-Type: text/plain`)**
- `plan.set` (upsert por `fecha`+`turno`), `plan.delete`, `plan.move`
- `plato.upsert`, `plato.delete` (borrado lógico vía `activo`)
- `ingrediente.upsert`, `ingrediente.delete`
- `platoIngredientes.replace`
- `regla.upsert`, `regla.delete`

Reglas de implementación: todas las escrituras bajo `LockService.getScriptLock()`;
ids asignados por el servidor (`max(id)+1` bajo lock); token compartido
comparado contra `PropertiesService`; **POST siempre `text/plain`** — un
`Content-Type: application/json` dispara un preflight `OPTIONS` que Apps
Script no responde y el navegador bloquea la petición.

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
