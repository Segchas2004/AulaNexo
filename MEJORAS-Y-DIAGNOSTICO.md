# AulaNexo Profesional — 15 de octubre de 2026

Actualización: se habilitó Authentication con Email/Password, se creó Firestore en `us-central1`, se desplegaron reglas/índices y se creó el propietario. Ver `ESTADO-PRODUCCION.md` para el estado actualizado; los pasos pendientes que siguen describen la revisión inicial.

## Resultado de esta revisión

Primera mejora visual implementada sobre la aplicación existente: azul institucional, tipografía de sistema, navegación con selección destacada, formularios y botones uniformes, tarjetas con jerarquía más clara, y textos del panel orientados a gestión académica. La hoja `dist/professional.css` concentra la personalización. Se conserva la lógica de cursos, tareas, exámenes y permisos.

Se añadió `npm run dev` para abrir la aplicación en http://127.0.0.1:4173. Instalar dependencias con `npm ci` antes del primer uso. No abrir el HTML directamente, porque utiliza módulos JavaScript.

## Firebase creado

- Proyecto: `aulanexo-pro-20261015` (AulaNexo Profesional).
- Aplicación web: `1:619636702136:web:a15d4c7b2d4900284f2d4d`.
- Consola: https://console.firebase.google.com/project/aulanexo-pro-20261015/overview
- `.firebaserc` apunta al proyecto nuevo. La configuración pública obtenida de Firebase está en `dist/firebase-config.production.json`.
- El aula permanece en demostración hasta disponer del backend. Crear un proyecto y registrar una aplicación no habilita automáticamente todos los servicios.

Pendiente para operar con alumnos reales: habilitar Email/Password en Authentication, elegir ubicación de Firestore y Storage, configurar facturación para Functions/Storage, instalar dependencias de Functions, desplegar reglas/índices/funciones, preparar el propietario con el script existente y probar accesos con los emuladores y en el proyecto real. Consultar README.md para los pasos originales. No se ha vinculado una cuenta de facturación ni publicado la web.

Después de preparar el backend, `npm run activate:production -- --backend-ready` activa la configuración real y escribe la variable del backend. Esta orden modifica archivos locales; no habilita servicios ni despliega. Revisar la región antes de crear las bases. El código conserva `us-central1`.

## Firebase o MySQL

Para esta versión recomiendo Firebase porque el código existente ya integra Authentication, Firestore, Storage y Cloud Functions. MySQL sería razonable si el alcance incluye contabilidad, relaciones académicas complejas e informes SQL intensivos. La migración requiere una API propia, autenticación/autorización, almacenamiento de archivos, migraciones y operación del servidor; cambiar solo la base no sustituye esos servicios. Los videos deben permanecer en almacenamiento de objetos, no como archivos binarios dentro de MySQL.

Referencias: https://firebase.google.com/pricing y https://dev.mysql.com/doc/refman/8.0/en/what-is-mysql.html

## Hallazgos y límites

La separación de adaptadores demo/Firebase y la calificación en servidor son buenas bases. La demo guarda datos localmente y no constituye seguridad para usuarios reales. Las pruebas existentes cubren grupos, permisos, entregas y evaluaciones; no certifican concurrencia ni disponibilidad de producción.

El adaptador carga colecciones y resultados de varios cursos al abrir el panel. Antes de escalar conviene medir lecturas y mover los resúmenes a agregaciones; completar también la experiencia de paginación de todos los listados. Las grabaciones largas necesitan estimar almacenamiento, transferencia y distribución de video. Faltan validación operativa del backend real, recuperación de copias, observabilidad y pruebas de carga. No se declara resuelto lo anterior por una mejora estética.

Validación: 48 pruebas existentes aprobadas y verificación de sintaxis/configuración. Revisión visual en navegador del panel. No se ejecutó la suite de emuladores de Firebase ni se probaron usuarios reales.
