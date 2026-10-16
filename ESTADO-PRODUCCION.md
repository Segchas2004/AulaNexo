# Estado de preparación

Publicación de presentación preparada para GitHub Pages. El sitio se mantiene explícitamente en modo demostración: las subidas locales permiten mostrar el recorrido, pero no son almacenamiento compartido de producción.

Proyecto Firebase: `aulanexo-pro-20261015`.

Preparado en Firebase: Authentication con Email/Password, Firestore `(default)` en `us-central1`, reglas e índices desplegados, y cuenta del propietario creada y verificada. El propietario establece su contraseña por enlace privado fuera del repositorio. No se reutilizó ni almacenó una contraseña de Google.

Repositorio preparado para GitHub con verificación automática en Node 22. No incluye contraseñas, enlaces de restablecimiento, credenciales administrativas ni dependencias instaladas. La configuración de la aplicación web es pública; el acceso a datos se controla mediante Authentication, reglas y funciones.

La interfaz sigue en modo demo hasta completar Storage y Functions. Esos servicios requieren preparar facturación Blaze. No activar la configuración real con un backend incompleto. El script de activación no sustituye el despliegue.

Para subir el repositorio local a un repositorio vacío de GitHub:

```bash
git remote add origin https://github.com/TU_USUARIO/AulaNexo.git
git push -u origin main
```

La automatización de GitHub verifica el código; no despliega servicios ni utiliza credenciales de Firebase. Configurar el despliegue por separado con identidad federada y permisos mínimos cuando el backend esté listo.
