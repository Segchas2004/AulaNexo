import { AppError, clone, uid, normalizeEmail, canManageCourse, canReadCourse, canManageUser, validateUserInput, validateProvision,
  validateCourse, validateMaterial, validateExam, splitExam, sanitizeAnswers, gradeExam, examAvailable, deadlineFor, validateSession, requireActive, normalizeCode, courseModules, resolveModule, validateAssignment, validateSubmission, validateFeedback, validateAnnouncement, canEnroll, fileMetadata } from './core.js';

export const DEMO_PASSWORD = 'AulaDemo2026!';
const STORE = 'aulanexo-demo-v1';
const SESSION = 'aulanexo-session-v1';
const bytesToHex = bytes => [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100000 }, key, 256);
  return bytesToHex(new Uint8Array(bits));
}
async function credential(password) {
  const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  return { salt, hash: await hashPassword(password, salt) };
}
function baseSeed() {
  const now = new Date().toISOString();
  const users = [
    { id: 'owner-demo', displayName: 'Administrador', email: 'admin@aulanexo.example', role: 'owner', level: 'independent', stage: '', active: true },
    { id: 'teacher-demo', displayName: 'Docente principal', email: 'docente@aulanexo.example', role: 'teacher', level: 'independent', stage: '', active: true },
    { id: 'student-secondary', displayName: 'Valeria Ruiz', email: 'secundaria@aulanexo.example', role: 'student', level: 'secondary', stage: '3', active: true },
    { id: 'student-university', displayName: 'Diego Torres', email: 'universidad@aulanexo.example', role: 'student', level: 'university', stage: '4', active: true },
    { id: 'student-independent', displayName: 'Camila Flores', email: 'curso@aulanexo.example', role: 'student', level: 'independent', stage: '', active: true },
  ].map(u => ({ ...u, createdAt: now, createdBy: 'owner-demo' }));
  const courses = [
    { id: 'math-3', title: 'Matemática', description: 'Álgebra, ecuaciones y una nueva forma de resolver problemas.', level: 'secondary', stage: '3', teacherId: 'teacher-demo', color: 'copper', published: true },
    { id: 'language-3', title: 'Comunicación', description: 'Lectura crítica, expresión escrita y argumentos que comunican.', level: 'secondary', stage: '3', teacherId: 'teacher-demo', color: 'sage', published: true },
    { id: 'programming-4', title: 'Programación', description: 'Del primer algoritmo a soluciones que funcionan.', level: 'university', stage: '4', teacherId: 'teacher-demo', color: 'indigo', published: true },
    { id: 'calculus-4', title: 'Cálculo integral', description: 'Explora integrales, áreas y aplicaciones paso a paso.', level: 'university', stage: '4', teacherId: 'teacher-demo', color: 'ochre', published: true },
    { id: 'digital', title: 'Herramientas digitales', description: 'Organiza tu trabajo y aprende a usar herramientas para tu día a día.', level: 'independent', stage: '', teacherId: 'teacher-demo', color: 'rose', published: true },
  ].map(c => ({ ...c, createdAt: now }));
  const enrollments = [
    ['math-3', 'student-secondary'], ['language-3', 'student-secondary'],
    ['programming-4', 'student-university'], ['calculus-4', 'student-university'], ['digital', 'student-independent'],
  ].map(([courseId, student]) => ({ id: `${courseId}_${student}`, uid: student, courseId, active: true }));
  const materials = [
    { id: 'sample-math', courseId: 'math-3', title: 'Guía de ecuaciones de primer grado', kind: 'document', module: 'Semestre I', path: null, url: null, sample: 'assets/guia-algebra.txt', filename: 'guia-algebra.txt', size: 800 },
    { id: 'sample-code', courseId: 'programming-4', title: 'Algoritmos y pensamiento lógico', kind: 'document', module: 'Unidad 1', path: null, url: null, sample: 'assets/guia-programacion.txt', filename: 'guia-programacion.txt', size: 800 },
  ].map(m => ({ ...m, description: 'Material de ejemplo para explorar el aula.', createdAt: now }));
  const exams = [], examKeys = {};
  const definitions = [
    { courseId: 'math-3', id: 'exam-math', title: 'Diagnóstico de álgebra', questions: [
      { prompt: 'Si 2x + 4 = 10, ¿cuánto vale x?', options: ['2', '3', '4', '5'], correct: 1, points: 1 },
      { prompt: '¿Cuál es el resultado de 3² + 1?', options: ['7', '9', '10', '12'], correct: 2, points: 1 },
      { prompt: '¿Qué expresión equivale a 2(a + b)?', options: ['2a + b', 'a + 2b', '2a + 2b', 'a + b + 2'], correct: 2, points: 1 },
    ] },
    { courseId: 'programming-4', id: 'exam-code', title: 'Conceptos de programación', questions: [
      { prompt: '¿Qué estructura repite instrucciones mientras se cumple una condición?', options: ['Variable', 'Bucle', 'Constante', 'Comentario'], correct: 1, points: 1 },
      { prompt: '¿Qué operador representa la igualdad estricta en JavaScript?', options: ['=', '==', '===', '!='], correct: 2, points: 1 },
    ] },
  ];
  for (const d of definitions) {
    const { publicExam, keys } = splitExam(validateExam({ ...d, minutes: 30, published: true }));
    exams.push({ ...publicExam, id: d.id, courseId: d.courseId, createdAt: now }); examKeys[d.id] = keys;
  }
  return { users, courses, enrollments, materials, exams, examKeys, sessions: [], attempts: [], attemptKeys: {}, credentials: {} };
}
export class DemoAdapter {
  constructor(storage = globalThis.localStorage, session = globalThis.sessionStorage, clock = () => Date.now()) {
    this.storage = storage; this.session = session; this.clock = clock; this.mode = 'demo';
  }
  async init() {
    const saved = this.storage.getItem(STORE);
    this.state = saved ? JSON.parse(saved) : baseSeed();
    for (const c of this.state.courses) c.modules = courseModules(c);
    for (const [i, u] of this.state.users.entries()) u.studentCode ||= u.role === 'student' ? ['SEC-003', 'UNI-004', 'CUR-001'][i - 2] || 'AN-' + u.id.slice(-8).toUpperCase() : '';
    for (const key of ['materials', 'exams', 'sessions']) for (const item of this.state[key]) {
      const c = this.state.courses.find(c => c.id === item.courseId);
      if (c && !c.modules.includes(item.module)) item.module = c.modules[0];
    }
    this.state.sessions = this.state.sessions.filter(s => s.mode !== 'integrated');
    this.state.materials = this.state.materials.filter(m => !m.demoRecording);
    const dueAt = new Date(this.clock() + 7 * 86400000).toISOString();
    this.state.assignments ||= [
      { id: 'task-math', courseId: 'math-3', title: 'Resolvemos ecuaciones', instructions: 'Resuelve tres ecuaciones de la guía y explica cada paso. Puedes escribir tu respuesta o adjuntar un documento.', module: 'Semestre I', published: true, allowLate: true, dueAt },
      { id: 'task-code', courseId: 'programming-4', title: 'Mi primer algoritmo', instructions: 'Describe un algoritmo para calcular el promedio de tres notas. Incluye las entradas, el proceso y la salida.', module: 'Unidad 1', published: true, allowLate: true, dueAt },
    ].map(a => ({ ...a, createdAt: new Date(this.clock()).toISOString() }));
    this.state.submissions ||= [];
    this.state.announcements ||= [
      { id: 'welcome-math', courseId: 'math-3', module: 'Semestre I', title: 'Bienvenidos al semestre', text: 'Empieza por la guía de álgebra, entrega tu trabajo y practica con el diagnóstico. El enlace de Meet y las grabaciones se publicarán en este mismo apartado.', pinned: true, createdAt: new Date(this.clock()).toISOString() },
      { id: 'welcome-code', courseId: 'programming-4', module: 'Unidad 1', title: 'Empezamos con pensamiento lógico', text: 'En cada unidad encontrarás materiales, clases de Meet, trabajos y evaluaciones. Consulta este espacio para conocer las novedades del curso.', pinned: true, createdAt: new Date(this.clock()).toISOString() },
    ];
    if (!saved) {
      const demoCredential = await credential(DEMO_PASSWORD);
      for (const user of this.state.users) this.state.credentials[user.id] = clone(demoCredential);
      this.persist();
    }
    if (this.state.users.find(u => u.id === this.session.getItem(SESSION))?.active === false) this.session.removeItem(SESSION);
    this.persist(); return this;
  }
  persist() { this.storage.setItem(STORE, JSON.stringify(this.state)); }
  get currentUser() { return clone(this.state.users.find(u => u.id === this.session.getItem(SESSION)) || null); }
  actor() { const actor = this.currentUser; requireActive(actor); return actor; }
  async signIn(email, password) {
    const user = this.state.users.find(u => u.email === normalizeEmail(email) || u.studentCode && u.studentCode === normalizeCode(email));
    const c = user && this.state.credentials[user.id];
    if (!c || await hashPassword(password, c.salt) !== c.hash) throw new AppError('El código/correo o la contraseña no son correctos.', 'unauthenticated');
    requireActive(user); this.session.setItem(SESSION, user.id); return this.currentUser;
  }
  async signInDemo(role) {
    const ids = { owner: 'owner-demo', teacher: 'teacher-demo', secondary: 'student-secondary', university: 'student-university', independent: 'student-independent' };
    const user = this.state.users.find(u => u.id === ids[role]);
    return this.signIn(user.email, DEMO_PASSWORD);
  }
  async signOut() { this.session.removeItem(SESSION); }
  async changePassword(oldPassword, newPassword) {
    const actor = this.actor(); const c = this.state.credentials[actor.id];
    if (await hashPassword(oldPassword, c.salt) !== c.hash) throw new AppError('La contraseña actual no es correcta.');
    if (newPassword.length < 10 || newPassword.length > 128) throw new AppError('La nueva contraseña debe tener entre 10 y 128 caracteres.');
    this.state.credentials[actor.id] = await credential(newPassword); this.persist();
  }
  async resetDemo() {
    if (typeof indexedDB !== 'undefined') await new Promise((resolve, reject) => { const r = indexedDB.deleteDatabase('aulanexo-demo-files'); r.onsuccess = resolve; r.onerror = () => reject(r.error); r.onblocked = () => reject(new AppError('Cierra otras pestañas del aula y vuelve a intentar.')); });
    this.storage.removeItem(STORE); this.session.removeItem(SESSION); return this.init();
  }
  async load() {
    const actor = this.actor();
    const courses = this.state.courses.filter(c => canReadCourse(actor, c, this.state.enrollments));
    const courseIds = courses.map(c => c.id);
    const users = actor.role === 'owner' ? this.state.users : actor.role === 'teacher'
      ? this.state.users.filter(u => u.id === actor.id || canManageUser(actor, u, this.state.courses, this.state.enrollments)) : [actor];
    return clone({ user: actor, courses, users, enrollments: this.state.enrollments.filter(e => e.uid === actor.id || courses.some(c => c.id === e.courseId && canManageCourse(actor, c))),
      materials: this.state.materials.filter(m => courseIds.includes(m.courseId)),
      exams: this.state.exams.filter(e => courseIds.includes(e.courseId) && (e.published || courses.some(c => c.id === e.courseId && canManageCourse(actor, c)))),
      sessions: this.state.sessions.filter(s => courseIds.includes(s.courseId)),
      assignments: this.state.assignments.filter(a => courseIds.includes(a.courseId) && (a.published || courses.some(c => c.id === a.courseId && canManageCourse(actor, c)))),
      announcements: this.state.announcements.filter(a => courseIds.includes(a.courseId)),
      submissions: this.state.submissions.filter(a => a.uid === actor.id && courseIds.includes(a.courseId) || courses.some(c => c.id === a.courseId && canManageCourse(actor, c))),
      attempts: this.state.attempts.filter(a => a.uid === actor.id || courses.some(c => c.id === a.courseId && canManageCourse(actor, c))) });
  }
  course(id, manage = false) {
    const actor = this.actor(); const course = this.state.courses.find(c => c.id === id);
    if (!course || !(manage ? canManageCourse(actor, course) : canReadCourse(actor, course, this.state.enrollments))) throw new AppError('No tienes acceso a este curso.', 'permission-denied');
    return course;
  }
  async saveUser(raw, id = null) {
    const actor = this.actor(); const input = validateUserInput(raw, { passwordRequired: !id });
    validateProvision(actor, input, this.state.courses);
    const existing = id && this.state.users.find(u => u.id === id);
    input.studentCode ||= existing?.studentCode || (input.role === 'student' ? 'AN-' + crypto.randomUUID().slice(0, 8).toUpperCase() : '');
    if (input.studentCode && this.state.users.some(u => u.id !== id && u.studentCode === input.studentCode)) throw new AppError('Ese código ya pertenece a otro alumno.', 'already-exists');
    if (existing && actor.role === 'teacher') {
      const retained = this.state.enrollments.filter(e => e.uid === id && e.active).map(e => this.state.courses.find(c => c.id === e.courseId)).filter(c => c && !canManageCourse(actor, c));
      if (retained.some(c => !canEnroll(input, c))) throw new AppError('El grupo académico debe corresponder a todas las matrículas del alumno.');
    }
    if (id && !canManageUser(actor, existing, this.state.courses, this.state.enrollments)) throw new AppError('No puedes modificar este usuario.', 'permission-denied');
    if (this.state.users.some(u => u.email === input.email && u.id !== id)) throw new AppError('Ese correo ya tiene una cuenta.', 'already-exists');
    if (existing && (input.email !== existing.email || input.role !== existing.role)) throw new AppError('El correo y el rol se conservan al editar una cuenta.');
    if (existing && input.active !== existing.active) throw new AppError('Usa el control de suspender/habilitar para cambiar el acceso.');
    const userId = id || uid('user'); const { courseIds, ...profile } = input;
    if (existing && actor.role === 'teacher' && existing.role !== profile.role) throw new AppError('No puedes cambiar ese rol.', 'permission-denied');
    const record = { ...(existing || {}), ...profile, id: userId, createdBy: existing?.createdBy || actor.id, createdAt: existing?.createdAt || new Date(this.clock()).toISOString() };
    if (existing) this.state.users[this.state.users.indexOf(existing)] = record; else this.state.users.push(record);
    if (!id) this.state.credentials[userId] = await credential(raw.password);
    this.state.enrollments = this.state.enrollments.filter(e => e.uid !== userId || !this.state.courses.some(c => c.id === e.courseId && canManageCourse(actor, c)));
    for (const courseId of courseIds) this.state.enrollments.push({ id: `${courseId}_${userId}`, uid: userId, courseId, active: true });
    this.persist(); return clone(record);
  }
  async toggleUser(id) {
    const actor = this.actor(); const target = this.state.users.find(u => u.id === id);
    if (!canManageUser(actor, target, this.state.courses, this.state.enrollments)) throw new AppError('No puedes cambiar este acceso.', 'permission-denied');
    target.active = !target.active; this.persist(); return clone(target);
  }
  async recoveryLink(id) {
    if (!canManageUser(this.actor(), this.state.users.find(u => u.id === id), this.state.courses, this.state.enrollments)) throw new AppError('No puedes gestionar esta cuenta.', 'permission-denied');
    return { demo: true, message: 'En la versión conectada se generará un enlace de Firebase para restablecer la contraseña, sin mostrar la contraseña anterior.' };
  }
  async forgotPassword() { return { demo: true, message: 'La recuperación por correo se habilitará al conectar Firebase.' }; }
  async saveCourse(raw, id = null) {
    const actor = this.actor(); if (!['owner', 'teacher'].includes(actor.role)) throw new AppError('Solo el docente puede crear cursos.', 'permission-denied');
    if (id) this.course(id, true);
    const input = validateCourse({ ...raw, teacherId: actor.role === 'teacher' ? actor.id : raw.teacherId });
    const teacher = this.state.users.find(u => u.id === input.teacherId && ['owner', 'teacher'].includes(u.role) && u.active);
    if (!teacher) throw new AppError('Selecciona un docente activo.');
    const existingCourse = this.state.courses.find(c => c.id === id);
    if (existingCourse && this.state.enrollments.some(e => e.courseId === id && e.active) &&
      (['level', 'stage', 'teacherId', 'career', 'section', 'period'].some(key => (input[key] || '') !== (existingCourse[key] || ''))))
      throw new AppError('Un curso con alumnos conserva su nivel, grado/ciclo y docente. Crea otro curso para un grupo diferente.');
    if (existingCourse) for (const key of ['materials', 'exams', 'sessions', 'assignments', 'announcements']) {
      if (this.state[key].some(item => item.courseId === id && !input.modules.includes(item.module))) throw new AppError('Un apartado con contenido no se puede retirar. Conserva su nombre o crea uno nuevo.');
    }
    const record = { ...input, id: id || uid('course'), createdAt: new Date(this.clock()).toISOString() };
    const at = this.state.courses.findIndex(c => c.id === id);
    if (at >= 0) this.state.courses[at] = { ...this.state.courses[at], ...record }; else this.state.courses.push(record);
    this.persist(); return clone(record);
  }
  async saveMaterial(courseId, raw) {
    const course = this.course(courseId, true); const input = validateMaterial(raw); input.module = resolveModule(course, raw.module);
    if (input.path && (!input.path.startsWith(courseId + '/') || input.path.includes('..'))) throw new AppError('La ruta del archivo no corresponde al curso.');
    const record = { ...input, courseId, id: uid('material'), createdAt: new Date(this.clock()).toISOString() };
    this.state.materials.push(record); this.persist(); return clone(record);
  }
  async deleteMaterial(courseId, id) {
    this.course(courseId, true);
    const material = this.state.materials.find(m => m.id === id && m.courseId === courseId);
    if (!material) throw new AppError('Material no encontrado.');
    if (material.path && typeof indexedDB !== 'undefined') {
      const db = await this.fileDB();
      await new Promise((resolve, reject) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').delete(material.path); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
      db.close();
    }
    this.state.materials = this.state.materials.filter(m => !(m.id === id && m.courseId === courseId)); this.persist();
  }
  async upload(courseId, file, progress = () => {}, { signal } = {}) {
    this.course(courseId, true); const metadata = fileMetadata(file, 50 * 1024 ** 2);
    if (signal?.aborted) throw new AppError('Subida cancelada.');
    const path = `${courseId}/${uid('file')}/${file.name}`;
    const db = await this.fileDB();
    await new Promise((resolve, reject) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(file, path); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    db.close(); if (signal?.aborted) throw new AppError('Subida cancelada.'); progress(100); return { path, ...metadata };
  }
  fileDB() {
    return new Promise((resolve, reject) => { const r = indexedDB.open('aulanexo-demo-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('files'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  }
  async materialURL(courseId, id) {
    this.course(courseId); const m = this.state.materials.find(m => m.id === id && m.courseId === courseId);
    if (!m) throw new AppError('Material no encontrado.');
    if (m.sample) return new URL(m.sample, location.href.split('#')[0]).href;
    if (m.url) return m.url;
    const db = await this.fileDB();
    const file = await new Promise((resolve, reject) => { const r = db.transaction('files').objectStore('files').get(m.path); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    db.close(); if (!file) throw new AppError('El archivo no está disponible en este navegador.');
    return URL.createObjectURL(file);
  }
  async saveExam(courseId, raw, id = null) {
    this.course(courseId, true);
    const input = validateExam(raw); input.module = resolveModule(this.course(courseId, true), raw.module); const parts = splitExam(input); const examId = id || uid('exam');
    if (id && !this.state.exams.some(e => e.id === id && e.courseId === courseId)) throw new AppError('Examen no encontrado.');
    const record = { ...parts.publicExam, id: examId, courseId, createdAt: new Date(this.clock()).toISOString() };
    const at = this.state.exams.findIndex(e => e.id === examId);
    if (at >= 0) this.state.exams[at] = record; else this.state.exams.push(record);
    this.state.examKeys[examId] = parts.keys; this.persist(); return clone(record);
  }
  async examForEditor(courseId, id) {
    this.course(courseId, true); const exam = this.state.exams.find(e => e.id === id && e.courseId === courseId);
    if (!exam) throw new AppError('Examen no encontrado.');
    return clone({ ...exam, questions: exam.questions.map(q => ({ ...q, correct: this.state.examKeys[id][q.id] })) });
  }
  async startExam(courseId, examId) {
    const actor = this.actor(); this.course(courseId);
    if (actor.role !== 'student') throw new AppError('El examen se rinde desde una cuenta de alumno.');
    const exam = this.state.exams.find(e => e.id === examId && e.courseId === courseId);
    const previous = this.state.attempts.find(a => a.uid === actor.id && a.examId === examId);
    if (previous) return { attempt: clone(previous), serverNow: this.clock() };
    if (!exam || !examAvailable(exam, this.clock())) throw new AppError('El examen no está disponible en este momento.');
    const attempt = { id: `${actor.id}_${examId}`, uid: actor.id, displayName: actor.displayName, module: exam.module, courseId, examId, title: exam.title,
      questions: clone(exam.questions), answers: {}, status: 'in-progress', startedAt: this.clock(), deadlineAt: deadlineFor(exam, this.clock()) };
    this.state.attempts.push(attempt); this.state.attemptKeys[attempt.id] = clone(this.state.examKeys[examId]); this.persist();
    return { attempt: clone(attempt), serverNow: this.clock() };
  }
  attempt(id) {
    const actor = this.actor(); const a = this.state.attempts.find(a => a.id === id);
    if (!a || a.uid !== actor.id) throw new AppError('No puedes responder este examen.', 'permission-denied');
    this.course(a.courseId); return a;
  }
  async saveAnswers(id, answers) {
    const a = this.attempt(id);
    if (a.status !== 'in-progress' || this.clock() >= a.deadlineAt) throw new AppError('El tiempo para responder terminó.', 'deadline-exceeded');
    a.answers = { ...a.answers, ...sanitizeAnswers(a.questions, answers) }; this.persist(); return { saved: true };
  }
  async submitExam(id, answers) {
    const a = this.attempt(id); if (a.status === 'graded') return clone(a);
    const finalAnswers = this.clock() < a.deadlineAt ? { ...a.answers, ...sanitizeAnswers(a.questions, answers) } : a.answers;
    Object.assign(a, gradeExam(a.questions, this.state.attemptKeys[a.id], finalAnswers), { answers: finalAnswers, status: 'graded', submittedAt: this.clock() });
    this.persist(); return clone(a);
  }
  async saveSession(courseId, input, id = null) {
    const course = this.course(courseId, true);
    const existing = id && this.state.sessions.find(s => s.id === id && s.courseId === courseId);
    if (id && !existing) throw new AppError('Clase no encontrada.');
    const record = { ...validateSession(input), module: resolveModule(course, input.module), courseId, id: id || uid('session') };
    if (existing) this.state.sessions[this.state.sessions.indexOf(existing)] = record; else this.state.sessions.push(record);
    this.persist(); return clone(record);
  }
  async deleteSession(courseId, id) {
    this.course(courseId, true); this.state.sessions = this.state.sessions.filter(s => !(s.id === id && s.courseId === courseId)); this.persist();
  }
  async saveAssignment(courseId, raw, id = null) {
    const course = this.course(courseId, true), input = validateAssignment(raw);
    input.module = resolveModule(course, raw.module);
    const old = id && this.state.assignments.find(a => a.id === id && a.courseId === courseId);
    if (id && !old) throw new AppError('Trabajo no encontrado.');
    const record = { ...old, ...input, courseId, id: id || uid('task'), createdAt: old?.createdAt || new Date(this.clock()).toISOString() };
    if (old) this.state.assignments[this.state.assignments.indexOf(old)] = record; else this.state.assignments.push(record);
    this.persist(); return clone(record);
  }
  assignment(courseId, id) {
    this.course(courseId);
    const a = this.state.assignments.find(a => a.id === id && a.courseId === courseId);
    if (!a || !a.published && !canManageCourse(this.actor(), this.course(courseId))) throw new AppError('Trabajo no disponible.', 'permission-denied');
    return a;
  }
  async uploadSubmission(courseId, assignmentId, file, progress = () => {}, { signal } = {}) {
    const actor = this.actor(); this.assignment(courseId, assignmentId);
    if (actor.role !== 'student') throw new AppError('Las entregas se realizan desde la cuenta del alumno.', 'permission-denied');
    const metadata = fileMetadata(file, 50 * 1024 ** 2); if (signal?.aborted) throw new AppError('Subida cancelada.');
    const path = `submissions/${courseId}/${assignmentId}/${actor.id}/${uid('file')}/${file.name}`;
    const db = await this.fileDB();
    await new Promise((resolve, reject) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').put(file, path); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
    db.close(); if (signal?.aborted) throw new AppError('Subida cancelada.'); progress(100); return { path, ...metadata };
  }
  async submitAssignment(courseId, assignmentId, raw) {
    const actor = this.actor(), a = this.assignment(courseId, assignmentId), input = validateSubmission(raw);
    if (actor.role !== 'student') throw new AppError('Solo los alumnos pueden entregar trabajos.', 'permission-denied');
    if (a.dueAt && this.clock() > Date.parse(a.dueAt) && !a.allowLate) throw new AppError('El plazo de entrega terminó.', 'deadline-exceeded');
    if (input.path && (!input.path.startsWith(`submissions/${courseId}/${assignmentId}/${actor.id}/`) || input.path.includes('..'))) throw new AppError('El archivo no corresponde a esta entrega.', 'permission-denied');
    const id = `${actor.id}_${assignmentId}`, old = this.state.submissions.find(s => s.id === id);
    if (old?.status === 'graded') throw new AppError('El trabajo ya está calificado. El docente puede habilitar una nueva entrega.');
    const record = { ...input, id, uid: actor.id, displayName: actor.displayName, assignmentId, courseId, title: a.title, module: a.module, status: 'submitted', submittedAt: this.clock(), late: !!a.dueAt && this.clock() > Date.parse(a.dueAt), revision: (old?.revision || 0) + 1 };
    if (old) this.state.submissions[this.state.submissions.indexOf(old)] = record; else this.state.submissions.push(record);
    this.persist(); return clone(record);
  }
  async gradeSubmission(id, raw) {
    const s = this.state.submissions.find(s => s.id === id);
    if (!s) throw new AppError('Entrega no encontrada.'); this.course(s.courseId, true);
    if (raw.revision != null && raw.revision !== s.revision) throw new AppError('El alumno actualizó su entrega. Vuelve a abrirla antes de calificar.');
    Object.assign(s, validateFeedback(raw), { status: 'graded', gradedAt: this.clock(), gradedBy: this.actor().id }); this.persist(); return clone(s);
  }
  async returnSubmission(id) {
    const s = this.state.submissions.find(s => s.id === id);
    if (!s) throw new AppError('Entrega no encontrada.'); this.course(s.courseId, true);
    s.status = 'returned'; delete s.score20; this.persist(); return clone(s);
  }
  async submissionURL(id) {
    const actor = this.actor(), s = this.state.submissions.find(s => s.id === id);
    if (!s || s.uid !== actor.id && !canManageCourse(actor, this.state.courses.find(c => c.id === s.courseId))) throw new AppError('No puedes leer esta entrega.', 'permission-denied');
    this.course(s.courseId);
    if (!s.path) throw new AppError('La entrega no tiene archivo adjunto.');
    const db = await this.fileDB();
    const file = await new Promise((resolve, reject) => { const r = db.transaction('files').objectStore('files').get(s.path); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    db.close(); if (!file) throw new AppError('Archivo no disponible en este navegador.'); return URL.createObjectURL(file);
  }
  async saveAnnouncement(courseId, raw, id = null) {
    const course = this.course(courseId, true), input = validateAnnouncement(raw);
    input.module = resolveModule(course, raw.module);
    const old = id && this.state.announcements.find(a => a.id === id && a.courseId === courseId);
    if (id && !old) throw new AppError('Aviso no encontrado.');
    const record = { ...input, id: id || uid('notice'), courseId, createdAt: old?.createdAt || new Date(this.clock()).toISOString() };
    if (old) this.state.announcements[this.state.announcements.indexOf(old)] = record; else this.state.announcements.push(record);
    this.persist(); return clone(record);
  }
  async deleteAnnouncement(courseId, id) {
    this.course(courseId, true); this.state.announcements = this.state.announcements.filter(a => !(a.id === id && a.courseId === courseId)); this.persist();
  }
}
