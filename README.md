# Menu Planner PWA

Aplicación PWA mínima para planificar menús mensuales de lunes a viernes y generar la lista de la compra.

## Setup

```bash
pnpm install
pnpm dev
```

## Scripts

- `pnpm dev` - entorno de desarrollo
- `pnpm build` - build de producción
- `pnpm preview` - previsualizar build
- `pnpm lint` - ejecutar ESLint
- `pnpm test` - tests con Vitest
- `pnpm typecheck` - verificación de tipos

## Datos

El fichero `public/data/menu.json` contiene los platos y planes iniciales. Sigue el esquema `schemas/menu.schema.json` y valida con:

```bash
pnpm test
```

## Exportar/Importar plan

La UI permite exportar tu plan local a un JSON e importar uno existente.

## Despliegue

La app es estática y se puede alojar en servicios como Netlify:

```bash
pnpm build
netlify deploy --prod
```

## PWA y modo kiosko

Instala la app desde el navegador. El service worker usa App Shell y SWR para `menu.json`.

Para usar en kiosko:
- Android: usa *App Pinning*.
- iOS: activa *Acceso guiado* en Ajustes → Accesibilidad.
