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
