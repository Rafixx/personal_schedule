# Fundación: reset del repo, spec y spike de conectividad — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el repo limpio y con el andamiaje del proyecto nuevo (spec, esqueleto `web/`, esqueleto `apps-script/`), y confirmar — con un spike real en un navegador — que un Google Apps Script Web App puede servir de API sin bloqueos de CORS, antes de construir nada más encima.

**Architecture:** Dos artefactos versionados en el mismo repo: `apps-script/` (código del Web App que se pega manualmente en el editor de Apps Script) y `web/` (SPA Vite + React + TypeScript). Este plan no construye la API real ni el planificador — solo el reset, el esqueleto y la prueba de conectividad que condiciona todo lo demás.

**Tech Stack:** Vite, React 19, TypeScript, Tailwind CSS v4, Vitest + Testing Library, Google Apps Script (`ContentService`).

**Spec:** `docs/specs/2026-09-06-menu-familiar-design.md` (creado por la Task 2 de este mismo plan — no existe todavía).

## Global Constraints

- Vitest es el único test runner. No añadir Jest.
- TanStack Query será la única fuente de verdad para datos de servidor (fuera de alcance de este plan, pero ya fijado para los siguientes).
- Las peticiones POST al Web App deben ir con `Content-Type: text/plain;charset=utf-8`. Un `Content-Type: application/json` dispara un preflight `OPTIONS` que Apps Script no responde, y el navegador bloquea la petición.
- Ningún secreto (URL de despliegue, token, `.clasp.json`) se commitea. Van en `.gitignore` / variables de entorno.
- Menú único para todos los comensales; turno único `COMIDA`, modelado con un campo `turno` para no migrar cuando se añada `CENA`.
- Los avisos de reglas y temporada son informativos, nunca bloqueantes — esto condiciona el diseño de la API y del dominio en planes futuros, anotado aquí porque vive en la spec.

---

### Task 1: Backup y reset del repositorio

**Files:**
- N/A (operación de repositorio, no de código)

**Interfaces:**
- Consumes: nada
- Produces: repo con un único commit inicial en `main`, árbol de trabajo vacío salvo `.gitignore` y `README.md` mínimo. Todo lo posterior parte de aquí.

- [ ] **Step 1: Crear el bundle de respaldo local**

```bash
cd /home/rafa/dev/personal/personal_schedule
git bundle create ~/personal_schedule-legacy.bundle --all
```

- [ ] **Step 2: Verificar que el bundle es válido**

Run: `git bundle verify ~/personal_schedule-legacy.bundle`
Expected: `The bundle records a complete history` (o similar mensaje de éxito), sin errores.

- [ ] **Step 3: Confirmar el remoto configurado**

Run: `git remote -v`
Expected: `origin  git@github.com:Rafixx/personal_schedule.git (fetch/push)`. Si no coincide, detente y confírmalo antes de continuar — el siguiente paso hace force-push.

- [ ] **Step 4: Crear rama huérfana vacía**

```bash
git checkout --orphan reset-inicial
git rm -rf .
```

Expected: `git status` muestra el árbol de trabajo vacío (sin archivos trackeados).

- [ ] **Step 5: Escribir `.gitignore` mínimo**

```gitignore
# dependencias
node_modules/

# build
dist/
web/dist/

# entorno y secretos
.env
.env.local
apps-script/.clasp.json

# editor / SO
.DS_Store
*.log
```

- [ ] **Step 6: Escribir `README.md` mínimo**

```markdown
# Menú familiar

Planificador de menú semanal para casa, con Google Sheets como base de datos
(vía Apps Script) y una tablet en la cocina como interfaz.

Ver `docs/specs/` para el diseño y `docs/superpowers/plans/` para los planes
de implementación en curso.
```

- [ ] **Step 7: Commit inicial y reemplazo de `main`**

```bash
git add .gitignore README.md
git commit -m "chore: reset del repo, arranque del proyecto de menú familiar"
git branch -M main
```

- [ ] **Step 8: Force-push a origin**

```bash
git push origin main --force
```

Expected: el push termina en éxito. Verificar en GitHub (o `git ls-remote origin main`) que el hash remoto coincide con `git rev-parse main` local.

- [ ] **Step 9: Confirmar con el usuario si conservar o borrar el bundle**

No es un paso de código: al terminar el plan, preguntar a Rafa si `~/personal_schedule-legacy.bundle` se conserva o se borra. No lo borres tú mismo sin confirmación explícita.

---

### Task 2: Escribir y commitear la spec de diseño

**Files:**
- Create: `docs/specs/2026-09-06-menu-familiar-design.md`

**Interfaces:**
- Consumes: nada
- Produces: documento de referencia que citarán todos los planes siguientes (`Spec:` en su cabecera).

- [ ] **Step 1: Crear el directorio y el archivo de spec**

