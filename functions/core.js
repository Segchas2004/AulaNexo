export const LEVELS = { secondary: 'Secundaria', university: 'Universidad', independent: 'Curso independiente' };
export const ROLES = { owner: 'Administrador', teacher: 'Docente', student: 'Alumno' };
export const COLORS = ['copper', 'sage', 'indigo', 'rose', 'ochre'];
export const FILE_MIMES = ['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'audio/mpeg', 'audio/mp4',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
export function fileMetadata(file, maxBytes) {
  const types = { pdf:FILE_MIMES[0], txt:FILE_MIMES[1], png:FILE_MIMES[2], jpg:FILE_MIMES[3], jpeg:FILE_MIMES[3], webp:FILE_MIMES[4], mp4:FILE_MIMES[5], webm:FILE_MIMES[6], mp3:FILE_MIMES[7], m4a:FILE_MIMES[8], docx:FILE_MIMES[9], pptx:FILE_MIMES[10], xlsx:FILE_MIMES[11] };
  const mimetype = file.type || types[String(file.name || '').split('.').at(-1).toLowerCase()];
  if (!FILE_MIMES.includes(mimetype)) throw new AppError('Tipo de archivo no permitido. Usa PDF, documentos de Office, imágenes, MP4/WebM o audio MP3/M4A.');
  const max = maxBytes ?? (mimetype.startsWith('video/') ? 20 * 1024 ** 3 : 200 * 1024 ** 2);
  if (!file.size || file.size > max) throw new AppError('El archivo está vacío o supera el tamaño permitido.');
  return { filename:String(file.name || 'archivo').slice(0,180), size:file.size, mimetype };
}
export class AppError extends Error {
  constructor(message, code = 'invalid-argument') { super(message); this.code = code; }
}
export const clone = value => structuredClone(value);
export const uid = prefix => `${prefix}-${crypto.randomUUID()}`;
export const normalizeEmail = value => String(value || '').trim().toLowerCase();
export const normalizeCode = value => String(value || '').trim().toUpperCase();
export const academicFields = input => Object.fromEntries(['career', 'section', 'period'].map(key => [key, String(input[key] || '').trim().slice(0, 80)]));
export function courseModules(course) {
  return course.modules?.length ? course.modules : course.level === 'secondary' ? ['Semestre I', 'Semestre II'] : course.level === 'university' ? ['Unidad 1', 'Unidad 2', 'Unidad 3', 'Unidad 4'] : ['Módulo 1', 'Módulo 2'];
}
export function resolveModule(course, value) {
  const module = String(value || courseModules(course)[0]).trim();
  if (!courseModules(course).includes(module)) throw new AppError('Selecciona un apartado del curso.');
  return module;
}
export function academicDate(value) {
  if (!value) return null;
  const text = String(value);
  const date = new Date(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text) ? text + ':00-05:00' : text);
  if (!Number.isFinite(date.getTime())) throw new AppError('Selecciona una fecha válida.');
  return date.toISOString();
}
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export function requireActive(actor) {
  if (!actor || !actor.active) throw new AppError('Tu cuenta no tiene acceso. Contacta al docente.', 'permission-denied');
}
export function canManageCourse(actor, course) {
  return !!actor?.active && (actor.role === 'owner' || (actor.role === 'teacher' && course?.teacherId === actor.id));
}
export function canEnroll(profile, course) {
  return profile?.role === 'student' && (course.level === 'independent' ||
    (profile.level === course.level && (!course.stage || profile.stage === course.stage))) &&
    ['career', 'section', 'period'].every(key => !course[key] || String(profile[key] || '').trim().toLocaleLowerCase('es') === String(course[key]).trim().toLocaleLowerCase('es'));
}
export function canReadCourse(actor, course, enrollments = []) {
  if (!actor?.active || !course) return false;
  if (canManageCourse(actor, course)) return true;
  return actor.role === 'student' && course.published && enrollments.some(e => e.uid === actor.id && e.courseId === course.id && e.active);
}
export function canManageUser(actor, target, courses, enrollments) {
  if (!actor?.active || !target || target.role === 'owner') return false;
  if (actor.role === 'owner') return true;
  return actor.role === 'teacher' && target.role === 'student' && (target.createdBy === actor.id ||
    enrollments.some(e => e.uid === target.id && e.active && courses.some(c => c.id === e.courseId && c.teacherId === actor.id)));
}
export function validateUserInput(input, { passwordRequired = true } = {}) {
  const displayName = String(input.displayName || '').trim();
  const email = normalizeEmail(input.email);
  const role = input.role;
  const level = input.level || 'secondary';
  const stage = String(input.stage || '').trim();
  const studentCode = normalizeCode(input.studentCode);
  if (studentCode && !/^[A-Z0-9][A-Z0-9_-]{3,31}$/.test(studentCode)) throw new AppError('El código debe tener de 4 a 32 letras, números, guiones o guiones bajos.');
  if (displayName.length < 2 || displayName.length > 100) throw new AppError('Escribe un nombre entre 2 y 100 caracteres.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new AppError('Escribe un correo válido.');
  if (!['student', 'teacher'].includes(role)) throw new AppError('Selecciona un rol permitido.');
  if (!Object.hasOwn(LEVELS, level)) throw new AppError('Selecciona un nivel válido.');
  const password = String(input.password || '');
  if (passwordRequired && (password.length < 10 || password.length > 128)) throw new AppError('La contraseña debe tener entre 10 y 128 caracteres.');
  return { displayName, email, role, level, stage, studentCode, ...academicFields(input), active: input.active !== false, courseIds: [...new Set(input.courseIds || [])] };
}
export function validateProvision(actor, input, courses) {
  requireActive(actor);
  if (!['owner', 'teacher'].includes(actor.role)) throw new AppError('Solo un administrador o docente puede crear usuarios.', 'permission-denied');
  if (actor.role === 'teacher' && input.role !== 'student') throw new AppError('Un docente puede crear alumnos de sus cursos.', 'permission-denied');
  if (input.role !== 'student' && input.courseIds.length) throw new AppError('Las matrículas se asignan a alumnos. Asigna el docente desde el curso.');
  if (input.courseIds.length > 40) throw new AppError('Selecciona como máximo 40 cursos.');
  for (const id of input.courseIds) {
    const course = courses.find(c => c.id === id);
    if (!course || !canManageCourse(actor, course)) throw new AppError('No puedes asignar ese curso.', 'permission-denied');
    if (!canEnroll(input, course)) throw new AppError(`El nivel, grado/ciclo o grupo académico no corresponde a ${course.title}.`);
  }
}
export function validateCourse(input) {
  const title = String(input.title || '').trim();
  const description = String(input.description || '').trim();
  if (title.length < 3 || title.length > 120) throw new AppError('El curso necesita un título entre 3 y 120 caracteres.');
  if (description.length > 1500) throw new AppError('La descripción debe tener como máximo 1.500 caracteres.');
  if (!Object.hasOwn(LEVELS, input.level)) throw new AppError('Selecciona un nivel válido.');
  const modules = input.modules == null ? courseModules(input) : (Array.isArray(input.modules) ? input.modules : String(input.modules).split('\n')).map(m => String(m).trim()).filter(Boolean);
  if (!modules.length || modules.length > 30 || modules.some(m => m.length > 80) || new Set(modules).size !== modules.length) throw new AppError('Define de 1 a 30 apartados distintos, de hasta 80 caracteres cada uno.');
  return { title, description, level: input.level, stage: String(input.stage || '').trim().slice(0, 40),
    teacherId: String(input.teacherId || ''), modules, ...academicFields(input), color: COLORS.includes(input.color) ? input.color : 'copper', published: !!input.published };
}
export function safeURL(value) {
  try { const url = new URL(String(value)); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function validateMaterial(input) {
  const title = String(input.title || '').trim();
  if (title.length < 2 || title.length > 140) throw new AppError('Escribe un título entre 2 y 140 caracteres.');
  if (!['document', 'video', 'link', 'recording'].includes(input.kind)) throw new AppError('Tipo de material no válido.');
  if (!input.path && !safeURL(input.url)) throw new AppError('Sube un archivo o escribe un enlace http/https válido.');
  return { title, kind: input.kind, module: String(input.module || 'General').trim().slice(0, 80),
    description: String(input.description || '').slice(0, 1000), path: input.path || null,
    url: input.path ? null : safeURL(input.url), filename: input.filename || null,
    size: Number(input.size || 0), mimetype: input.mimetype || null };
}
export function validateExam(input) {
  const title = String(input.title || '').trim();
  const minutes = Number(input.minutes);
  if (title.length < 3 || title.length > 140) throw new AppError('Escribe un título para el examen (3 a 140 caracteres).');
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 180) throw new AppError('La duración debe ser entre 1 y 180 minutos.');
  if (!Array.isArray(input.questions) || input.questions.length < 1 || input.questions.length > 60) throw new AppError('Añade entre 1 y 60 preguntas.');
  const questions = input.questions.map((q, i) => {
    const prompt = String(q.prompt || '').trim();
    const options = (q.options || []).map(o => String(o || '').trim());
    const points = Number(q.points || 1);
    const correct = q.correct;
    if (!prompt || prompt.length > 1000 || options.length < 2 || options.length > 6 || options.some(o => !o || o.length > 500)) throw new AppError(`Completa el enunciado y las alternativas de la pregunta ${i + 1}.`);
    if (!Number.isInteger(correct) || correct < 0 || correct >= options.length) throw new AppError(`Selecciona la respuesta correcta de la pregunta ${i + 1}.`);
    if (!Number.isInteger(points) || points < 1 || points > 20) throw new AppError('Cada pregunta debe valer de 1 a 20 puntos.');
    return { id: `q${i + 1}`, prompt, options, points, correct };
  });
  const dateValue = value => {
    if (!value) return null;
    const d = new Date(academicDate(value));
    if (!Number.isFinite(d.getTime())) throw new AppError('La fecha del examen no es válida.');
    return d.toISOString();
  };
  const opensAt = dateValue(input.opensAt);
  const closesAt = dateValue(input.closesAt);
  if (opensAt && closesAt && opensAt >= closesAt) throw new AppError('El cierre debe ser posterior a la apertura.');
  let document = null;
  if (input.document) {
    const d = input.document;
    if (typeof d.path !== 'string' || d.path.includes('..') || d.path.length > 500 || d.mimetype !== 'application/pdf' || !Number.isFinite(d.size) || d.size <= 0 || d.size > 20 * 1024 ** 2) throw new AppError('Adjunta un PDF válido de hasta 20 MB.');
    document = { path: d.path, filename: String(d.filename || 'Examen.pdf').slice(0,150), mimetype: 'application/pdf', size: d.size };
  }
  return { title, module: String(input.module || '').slice(0, 80), minutes, published: !!input.published, opensAt, closesAt, questions, document };
}
export function splitExam(exam) {
  const { questions, ...rest } = exam;
  return { publicExam: { ...rest, questions: questions.map(({ correct, ...q }) => q), totalPoints: questions.reduce((s, q) => s + q.points, 0) },
    keys: Object.fromEntries(questions.map(q => [q.id, q.correct])) };
}
export function sanitizeAnswers(questions, answers) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) throw new AppError('Respuestas no válidas.');
  const valid = {};
  for (const q of questions) {
    if (answers[q.id] === undefined || answers[q.id] === null) continue;
    const value = answers[q.id];
    if (!Number.isInteger(value) || value < 0 || value >= q.options.length) throw new AppError('Una alternativa no es válida.');
    valid[q.id] = value;
  }
  return valid;
}
export function gradeExam(questions, keys, answers) {
  const clean = sanitizeAnswers(questions, answers);
  let earned = 0, total = 0, correct = 0;
  for (const q of questions) {
    if (!Number.isInteger(keys[q.id]) || keys[q.id] < 0 || keys[q.id] >= q.options.length) throw new AppError('La clave del examen no es válida.', 'failed-precondition');
    total += q.points; if (clean[q.id] === keys[q.id]) { earned += q.points; correct++; }
  }
  if (total <= 0) throw new AppError('El examen no tiene puntuación válida.', 'failed-precondition');
  return { score20: Math.round((earned / total) * 2000) / 100, earned, total, correct, questionCount: questions.length };
}
export function examAvailable(exam, now = Date.now()) {
  return exam.published && (!exam.opensAt || now >= Date.parse(exam.opensAt)) && (!exam.closesAt || now < Date.parse(exam.closesAt));
}
export function deadlineFor(exam, now) {
  return Math.min(now + exam.minutes * 60000, exam.closesAt ? Date.parse(exam.closesAt) : Infinity);
}
export function validateSession(input) {
  const title = String(input.title || '').trim();
  const meetingUrl = safeURL(input.meetingUrl);
  if (title.length < 3 || title.length > 140 || !meetingUrl || new URL(meetingUrl).protocol !== 'https:') throw new AppError('Escribe un título y un enlace HTTPS válido para la clase.');
  if (input.mode === 'integrated') throw new AppError('Programa la clase con un enlace externo y sube la grabación después.');
  const startsAt = academicDate(input.startsAt);
  if (!startsAt) throw new AppError('Selecciona una fecha válida para la clase.');
  const minutes = Number(input.minutes || 90);
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > 480) throw new AppError('La clase debe durar entre 15 y 480 minutos.');
  return { title, meetingUrl, startsAt, minutes, module: String(input.module || '').slice(0, 80), endsAt: new Date(Date.parse(startsAt) + minutes * 60000).toISOString(), mode: 'external',
    provider: new URL(meetingUrl).hostname === 'meet.google.com' ? 'Google Meet' : 'Videoconferencia' };
}
export function validateAssignment(input) {
  const title = String(input.title || '').trim(), instructions = String(input.instructions || '').trim();
  if (title.length < 3 || title.length > 140 || instructions.length < 3 || instructions.length > 6000) throw new AppError('Escribe un título (3–140 caracteres) y las indicaciones (3–6.000 caracteres).');
  return { title, instructions, module: String(input.module || '').slice(0, 80), dueAt: academicDate(input.dueAt), allowLate: !!input.allowLate, published: !!input.published };
}
export function validateSubmission(input) {
  const text = String(input.text || '').trim();
  if (text.length > 12000 || (!text && !input.path)) throw new AppError('Escribe tu respuesta (hasta 12.000 caracteres) o adjunta un archivo.');
  return { text, path: input.path || null, filename: String(input.filename || '').slice(0, 180), size: Number(input.size || 0), mimetype: input.mimetype || null };
}
export function validateFeedback(input) {
  const score20 = Number(input.score20), feedback = String(input.feedback || '').trim();
  if (input.score20 === '' || input.score20 == null || !Number.isFinite(score20) || score20 < 0 || score20 > 20 || feedback.length > 6000) throw new AppError('Indica una nota entre 0 y 20 y un comentario de hasta 6.000 caracteres.');
  return { score20: Math.round(score20 * 100) / 100, feedback };
}
export function validateAnnouncement(input) {
  const title = String(input.title || '').trim(), text = String(input.text || '').trim();
  if (title.length < 3 || title.length > 140 || text.length < 3 || text.length > 6000) throw new AppError('Completa el título y el mensaje del aviso.');
  return { title, text, module: String(input.module || '').slice(0, 80), pinned: !!input.pinned };
}
