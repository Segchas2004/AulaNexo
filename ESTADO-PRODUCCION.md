# Estado de preparación

## Actualización de acceso y exámenes

La configuración publicada usa Firebase Authentication real. Ya no se muestran perfiles ficticios ni accesos de demostración. Los listados provienen de Firestore; solo existe el propietario hasta que este cree las demás cuentas. La creación de accesos se restringió al propietario en interfaz y servidor.

`backendReady: false` mantiene un aviso explícito para el propietario y evita invocar servicios sin desplegar. El despliegue de Functions fue rechazado porque el proyecto requiere Blaze; Storage tampoco está provisionado. El sitio todavía NO está listo para administrar cursos, crear usuarios, subir archivos compartidos o rendir exámenes reales. Activar Blaze requiere una cuenta de facturación que el propietario debe completar; no se realizaron pagos.

El código incorpora PDF opcional de hasta 20 MB en exámenes, visor local PDF.js con marca de agua identificativa, sin controles de descarga/impresión y autorización de enlaces solo durante el intento. Las preguntas y el PDF quedan fijados al intento. Las capturas del sistema y las copias por un usuario autorizado no se pueden impedir de forma absoluta. Para desplegar el visor real se debe configurar CORS GET/HEAD del bucket para `https://segchas2004.github.io` y probar permisos, expiración y entrega en el proyecto real.

Después de provisionar y desplegar el backend completo, ejecutar el script de activación y publicar la configuración actualizada. No retirar el aviso de preparación antes de verificar los flujos reales.

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
