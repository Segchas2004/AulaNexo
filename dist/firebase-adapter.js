import { AppError, validateCourse, validateMaterial, validateExam, validateSession, canManageCourse, validateAssignment, validateAnnouncement, normalizeCode, fileMetadata } from './core.js';
import { config } from './firebase-config.js';
const SDK = 'https://www.gstatic.com/firebasejs/12.19.0/';
const normalizeDoc = doc => ({ id: doc.id, ...doc.data() });

export class FirebaseAdapter {
  constructor() { this.mode = 'firebase'; this.user = null; this.usersCursor = null; this.cursors = new Map(); }
  async init() {
    const [app, auth, db, functions, storage] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-firestore.js', 'firebase-functions.js', 'firebase-storage.js'].map(file => import(SDK + file)));
    this.sdk = { app, auth, db, functions, storage };
    this.app = app.initializeApp(config.firebase);
    this.auth = auth.getAuth(this.app); this.db = db.getFirestore(this.app);
    this.functions = functions.getFunctions(this.app, config.functionsRegion);
    this.storage = storage.getStorage(this.app);
    if (config.emulators) {
      const e = config.emulators;
      auth.connectAuthEmulator(this.auth, `http://${e.host}:${e.auth}`);
      db.connectFirestoreEmulator(this.db, e.host, e.firestore);
      functions.connectFunctionsEmulator(this.functions, e.host, e.functions);
      storage.connectStorageEmulator(this.storage, e.host, e.storage);
    }
    await this.auth.authStateReady();
    if (this.auth.currentUser) await this.profile();
    return this;
  }
  get currentUser() { return this.user; }
  async profile() {
    if (!this.auth.currentUser) return this.user = null;
    const { getDoc, doc } = this.sdk.db;
    const snapshot = await getDoc(doc(this.db, 'users', this.auth.currentUser.uid));
    if (!snapshot.exists() || !snapshot.data().active) {
      await this.sdk.auth.signOut(this.auth); this.user = null;
      throw new AppError('Esta cuenta no tiene acceso habilitado. Contacta al docente.', 'permission-denied');
    }
    return this.user = normalizeDoc(snapshot);
  }
  async signIn(email, password) {
    try {
      if (email.includes('@')) await this.sdk.auth.signInWithEmailAndPassword(this.auth, email.trim(), password);
      else { const { token } = await this.call('loginWithStudentCode', { code: normalizeCode(email), password }); await this.sdk.auth.signInWithCustomToken(this.auth, token); }
      return await this.profile();
    }
    catch (error) {
      if (error instanceof AppError) throw error;
      if (['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(error.code)) throw new AppError('El código/correo o la contraseña no son correctos.');
      if (error.code === 'auth/user-disabled') throw new AppError('Tu acceso está suspendido. Contacta al docente.');
      throw error;
    }
  }
  async signOut() { await this.sdk.auth.signOut(this.auth); this.user = null; }
  async changePassword(oldPassword, newPassword) {
    if (newPassword.length < 10 || newPassword.length > 128) throw new AppError('La contraseña debe tener entre 10 y 128 caracteres.');
    const credential = this.sdk.auth.EmailAuthProvider.credential(this.user.email, oldPassword);
    await this.sdk.auth.reauthenticateWithCredential(this.auth.currentUser, credential);
    await this.sdk.auth.updatePassword(this.auth.currentUser, newPassword);
  }
  async forgotPassword(email) {
    await this.sdk.auth.sendPasswordResetEmail(this.auth, email.trim());
    return { message: 'Si el correo tiene una cuenta habilitada, recibirás las instrucciones para recuperar el acceso.' };
  }
  async call(name, data) {
    const result = await this.sdk.functions.httpsCallable(this.functions, name)(data);
    return result.data;
  }
  async load() {
    this.cursors.clear();
    const user = await this.profile(); if (!user) throw new AppError('Inicia sesión para continuar.');
    const { collection, query, where, getDocs, getDoc, doc, limit, getCountFromServer, orderBy } = this.sdk.db;
    let courses = [], enrollments = [];
    if (user.role === 'student') {
      enrollments = (await getDocs(query(collection(this.db, 'enrollments'), where('uid', '==', user.id), where('active', '==', true), limit(40)))).docs.map(normalizeDoc);
      const results = await Promise.all(enrollments.map(async e => {
        try { const d = await getDoc(doc(this.db, 'courses', e.courseId)); return d.exists() && d.data().published ? normalizeDoc(d) : null; }
        catch (error) { if (error.code === 'permission-denied') return null; throw error; }
      }));
      courses = results.filter(Boolean);
    } else {
      const filters = user.role === 'teacher' ? [where('teacherId', '==', user.id)] : [];
      const page = await getDocs(query(collection(this.db, 'courses'), ...filters, orderBy('createdAt', 'desc'), limit(100))); this.coursesCursor = page.docs.at(-1); courses = page.docs.map(normalizeDoc);
    }
    const usersPage = user.role === 'student' ? { users: [user], hasMore: false } : await this.listUsers();
    const users = usersPage.users;
    const teachersPage = user.role === 'owner' ? await this.listTeachers() : { users: [user], hasMore: false };
    for (const teacher of teachersPage.users) if (!users.some(u => u.id === teacher.id)) users.push(teacher);
    if (!users.some(u => u.id === user.id)) users.push(user);
    if (user.role === 'owner') {
      const missing = [...new Set(courses.map(c => c.teacherId))].filter(id => !teachersPage.users.some(u => u.id === id));
      const assigned = (await Promise.all(missing.map(id => getDoc(doc(this.db, 'users', id))))).filter(d => d.exists()).map(normalizeDoc);
      for (const teacher of assigned) { teachersPage.users.push(teacher); if (!users.some(u => u.id === teacher.id)) users.push(teacher); }
    }
    if (user.role !== 'student') {
      enrollments = users.flatMap(u => (u.courseIds || []).filter(id => courses.some(c => c.id === id)).map(courseId => ({ uid: u.id, courseId, active: true })));
    }
    const materials = [], exams = [], sessions = [], attempts = [], assignments = [], announcements = [], submissions = []; const hasMoreContent = {};
    await Promise.all(courses.map(async c => {
      const lists = { materials, exams, sessions, assignments, announcements };
      await Promise.all(Object.entries(lists).map(async ([name, list]) => {
        const page = await this.courseItems(c.id, name);
        list.push(...page.items); hasMoreContent[`${c.id}:${name}`] = page.hasMore;
      }));
      if (user.role !== 'student') {
        c.studentCount = (await getCountFromServer(query(collection(this.db, 'enrollments'), where('courseId', '==', c.id), where('active', '==', true)))).data().count;
        const a = await getDocs(query(collection(this.db, 'attempts'), where('courseId', '==', c.id), orderBy('startedAt', 'desc'), limit(200)));
        attempts.push(...a.docs.map(normalizeDoc));
        const page = await this.resultItems(c.id, 'submissions'); submissions.push(...page.items); hasMoreContent[`${c.id}:submissions`] = page.hasMore;
        this.cursors.set(`${c.id}:attempts`, a.docs.at(-1)); hasMoreContent[`${c.id}:attempts`] = a.size === 200;
      }
    }));
    if (user.role === 'student') {
      const a = await getDocs(query(collection(this.db, 'attempts'), where('uid', '==', user.id), orderBy('startedAt', 'desc'), limit(100)));
      attempts.push(...a.docs.map(normalizeDoc));
      const s = await getDocs(query(collection(this.db, 'submissions'), where('uid', '==', user.id), orderBy('submittedAt', 'desc'), limit(100)));
      submissions.push(...s.docs.map(normalizeDoc).filter(s => courses.some(c => c.id === s.courseId)));
      this.cursors.set('student:attempts', a.docs.at(-1)); this.cursors.set('student:submissions', s.docs.at(-1));
      hasMoreContent['student:attempts'] = a.size === 100; hasMoreContent['student:submissions'] = s.size === 100;
    }
    this.materials = materials;
    return this.snapshot = { user, courses, users, teachers: teachersPage.users, hasMoreTeachers: teachersPage.hasMore, userResults: usersPage.users.filter(u => u.role !== 'owner' || u.id === user.id), enrollments, materials, exams, sessions, attempts, assignments, announcements, submissions, hasMoreContent, hasMoreCourses: user.role !== 'student' && courses.length === 100, hasMoreUsers: usersPage.hasMore };
  }
  async moreCourses() {
    const { collection, query, where, getDocs, orderBy, limit, startAfter, getCountFromServer } = this.sdk.db;
    const filters = this.user.role === 'teacher' ? [where('teacherId', '==', this.user.id)] : [];
    filters.push(orderBy('createdAt', 'desc')); if (this.coursesCursor) filters.push(startAfter(this.coursesCursor));
    const page = await getDocs(query(collection(this.db, 'courses'), ...filters, limit(100)));
    this.coursesCursor = page.docs.at(-1); const courses = page.docs.map(normalizeDoc);
    await Promise.all(courses.map(async c => {
      for (const name of ['materials', 'exams', 'sessions', 'assignments', 'announcements']) {
        const page = await this.courseItems(c.id, name); this.snapshot[name].push(...page.items); this.snapshot.hasMoreContent[`${c.id}:${name}`] = page.hasMore;
      }
      c.studentCount = (await getCountFromServer(query(collection(this.db, 'enrollments'), where('courseId', '==', c.id), where('active', '==', true)))).data().count;
      for (const name of ['attempts', 'submissions']) { const page = await this.resultItems(c.id, name); this.snapshot[name].push(...page.items); this.snapshot.hasMoreContent[`${c.id}:${name}`] = page.hasMore; }
    })); return { courses, hasMore: page.size === 100 };
  }
  async listRoster(courseId, append = false) {
    const { collection, query, where, getDocs, getDoc, doc, orderBy, limit, startAfter } = this.sdk.db;
    const filters = [where('courseId', '==', courseId), where('active', '==', true), orderBy('updatedAt', 'desc')], key = courseId + ':roster';
    if (append && this.cursors.get(key)) filters.push(startAfter(this.cursors.get(key)));
    const page = await getDocs(query(collection(this.db, 'enrollments'), ...filters, limit(50))); this.cursors.set(key, page.docs.at(-1));
    const enrollments = page.docs.map(normalizeDoc), users = (await Promise.all(enrollments.map(e => getDoc(doc(this.db, 'users', e.uid))))).filter(d => d.exists()).map(normalizeDoc);
    return { users, enrollments, hasMore: page.size === 50 };
  }
  async courseItems(courseId, name, append = false) {
    if (!['materials', 'exams', 'sessions', 'assignments', 'announcements'].includes(name)) throw new AppError('Apartado no válido.');
    const { collection, query, where, getDocs, orderBy, limit, startAfter } = this.sdk.db;
    const filters = [];
    if (['exams', 'assignments'].includes(name) && this.user.role === 'student') filters.push(where('published', '==', true));
    filters.push(orderBy('createdAt', 'desc'));
    const key = `${courseId}:${name}`, cursor = this.cursors.get(key);
    if (append && cursor) filters.push(startAfter(cursor));
    const snapshot = await getDocs(query(collection(this.db, 'courses', courseId, name), ...filters, limit(50)));
    this.cursors.set(key, snapshot.docs.at(-1));
    return { items: snapshot.docs.map(d => ({ ...normalizeDoc(d), courseId })), hasMore: snapshot.size === 50 };
  }
  async resultItems(courseId, name, append = false) {
    if (!['attempts', 'submissions'].includes(name)) throw new AppError('Resultados no válidos.');
    const { collection, query, where, getDocs, orderBy, limit, startAfter } = this.sdk.db;
    const student = this.user.role === 'student', key = `${student ? 'student' : courseId}:${name}`;
    const filters = [where(student ? 'uid' : 'courseId', '==', student ? this.user.id : courseId), orderBy(name === 'attempts' ? 'startedAt' : 'submittedAt', 'desc')];
    if (append && this.cursors.get(key)) filters.push(startAfter(this.cursors.get(key)));
    const snapshot = await getDocs(query(collection(this.db, name), ...filters, limit(student ? 100 : 200)));
    this.cursors.set(key, snapshot.docs.at(-1)); return { items: snapshot.docs.map(normalizeDoc), hasMore: snapshot.size === (student ? 100 : 200) };
  }
  async listTeachers(append = false) {
    const { collection, query, where, getDocs, orderBy, limit, startAfter } = this.sdk.db;
    const filters = [where('role', 'in', ['teacher', 'owner']), where('active', '==', true), orderBy('__name__')];
    if (append && this.teachersCursor) filters.push(startAfter(this.teachersCursor));
    const page = await getDocs(query(collection(this.db, 'users'), ...filters, limit(100)));this.teachersCursor = page.docs.at(-1);
    return { users: page.docs.map(normalizeDoc), hasMore: page.size === 100 };
  }
  async listUsers(search = '', append = false) {
    const { collection, query, where, getDocs, orderBy, startAfter, startAt, endAt, limit } = this.sdk.db;
    const filters = this.user.role === 'teacher' ? [where('managerIds', 'array-contains', this.user.id)] : [];
    const term = search.trim().toLowerCase();
    if (term && !term.includes('@') && /^[a-z0-9_-]{4,32}$/i.test(term)) {
      const codePage = await getDocs(query(collection(this.db, 'users'), ...filters, where('studentCode', '==', normalizeCode(term)), orderBy('displayNameFold'), limit(50)));
      if (!codePage.empty) { this.usersCursor = codePage.docs.at(-1); return { users: codePage.docs.map(normalizeDoc), hasMore: false }; }
    }
    const codeSearch = false;
    if (term.includes('@')) filters.push(where('email', '==', term));
    else if (codeSearch) filters.push(where('studentCode', '==', normalizeCode(term)));
    filters.push(orderBy('displayNameFold'));
    if (append && this.usersCursor) filters.push(startAfter(this.usersCursor));
    else if (term && !term.includes('@') && !codeSearch) filters.push(startAt(term));
    if (term && !term.includes('@') && !codeSearch) filters.push(endAt(term + '\uf8ff'));
    const snapshot = await getDocs(query(collection(this.db, 'users'), ...filters, limit(50)));
    this.usersCursor = snapshot.docs.at(-1) || null;
    return { users: snapshot.docs.map(normalizeDoc), hasMore: snapshot.size === 50 };
  }
  async saveUser(input, id = null) { return this.call(id ? 'adminUpdateUser' : 'adminCreateUser', { ...input, uid: id }); }
  async toggleUser(id) { return this.call('adminToggleUser', { uid: id }); }
  async recoveryLink(id) { return this.call('adminRecoveryLink', { uid: id }); }
  async saveCourse(input, id = null) { return this.call('saveCourse', { ...validateCourse(input), id }); }
  async saveMaterial(courseId, input) { return this.call('saveMaterial', { courseId, ...validateMaterial(input) }); }
  async deleteMaterial(courseId, id) { return this.call('deleteMaterial', { courseId, id }); }
  async upload(courseId, file, progress = () => {}, { assignmentId = null, signal = null } = {}) {
    const metadata = fileMetadata(file, assignmentId ? 50 * 1024 ** 2 : undefined);
    if (signal?.aborted) throw new AppError('Subida cancelada.');
    const { ref, uploadBytesResumable } = this.sdk.storage;
    const filename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 150);
    const path = assignmentId ? `submissions/${courseId}/${assignmentId}/${this.user.id}/${crypto.randomUUID()}/${filename}` : `courses/${courseId}/files/${crypto.randomUUID()}/${filename}`;
    const task = uploadBytesResumable(ref(this.storage, path), file, { contentType: metadata.mimetype });
    const cancel = () => task.cancel(); signal?.addEventListener('abort', cancel, { once: true });
    try { await new Promise((resolve, reject) => task.on('state_changed', s => progress(Math.round(s.bytesTransferred / s.totalBytes * 100)), reject, resolve)); }
    catch (error) { if (signal?.aborted || error.code === 'storage/canceled') throw new AppError('Subida cancelada.'); throw error; }
    finally { signal?.removeEventListener('abort', cancel); }
    if (signal?.aborted) throw new AppError('Subida cancelada.'); return { path, ...metadata };
  }
  async materialURL(courseId, id) { const result = await this.call('materialLink', { courseId, id }); return result.url; }
  async saveExam(courseId, input, id = null) { return this.call('saveExam', { courseId, ...validateExam(input), id }); }
  async examForEditor(courseId, id) { return this.call('examForEditor', { courseId, id }); }
  async startExam(courseId, examId) { return this.call('startExam', { courseId, examId }); }
  async saveAnswers(attemptId, answers) { return this.call('saveAnswers', { attemptId, answers }); }
  async submitExam(attemptId, answers) { return this.call('submitExam', { attemptId, answers }); }
  async saveSession(courseId, input, id = null) { return this.call('saveSession', { courseId, ...validateSession(input), id }); }
  async deleteSession(courseId, id) { return this.call('deleteSession', { courseId, id }); }
  async saveAssignment(courseId, input, id = null) { return this.call('saveAssignment', { courseId, ...validateAssignment(input), id }); }
  async uploadSubmission(courseId, assignmentId, file, progress, options = {}) { return this.upload(courseId, file, progress, { ...options, assignmentId }); }
  async submitAssignment(courseId, assignmentId, input) { return this.call('submitAssignment', { courseId, assignmentId, ...input }); }
  async gradeSubmission(id, input) { return this.call('gradeSubmission', { id, ...input }); }
  async returnSubmission(id) { return this.call('returnSubmission', { id }); }
  async submissionURL(id) { return (await this.call('submissionLink', { id })).url; }
  async saveAnnouncement(courseId, input, id = null) { return this.call('saveAnnouncement', { courseId, ...validateAnnouncement(input), id }); }
  async deleteAnnouncement(courseId, id) { return this.call('deleteAnnouncement', { courseId, id }); }
}
