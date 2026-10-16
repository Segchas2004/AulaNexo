# AulaNexo · aula virtual

**Estado actualizado:** consulta [ESTADO-PRODUCCION.md](ESTADO-PRODUCCION.md). El proyecto real, Authentication, Firestore y el propietario ya están preparados. Storage/Functions y el despliegue web siguen pendientes. Para revisar la interfaz: `npm ci` y `npm run dev`.

Implementación navegable para secundaria, universidad y cursos independientes, con diseño azul y blanco. El nombre se puede cambiar en la marca y el título de `dist/`.

## Qué puedes revisar ahora

La publicación de Sites es una **demostración privada para el propietario**. Funciona en este navegador con usuarios ficticios, cursos, matrículas, trabajos y exámenes. No está conectada a un proyecto real de Firebase. Las cuentas creadas aquí no sirven en otro dispositivo y los archivos de prueba se guardan en IndexedDB, no en un servidor. El límite de archivo de la demostración es 50 MB y depende también del espacio disponible en el navegador.

El código incluye el frontend, el adaptador de Firebase, las Cloud Functions, las reglas de acceso, los índices y la preparación del primer administrador. Para admitir alumnos reales todavía hace falta configurar, desplegar y probar tu proyecto de Firebase. No se han activado cuentas reales, facturación ni un servicio de videoconferencia de pago.

## Funciones

- Acceso por código o correo y contraseña; roles de administrador, docente y alumno.
- Alta de usuarios desde el panel, generación de contraseña inicial, edición de perfiles y matrículas, suspensión, recuperación y cambio de contraseña.
- Cursos por grado de secundaria o ciclo universitario, con carrera, sección y periodo opcionales. Las matrículas se validan frente al grupo académico.
- **Secundaria por semestres; universidad por unidades; cursos independientes por módulos.** Los nombres son configurables. Cada apartado reúne materiales, Meet, trabajos, exámenes, grabaciones y avisos.
- Materiales y grabaciones subidos como archivo o compartidos mediante enlace.
- Clases con enlace externo de Meet, fecha y duración, edición/eliminación y agenda. Los horarios de clase, exámenes y trabajos se introducen y muestran en hora de Perú (UTC−5).
- Trabajos con indicaciones, fecha límite, aceptación opcional de entregas tardías, respuesta escrita y archivo privado. El alumno puede actualizar su entrega hasta la calificación; el docente puede habilitar otra revisión.
- Calificación de trabajos sobre 20 y comentarios privados para el alumno. La revisión se identifica para evitar calificar una versión que el alumno acaba de reemplazar.
- Exámenes de alternativas con ponderación por pregunta, un intento, temporizador, respuestas guardadas, reanudación y nota automática en el servidor.
- Notas de exámenes y trabajos, devolución individual y exportación CSV. No se presenta un promedio oficial sin definir pesos académicos.
- Avisos por apartado, destacados y consulta global; resumen del curso con actividades entregadas.
- Búsqueda y filtros, navegación móvil, diálogos accesibles y reducción de animaciones según la preferencia del sistema.

## Cómo explorar

En la entrada elige una cuenta de demostración o crea un acceso de prueba como administrador/docente. Para comprobar el recorrido:

1. Crea un curso con nivel, grado/ciclo y apartados.
2. Agrega un alumno, indica su grupo y selecciona las matrículas compatibles.
3. Publica un trabajo, un examen y un enlace de Meet dentro del apartado elegido.
4. Cierra sesión e ingresa con el código o correo y contraseña del alumno.
5. Entrega el trabajo, rinde el examen y consulta Mis notas.
6. Vuelve como docente, revisa la entrega y publica una nota/comentario. El alumno encontrará su devolución en la misma actividad.

| Perfil ficticio | Correo | Código |
| --- | --- | --- |
| Administrador | admin@aulanexo.example | — |
| Docente | docente@aulanexo.example | — |
| Secundaria, 3.er grado | secundaria@aulanexo.example | SEC-003 |
| Universidad, ciclo IV | universidad@aulanexo.example | UNI-004 |
| Curso independiente | curso@aulanexo.example | CUR-001 |

Contraseña de las cuentas iniciales: `AulaDemo2026!`. Las nuevas cuentas conservan la contraseña que se indicó al crearlas. La demostración deriva sus contraseñas con PBKDF2 y no las guarda en texto legible, pero **no es una frontera de seguridad**: sus datos son modificables por quien controla el navegador. Usa únicamente datos ficticios. Restablecer la demostración elimina las cuentas y datos de prueba.