Contenido completo de `docs/specs/2026-09-06-menu-familiar-design.md`:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add docs/specs/2026-09-06-menu-familiar-design.md
git commit -m "docs: spec de diseño del planificador de menú familiar"
```

---

### Task 3: Scaffold del proyecto `web/`

**Files:**
- Create: `web/` (proyecto Vite completo)
- Modify: `web/vite.config.ts`, `web/src/index.css`, `web/eslint.config.js`, `web/package.json`
- Create: `web/.prettierrc`, `web/src/test/setup.ts`, `web/src/App.test.tsx`
- Create (carpetas vacías con `.gitkeep`): `web/src/domain/`, `web/src/data/`, `web/src/features/planner/`, `web/src/features/shopping/`, `web/src/features/catalog/`, `web/src/shared/`

**Interfaces:**
- Consumes: nada
- Produces: proyecto `web/` con `npm run dev|build|lint|test` funcionando. Los siguientes planes añaden código dentro de `domain/`, `data/` y `features/` sin tocar la configuración.

- [ ] **Step 1: Generar el proyecto base con Vite**

```bash
cd /home/rafa/dev/personal/personal_schedule
npm create vite@latest web -- --template react-ts
cd web
npm install
```

- [ ] **Step 2: Instalar dependencias de la aplicación**

```bash
npm install @tanstack/react-query @tanstack/react-query-persist-client \
  @tanstack/query-async-storage-persister idb-keyval zod \
  @dnd-kit/core @dnd-kit/sortable date-fns react-router-dom \
  react-hook-form @hookform/resolvers motion lucide-react clsx
```

- [ ] **Step 3: Instalar dependencias de test y de desarrollo**

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event vite-plugin-pwa msw prettier eslint-config-prettier
```

- [ ] **Step 4: Instalar y configurar Tailwind CSS v4**

```bash
npm install tailwindcss @tailwindcss/vite
```

Editar `web/vite.config.ts` (reemplazar el archivo entero):

```typescript
/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts']
  }
})
```

Editar `web/src/index.css` (reemplazar el archivo entero):

```css
@import 'tailwindcss';
```

- [ ] **Step 5: Configurar el entorno de test**

Crear `web/src/test/setup.ts`:

```typescript
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 6: Añadir scripts de test a `package.json`**

En `web/package.json`, dentro de `"scripts"`, añadir (junto a los que ya trae el template: `dev`, `build`, `lint`, `preview`):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 7: Escribir el test de humo del pipeline**

Crear `web/src/App.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App scaffold', () => {
  it('renders the Vite + React starter and reacts to clicks', async () => {
    render(<App />)
    expect(screen.getByText(/vite \+ react/i)).toBeInTheDocument()

    const button = screen.getByRole('button', { name: /count is 0/i })
    await userEvent.click(button)

    expect(screen.getByRole('button', { name: /count is 1/i })).toBeInTheDocument()
  })
})
```

- [ ] **Step 8: Ejecutar el test y verificar que pasa**

Run: `npm run test`
Expected: 1 archivo de test, 1 test, `PASS`.

- [ ] **Step 9: Crear la estructura de carpetas de la arquitectura**

```bash
mkdir -p src/domain src/data src/features/planner src/features/shopping src/features/catalog src/shared
touch src/domain/.gitkeep src/data/.gitkeep \
  src/features/planner/.gitkeep src/features/shopping/.gitkeep src/features/catalog/.gitkeep \
  src/shared/.gitkeep
```

- [ ] **Step 10: Añadir Prettier**

Crear `web/.prettierrc`:

```json
{
  "semi": false,
  "singleQuote": true,
  "printWidth": 100,
  "trailingComma": "none"
}
```

Al final de `web/eslint.config.js`, añadir `eslint-config-prettier` al array de configs exportado (evita choques entre ESLint y Prettier en reglas de formato):

```javascript
import prettier from 'eslint-config-prettier'
// ... imports existentes del template ...

export default [
  // ... configuración existente generada por el template ...
  prettier
]
```

- [ ] **Step 11: Verificar lint, test y build en verde**

```bash
npm run lint
npm run test
npm run build
```

Expected: los tres comandos terminan sin error (exit code 0).

- [ ] **Step 12: Commit**

```bash
cd /home/rafa/dev/personal/personal_schedule
git add web/
git commit -m "chore: scaffold de la web app (Vite + React + TS + Tailwind v4 + Vitest)"
```

---

### Task 4: Código y guía de despliegue del spike de Apps Script

**Files:**
- Create: `apps-script/Codigo.gs`
- Create: `apps-script/appsscript.json`
- Create: `apps-script/README.md`

**Interfaces:**
- Consumes: nada
- Produces: código listo para pegar manualmente en el editor de Apps Script (no hay API de despliegue automatizable sin login interactivo de Google, así que este paso es manual para Rafa).

- [ ] **Step 1: Escribir el código del spike**

Crear `apps-script/Codigo.gs`:

```javascript
/**
 * Spike de conectividad: confirma que un navegador puede hacer GET y POST
 * contra este Web App sin bloqueos de CORS, antes de construir la API real.
 * No toca la hoja de cálculo todavía.
 */

function doGet(e) {
  var body = JSON.stringify({
    ok: true,
    action: 'get',
    receivedParams: e && e.parameter ? e.parameter : {},
    serverTime: new Date().toISOString()
  })
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON)
}

