# AulaNexo — estado operativo

Proyecto: `aulanexo-pro-20261015`. Interfaz: https://segchas2004.github.io/AulaNexo/

Blaze confirmado. Authentication, Firestore, Storage privado y las 24 funciones del backend están desplegados en `us-central1`. El bucket es `aulanexo-pro-20261015.firebasestorage.app`. Se configuraron los permisos de los servicios y CORS para la interfaz. La configuración utiliza `backendReady: true`.

El sitio no muestra ni carga perfiles de demostración. El administrador crea docentes y alumnos y proporciona las credenciales iniciales por un canal privado. Las contraseñas reales permanecen en Authentication.

## Validación

- 50 pruebas locales de permisos, cursos, entregas, exámenes e interfaz.
- Prueba real: altas de docente y alumno, ingreso por código, paneles de los tres roles y rechazo de altas por el docente.
- Subida de documentos, enlace temporal para el alumno matriculado, CORS y rechazo de lectura directa del objeto.
- Subida de objeto de prueba `video/mp4` y lectura parcial HTTP 206. Es una prueba de transporte, no de reproducción de varias horas.
- PDF privado del intento, tiempo del servidor, identificación del alumno, nota automática y rechazo del enlace del PDF tras entregar.
- Entrega de trabajo, calificación por docente y consulta de nota por alumno.
- Visor PDF comprobado en navegador con dos páginas.
- Eliminación de cuentas, cursos, archivos y documentos temporales. No se cambió la contraseña del propietario.

## Primer uso

1. Ingresar con el correo del propietario y su contraseña. Si todavía no la definió, utilizar «¿Olvidaste tu contraseña?».
2. En Usuarios, crear el docente. Crear el curso y asignarlo a ese docente.
3. Crear alumnos y asignar las matrículas correspondientes.
4. En Materiales o Grabaciones, subir archivos o compartir enlaces externos.
5. En Evaluaciones, indicar duración, apertura/cierre opcionales, preguntas y PDF opcional de hasta 20 MB.

El visor no incluye botones de descarga ni impresión y muestra la identificación del alumno. No puede impedir capturas del sistema, fotos o copias de un usuario autorizado. Los enlaces firmados ya emitidos son utilizables hasta vencer; no constituyen DRM.

GitHub Actions comprueba y publica la interfaz desde `main`; el backend se despliega por separado. `functions/.env` utiliza `AULANEXO_WEB_API_KEY`, porque Firebase reserva el prefijo `FIREBASE_`. Las imágenes de despliegue se limpian después de un día.

Blaze cobra por uso; no se estableció un tope de gasto. Para presupuestos reducidos, considerar enlaces externos para grabaciones grandes. No se certificó reproducción continua de seis horas, todos los navegadores ni carga simultánea de 50 alumnos.
