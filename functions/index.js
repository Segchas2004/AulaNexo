import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineString } from 'firebase-functions/params';
import { createHash, randomUUID } from 'node:crypto';
import { setGlobalOptions } from 'firebase-functions/v2';
import { AppError, normalizeEmail, validateUserInput, validateProvision, canManageCourse, canEnroll,
  validateCourse, validateMaterial, validateExam, splitExam, sanitizeAnswers, gradeExam, examAvailable, deadlineFor, validateSession, normalizeCode, resolveModule, courseModules, validateAssignment, validateSubmission, validateFeedback, validateAnnouncement, FILE_MIMES } from './core.js';

initializeApp();
// Ajustar región, capacidad y cuotas tras las pruebas del proyecto real.
setGlobalOptions({ region: 'us-central1', maxInstances: 30, concurrency: 40, memory: '256MiB', timeoutSeconds: 60 });
const db = getFirestore(); const auth = getAuth();
const iso = () => new Date().toISOString();
const docData = d => d.exists ? { id: d.id, ...d.data() } : null;
const wrap = (handler, options = {}) => onCall(options, async request => {
  try { return await handler(request); }
  catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof AppError) throw new HttpsError(error.code || 'invalid-argument', error.message);
    if (error.code === 'auth/email-already-exists') throw new HttpsError('already-exists', 'Ese correo ya tiene una cuenta.');
    if (['auth/invalid-password', 'auth/password-does-not-meet-requirements'].includes(error.code)) throw new HttpsError('invalid-argument', 'La contraseña no cumple la política configurada.');
    // No registrar el cuerpo de la solicitud: puede contener una contraseña inicial.
    console.error('AulaNexo operation failed', { code: error.code || 'unknown' });
    throw new HttpsError('internal', 'No se pudo completar la operación. Intenta nuevamente.');
  }
});
async function actorOf(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Inicia sesión para continuar.');
  const actor = docData(await db.doc(`users/${request.auth.uid}`).get());
  if (!actor?.active) throw new HttpsError('permission-denied', 'Tu acceso no está habilitado.');
  return actor;
}
async function courseOf(actor, courseId, manage = false) {
  if (typeof courseId !== 'string' || !/^[\w-]{1,140}$/.test(courseId)) throw new HttpsError('invalid-argument', 'Curso no válido.');
  const course = docData(await db.doc(`courses/${courseId}`).get());
  if (!course) throw new HttpsError('not-found', 'Curso no encontrado.');
  if (canManageCourse(actor, course)) return course;
  if (!manage && actor.role === 'student' && course.published) {
    const enrollment = await db.doc(`enrollments/${courseId}_${actor.id}`).get();
    if (enrollment.exists && enrollment.data().active) return course;
  }
  throw new HttpsError('permission-denied', 'No tienes acceso a este curso.');
}
function identifier(value) {
  if (typeof value !== 'string' || !/^[\w-]{1,180}$/.test(value)) throw new HttpsError('invalid-argument', 'Identificador no válido.');
  return value;
}
async function targetOf(actor, uid) {
  const target = docData(await db.doc(`users/${identifier(uid)}`).get());
  if (!target || target.role === 'owner' || target.id === actor.id ||
    !(actor.role === 'owner' || (actor.role === 'teacher' && target.role === 'student' && target.managerIds?.includes(actor.id))))
    throw new HttpsError('permission-denied', 'No puedes administrar esta cuenta.');
  return target;
}
async function selectedCourses(ids) {
  if (!Array.isArray(ids) || ids.length > 40) throw new HttpsError('invalid-argument', 'Selecciona hasta 40 cursos.');
  return (await Promise.all(ids.map(id => db.doc(`courses/${identifier(id)}`).get()))).map(docData).filter(Boolean);
}
async function saveProfile(actor, input, uid, previous = null) {
  const managed = await selectedCourses(input.courseIds);
  validateProvision(actor, input, managed);
  const otherIds = actor.role === 'teacher' && previous ? (previous.courseIds || []).filter(id => !managed.some(c => c.id === id)) : [];
  // Conservar las matrículas de otros docentes; retirar únicamente las de quien realiza la edición.
  const otherCourses = await selectedCourses(otherIds);
  const retained = otherCourses.filter(c => !canManageCourse(actor, c));
  const allCourses = [...managed, ...retained];
  if (allCourses.some(c => !canEnroll(input, c))) throw new HttpsError('invalid-argument', 'El nuevo nivel no corresponde a todas sus matrículas.');
  const courseIds = allCourses.map(c => c.id);
  const managerIds = [...new Set([previous?.createdBy || actor.id, ...allCourses.map(c => c.teacherId)])];
  const { courseIds: ignored, ...profile } = input;
  const record = { ...profile, courseIds, managerIds, displayNameFold: input.displayName.toLocaleLowerCase('es'),
    createdBy: previous?.createdBy || actor.id, createdAt: previous?.createdAt || iso(), updatedAt: iso() };
  await db.runTransaction(async tx => {
    const codeRef = record.studentCode ? db.doc(`loginCodes/${record.studentCode}`) : null;
    const assigned = codeRef && await tx.get(codeRef);
    if (assigned?.exists && assigned.data().uid !== uid) throw new HttpsError('already-exists', 'Ese código ya pertenece a otro alumno.');
    tx.set(db.doc(`users/${uid}`), record);
    if (codeRef) tx.set(codeRef, { uid });
    if (previous?.studentCode && previous.studentCode !== record.studentCode) tx.delete(db.doc(`loginCodes/${previous.studentCode}`));
    for (const id of previous?.courseIds || []) if (!courseIds.includes(id)) tx.set(db.doc(`enrollments/${id}_${uid}`), { uid, courseId: id, active: false, updatedAt: iso() });
    for (const id of courseIds) tx.set(db.doc(`enrollments/${id}_${uid}`), { uid, courseId: id, active: true, updatedAt: iso() });
  }); return { id: uid, ...record };
}
export const adminCreateUser = wrap(async request => {
  const actor = await actorOf(request); const input = validateUserInput(request.data || {});
  if (actor.role !== 'owner') throw new HttpsError('permission-denied', 'Solo el administrador puede crear accesos.');
  input.studentCode ||= input.role === 'student' ? 'AN-' + randomUUID().slice(0, 8).toUpperCase() : '';
  validateProvision(actor, input, await selectedCourses(input.courseIds));
  // Mantener la cuenta deshabilitada hasta que perfil y matrículas estén guardados.
  const user = await auth.createUser({ email: input.email, password: request.data.password, displayName: input.displayName, disabled: true });
  try {
    const profile = await saveProfile(actor, input, user.uid);
    await auth.setCustomUserClaims(user.uid, { role: profile.role });
    if (profile.active) await auth.updateUser(user.uid, { disabled: false });
    return profile;
  } catch (error) {
    // Cualquier perfil residual queda inactivo y la cuenta se elimina.
    await db.doc(`users/${user.uid}`).set({ active: false }, { merge: true }).catch(() => {});
    await auth.deleteUser(user.uid).catch(() => {}); throw error;
  }
});
export const adminUpdateUser = wrap(async request => {
  const actor = await actorOf(request); const target = await targetOf(actor, request.data.uid);
  const input = validateUserInput({ ...request.data, studentCode: request.data.studentCode ?? target.studentCode }, { passwordRequired: false });
  if (input.email !== target.email || input.role !== target.role) throw new HttpsError('invalid-argument', 'El correo y el rol se conservan al editar una cuenta.');
  if (input.active !== target.active) throw new HttpsError('invalid-argument', 'Usa el control de suspender/habilitar para cambiar el acceso.');
  const profile = await saveProfile(actor, input, target.id, target);
  await auth.updateUser(target.id, { displayName: input.displayName }); return profile;
});
export const adminToggleUser = wrap(async request => {
  const actor = await actorOf(request); const target = await targetOf(actor, request.data.uid);
  const active = !target.active;
  if (active) { await auth.updateUser(target.id, { disabled: false }); await db.doc(`users/${target.id}`).update({ active, updatedAt: iso() }); }
  else { await db.doc(`users/${target.id}`).update({ active, updatedAt: iso() }); await auth.updateUser(target.id, { disabled: true }); await auth.revokeRefreshTokens(target.id); }
  return { id: target.id, active };
});
export const adminRecoveryLink = wrap(async request => {
  const actor = await actorOf(request); const target = await targetOf(actor, request.data.uid);
  return { url: await auth.generatePasswordResetLink(target.email) };
});
export const saveCourse = wrap(async request => {
  const actor = await actorOf(request);
  if (!['owner', 'teacher'].includes(actor.role)) throw new HttpsError('permission-denied', 'Solo el docente puede crear cursos.');
  if (request.data.id) await courseOf(actor, request.data.id, true);
  const input = validateCourse({ ...request.data, teacherId: actor.role === 'teacher' ? actor.id : request.data.teacherId });
  const teacher = docData(await db.doc(`users/${identifier(input.teacherId)}`).get());
  if (!teacher?.active || !['owner', 'teacher'].includes(teacher.role)) throw new HttpsError('invalid-argument', 'Selecciona un docente activo.');
  const ref = request.data.id ? db.doc(`courses/${identifier(request.data.id)}`) : db.collection('courses').doc();
  if (request.data.id) {
    const existing = docData(await ref.get());
    if (['level', 'stage', 'teacherId', 'career', 'section', 'period'].some(key => (input[key] || '') !== (existing[key] || ''))) {
      const enrolled = await db.collection('enrollments').where('courseId', '==', ref.id).where('active', '==', true).limit(1).get();
      if (!enrolled.empty) throw new HttpsError('failed-precondition', 'Un curso con alumnos conserva su nivel, grado/ciclo y docente. Crea otro curso para un grupo diferente.');
    }
  }
  if (request.data.id) {
    for (const collection of ['materials', 'exams', 'sessions', 'assignments', 'announcements']) {
      const items = await ref.collection(collection).select('module').get();
      if (items.docs.some(d => !input.modules.includes(d.data().module || courseModules(input)[0]))) throw new HttpsError('failed-precondition', 'Un apartado con contenido no se puede retirar. Conserva su nombre o crea uno nuevo.');
    }
  }
  await ref.set({ ...input, updatedAt: iso(), ...(request.data.id ? {} : { createdAt: iso() }) }, { merge: true });
  return { id: ref.id, ...input };
});
const allowedMimes = new Set(FILE_MIMES);
export const saveMaterial = wrap(async request => {
  const actor = await actorOf(request); const course = await courseOf(actor, request.data.courseId, true);
  const input = validateMaterial(request.data); input.module = resolveModule(course, request.data.module);
  if (input.path) {
    if (!input.path.startsWith(`courses/${course.id}/files/`) || input.path.includes('..')) throw new HttpsError('invalid-argument', 'La ruta del archivo no corresponde al curso.');
    const [metadata] = await getStorage().bucket().file(input.path).getMetadata();
    if (!allowedMimes.has(metadata.contentType)) throw new HttpsError('invalid-argument', 'Ese tipo de archivo no está permitido.');
    input.size = Number(metadata.size); input.mimetype = metadata.contentType;
    if (input.size > (input.mimetype.startsWith('video/') ? 20 * 1024 ** 3 : 200 * 1024 ** 2)) throw new HttpsError('invalid-argument', 'El archivo supera el tamaño permitido.');
    if (input.kind === 'recording' && !input.mimetype.startsWith('video/')) throw new HttpsError('invalid-argument', 'La grabación debe ser un video MP4 o WebM.');
  }
  const ref = db.collection(`courses/${course.id}/materials`).doc();
  await ref.set({ ...input, createdAt: iso(), createdBy: actor.id }); return { id: ref.id, ...input };
});
export const deleteMaterial = wrap(async request => {
  const actor = await actorOf(request); const course = await courseOf(actor, request.data.courseId, true);
  const ref = db.doc(`courses/${course.id}/materials/${identifier(request.data.id)}`);
  const material = docData(await ref.get()); if (!material) throw new HttpsError('not-found', 'Material no encontrado.');
  await ref.delete(); if (material.path) await getStorage().bucket().file(material.path).delete({ ignoreNotFound: true });
  return { deleted: true };
});
export const materialLink = wrap(async request => {
  const actor = await actorOf(request); const course = await courseOf(actor, request.data.courseId);
  const material = docData(await db.doc(`courses/${course.id}/materials/${identifier(request.data.id)}`).get());
  if (!material) throw new HttpsError('not-found', 'Material no encontrado.');
  if (!material.path) return { url: material.url };
  const expiresInMinutes = ['video', 'recording'].includes(material.kind) ? 480 : 15;
  const [url] = await getStorage().bucket().file(material.path).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + expiresInMinutes * 60000 });
  return { url, expiresInMinutes };
});
export const saveExam = wrap(async request => {
  const actor = await actorOf(request); const course = await courseOf(actor, request.data.courseId, true);
  const input = validateExam(request.data); input.module = resolveModule(course, request.data.module);
  if (input.document) {
    if (!input.document.path.startsWith(`courses/${course.id}/files/`)) throw new HttpsError('invalid-argument', 'El PDF no corresponde al curso.');
    const [metadata] = await getStorage().bucket().file(input.document.path).getMetadata();
    if (metadata.contentType !== 'application/pdf' || Number(metadata.size) > 20 * 1024 ** 2 || Number(metadata.size) <= 0) throw new HttpsError('invalid-argument', 'Adjunta un PDF de hasta 20 MB.');
    input.document.size = Number(metadata.size);
  }
  const { publicExam, keys } = splitExam(input);
  const ref = request.data.id ? db.doc(`courses/${course.id}/exams/${identifier(request.data.id)}`) : db.collection(`courses/${course.id}/exams`).doc();
  if (request.data.id && !(await ref.get()).exists) throw new HttpsError('not-found', 'Examen no encontrado.');
  const batch = db.batch(); batch.set(ref, { ...publicExam, createdAt: iso(), updatedBy: actor.id });
  batch.set(db.doc(`examKeys/${ref.id}`), { courseId: course.id, keys }); await batch.commit();
  return { id: ref.id, courseId: course.id, ...publicExam };
});
export const examForEditor = wrap(async request => {
  const actor = await actorOf(request); const course = await courseOf(actor, request.data.courseId, true);
  const id = identifier(request.data.id);
  const [exam, keys] = await Promise.all([db.doc(`courses/${course.id}/exams/${id}`).get(), db.doc(`examKeys/${id}`).get()]);
  if (!exam.exists || !keys.exists) throw new HttpsError('not-found', 'Examen no encontrado.');
  return { ...exam.data(), id, questions: exam.data().questions.map(q => ({ ...q, correct: keys.data().keys[q.id] })) };
});
export const startExam = wrap(async request => {
  const actor = await actorOf(request); const course = await courseOf(actor, request.data.courseId);
  if (actor.role !== 'student') throw new HttpsError('permission-denied', 'El examen se rinde desde una cuenta de alumno.');
  const examId = identifier(request.data.examId); const ref = db.doc(`attempts/${actor.id}_${examId}`); const serverNow = Date.now();
  const attempt = await db.runTransaction(async tx => {
    const [old, examSnapshot, keys] = await Promise.all([tx.get(ref), tx.get(db.doc(`courses/${course.id}/exams/${examId}`)), tx.get(db.doc(`examKeys/${examId}`))]);
    if (old.exists) {
      if (old.data().courseId !== course.id) throw new HttpsError('permission-denied', 'El intento no corresponde al curso.');
      return { id: ref.id, ...old.data() };
    }
    const exam = docData(examSnapshot);
    if (!exam || !keys.exists || keys.data().courseId !== course.id || !examAvailable(exam, serverNow)) throw new HttpsError('failed-precondition', 'El examen no está disponible en este momento.');
    const a = { uid: actor.id, displayName: actor.displayName, courseId: course.id, examId, module: exam.module, title: exam.title,
      questions: exam.questions, document: exam.document || null, answers: {}, status: 'in-progress', startedAt: serverNow, deadlineAt: deadlineFor(exam, serverNow) };
    tx.set(ref, a); tx.set(db.doc(`attemptKeys/${ref.id}`), { keys: keys.data().keys }); return { id: ref.id, ...a };
  }); return { attempt, serverNow };
});
async function checkAttempt(actor, attemptId) {
  const ref = db.doc(`attempts/${identifier(attemptId)}`); const a = docData(await ref.get());
  if (!a || a.uid !== actor.id || actor.role !== 'student') throw new HttpsError('permission-denied', 'No puedes responder este examen.');
  await courseOf(actor, a.courseId); return ref;
}
export const examDocumentLink = wrap(async request => {
  const actor = await actorOf(request);
  const ref = await checkAttempt(actor, request.data.attemptId);
  const attempt = (await ref.get()).data();
  const expires = Math.min(attempt.deadlineAt, Date.now() + 5 * 60000);
  if (attempt.status !== 'in-progress' || expires <= Date.now() || !attempt.document) throw new HttpsError('permission-denied', 'El PDF solo está disponible durante el examen.');
  if (!attempt.document.path.startsWith(`courses/${attempt.courseId}/files/`) || attempt.document.path.includes('..')) throw new HttpsError('permission-denied', 'Documento no válido.');
  const [url] = await getStorage().bucket().file(attempt.document.path).getSignedUrl({ version: 'v4', action: 'read', expires });
  return { url, watermark: `${actor.displayName} · ${actor.studentCode || actor.id}`, expiresAt: expires };
});
export const saveAnswers = wrap(async request => {
  const actor = await actorOf(request); const ref = await checkAttempt(actor, request.data.attemptId);
  return db.runTransaction(async tx => {
    const a = (await tx.get(ref)).data();
    if (a.status !== 'in-progress' || Date.now() >= a.deadlineAt) throw new HttpsError('deadline-exceeded', 'El tiempo para responder terminó.');
    tx.update(ref, { answers: { ...a.answers, ...sanitizeAnswers(a.questions, request.data.answers) } }); return { saved: true };
  });
});
export const submitExam = wrap(async request => {
  const actor = await actorOf(request); const ref = await checkAttempt(actor, request.data.attemptId);
  return db.runTransaction(async tx => {
    const [snapshot, keys] = await Promise.all([tx.get(ref), tx.get(db.doc(`attemptKeys/${ref.id}`))]);
    const a = snapshot.data(); if (a.status === 'graded') return { id: ref.id, ...a };
    if (!keys.exists) throw new HttpsError('failed-precondition', 'La clave de este intento no está disponible.');
    const now = Date.now();
    // Tras el cierre se califican únicamente las respuestas guardadas a tiempo.
    const answers = now < a.deadlineAt ? { ...a.answers, ...sanitizeAnswers(a.questions, request.data.answers) } : a.answers;
    const graded = { ...a, ...gradeExam(a.questions, keys.data().keys, answers), answers, status: 'graded', submittedAt: now };
    tx.set(ref, graded); return { id: ref.id, ...graded };
  });
});
export const saveSession = wrap(async request => {
  const actor = await actorOf(request); const course = await courseOf(actor, request.data.courseId, true);
  const input = validateSession(request.data); input.module = resolveModule(course, request.data.module);
  const ref = request.data.id ? db.doc(`courses/${course.id}/sessions/${identifier(request.data.id)}`) : db.collection(`courses/${course.id}/sessions`).doc();
  if (request.data.id && !(await ref.get()).exists) throw new HttpsError('not-found', 'Clase no encontrada.');
  await ref.set({ ...input, createdAt: iso(), createdBy: actor.id }); return { id: ref.id, courseId: course.id, ...input };
});
export const deleteSession = wrap(async request => {
  const actor = await actorOf(request), course = await courseOf(actor, request.data.courseId, true);
  await db.doc(`courses/${course.id}/sessions/${identifier(request.data.id)}`).delete(); return { deleted: true };
});
export const saveAssignment = wrap(async request => {
  const actor = await actorOf(request), course = await courseOf(actor, request.data.courseId, true), input = validateAssignment(request.data);
  input.module = resolveModule(course, request.data.module);
  const ref = request.data.id ? db.doc(`courses/${course.id}/assignments/${identifier(request.data.id)}`) : db.collection(`courses/${course.id}/assignments`).doc();
  const old = request.data.id && docData(await ref.get());
  if (request.data.id && !old) throw new HttpsError('not-found', 'Trabajo no encontrado.');
  const record = { ...input, createdAt: old?.createdAt || iso(), updatedAt: iso(), updatedBy: actor.id };
  await ref.set(record); return { id: ref.id, courseId: course.id, ...record };
});
export const submitAssignment = wrap(async request => {
  const actor = await actorOf(request), course = await courseOf(actor, request.data.courseId);
  if (actor.role !== 'student') throw new HttpsError('permission-denied', 'Solo los alumnos pueden entregar trabajos.');
  const assignmentId = identifier(request.data.assignmentId), input = validateSubmission(request.data);
  if (input.path) {
    if (!input.path.startsWith(`submissions/${course.id}/${assignmentId}/${actor.id}/`) || input.path.includes('..')) throw new HttpsError('permission-denied', 'El archivo no corresponde a esta entrega.');
    const [metadata] = await getStorage().bucket().file(input.path).getMetadata();
    if (!allowedMimes.has(metadata.contentType) || Number(metadata.size) > 50 * 1024 ** 2) throw new HttpsError('invalid-argument', 'El archivo no es válido o supera 50 MB.');
    input.size = Number(metadata.size); input.mimetype = metadata.contentType;
  }
  const ref = db.doc(`submissions/${actor.id}_${assignmentId}`), now = Date.now();
  return db.runTransaction(async tx => {
    const [assignmentDoc, old] = await Promise.all([tx.get(db.doc(`courses/${course.id}/assignments/${assignmentId}`)), tx.get(ref)]);
    const a = docData(assignmentDoc);
    if (!a?.published) throw new HttpsError('permission-denied', 'El trabajo no está publicado.');
    if (a.dueAt && now > Date.parse(a.dueAt) && !a.allowLate) throw new HttpsError('deadline-exceeded', 'El plazo de entrega terminó.');
    if (old.exists && old.data().status === 'graded') throw new HttpsError('failed-precondition', 'El trabajo ya está calificado. El docente puede habilitar una nueva entrega.');
    const record = { ...input, uid: actor.id, displayName: actor.displayName, courseId: course.id, assignmentId, title: a.title, module: a.module, status: 'submitted', submittedAt: now, revision: (old.data()?.revision || 0) + 1, late: !!a.dueAt && now > Date.parse(a.dueAt) };
    tx.set(ref, record); return { id: ref.id, ...record };
  });
});
export const gradeSubmission = wrap(async request => {
  const actor = await actorOf(request), ref = db.doc(`submissions/${identifier(request.data.id)}`), input = validateFeedback(request.data);
  const s = docData(await ref.get());
  if (!s) throw new HttpsError('not-found', 'Entrega no encontrada.'); await courseOf(actor, s.courseId, true);
  return db.runTransaction(async tx => {
    const current = docData(await tx.get(ref));
    if (request.data.revision !== current.revision) throw new HttpsError('failed-precondition', 'El alumno actualizó su entrega. Vuelve a abrirla antes de calificar.');
    const update = { ...input, status: 'graded', gradedAt: Date.now(), gradedBy: actor.id };
    tx.update(ref, update); return { ...current, ...update };
  });
});
export const returnSubmission = wrap(async request => {
  const actor = await actorOf(request), ref = db.doc(`submissions/${identifier(request.data.id)}`);
  const s = docData(await ref.get());
  if (!s) throw new HttpsError('not-found', 'Entrega no encontrada.'); await courseOf(actor, s.courseId, true);
  await ref.update({ status: 'returned', score20: null }); return { returned: true };
});
export const submissionLink = wrap(async request => {
  const actor = await actorOf(request), s = docData(await db.doc(`submissions/${identifier(request.data.id)}`).get());
  if (!s) throw new HttpsError('not-found', 'Entrega no encontrada.');
  const course = await courseOf(actor, s.courseId);
  if (s.uid !== actor.id && !canManageCourse(actor, course)) throw new HttpsError('permission-denied', 'No puedes leer esta entrega.');
  if (!s.path) throw new HttpsError('not-found', 'La entrega no tiene archivo adjunto.');
  const [url] = await getStorage().bucket().file(s.path).getSignedUrl({ version: 'v4', action: 'read', expires: Date.now() + 15 * 60000 });
  return { url };
});
export const saveAnnouncement = wrap(async request => {
  const actor = await actorOf(request), course = await courseOf(actor, request.data.courseId, true), input = validateAnnouncement(request.data);
  input.module = resolveModule(course, request.data.module);
  const ref = request.data.id ? db.doc(`courses/${course.id}/announcements/${identifier(request.data.id)}`) : db.collection(`courses/${course.id}/announcements`).doc();
  const old = request.data.id && docData(await ref.get());
  if (request.data.id && !old) throw new HttpsError('not-found', 'Aviso no encontrado.');
  await ref.set({ ...input, createdAt: old?.createdAt || iso(), updatedAt: iso(), updatedBy: actor.id }); return { id: ref.id, ...input };
});
export const deleteAnnouncement = wrap(async request => {
  const actor = await actorOf(request), course = await courseOf(actor, request.data.courseId, true);
  await db.doc(`courses/${course.id}/announcements/${identifier(request.data.id)}`).delete(); return { deleted: true };
});
// La contraseña la verifica Firebase Auth; el índice de códigos nunca se expone al cliente.
const webApiKey = defineString('AULANEXO_WEB_API_KEY', { default: '' });
export const loginWithStudentCode = wrap(async request => {
  const code = normalizeCode(request.data?.code), password = String(request.data?.password || '');
  const invalid = () => new HttpsError('unauthenticated', 'El código/correo o la contraseña no son correctos.');
  if (!/^[A-Z0-9][A-Z0-9_-]{3,31}$/.test(code) || password.length > 128 || !password) throw invalid();
  const now = Date.now(), window = Math.floor(now / 900000);
  const fingerprint = createHash('sha256').update(String(request.rawRequest?.ip || 'unknown') + '\n' + code).digest('hex');
  const rateRef = db.doc(`loginRateLimits/${fingerprint}_${window}`);
  await db.runTransaction(async tx => {
    const rate = (await tx.get(rateRef)).data()?.count || 0;
    if (rate >= 10) throw new HttpsError('resource-exhausted', 'Demasiados intentos. Espera unos minutos antes de volver a ingresar.');
    tx.set(rateRef, { count: rate + 1, expiresAt: new Date((window + 2) * 900000) });
  });
  const entry = docData(await db.doc(`loginCodes/${code}`).get());
  const profile = entry && docData(await db.doc(`users/${entry.uid}`).get());
  if (!profile?.active || profile.studentCode !== code) throw invalid();
  const emulator = process.env.FIREBASE_AUTH_EMULATOR_HOST;
  const apiKey = emulator ? 'demo-api-key' : webApiKey.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'Falta configurar el acceso por código en el proyecto de Firebase. Puedes ingresar con tu correo.');
  const endpoint = emulator ? `http://${emulator}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword` : 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword';
  const response = await fetch(endpoint + '?key=' + encodeURIComponent(apiKey), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: profile.email, password, returnSecureToken: true }), signal: AbortSignal.timeout(10000) });
  const result = await response.json();
  if (!response.ok || result.localId !== profile.id) throw invalid();
  const user = await auth.getUser(profile.id);
  if (user.disabled) throw invalid();
  return { token: await auth.createCustomToken(profile.id) };
});