## Meet y grabaciones de 4–6 horas

El docente crea su reunión en Meet y copia el enlace al aula. El alumno abre Meet en otra pestaña. El control de admisión de esa reunión se configura en Meet; la matrícula de AulaNexo controla quién puede consultar el enlace en el curso.

El docente graba la pantalla con una aplicación externa y luego selecciona **Grabaciones → Subir grabación**, eligiendo su semestre o unidad. Se puede reproducir el archivo MP4/WebM desde el aula o compartir un enlace externo. No hay grabación automática ni sincronización de Google Classroom.

El backend preparado permite videos MP4/WebM de hasta **20 GiB** y otros materiales de hasta **200 MiB**; las entregas de alumnos tienen un límite de **50 MiB**. Una grabación de 4–6 horas cabe si su tamaño está dentro del límite: la duración por sí sola no determina el peso. Conviene usar MP4 con video H.264 y audio AAC para compatibilidad. La subida al proyecto real utiliza el mecanismo resumible del SDK de Storage y muestra el porcentaje; cancelar la ventana cancela una subida en curso. La transferencia y reproducción dependen de la conexión, el formato y el equipo.

Los videos privados reciben enlaces temporales de lectura de ocho horas; documentos y adjuntos de entregas, de quince minutos. La función verifica el usuario activo y la matrícula o responsabilidad del docente antes de emitirlos. Un enlace ya emitido puede compartirse y sigue vigente hasta su vencimiento; la suspensión no borra lo que alguien descargó. Storage niega la lectura directa desde clientes, por lo que la interfaz no utiliza enlaces permanentes con tokens de descarga.

Guardar videos en Storage implica pagar almacenamiento y transferencia según el proyecto contratado. Para muchas reproducciones simultáneas, conviene evaluar distribución/transcodificación de video después de medir el volumen real. Esta entrega no certifica capacidad para 1.000 o 10.000 usuarios ni contiene una prueba de reproducción continua de seis horas.

## Arquitectura y accesos

| Servicio | Uso |
| --- | --- |
| Firebase Authentication | Cuentas, correo, contraseña, recuperación y suspensión |
| Cloud Firestore | Perfiles, grupos, cursos, matrículas, contenido, trabajos, entregas y resultados |
| Cloud Storage | Materiales, grabaciones manuales y adjuntos privados |
| Cloud Functions | Altas administrativas, permisos, calificación y enlaces temporales |
| Firebase Hosting o Sites | Archivos de la interfaz web |

Las contraseñas reales se administran en Authentication. No se guardan en documentos de Firestore ni se muestran al editar un usuario. Solo se muestra la contraseña inicial elegida al crear un acceso.

El propietario administra el aula. El docente administra sus propios cursos y alumnos vinculados a él. El alumno necesita una cuenta activa y una matrícula activa en un curso publicado. No existe alta pública desde la interfaz.

El acceso por código usa un índice `loginCodes` que ningún cliente puede leer. Una función resuelve internamente el código, verifica la contraseña contra Firebase Authentication y emite un token personalizado. Nunca devuelve el correo al solicitante. Hay un límite de diez intentos por combinación de IP/código y ventana de quince minutos. El correo conserva el inicio de sesión estándar del SDK. Configura TTL sobre `loginRateLimits.expiresAt` para eliminar contadores vencidos en producción.

Las claves de examen se mantienen en `examKeys` y `attemptKeys`, inaccesibles a todos los clientes. Cada intento conserva una copia de sus preguntas y clave. Después del cierre se califican las respuestas guardadas a tiempo; volver a entregar no cambia la nota. Los trabajos y notas tampoco se escriben directamente desde el cliente.

## Conectar un proyecto real

Se necesita Node.js 22 o posterior, una cuenta autorizada de Google/Firebase y acceso al proyecto elegido.

1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com/) y registra una aplicación web. Habilita Authentication con Email/Password, Firestore y un bucket de Storage. El despliegue de Functions y Storage requiere configurar facturación en Blaze. Revisa región, cuotas, políticas de contraseña, protección contra enumeración y presupuesto para el tráfico esperado.
2. Instala las dependencias y ejecuta la configuración guiada con los valores públicos de tu aplicación:

```bash
npm install
npm --prefix functions install
npm run configure
npx firebase login
```