function doPost(e) {
  var raw = e && e.postData ? e.postData.contents : null
  var parsed = null
  var parseError = null
  try {
    parsed = raw ? JSON.parse(raw) : null
  } catch (err) {
    parseError = String(err)
  }
  var body = JSON.stringify({
    ok: true,
    action: 'post',
    echoed: parsed,
    parseError: parseError,
    rawLength: raw ? raw.length : 0,
    contentType: e && e.postData ? e.postData.type : null
  })
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON)
}
```

- [ ] **Step 2: Escribir el manifiesto**

Crear `apps-script/appsscript.json`:

```json
{
  "timeZone": "Europe/Madrid",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "access": "ANYONE_ANONYMOUS",
    "executeAs": "USER_DEPLOYING"
  }
}
```

- [ ] **Step 3: Escribir la guía de despliegue manual**

Crear `apps-script/README.md`:

```markdown
# Apps Script — spike de conectividad

Este script no toca la hoja todavía: solo confirma que el navegador puede
hablar con un Web App de Apps Script sin que CORS lo bloquee.

## Desplegar (manual, una vez)

1. Abre la hoja de Google del proyecto.
2. Extensiones → Apps Script.
3. Borra el contenido por defecto de `Código.gs` y pega el contenido de
   `Codigo.gs` de este repo.
4. En el icono de engranaje (Configuración del proyecto), marca
   "Mostrar el archivo de manifiesto appsscript.json en el editor".
   Abre `appsscript.json` en el editor de Apps Script y sustituye su
   contenido por el de `appsscript.json` de este repo.
5. Implementar → Nueva implementación → tipo "Aplicación web".
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
6. Autoriza los permisos que pida Google (es tu propio script sobre tu
   propia hoja).
7. Copia la URL de la implementación (termina en `/exec`) y compártela en
   la conversación para hacer la verificación automática desde un
   navegador real.

## Importante para cambios futuros

Cada vez que se modifique `Codigo.gs`, hay que crear una **nueva versión**
del despliegue (Implementar → Gestionar implementaciones → editar →
Nueva versión). Guardar el archivo en el editor no actualiza la URL ya
publicada.
```

- [ ] **Step 4: Commit**

```bash
git add apps-script/
git commit -m "feat: spike de conectividad de Apps Script (GET/POST) y guía de despliegue"
```

---

### Task 5: Despliegue manual y verificación de conectividad desde un navegador real

**Files:**
- N/A (verificación, no código)

**Interfaces:**
- Consumes: URL de despliegue del Web App (la aporta Rafa tras el Step 1)
- Produces: decisión go/no-go documentada, que condiciona el diseño de la API en el siguiente plan.

- [ ] **Step 1 (manual, Rafa): Desplegar y compartir la URL**

Seguir `apps-script/README.md` y pegar en el chat la URL que termina en
`/exec`. Este paso no lo puede automatizar el agente: requiere iniciar
sesión y aceptar permisos en tu cuenta de Google.

- [ ] **Step 2 (agente): Verificar `GET` desde un navegador real**

Usar las herramientas de Chrome DevTools MCP: abrir una página nueva
(`about:blank` sirve, no hace falta el dev server) y ejecutar con
`evaluate_script`:

```javascript
async () => {
  const url = '<URL_DE_DESPLIEGUE>?probe=1'
  const t0 = performance.now()
  const res = await fetch(url)
  const ms = Math.round(performance.now() - t0)
  const json = await res.json()
  return { status: res.status, ms, json }
}
```

Expected: `status: 200`, `json.ok === true`, sin error de red ni de CORS en
la consola de la página (revisar con `list_console_messages`).

- [ ] **Step 3 (agente): Verificar `POST` con `text/plain`**

Mismo mecanismo, nuevo `evaluate_script`:

```javascript
async () => {
  const url = '<URL_DE_DESPLIEGUE>'
  const t0 = performance.now()
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ hello: 'world' })
  })
  const ms = Math.round(performance.now() - t0)
  const json = await res.json()
  return { status: res.status, ms, json }
}
```

Expected: `status: 200`, `json.echoed` igual a `{hello: "world"}`, sin
preflight fallido en la consola.

- [ ] **Step 4 (agente): Medir arranque en frío**

Esperar al menos 10 minutos sin llamar al script (o usar una segunda
implementación) y repetir el Step 2, anotando `ms`. Comparar con una
llamada inmediatamente posterior (script ya "caliente").

- [ ] **Step 5: Registrar el resultado en la spec**

Añadir al final de `docs/specs/2026-09-06-menu-familiar-design.md`, bajo un
nuevo encabezado `## Resultado del spike de conectividad`, los datos reales
obtenidos (status, latencia en frío/caliente, cualquier error de consola) y
la conclusión: **API Apps Script confirmada** o **requiere alternativa**
(y cuál, si aplica). Commitear:

```bash
git add docs/specs/2026-09-06-menu-familiar-design.md
git commit -m "docs: resultado del spike de conectividad Apps Script"
```

**Si el resultado es "requiere alternativa":** detener aquí. No escribir el
siguiente plan (API completa + capa de datos) hasta decidir con Rafa el
mecanismo de transporte definitivo.
