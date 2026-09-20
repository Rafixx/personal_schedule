# Apps Script — backend del planificador de menú familiar

API JSON sobre una hoja de Google Sheets, publicada como Web App. Sirve el
catálogo de platos/ingredientes, el plan semanal, las reglas de equilibrio,
la lista de la compra compartida y el login por PIN de la familia. Todo
vive en un único fichero (`Codigo.gs`, ES5 puro — sin módulos, sin
`const`/`let`, sin arrow functions ni template literals) porque así lo
exige el editor de Apps Script.

## Desplegar (manual, una vez)

1. Abre la hoja de Google del proyecto.
2. Extensiones → Apps Script.
3. Borra el contenido de `Código.gs` y pega el contenido de `Codigo.gs` de
   este repo.
4. En el icono de engranaje (Configuración del proyecto), marca "Mostrar el
   archivo de manifiesto appsscript.json en el editor". Abre
   `appsscript.json` en el editor y sustituye su contenido por el de
   `appsscript.json` de este repo.
5. Implementar → Nueva implementación → tipo "Aplicación web".
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
6. Autoriza los permisos que pida Google (es tu propio script sobre tu
   propia hoja).
7. Copia la URL de la implementación (termina en `/exec`) — es la que va en
   `VITE_API_URL` del frontend.

## Importante para cambios futuros

Cada vez que se modifique `Codigo.gs`, hay que crear una **nueva versión**
del despliegue (Implementar → Gestionar implementaciones → editar →
Nueva versión). Guardar el archivo en el editor no actualiza la URL ya
publicada (`/exec`) — sigue sirviendo el código de la versión congelada
hasta que publiques una nueva.

**Implementaciones de prueba (`/dev`) no sirven para probar el acceso
anónimo real.** Dan una URL que refleja el código recién guardado sin
publicar versión, pero exigen que quien la pida esté autenticado con la
cuenta de Google del desarrollador — un `fetch()` normal desde el frontend
(sin esa sesión, tal y como está pensado para funcionar de forma anónima)
rebota contra el login de Google, incluso con "Quién tiene acceso: Cualquier
usuario" configurado. Solo una implementación **publicada** (`/exec`)
replica el acceso anónimo real. Para probar cambios de verdad sin afectar a
producción, prueba las funciones sueltas desde el editor (`Ejecutar`) o
acepta el corte y publica una nueva versión — no hay término medio.

## Autenticación

`doGet`/`doPost` exigen una sesión válida (`autenticar_`) para todo excepto
dos acciones públicas: `GET action=auth.usuarios` (lista de nombres para la
pantalla de login) y `POST action=auth.login` (cómo se consigue la sesión).
El PIN (6 dígitos) se guarda hasheado con sal por usuario y un pepper común
en Script Properties — nunca en la hoja, nunca en claro. La defensa real
contra un PIN corto es el bloqueo por intentos fallidos, no el hash: ver el
análisis completo en
`docs/superpowers/plans/2026-09-19-login-y-compra-sincronizada.md`.

### Dar de alta a alguien o cambiarle el PIN

No hay pantalla de administración — se hace desde el editor:

1. Configuración del proyecto (⚙️) → Propiedades del script → añade
   `ADMIN_NOMBRE` (el nombre) y `ADMIN_PIN` (6 dígitos).
2. Ejecuta `adminSetPin()` desde el editor.
3. La función crea o actualiza el usuario y borra ambas propiedades sola al
   terminar (éxito o error) — el PIN nunca queda escrito en ningún sitio
   además de en la cabeza de la persona.

Primera vez en un despliegue nuevo: ejecuta `adminInicializarAuth()` antes,
crea el pepper (una sola vez — regenerarlo invalida todos los PIN y
sesiones existentes) y las hojas `usuarios`/`sesiones`/`compra_marcas`.

### Otras funciones de administración (editor → Ejecutar)

- `adminDesbloquearUsuario()` — levanta el bloqueo por intentos fallidos de
  un usuario (edita el `ID_USUARIO` dentro de la función antes de
  ejecutar).
- `adminDesactivarUsuario()` — desactiva un usuario y revoca sus sesiones.
- `adminPurgarSesiones()` — borra sesiones inactivas con más de 90 días.
- `benchPin()` — mide el coste real de las iteraciones del hash del PIN en
  este proyecto concreto (varía según la cuenta/región). Útil si algún día
  se cambia `AUTH.ITERACIONES_PIN`.