`configure` escribe `dist/firebase-config.js`, `.firebaserc`, la región del backend y `functions/.env` con `FIREBASE_WEB_API_KEY`. Esta API key identifica la aplicación y no es una clave privada; el servidor la usa para verificar contraseñas en el acceso por código. Si la key está restringida a orígenes de navegador, utiliza una key separada del mismo proyecto que permita la API Identity Toolkit desde el backend y configura el parámetro allí.

3. Ejecuta las comprobaciones y despliega las funciones/reglas junto con la web:

```bash
npm test
npm run check
npx firebase deploy --only firestore,storage,functions,hosting
```

La web de Sites y el backend de Firebase son despliegues distintos. Si conservas Sites como frontend, vuelve a publicar el código de `dist/` con la configuración pública de Firebase y despliega allí solamente el backend y las reglas necesarias. Añade el dominio final a los dominios autorizados de Authentication.

4. Habilita la API IAM Service Account Credentials y concede a la cuenta de servicio de Functions `iam.serviceAccounts.signBlob` sobre la cuenta que firma, normalmente con `roles/iam.serviceAccountTokenCreator`. Se usa tanto para enlaces de Storage como para tokens de acceso por código. Comprueba estos permisos en el proyecto real.
5. En tu equipo, configura credenciales Application Default (`gcloud auth application-default login`) y ejecuta `npm run bootstrap`. Este script pide el proyecto, nombre, correo y contraseña oculta y crea el primer propietario una sola vez. Después, crea los demás usuarios desde el panel; no hace falta ingresarlos uno a uno en la consola de Firebase.
6. Prueba con cuentas reales de administrador, docente y alumnos: recuperación por correo, subida, reproducción y búsqueda en videos largos, adjuntos, notas y revocación de matrícula. Mide gasto, tiempos de respuesta y transferencia antes de admitir tráfico masivo.

Nunca publiques contraseñas, JSON de cuentas de servicio ni claves privadas en `dist/` o en Git. Git almacena el código; los datos y archivos de los alumnos viven en los servicios del backend.

## Validación de esta versión

```bash
npm test
npm run check
# Requiere Java y emuladores oficiales:
npm run test:firebase
# Alternativa cuando el entorno no admite sockets Unix del emulador de Functions:
npm run test:firebase:logic
```

Pasaron **48 pruebas locales** de validación, flujos y DOM, incluida la entrega/revisión de trabajos, códigos, agrupación académica, Meet externo, subida manual de video, aislamiento por matrícula y calificación automática. También pasaron **diez escenarios de integración** con los emuladores oficiales de Authentication, Firestore y Storage, usando los handlers reales de Functions con tokens verificados.

Las pruebas DOM no equivalen a una revisión visual en navegador. La capacidad de navegador requerida por el flujo de Sites no está disponible en este entorno. También quedan pendientes el transporte callable del proyecto desplegado, la firma IAM y reproducción real de videos largos, recuperación por correo real y pruebas de carga. No se han inventado resultados de producción.

## Paginación y límites

- Usuarios y lista de alumnos de un curso: páginas de 50. Búsqueda por prefijo del nombre, correo exacto o código exacto.
- Cursos y docentes: páginas de 100. Contenido por curso: páginas de 50, empezando por las publicaciones más recientes; resultados por curso: páginas de 200; resultados del alumno: páginas de 100. Los indicadores reflejan la información cargada y ofrecen carga adicional.
- Hasta 40 matrículas por alumno, 30 apartados por curso y 60 preguntas por examen. Un intento por examen.
- Un curso con matrículas conserva su grupo y docente. Para un nuevo grado, ciclo o periodo, crea otro curso. Un apartado con contenido conserva su nombre para no perder la relación académica.
- La carga inicial lee páginas limitadas por curso. Para instituciones con cientos de cursos, una siguiente etapa debe separar agregados del inicio y cargar contenido bajo demanda, además de comprobar índices, cuotas, caché y picos de entregas.
- Los enlaces externos de documentos/videos obedecen la privacidad configurada en su proveedor. La privacidad de Storage se aplica a archivos alojados en el proyecto.
- Para 1.000/10.000 usuarios simultáneos hacen falta pruebas progresivas del proyecto real y ajustes a partir de latencia, errores, cuotas y costo medidos.

## Código

`dist/` contiene la interfaz sin etapa de compilación. `functions/` contiene el backend. Las reglas y los índices están en la raíz, junto con `firebase.json`. `tests/` reúne las comprobaciones y `scripts/` incluye la configuración y preparación del propietario. Se puede servir `dist/` con un servidor HTTP local para explorar la demostración; no abrir los módulos directamente como archivos `file://`.
