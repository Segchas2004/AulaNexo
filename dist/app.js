import { config } from './firebase-config.js';
import { DemoAdapter } from './demo-adapter.js';
import { LEVELS, ROLES, escapeHTML as esc, canManageCourse, canManageUser, canEnroll, examAvailable, safeURL, courseModules } from './core.js';

const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const state = { data: null, search: '', filter: 'all', userSearch: '', authTab: config.firebase ? 'account' : 'demo', modalHandler: null, exam: null, saveQueue: Promise.resolve(), navOpen: false, modules: {}, objectURLs: [], uploadAbort: null, academicFilter: '' };
let service;
const paths = {
  book: '<path d="M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3Z"/><path d="M12 6v15"/>',
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-3a5 5 0 0 1 10 0v3M16 4a3 3 0 0 1 0 6M17 14a4 4 0 0 1 4 4v2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="m8 13 2 2 5-5"/>',
  chart: '<path d="M4 3v18h17M8 16v-5M13 16V8M18 16V5"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M8 15h2M14 15h2"/>',
  settings: '<path d="m9 3-.6 2.4-2 .9L4 5.6 2.5 8l1.7 1.7-.2 2.2L2 13l1.2 2.5 2.4-.1 1.7 1.5.2 2.4 2.7.6 1.2-2.1 2.2-.2 1.7 1.7 2.4-1.5-.7-2.4.9-2 2.4-.6V10l-2.4-.6-.9-2 .7-2.4L17 3.5l-1.7 1.7-2.2-.2L12 3Z"/><circle cx="11" cy="11" r="3"/>',
  arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', back: '<path d="M19 12H5m5-5-5 5 5 5"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
  logout: '<path d="M9 3H4v18h5M9 12h12m-4-4 4 4-4 4"/>',
  file: '<path d="M14 3H5v18h14V8Z"/><path d="M14 3v5h5M8 12h8M8 16h5"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="2"/><path d="m16 9 5-3v12l-5-3"/>',
  play: '<path d="m8 5 11 7-11 7Z"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  link: '<path d="m10 8 3-3a4 4 0 0 1 6 6l-3 3M14 16l-3 3a4 4 0 0 1-6-6l3-3M8 16l8-8"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L20 8a3.5 3.5 0 0 0-5-5L4 14Z"/>',
  trash: '<path d="M3 6h18M8 6V3h8v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
  key: '<circle cx="8" cy="9" r="4"/><path d="m11 12 9 9M16 17l3-3M19 20l3-3"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  download: '<path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/>',
  cloud: '<path d="M7 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5 5 0 0 1 0 11ZM9 12l3-3 3 3M12 9v7"/>',
  sparkle: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 3v4M18 5h4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  shield: '<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',
};
const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.book}</svg>`;
const brand = () => `<a href="#home" class="brand" aria-label="AulaNexo inicio"><span class="brand-symbol">${icon('book')}</span><div><div class="brand-name"><strong>Aula</strong><em>Nexo</em></div><div class="brand-caption">Tu espacio para aprender</div></div></a>`;
const button = (label, action, symbol = 'plus', classes = 'primary', attrs = '') => `<button type="button" class="button ${classes}" data-action="${action}" ${attrs}>${icon(symbol)}${label}</button>`;
const initials = name => (name || 'A').trim().split(/\s+/).slice(0, 2).map(n => n[0]).join('').toUpperCase();
const roman = n => ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][Number(n)] || n;
const stageLabel = c => c.level === 'university' ? `Ciclo ${roman(c.stage)}` : c.level === 'independent' ? 'Curso abierto por matrícula' : `${c.stage || '—'}.º grado`;
const levelLabel = c => [LEVELS[c.level] || c.level, c.stage && stageLabel(c), c.career, c.section && 'Sección ' + c.section, c.period].filter(Boolean).join(' · ');
const fmtDate = value => new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short', timeZone: 'America/Lima' }).format(new Date(value));
const fmtTime = value => new Intl.DateTimeFormat('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' }).format(new Date(value));
const today = () => new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Lima' }).format(new Date());
const size = bytes => bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : bytes ? `${Math.ceil(bytes / 1024)} KB` : 'Enlace';
const route = () => { const [name = 'home', id, tab = 'materials'] = location.hash.replace(/^#/, '').split('/'); return { name: name || 'home', id, tab }; };
const empty = (title, description, symbol = 'book', action = '') => `<div class="empty">${icon(symbol)}<h3>${esc(title)}</h3><p>${esc(description)}</p>${action}</div>`;
const badge = (text, cls = '') => `<span class="badge ${cls}">${esc(text)}</span>`;
const isManager = () => state.data && state.data.user.role !== 'student';
const courseById = id => state.data?.courses.find(c => c.id === id);
function art(c = {}) {
  const shape = c.level === 'university' && c.color === 'indigo'
    ? '<rect x="25" y="32" width="131" height="85" rx="8"/><path d="M25 50h131M36 41h2m7 0h2m7 0h2m-8 32-12 10 12 10m41-20 12 10-12 10m-19-28-13 39M48 132h89"/>'
    : c.color === 'sage'
    ? '<path d="M27 42c25-6 43-1 61 10 18-11 36-16 61-10v75c-25-6-43-1-61 10-18-11-36-16-61-10ZM88 52v75M38 60c16-1 25 2 38 8M38 78c16-1 25 2 38 8M101 68c13-6 22-9 36-8M101 86c13-6 22-9 36-8"/>'
    : c.color === 'ochre'
    ? '<path d="M35 127V35m-9 82h132M48 100c20-10 14-65 41-50s16 57 55 9"/><path d="M49 116V99m8 17V91m8 25V71m8 45V54m8 62V47m8 69V51m8 65V69m8 47V86m8 30V84m8 32V78m8 38V74m8 42V71" stroke-opacity=".25"/>'
    : c.color === 'rose'
    ? '<rect x="34" y="30" width="99" height="118" rx="7"/><path d="M49 50h53M49 67h69M49 84h42M49 108h69M49 125h53"/><circle cx="132" cy="106" r="27"/><path d="m121 106 7 7 15-18"/>'
    : '<path d="m40 133 49-96 54 96ZM89 37v96M40 133h103"/><circle cx="127" cy="53" r="29"/><path d="M104 133V115H89"/><text x="22" y="65" font-family="Georgia,serif" font-size="29" fill="currentColor" stroke="none">x²</text>';
  return `<svg class="art" viewBox="0 0 180 165" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;
}
function toast(message, error = false) {
  const el = document.createElement('div'); el.className = `toast ${error ? 'error' : ''}`;
  el.innerHTML = `${icon(error ? 'info' : 'check')}<span>${esc(message)}</span>`;
  document.querySelector('#toasts').append(el); setTimeout(() => el.remove(), error ? 7500 : 4200);
}
function pageHead(title, description, action = '', eyebrow = 'Tu aula virtual') {
  return `<div class="page-head"><div><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1><p>${esc(description)}</p></div>${action || `<span class="date-label">${icon('calendar')}${esc(today())}</span>`}</div>`;
}
function courseCard(c) {
  const data = state.data; const materials = data.materials.filter(m => m.courseId === c.id).length;
  const exams = data.exams.filter(e => e.courseId === c.id).length;
  const teacher = data.users.find(u => u.id === c.teacherId)?.displayName || 'Docente del curso';
  const students = c.studentCount ?? data.enrollments.filter(e => e.courseId === c.id && e.active).length;
  return `<article class="course-card ${esc(c.color)}"><a href="#course/${esc(c.id)}/overview" class="course-cover" aria-label="Abrir ${esc(c.title)}">${badge(LEVELS[c.level])}<span class="course-code">${esc([stageLabel(c), c.period].filter(Boolean).join(" · "))}</span>${art(c)}</a><div class="course-body"><div class="course-level">${c.career ? esc(c.career) + ' · ' : ''}${c.published ? 'Aula habilitada' : 'Borrador · solo docente'}</div><h3><a href="#course/${esc(c.id)}/overview">${esc(c.title)}</a></h3><p>${esc(c.description)}</p><div class="course-meta"><span>${icon('file')}${materials} materiales</span><span>${icon('clipboard')}${exams} exámenes</span>${isManager() ? `<span>${icon('users')}${students}</span>` : ''}</div></div><div class="course-footer"><span class="course-teacher"><span class="mini-avatar">${esc(initials(teacher))}</span>${esc(teacher)}</span><a class="enter-course" href="#course/${esc(c.id)}/overview">Entrar al curso ${icon('arrow')}</a></div></article>`;
}
function shell(content) {
  const user = state.data.user; const r = route(); const admin = user.role !== 'student';
  const navigation = [ ['home', 'home', 'Inicio'], ['courses', 'grid', admin ? 'Cursos' : 'Mis cursos'], ...(admin ? [['users', 'users', 'Usuarios']] : []),
    ['work', 'file', admin ? 'Trabajos' : 'Mis trabajos'], ['exams', 'clipboard', 'Evaluaciones'], ['notices', 'info', 'Avisos'], ['grades', 'chart', admin ? 'Calificaciones' : 'Mis notas'], ['agenda', 'calendar', 'Agenda'] ];
  const title = r.name === 'course' ? courseById(r.id)?.title || 'Curso' : navigation.find(n => n[0] === r.name)?.[2] || 'Configuración';
  app.innerHTML = `<div class="app-shell ${state.navOpen ? 'nav-open' : ''}"><button class="mobile-shade" data-action="toggle-nav" aria-label="Cerrar menú"></button><aside class="sidebar">${brand()}<div class="nav-label">Espacio de aprendizaje</div><nav aria-label="Navegación principal">${navigation.map(([path, symbol, name]) => `<a class="nav-item ${(r.name === path || path === 'courses' && r.name === 'course') ? 'active' : ''}" href="#${path}">${icon(symbol)}${esc(name)}</a>`).join('')}</nav>${user.role === 'owner' ? `<div class="nav-label">Administración</div><a href="#settings" class="nav-item ${r.name === 'settings' ? 'active' : ''}">${icon('settings')}Configuración</a>` : ''}<div class="sidebar-spacer"></div><div class="sidebar-status"><strong>${icon(service.mode === 'demo' ? 'info' : 'shield')}${service.mode === 'demo' ? 'Demostración local' : 'Aula conectada'}</strong><p>${service.mode === 'demo' ? 'Cambios solo en este navegador. Utiliza datos de prueba.' : 'Tus cursos y accesos están protegidos por matrícula.'}</p></div><div class="sidebar-user"><button class="avatar" data-action="profile" aria-label="Mi cuenta">${esc(initials(user.displayName))}</button><div class="user-info"><strong>${esc(user.displayName)}</strong><span>${esc(ROLES[user.role])}</span></div><button class="icon-button" data-action="logout" title="Cerrar sesión" aria-label="Cerrar sesión">${icon('logout')}</button></div></aside><div class="workspace"><header class="topbar"><button class="icon-button mobile-toggle" data-action="toggle-nav" aria-label="Abrir menú">${icon('menu')}</button><div class="breadcrumb">AulaNexo ${icon('chevron')}<span>${esc(title)}</span></div><div class="topbar-tools"><label class="searchbox">${icon('search')}<input id="global-search" type="search" placeholder="Buscar un curso…" aria-label="Buscar un curso" value="${esc(state.search)}" /></label>${badge(service.mode === 'demo' ? 'Vista de prueba' : 'Conectado', service.mode === 'demo' ? 'amber dot' : 'green dot')}<button class="avatar" data-action="profile" aria-label="Abrir mi cuenta">${esc(initials(user.displayName))}</button></div></header><main id="main" class="main" tabindex="-1">${config.backendReady === false && user.role === "owner" ? `<div class="setup-notice" role="status"><strong>Ingreso real habilitado.</strong> Falta activar Blaze y desplegar el backend para crear accesos, administrar cursos y compartir archivos.</div>` : ""}${content}<footer class="app-footer"><span>AulaNexo · Un espacio para enseñar y aprender</span><span>${service.mode === 'demo' ? 'Versión de prueba · sin cuentas reales de Firebase' : 'Acceso por matrícula'}</span></footer></main></div></div>`;
}
function login() {
  const demo = service.mode === 'demo';
  app.innerHTML = `<div class="login-shell"><section class="login-story">${brand()}<div class="login-story-content"><div class="eyebrow">Aprender nos conecta</div><h1>Tu siguiente<br>logro empieza<br><em>aquí.</em></h1><p>Clases, materiales y nuevos retos. Tu aula conecta todo lo que necesitas para avanzar.</p><div class="login-cards"><div class="login-card">${icon('book')}<strong>Cada curso, su espacio.</strong><span>Organiza · comparte · enseña</span></div><div class="login-card">${icon('sparkle')}<strong>Cada alumno, su camino.</strong><span>Descubre · practica · aprende</span></div></div></div><div class="login-footer"><span>SECUNDARIA · UNIVERSIDAD · CURSOS</span><span>AulaNexo / 2026</span></div></section><section class="login-content"><div class="login-top-note">${badge(demo ? 'Demostración' : 'Aula virtual', demo ? 'amber dot' : 'green dot')}</div><div class="login-content-inner"><p class="eyebrow">Bienvenido a tu aula</p><h2>El aprendizaje continúa aquí.</h2><p>${demo ? 'Explora la experiencia del docente y del alumno, o prueba una cuenta que hayas creado en esta demostración.' : 'Ingresa con el código o correo y la contraseña que te proporcionó el administrador.'}</p>${demo ? `<div class="login-tabs"><button data-action="auth-tab" data-tab="demo" class="${state.authTab === 'demo' ? 'active' : ''}">Explorar demostración</button><button data-action="auth-tab" data-tab="account" class="${state.authTab === 'account' ? 'active' : ''}">Ingresar con cuenta</button></div>` : ''}${demo && state.authTab === 'demo' ? `<div class="demo-options">${[['owner','shield','Administrador','Gestiona toda el aula'],['teacher','book','Docente','Enseña y crea usuarios'],['secondary','user','Alumno de secundaria','Accede a 3.er grado'],['university','user','Alumno universitario','Accede a ciclo IV'],['independent','sparkle','Curso independiente','Explora otros aprendizajes']].map(([id,symbol,title,desc]) => `<button type="button" class="demo-option" data-action="demo-login" data-role="${id}">${icon(symbol)}<strong>${title}</strong><small>${desc}</small></button>`).join('')}</div>` : `<form id="login-form"><div class="field"><label for="login-email">Código o correo electrónico</label><input id="login-email" name="email" type="text" autocomplete="username" required placeholder="Código de alumno o correo" /></div><div class="field"><label for="login-password">Contraseña</label><div class="input-action"><input id="login-password" name="password" type="password" autocomplete="current-password" required placeholder="Tu contraseña" /><button class="icon-button" type="button" data-action="show-password" data-target="login-password" aria-label="Mostrar u ocultar contraseña">${icon('key')}</button></div></div><div class="login-forgot"><button type="button" data-action="forgot">¿Olvidaste tu contraseña?</button></div><div class="field-error" id="login-error" role="alert"></div><button class="button primary full" type="submit">Ingresar al aula ${icon('arrow')}</button></form>`}${demo ? `<div class="demo-disclosure">${icon('info')} Esta es una demostración local. Los cambios se guardan solo en este navegador y las cuentas no se crean todavía en Firebase. No uses correos ni contraseñas reales.</div>` : `<div class="helper-text">¿Aún no tienes acceso? Solicita tu cuenta y los cursos correspondientes al administrador.</div>`}</div></section></div>`;
}
function dashboard() {
  const d = state.data; const admin = isManager(); const graded = d.attempts.filter(a => a.status === 'graded');
  const upcoming = d.sessions.filter(s => Date.parse(s.startsAt) >= Date.now() - 2 * 3600000).sort((a,b) => Date.parse(a.startsAt)-Date.parse(b.startsAt));
  const stats = admin ? [['grid',d.courses.length,'Cursos administrados'],['users',d.users.filter(u => u.role === 'student').length,service.mode === 'demo' ? 'Alumnos en el aula' : 'Alumnos cargados'],['file',d.assignments.length,'Trabajos publicados'],['clipboard',d.exams.length,'Evaluaciones creadas']]
    : [['grid',d.courses.length,'Cursos habilitados'],['file',d.assignments.length,'Trabajos publicados'],['clipboard',d.exams.length,'Evaluaciones disponibles'],['chart',graded.length+d.submissions.filter(s=>s.status==='graded').length,'Actividades calificadas']];
  const hero = `<section class="welcome"><div class="welcome-copy"><div class="eyebrow">${admin ? 'Un espacio para enseñar' : 'Un espacio para crecer'}</div><h2>${admin ? 'Gestiona tu aula.<br>Impulsa el aprendizaje.' : 'Tu próximo logro<br>empieza hoy.'}</h2><p>${admin ? 'Organiza tus cursos, comparte conocimiento y acompaña a cada alumno a su siguiente paso.' : 'Encuentra tus materiales, practica lo aprendido y continúa avanzando en tus cursos.'}</p><a href="#courses" class="button primary">${admin ? 'Administrar cursos' : 'Explorar mis cursos'}${icon('arrow')}</a></div><div class="welcome-art">${art({ color:'sage' })}</div></section>`;
  return `${pageHead(admin ? 'Panel académico' : `Hola, ${d.user.displayName.split(' ')[0]}.`, admin ? 'Cursos, alumnos y evaluaciones en un solo lugar.' : 'Este es tu espacio para seguir aprendiendo.')}
  <div class="welcome-grid">${hero}<section class="panel quick-panel"><p class="eyebrow">${admin ? 'Atajos de tu aula' : 'El siguiente paso'}</p><h2>${admin ? 'Gestiona tu día' : 'Sigue tu camino.'}</h2><p>${admin ? 'Los cursos y accesos se administran desde tu panel.' : 'Solo aparecen los cursos que tu docente te ha habilitado.'}</p><div class="quick-links">${admin ? `<button data-action="new-course">${icon('plus')}Crear un curso${icon('arrow','arrow')}</button>${d.user.role === "owner" ? `<button data-action="new-user">${icon("users")}Crear acceso${icon("arrow","arrow")}</button>` : ""}` : `<a href="#work">${icon('file')}Revisar mis trabajos${icon('arrow','arrow')}</a><a href="#grades">${icon('chart')}Consultar mis notas${icon('arrow','arrow')}</a>`}</div></section></div>
  <div class="stats">${stats.map(([symbol,n,label])=>`<div class="stat"><div class="stat-icon">${icon(symbol)}</div><div><strong>${n}</strong><span>${label}</span></div></div>`).join('')}</div>
  <div class="section-head"><h2>${admin ? 'Cursos de tu aula' : 'Tus cursos'}</h2><a href="#courses">Ver todos ${icon('arrow')}</a></div>${d.courses.length ? `<div class="course-grid">${d.courses.slice(0,3).map(courseCard).join('')}</div>` : empty('Tu aula está lista para comenzar',admin ? 'Crea tu primer curso y después asigna los alumnos que tendrán acceso.' : 'Tu docente todavía no ha habilitado cursos para tu cuenta.','book',admin ? button('Crear primer curso','new-course') : '')}
  <div class="home-bottom"><section class="panel"><div class="panel-head"><h2>${admin ? 'Actividad reciente' : 'A mano para aprender'}</h2><span class="small muted">${d.materials.length} disponibles</span></div>${d.materials.slice(-3).reverse().map(m=>`<div class="activity-row"><div class="stat-icon">${icon(m.kind === 'video' || m.kind === 'recording' ? 'play' : 'file')}</div><div><strong>${esc(m.title)}</strong><p>${esc(courseById(m.courseId)?.title)} · ${esc(m.module)}</p></div><a class="icon-button row-end" href="#course/${esc(m.courseId)}/materials" aria-label="Abrir curso">${icon('arrow')}</a></div>`).join('') || `<p class="helper-text">${admin ? 'Los materiales que subas aparecerán aquí.' : 'Encontrarás aquí los materiales de tus cursos.'}</p>`}</section><section class="panel"><div class="panel-head"><h2>Próximas clases</h2><a href="#agenda">Ver agenda</a></div>${upcoming.slice(0,2).map(s=>`<div class="activity-row"><div class="stat-icon">${icon('video')}</div><div><strong>${esc(s.title)}</strong><p>${fmtDate(s.startsAt)} · ${fmtTime(s.startsAt)}</p></div></div>`).join('') || `<p class="helper-text">${admin ? 'Programa una clase dentro de un curso para que aparezca en la agenda.' : 'Las clases que programe tu docente aparecerán aquí.'}</p>`}<div class="mini-note">${icon('lock')}<div><strong>Un aula para cada grupo.</strong><p>Los accesos se habilitan por matrícula, nivel y grado o ciclo.</p></div></div></section></div>`;
}
function coursesPage() {
  const all = state.data.courses, q = state.search.toLowerCase();
  const groups = [...new Set(all.map(c => [c.stage && stageLabel(c),c.career,c.section,c.period].filter(Boolean).join(' · ')))].filter(Boolean);
  const courses = all.filter(c => (state.filter === 'all' || c.level === state.filter) && (!state.academicFilter || [c.stage && stageLabel(c),c.career,c.section,c.period].filter(Boolean).join(' · ') === state.academicFilter) && `${c.title} ${c.description} ${levelLabel(c)}`.toLowerCase().includes(q));
  return `${pageHead(isManager() ? 'Un espacio para cada curso.' : 'Tus cursos, tu camino.',isManager() ? 'Organiza cada grado o ciclo con sus propios materiales, clases y actividades.' : 'Accede a los cursos habilitados para tu matrícula.',isManager() ? button('Nuevo curso','new-course') : '')}<div class="filterbar"><div class="chips">${[['all','Todos'],...Object.entries(LEVELS)].map(([value,label])=>`<button class="chip ${state.filter === value ? 'active' : ''}" data-action="filter" data-filter="${value}">${esc(label)}</button>`).join('')}</div><span class="filter-count">${courses.length} cursos</span></div><div class="course-filters"><label class="inline-search">${icon('search')}<input id="course-search" aria-label="Buscar curso" type="search" placeholder="Busca tu próximo aprendizaje…" value="${esc(state.search)}"></label><label class="group-filter"><span>Grupo</span><select id="academic-filter"><option value="">Todos los grupos</option>${groups.map(g=>`<option ${g===state.academicFilter?'selected':''} value="${esc(g)}">${esc(g)}</option>`).join('')}</select></label></div>${courses.length ? `<div class="course-grid">${courses.map(courseCard).join('')}</div>` : empty('No hay cursos para mostrar','Prueba con otro filtro o término de búsqueda.','grid')}${state.data.hasMoreCourses ? `<div class="section-head">${button('Cargar más cursos','more-courses','arrow','secondary')}</div>` : ''}`;
}

function selectedModule(c) { return state.modules[c.id] || 'all'; }
function inModule(c,item) { return selectedModule(c) === 'all' || item.module === selectedModule(c); }
function moduleField(c,selected = null) {
  selected ||= selectedModule(c) === 'all' ? courseModules(c)[0] : selectedModule(c);
  return `<div class="field"><label for="f-module">${c.level==='secondary'?'Semestre':c.level==='university'?'Unidad':'Módulo'}</label><select id="f-module" name="module" required>${courseModules(c).map(m=>`<option value="${esc(m)}" ${m===selected?'selected':''}>${esc(m)}</option>`).join('')}</select></div>`;
}
function academicForm(value) {
  return `<div class="field-row triple academic-fields">${field('Carrera (si corresponde)','career',value.career,'maxlength="80" placeholder="Ej. Ingeniería de sistemas"')}${field('Sección / grupo','section',value.section,'maxlength="80" placeholder="Ej. A"')}${field('Periodo académico','period',value.period,'maxlength="80" placeholder="Ej. 2026-II"')}</div>`;
}
function moreContent(c,name,assignmentId=null) {
  return state.data.hasMoreContent?.[`${c.id}:${name}`] ? `<div class="section-head">${button('Cargar más','more-content','arrow','secondary',`data-course="${esc(c.id)}" data-list="${name}" ${assignmentId?`data-assignment="${esc(assignmentId)}"`:''}`)}</div>` : '';
}
function materialList(c, recordings = false) {
  const materials = state.data.materials.filter(m => m.courseId === c.id && inModule(c,m) && (recordings ? m.kind === 'recording' : m.kind !== 'recording'));
  const manage = canManageCourse(state.data.user,c); const groups = [...new Set(materials.map(m => m.module))];
  return `<div class="section-head"><h2>${recordings ? 'Grabaciones de tus clases' : 'Materiales del curso'}</h2>${manage ? button(recordings ? 'Subir grabación' : 'Agregar material',recordings ? 'new-recording' : 'new-material','plus','secondary',`data-course="${esc(c.id)}"`) : ''}</div>${materials.length ? groups.map(group=>`<section class="materials-group"><h3>${esc(group)}</h3>${materials.filter(m=>m.module === group).map(m=>`<article class="material-row"><div class="material-icon ${['video','recording'].includes(m.kind) ? 'video' : m.kind}">${icon(['video','recording'].includes(m.kind) ? 'play' : m.kind === 'link' ? 'link' : 'file')}</div><div class="material-text"><strong>${esc(m.title)}</strong><p>${esc(m.filename || (m.kind === 'recording' ? 'Grabación' : m.kind === 'link' ? 'Recurso en línea' : 'Video'))} · ${size(m.size)}</p>${m.description ? `<p>${esc(m.description)}</p>` : ''}</div><div class="actions">${button(['video','recording'].includes(m.kind) ? 'Ver' : 'Abrir','open-material',['video','recording'].includes(m.kind) ? 'play' : 'download','secondary compact',`data-course="${esc(c.id)}" data-id="${esc(m.id)}"`)}${manage ? `<button class="icon-button" data-action="delete-material" data-course="${esc(c.id)}" data-id="${esc(m.id)}" aria-label="Eliminar ${esc(m.title)}">${icon('trash')}</button>` : ''}</div></article>`).join('')}</section>`).join('') : empty(recordings ? 'Las clases también se pueden volver a ver.' : 'Un lugar para todo lo que enseñas.',manage ? recordings ? 'Sube la grabación o agrega su enlace para que tus alumnos puedan revisarla.' : 'Comparte guías, documentos, presentaciones, videos o enlaces.' : 'Tu docente compartirá aquí los recursos de este curso.',recordings ? 'video' : 'file')}`;
}
function examCard(e) {
  const c = courseById(e.courseId); const manage = canManageCourse(state.data.user,c);
  const attempt = state.data.attempts.find(a => a.examId === e.id && a.uid === state.data.user.id);
  const available = examAvailable(e);
  return `<article class="panel exam-card"><div class="exam-card-top"><div class="stat-icon">${icon('clipboard')}</div>${badge(attempt?.status === 'graded' ? 'Completado' : !e.published ? 'Borrador' : available ? 'Disponible' : 'Fuera de horario',attempt?.status === 'graded' || available ? 'green' : 'amber')}</div><p class="eyebrow">${esc(c?.title || '')} · ${esc(e.module || '')}</p><h3>${esc(e.title)}</h3><div class="exam-detail"><span>${icon('clock')}${e.minutes} minutos</span><span>${icon('file')}${e.questions.length} preguntas</span><span>1 intento</span></div>${e.closesAt ? `<p class="small muted">Cierre: ${fmtDate(e.closesAt)} · ${fmtTime(e.closesAt)}</p>` : ''}<div class="exam-card-bottom">${attempt?.status === 'graded' ? `<span class="grade-big">${attempt.score20}<small> / 20</small></span>${button('Ver resultado','exam-result','chart','secondary compact',`data-id="${esc(attempt.id)}"`)}` : manage ? `${button('Editar examen','edit-exam','edit','secondary',`data-course="${esc(e.courseId)}" data-id="${esc(e.id)}"`)}<span class="small muted">Nota sobre 20</span>` : `${button(attempt ? 'Continuar examen' : 'Rendir examen','start-exam','arrow','primary',`data-course="${esc(e.courseId)}" data-id="${esc(e.id)}" ${!available && !attempt ? 'disabled' : ''}`)}<span class="small muted">Nota automática</span>`}</div></article>`;
}
function courseExams(c) {
  const exams = state.data.exams.filter(e => e.courseId === c.id && inModule(c,e));
  return `<div class="section-head"><h2>Evaluaciones del curso</h2>${canManageCourse(state.data.user,c) ? button('Crear examen','new-exam','plus','secondary',`data-course="${esc(c.id)}"`) : ''}</div>${exams.length ? `<div class="exam-list">${exams.map(examCard).join('')}</div>` : empty('Pon en práctica lo aprendido.',canManageCourse(state.data.user,c) ? 'Crea preguntas de alternativas y establece el tiempo. La nota se calcula al entregar.' : 'Las evaluaciones de este curso aparecerán aquí.','clipboard')}`;
}
function sessionsList(sessions, withCourse = false) {
  return [...sessions].sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt)).map(s=>{
    const c = courseById(s.courseId), manage = canManageCourse(state.data.user,c), ended = Date.now() > Date.parse(s.endsAt);
    return `<article class="panel session-row"><div class="session-date"><strong>${new Date(s.startsAt).toLocaleDateString('es-PE',{day:'numeric',timeZone:'America/Lima'})}</strong><small>${new Date(s.startsAt).toLocaleDateString('es-PE',{month:'short',timeZone:'America/Lima'})}</small></div><div class="session-content"><div class="session-labels">${badge(s.module)}${badge(ended?'Clase anterior':'Programada',ended?'':'green')}</div><h3>${esc(s.title)}</h3><p>${withCourse ? `${esc(c?.title)} · ` : ''}${fmtTime(s.startsAt)} (Perú) · ${esc(s.provider)} · ${s.minutes} min</p></div><div class="actions"><a class="button secondary" href="${esc(safeURL(s.meetingUrl) || '#')}" target="_blank" rel="noopener noreferrer">${icon('video')}Abrir ${s.provider==='Google Meet'?'Meet':'clase'}</a>${manage ? `<button class="icon-button" data-action="edit-session" data-course="${esc(s.courseId)}" data-id="${esc(s.id)}" aria-label="Editar clase">${icon('edit')}</button><button class="icon-button" data-action="delete-session" data-course="${esc(s.courseId)}" data-id="${esc(s.id)}" aria-label="Eliminar clase">${icon('trash')}</button>` : ''}</div></article>`;
  }).join('');
}
function courseSessions(c) {
  const sessions = state.data.sessions.filter(s => s.courseId === c.id && inModule(c,s));
  return `<div class="section-head"><h2>Nos encontramos en clase</h2>${canManageCourse(state.data.user,c) ? button('Programar clase','new-session','plus','primary',`data-course="${esc(c.id)}"`) : ''}</div>${sessions.length ? sessionsList(sessions) : empty('La próxima clase empieza aquí.',isManager() ? 'Publica el enlace de Meet y elige su unidad o semestre.' : 'Tu docente publicará el enlace, la fecha y el horario de cada clase.','video')}${moreContent(c,'sessions')}<div class="mini-note">${icon('video')}<div><strong>En vivo y a tu ritmo.</strong><p>Meet se abre en otra pestaña. El docente graba con una aplicación externa y después comparte el video en Grabaciones, dentro del mismo apartado.</p></div></div>`;
}
function coursePage(id, tab) {
  const c = courseById(id); if (!c) return empty('Este curso no está habilitado para tu cuenta.','Consulta con tu docente las matrículas que te corresponden.','lock');
  const tabs = [['overview','book','Resumen'],['materials','file','Materiales'],['work','edit','Trabajos'],['exams','clipboard','Exámenes'],['live','video','Clases en Meet'],['recordings','play','Grabaciones'],['notices','info','Avisos'],...(canManageCourse(state.data.user,c) ? [['roster','users','Alumnos']] : [])];
  if (!tabs.some(t => t[0] === tab)) tab = 'overview';
  const content = tab==='overview' ? courseOverview(c) : tab === 'materials' ? materialList(c)+moreContent(c,'materials') : tab === 'recordings' ? materialList(c,true)+moreContent(c,'materials') : tab === 'work' ? courseWork(c) : tab === 'exams' ? courseExams(c)+moreContent(c,'exams') : tab === 'live' ? courseSessions(c) : tab === 'notices' ? courseNotices(c) : usersPage(id);
  const organization = c.level==='secondary'?'Semestres':c.level==='university'?'Unidades':'Módulos';
  return `<a href="#courses" class="back-link">${icon('back')}Todos los cursos</a><header class="course-header ${esc(c.color)}"><span class="eyebrow">${esc(levelLabel(c))}</span><h1>${esc(c.title)}</h1><p>${esc(c.description)}</p><div class="course-header-meta"><span>${icon('shield')}${c.published ? 'Curso habilitado' : 'Curso en borrador'}</span>${canManageCourse(state.data.user,c) ? `<button class="button ghost compact" data-action="edit-course" data-id="${esc(c.id)}">${icon('settings')}Editar curso</button>` : `<span>${icon('lock')}Acceso por matrícula</span>`}</div>${art(c)}</header><div class="module-bar"><div><strong>${icon('grid')}${organization} del curso</strong><span>Encuentra aquí todo lo relacionado a cada apartado.</span></div><label><span class="sr-only">Elegir apartado</span><select id="course-module-filter" data-course="${esc(c.id)}"><option value="all">Ver todos los apartados</option>${courseModules(c).map(m=>`<option value="${esc(m)}" ${selectedModule(c)===m?'selected':''}>${esc(m)}</option>`).join('')}</select></label></div><nav class="tabs" aria-label="Apartados del curso">${tabs.map(([name,symbol,label])=>`<a class="tab ${tab === name ? 'active' : ''}" href="#course/${esc(c.id)}/${name}">${icon(symbol)}${label}</a>`).join('')}</nav>${content}`;
}
function courseOverview(c) {
  const d=state.data, tasks=d.assignments.filter(a=>a.courseId===c.id&&inModule(c,a)), exams=d.exams.filter(e=>e.courseId===c.id&&inModule(c,e)), materials=d.materials.filter(m=>m.courseId===c.id&&inModule(c,m));
  const finished=tasks.filter(a=>d.submissions.some(s=>s.assignmentId===a.id&&s.uid===d.user.id&&['submitted','graded'].includes(s.status))).length+exams.filter(e=>d.attempts.some(a=>a.examId===e.id&&a.uid===d.user.id&&a.status==='graded')).length;
  const total=tasks.filter(a=>a.published).length+exams.filter(e=>e.published).length, percent=total?Math.round(finished/total*100):0;
  const sessions=d.sessions.filter(s=>s.courseId===c.id&&inModule(c,s)&&Date.parse(s.endsAt)>Date.now()).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt));
  return `<div class="overview-grid"><section class="panel learning-panel"><p class="eyebrow">${esc(selectedModule(c)==='all'?'Tu ruta de aprendizaje':selectedModule(c))}</p><h2>Cada paso cuenta.</h2><p>Revisa los materiales, participa en clase y entrega tus actividades desde este espacio.</p><div class="overview-counts"><a href="#course/${esc(c.id)}/materials"><strong>${materials.filter(m=>m.kind!=='recording').length}</strong>Materiales</a><a href="#course/${esc(c.id)}/work"><strong>${tasks.length}</strong>Trabajos</a><a href="#course/${esc(c.id)}/exams"><strong>${exams.length}</strong>Exámenes</a><a href="#course/${esc(c.id)}/recordings"><strong>${materials.filter(m=>m.kind==='recording').length}</strong>Grabaciones</a></div>${!isManager()?`<div class="progress-label"><span>${finished} de ${total} actividades entregadas</span><strong>${percent}%</strong></div><progress max="100" value="${percent}" aria-label="Actividades entregadas">${percent}%</progress>`:''}</section><section class="panel"><div class="panel-head"><h2>Próxima clase</h2>${icon('video')}</div>${sessions[0]?`<div class="next-class">${badge(sessions[0].module,'green')}<h3>${esc(sessions[0].title)}</h3><p>${fmtDate(sessions[0].startsAt)} · ${fmtTime(sessions[0].startsAt)} (Perú)</p><a class="button primary" href="${esc(sessions[0].meetingUrl)}" target="_blank" rel="noopener noreferrer">${icon('video')}Abrir Meet</a></div>`:`<p class="helper-text">${isManager()?'Programa una clase y comparte el enlace de Meet con este grupo.':'Tu docente anunciará la próxima clase aquí.'}</p><a class="button secondary" href="#course/${esc(c.id)}/live">Ver clases ${icon('arrow')}</a>`}</section></div>${courseNotices(c,true)}<div class="section-head"><h2>Actividades para avanzar</h2><a href="#course/${esc(c.id)}/work">Ver todos los trabajos ${icon('arrow')}</a></div>${tasks.length?`<div class="assignment-grid">${tasks.slice(0,2).map(assignmentCard).join('')}</div>`:empty('Tu próxima actividad aparecerá aquí.','Mientras tanto, puedes revisar los materiales de este apartado.','file')}`;
}
function assignmentCard(a) {
  const c=courseById(a.courseId), manage=canManageCourse(state.data.user,c), s=state.data.submissions.find(s=>s.assignmentId===a.id&&s.uid===state.data.user.id);
  const closed=a.dueAt&&Date.parse(a.dueAt)<Date.now()&&!a.allowLate, label=!a.published?'Borrador':s?.status==='graded'?'Calificado':s?.status==='returned'?'Por corregir':s?'Entregado':closed?'Plazo cerrado':'Pendiente';
  const count=state.data.submissions.filter(s=>s.assignmentId===a.id).length;
  return `<article class="panel assignment-card"><div class="assignment-top"><span class="stat-icon">${icon('edit')}</span>${badge(manage?(a.published?'Publicado':'Borrador'):label,s&&s.status!=='returned'?'green':closed?'red':'amber')}</div><p class="eyebrow">${esc(c?.title)} · ${esc(a.module)}</p><h3>${esc(a.title)}</h3><p class="assignment-preview">${esc(a.instructions)}</p><div class="assignment-deadline">${icon('calendar')}${a.dueAt?'Entrega: '+fmtDate(a.dueAt)+' · '+fmtTime(a.dueAt)+' (Perú)':'Sin fecha límite'}</div><div class="assignment-bottom">${manage?`${button('Ver entregas','assignment-detail','users','primary compact',`data-course="${esc(a.courseId)}" data-id="${esc(a.id)}"`)}<span class="small muted">${count} entregas</span><button class="icon-button" data-action="edit-assignment" data-course="${esc(a.courseId)}" data-id="${esc(a.id)}" aria-label="Editar trabajo">${icon('edit')}</button>`:`${button(s?'Ver mi entrega':'Abrir trabajo','assignment-detail','arrow',s?'secondary':'primary',`data-course="${esc(a.courseId)}" data-id="${esc(a.id)}"`)}${s?.status==='graded'?`<span class="grade-big">${s.score20}<small> / 20</small></span>`:''}`}</div></article>`;
}
function courseWork(c) {
  const list=state.data.assignments.filter(a=>a.courseId===c.id&&inModule(c,a));
  return `<div class="section-head"><h2>${isManager()?'Trabajos y entregas':'Mis trabajos'}</h2>${canManageCourse(state.data.user,c)?button('Crear trabajo','new-assignment','plus','primary',`data-course="${esc(c.id)}"`):''}</div>${list.length?`<div class="assignment-grid">${list.map(assignmentCard).join('')}</div>`:empty('Aprendemos haciendo.','Los trabajos y sus indicaciones aparecerán en este apartado.','edit')}${moreContent(c,'assignments')}`;
}
function workPage() {
  const list=state.data.assignments;
  return `${pageHead(isManager()?'Cada entrega merece atención.':'Tu trabajo, paso a paso.',isManager()?'Consulta los trabajos y acompaña a tus alumnos con notas y comentarios.':'Abre una actividad para revisar las indicaciones, entregar y consultar tu devolución.')}<div class="assignment-grid">${list.map(assignmentCard).join('')}</div>${!list.length?empty('Todavía no hay trabajos.','Los encontrarás aquí cuando el docente los publique.','file'):''}${globalPaging('assignments')}`;
}
function announcementCard(a) {
  const c=courseById(a.courseId), manage=canManageCourse(state.data.user,c);
  return `<article class="panel notice-card"><div class="notice-top"><span>${badge(a.module)}${a.pinned?badge('Destacado','green'):''}</span>${manage?`<div class="actions"><button class="icon-button" data-action="edit-notice" data-course="${esc(a.courseId)}" data-id="${esc(a.id)}" aria-label="Editar aviso">${icon('edit')}</button><button class="icon-button" data-action="delete-notice" data-course="${esc(a.courseId)}" data-id="${esc(a.id)}" aria-label="Eliminar aviso">${icon('trash')}</button></div>`:''}</div><p class="eyebrow">${esc(c?.title)}</p><h3>${esc(a.title)}</h3><p class="notice-text">${esc(a.text)}</p><footer>${fmtDate(a.createdAt)} · ${fmtTime(a.createdAt)}<a href="#course/${esc(a.courseId)}/notices">Ir al curso ${icon('arrow')}</a></footer></article>`;
}
function courseNotices(c,preview=false) {
  let list=state.data.announcements.filter(a=>a.courseId===c.id&&inModule(c,a)).sort((a,b)=>Number(b.pinned)-Number(a.pinned)||Date.parse(b.createdAt)-Date.parse(a.createdAt));
  if(preview)list=list.slice(0,2);
  return `<div class="section-head"><h2>Avisos del curso</h2>${!preview&&canManageCourse(state.data.user,c)?button('Publicar aviso','new-notice','plus','secondary',`data-course="${esc(c.id)}"`):''}</div>${list.length?`<div class="notice-grid">${list.map(announcementCard).join('')}</div>`:empty('Estamos en contacto.','Las novedades de este apartado aparecerán aquí.','info')}${!preview?moreContent(c,'announcements'):''}`;
}
function noticesPage() {
  const list=[...state.data.announcements].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||Date.parse(b.createdAt)-Date.parse(a.createdAt));
  return `${pageHead('Mantente al día.','Novedades y orientaciones de tus cursos, en un solo lugar.')}<div class="notice-grid">${list.map(announcementCard).join('')}</div>${!list.length?empty('Sin avisos por ahora.','Las novedades de tus cursos se publicarán aquí.','info'):''}${globalPaging('announcements')}`;
}
function globalPaging(name) {
  return state.data.courses.filter(c=>state.data.hasMoreContent?.[`${c.id}:${name}`]).map(c=>`<div class="pagination-row"><span>${esc(c.title)}</span>${moreContent(c,name)}</div>`).join('');
}
function usersTable(users) {
  return `<div class="table-wrap"><table class="data-table"><thead><tr><th>Usuario</th><th>Nivel / grado o ciclo</th><th>Rol</th><th>Acceso</th><th>Cursos</th><th>Acciones</th></tr></thead><tbody>${users.map(u=>{
    const managed = canManageUser(state.data.user,u,state.data.courses,state.data.enrollments);
    const enrolled = state.data.enrollments.filter(e => e.uid === u.id && e.active).length;
    return `<tr><td><div class="person-cell"><span class="avatar ${u.level === 'university' ? 'indigo' : u.role === 'student' ? 'sage' : ''}">${esc(initials(u.displayName))}</span><div><strong>${esc(u.displayName)}</strong><small>${esc(u.email)}</small>${u.studentCode ? `<small class="student-code">${esc(u.studentCode)}</small>` : ''}</div></div></td><td>${u.role === 'student' ? esc(levelLabel(u)) : '—'}</td><td>${esc(ROLES[u.role])}</td><td>${badge(u.active ? 'Habilitado' : 'Suspendido',u.active ? 'green dot' : 'red dot')}</td><td>${u.role === 'student' ? enrolled : '—'}</td><td><div class="table-actions">${managed ? `<button class="icon-button" data-action="edit-user" data-id="${esc(u.id)}" title="Editar usuario y matrículas" aria-label="Editar ${esc(u.displayName)}">${icon('edit')}</button><button class="icon-button" data-action="recovery" data-id="${esc(u.id)}" title="Generar enlace de recuperación" aria-label="Recuperar acceso de ${esc(u.displayName)}">${icon('key')}</button><button class="icon-button" data-action="toggle-user" data-id="${esc(u.id)}" title="${u.active ? 'Suspender' : 'Habilitar'} acceso" aria-label="${u.active ? 'Suspender' : 'Habilitar'} a ${esc(u.displayName)}">${icon(u.active ? 'lock' : 'check')}</button>` : '<span class="muted small">Cuenta protegida</span>'}</div></td></tr>`;
  }).join('')}</tbody></table></div>`;
}
function usersPage(courseId = null) {
  const data = state.data; let users = courseId ? data.users : data.userResults || data.users;
  if (courseId) users = users.filter(u => data.enrollments.some(e => e.uid === u.id && e.courseId === courseId && e.active));
  const q = state.userSearch.toLowerCase(); users = users.filter(u => `${u.displayName} ${u.email} ${u.studentCode || ""}`.toLowerCase().includes(q));
  return `${courseId ? `<div class="section-head"><h2>Alumnos matriculados</h2>${data.user.role === 'owner' ? button('Agregar alumno','new-user','plus','secondary',`data-course="${esc(courseId)}"`) : ''}</div>` : pageHead('Cada alumno, su acceso.','Crea cuentas y asigna únicamente los cursos que les corresponden.',data.user.role === 'owner' ? button('Nuevo usuario','new-user') : '')}<div class="filterbar"><label class="inline-search">${icon('search')}<input id="user-search" type="search" aria-label="Buscar usuario" placeholder="Buscar nombre, correo o código…" value="${esc(state.userSearch)}" /></label><span class="filter-count">${users.length} ${users.length === 1 ? 'usuario' : 'usuarios'}${service.mode === 'firebase' ? ' cargados' : ''}</span></div><div id="users-results">${users.length ? usersTable(users) : empty('No hay usuarios para mostrar.','Agrega un alumno o revisa tu búsqueda.','users')}</div>${service.mode==='firebase'&&courseId&&data.hasMoreRoster?`<div class="section-head">${button('Cargar más alumnos','more-roster','arrow','secondary')}</div>`:''}${service.mode === 'firebase' && data.hasMoreUsers && !courseId ? `<div class="section-head">${button('Cargar más usuarios','more-users','arrow','secondary')}</div>` : ''}<p class="helper-text">Las matrículas habilitan el acceso a materiales, trabajos, exámenes y grabaciones. ${service.mode === 'demo' ? 'Las cuentas de esta demostración son locales; utiliza únicamente datos de prueba.' : 'Las contraseñas se administran en Firebase Authentication y no se muestran en este panel.'}</p>`;
}
function examsPage() {
  const exams = state.data.exams;
  return `${pageHead('Aprender también es practicar.',isManager() ? 'Las evaluaciones de tus cursos, organizadas en un solo lugar.' : 'Revisa tus evaluaciones. Al entregar, recibirás tu nota automáticamente.')} ${exams.length ? `<div class="exam-list">${exams.map(examCard).join('')}</div>` : empty('Todavía no hay evaluaciones.','Encontrarás los exámenes dentro de cada curso y en este apartado.','clipboard')}`;
}
function gradesPage() {
  const results=[...state.data.attempts.filter(a=>a.status==='graded').map(a=>({...a,type:'Examen'})),...state.data.submissions.filter(s=>s.status==='graded').map(s=>({...s,type:'Trabajo'}))].sort((a,b)=>b.submittedAt-a.submittedAt);
  return `${pageHead(isManager()?'Los resultados, a la vista.':'Así vas avanzando.',isManager()?'Notas de exámenes y trabajos. Revisa cada entrega para acompañar el aprendizaje.':'Tus notas de exámenes, trabajos y comentarios del docente.',results.length?button('Exportar notas','export-grades','download','secondary'):'')}${results.length?`<div class="table-wrap"><table class="data-table"><thead><tr>${isManager()?'<th>Alumno</th>':''}<th>Actividad</th><th>Tipo / apartado</th><th>Curso</th><th>Nota</th><th>Entrega</th><th>Detalle</th></tr></thead><tbody>${results.map(a=>`<tr>${isManager()?`<td>${esc(a.displayName||state.data.users.find(u=>u.id===a.uid)?.displayName||'Alumno')}</td>`:''}<td>${esc(a.title)}</td><td>${esc(a.type)}<small class="table-subline">${esc(a.module || '')}</small></td><td>${esc(courseById(a.courseId)?.title || 'Curso anterior')}</td><td><span class="grade-big">${a.score20}<small> / 20</small></span></td><td>${fmtDate(a.submittedAt)} · ${fmtTime(a.submittedAt)}</td><td>${a.type==='Trabajo'?button(isManager()?'Revisar':'Ver devolución',isManager()?'review-submission':'assignment-detail','arrow','secondary compact',`data-id="${esc(isManager()?a.id:a.assignmentId)}" data-course="${esc(a.courseId)}"`):isManager()?`${a.correct} / ${a.questionCount} correctas`:button('Ver resultado','exam-result','chart','secondary compact',`data-id="${esc(a.id)}"`)}</td></tr>`).join('')}</tbody></table></div>`:empty('Cada resultado cuenta.','Tus notas aparecerán aquí después de entregar un examen o recibir la calificación de un trabajo.','chart')}${results.length?'<p class="helper-text">Las notas se muestran por actividad sobre 20. No se calcula un promedio oficial sin definir los pesos de cada curso.</p>':''}${isManager()?globalPaging('attempts')+globalPaging('submissions'):['attempts','submissions'].map(name=>state.data.hasMoreContent?.['student:'+name]?button('Cargar más resultados','more-results','arrow','secondary',`data-list="${name}"`):'').join('')}`;
}
function agendaPage() {
  const tasks=state.data.assignments.filter(a=>a.published&&a.dueAt).sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));
  return `${pageHead('Hagamos espacio para aprender.','Clases por Meet y fechas de entrega. Todos los horarios se muestran en hora de Perú.')}<div class="section-head"><h2>Clases programadas</h2></div>${state.data.sessions.length?sessionsList(state.data.sessions,true):empty('Todavía no hay clases programadas.','El docente puede publicar un enlace de Meet desde cada curso.','calendar')}${globalPaging('sessions')}<div class="section-head"><h2>Fechas de entrega</h2><a href="#work">Ver trabajos ${icon('arrow')}</a></div>${tasks.length?`<div class="assignment-grid">${tasks.map(assignmentCard).join('')}</div>`:empty('Sin fechas de entrega por ahora.','Las actividades con fecha límite aparecerán aquí.','file')}`;
}
function settingsPage() {
  return `${pageHead('Tu aula, bien organizada.','Revisa el funcionamiento y prepara la conexión con tu proyecto.')}
    <div class="settings-grid"><section class="panel"><div class="setting-icon">${icon('cloud')}</div><div class="panel-head"><h2>Conexión del aula</h2>${badge(service.mode === 'demo' ? 'Pendiente de vincular' : 'Firebase conectado',service.mode === 'demo' ? 'amber' : 'green')}</div><p>${service.mode === 'demo' ? 'La experiencia navegable funciona con datos de prueba en este navegador. Las cuentas y archivos reales se habilitan al conectar el proyecto propio de Firebase.' : 'Los accesos y el contenido se guardan en tu proyecto de Firebase.'}</p><div class="settings-list"><div><span>Proyecto</span><span>${esc(config.firebase?.projectId || 'Proyecto nuevo pendiente')}</span></div><div><span>Usuarios</span><span>${service.mode === 'demo' ? 'Cuentas locales de prueba' : 'Firebase Authentication'}</span></div><div><span>Datos</span><span>${service.mode === 'demo' ? 'Este navegador' : 'Cloud Firestore'}</span></div></div>${button('Ver pasos de conexión','connection-guide','arrow','secondary')}</section>
    <section class="panel"><div class="setting-icon">${icon('shield')}</div><h2>Accesos por rol</h2><p>El administrador organiza toda el aula. El docente administra sus cursos y alumnos. Cada alumno accede a sus matrículas.</p><div class="settings-list"><div><span>Contraseñas visibles en el panel</span><span>No</span></div><div><span>Registro público de alumnos</span><span>Deshabilitado en la interfaz</span></div><div><span>Escala de notas</span><span>0 a 20</span></div><div><span>Intentos por examen</span><span>1</span></div></div></section>
    <section class="panel wide"><h2>De tu panel al aula del alumno.</h2><p>El docente administra el contenido sin modificar el código de la página.</p><div class="steps"><div><span class="step-number">01</span><h3>Crea un curso</h3><p>Define el nivel, grado o ciclo y el docente responsable.</p></div><div><span class="step-number">02</span><h3>Agrega los alumnos</h3><p>Crea sus cuentas y selecciona las matrículas que les corresponden.</p></div><div><span class="step-number">03</span><h3>Comparte y evalúa</h3><p>Sube materiales, publica exámenes y programa las clases desde cada curso.</p></div></div></section>
    ${service.mode === 'demo' ? `<section class="panel wide"><h2>Restablecer la demostración</h2><p>Elimina los cambios locales y vuelve a los cursos y alumnos de ejemplo. No modifica ningún proyecto de Firebase.</p>${button('Restablecer datos de prueba','reset-demo','trash','danger')}</section>` : ''}</div>`;
}
function render() {
  if (!state.data) return login();
  const r = route(); const admin = isManager();
  const pages = { home: dashboard, courses: coursesPage, work: workPage, notices: noticesPage, exams: examsPage, grades: gradesPage, agenda: agendaPage, settings: settingsPage, users: usersPage };
  const restricted = (r.name === 'users' && !admin) || (r.name === 'settings' && state.data.user.role !== 'owner');
  shell(restricted ? empty('Este apartado es de administración.','Puedes continuar en tus cursos habilitados.','lock') : r.name === 'course' ? coursePage(r.id,r.tab) : (pages[r.name] || dashboard)());
}
async function prepareRoster(append=false) {
  const r=route();if(service.mode!=='firebase'||r.name!=='course'||r.tab!=='roster'||!canManageCourse(state.data.user,courseById(r.id)))return;
  const page=await service.listRoster(r.id,append); if(route().id!==r.id||route().tab!=='roster')return;
  for(const u of page.users) { const at=state.data.users.findIndex(old=>old.id===u.id);if(at<0)state.data.users.push(u);else state.data.users[at]=u; }
  for(const e of page.enrollments)if(!state.data.enrollments.some(old=>old.uid===e.uid&&old.courseId===e.courseId))state.data.enrollments.push(e);
  state.data.hasMoreRoster=page.hasMore;
}
async function refresh() { state.data = await service.load(); await prepareRoster(); render(); }
function closeModal() {
  state.uploadAbort?.abort(); state.uploadAbort=null;
  for (const url of state.objectURLs) URL.revokeObjectURL(url); state.objectURLs = [];
  state.exam?.disposeDocument?.();
  clearInterval(state.exam?.timer); state.exam = null; state.modalHandler = null;
  if (modal.open) modal.close(); modal.className = ''; modal.innerHTML = '';
}
function openModal(title, body, handler = null, { wide = false, submitLabel = 'Guardar', footer = true } = {}) {
  closeModal(); state.modalHandler = handler;
  modal.className = wide ? 'wide' : '';
  modal.innerHTML = `<form id="modal-form"><header class="modal-head"><h2 id="modal-title">${esc(title)}</h2><button type="button" class="icon-button" data-action="close-modal" aria-label="Cerrar ventana">${icon('close')}</button></header><div class="modal-body">${body}<div class="field-error" id="modal-error" role="alert"></div></div>${footer ? `<footer class="modal-footer"><button type="button" class="button secondary" data-action="close-modal">${handler ? 'Cancelar' : 'Cerrar'}</button>${handler ? `<button type="submit" class="button primary">${esc(submitLabel)}${icon('check')}</button>` : ''}</footer>` : ''}</form>`;
  modal.showModal();
}
const field = (label, name, value = '', opts = '') => `<div class="field"><label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" value="${esc(value)}" ${opts} /></div>`;
function levelOptions(selected) { return Object.entries(LEVELS).map(([v,l])=>`<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`).join(''); }
function stageOptions(level, selected) { return level === 'independent' ? '<option value="">Sin grado ni ciclo</option>' : Array.from({length:level === 'university' ? 12 : 5},(_,i)=>`<option value="${i+1}" ${String(i+1) === String(selected) ? 'selected' : ''}>${level === 'university' ? 'Ciclo '+roman(i+1) : (i+1)+'.º grado'}</option>`).join(''); }
function drawUserCourses(preselected = []) {
  const form = document.querySelector('#modal-form'); const level = form.elements.level.value, stage = form.elements.stage.value, role = form.elements.role.value;
  const academic = Object.fromEntries(['career','section','period'].map(k => [k, form.elements[k]?.value || '']));
  const courses = state.data.courses.filter(c => canManageCourse(state.data.user,c) && canEnroll({role,level,stage,...academic},c));
  document.querySelector('#user-course-list').innerHTML = role !== 'student' ? '<div class="empty-checks">El docente se asigna desde la configuración de cada curso.</div>' : courses.length ? courses.map(c=>`<label><input name="courseIds" type="checkbox" value="${esc(c.id)}" ${preselected.includes(c.id) ? 'checked' : ''} /><span>${esc(c.title)}</span>${badge([stageLabel(c), c.section, c.period].filter(Boolean).join(' · '))}</label>`).join('') : '<div class="empty-checks">No hay cursos para este nivel y grupo académico. Puedes crear la cuenta y matricularla después.</div>';
}
function userForm(id = null, preCourse = null) {
  const existing = state.data.users.find(u => u.id === id); const c = courseById(preCourse); const admin = state.data.user.role === 'owner';
  const value = existing || { role:'student',level:c?.level || 'secondary',stage:c?.stage || '3',career:c?.career || '',section:c?.section || '',period:c?.period || '' };
  const selected = existing ? state.data.enrollments.filter(e=>e.uid===id&&e.active).map(e=>e.courseId) : preCourse ? [preCourse] : [];
  openModal(existing ? 'Editar usuario y matrículas' : 'Un nuevo acceso al aula', `<p class="modal-description">${existing ? 'Actualiza su perfil y los cursos que tendrá habilitados.' : 'Crea la cuenta y selecciona los cursos que le corresponden.'}${service.mode === 'demo' ? ' Usa únicamente datos de prueba.' : ''}</p><div class="field-row">${field('Nombre completo','displayName',value.displayName,'required minlength="2" maxlength="100" autocomplete="name"')}${field('Correo electrónico','email',value.email,`type="email" required autocomplete="off" ${existing ? 'disabled' : ''}`)}</div>${!existing ? `<div class="field"><label for="f-password">Contraseña inicial</label><div class="input-action"><input name="password" id="f-password" type="password" required minlength="10" maxlength="128" autocomplete="new-password" placeholder="Al menos 10 caracteres" /><button type="button" class="button secondary compact" data-action="generate-password">Generar</button><button type="button" class="icon-button" data-action="show-password" data-target="f-password" aria-label="Mostrar contraseña">${icon('key')}</button></div><small>Podrás compartirla una vez creado el acceso. La contraseña anterior nunca se muestra.</small></div>` : ''}<div class="field-row triple"><div class="field"><label for="f-role">Rol</label><select id="f-role" name="role" ${existing ? 'disabled' : ''}><option value="student" ${value.role==='student'?'selected':''}>Alumno</option>${admin ? `<option value="teacher" ${value.role==='teacher'?'selected':''}>Docente</option>` : ''}</select></div><div class="field"><label for="f-level">Nivel</label><select id="f-level" name="level">${levelOptions(value.level)}</select></div><div class="field"><label for="f-stage">Grado / ciclo</label><select id="f-stage" name="stage">${stageOptions(value.level,value.stage)}</select></div></div>${academicForm(value)}${field('Código de alumno (opcional; se genera si lo dejas vacío)','studentCode',value.studentCode,'maxlength="32" placeholder="Ej. SEC-2026-001"')}<div class="field"><label>Cursos habilitados</label><div id="user-course-list" class="course-checks"></div><small>Solo se ofrecen cursos compatibles con su nivel y grado/ciclo.</small></div>`, async form => {
    const input = Object.fromEntries(new FormData(form)); input.email = existing?.email || input.email; input.role = existing?.role || input.role;
    input.active = existing?.active ?? true; input.courseIds = [...form.querySelectorAll('[name="courseIds"]:checked')].map(c=>c.value);
    const password = input.password;
    const record = await service.saveUser(input,id); closeModal(); await refresh();
    if (!existing) {
      const credentials = `Código: ${record.studentCode || "—"}\nCorreo: ${record.email}\nContraseña inicial: ${password}`;
      openModal('El acceso está creado.',`<p class="modal-description">${service.mode === 'demo' ? 'Cuenta local de prueba. Puedes cerrar sesión e ingresar con estos datos en este navegador.' : 'La cuenta quedó creada en Firebase Authentication y sus cursos fueron asignados.'}</p><div class="credentials">${record.studentCode ? `<div><label>Código</label><code>${esc(record.studentCode)}</code></div>` : ''}<div><label>Correo</label><code>${esc(record.email)}</code></div><div><label>Contraseña inicial</label><code>${esc(password)}</code></div></div><p class="helper-text">Comparte estos datos de forma privada con el alumno. Esta ventana es la única que muestra la contraseña inicial.</p><button type="button" class="button secondary full" id="copy-access">${icon('clipboard')}Copiar datos de acceso</button>`);
      document.querySelector('#copy-access').onclick = async () => { try { await navigator.clipboard.writeText(credentials); toast('Datos de acceso copiados.'); } catch { toast('Selecciona el texto de esta ventana para copiarlo.',true); } };
    } else toast('Perfil y matrículas actualizados.');
  }, { submitLabel:existing ? 'Guardar cambios' : 'Crear acceso' });
  drawUserCourses(selected);
}
function courseForm(id = null) {
  const old = courseById(id); const c = old || {level:'secondary',stage:'3',color:'copper',published:true,teacherId:state.data.user.role==='teacher' ? state.data.user.id : state.data.users.find(u=>u.role==='teacher'&&u.active)?.id || state.data.user.id};
  const teachers = (state.data.teachers || state.data.users).filter(u=>['teacher','owner'].includes(u.role)&&u.active);
  openModal(old ? 'Editar curso' : 'Un nuevo espacio para enseñar',`<p class="modal-description">Define el grupo académico y organiza el contenido por semestres en secundaria o por unidades en universidad.</p>${field('Nombre del curso','title',c.title,'required minlength="3" maxlength="120" placeholder="Ej. Matemática"')}<div class="field"><label for="f-description">Descripción</label><textarea id="f-description" name="description" maxlength="1500" placeholder="¿Qué aprenderán tus alumnos?">${esc(c.description || '')}</textarea></div><div class="field-row"><div class="field"><label for="f-level">Nivel</label><select id="f-level" name="level">${levelOptions(c.level)}</select></div><div class="field"><label for="f-stage">Grado / ciclo</label><select id="f-stage" name="stage">${stageOptions(c.level,c.stage)}</select></div></div>${academicForm(c)}<p class="helper-text">Cuando indicas una carrera, sección o periodo, el perfil del alumno debe coincidir para poder matricularlo.</p><div class="field"><label for="f-modules">Apartados del curso (uno por línea)</label><textarea id="f-modules" name="modules" required rows="4">${esc(courseModules(c).join('\n'))}</textarea><small>Personaliza sus nombres. Conserva los apartados que ya contienen actividades o materiales.</small></div><div class="field-row"><div class="field"><label for="f-teacherId">Docente</label><select id="f-teacherId" name="teacherId" ${state.data.user.role==='teacher'?'disabled':''}>${teachers.map(u=>`<option value="${esc(u.id)}" ${c.teacherId===u.id?'selected':''}>${esc(u.displayName)}</option>`).join('')}</select></div><div class="field"><label for="f-color">Acento del curso</label><select id="f-color" name="color">${[['copper','Azul'],['sage','Turquesa'],['indigo','Índigo'],['rose','Violeta'],['ochre','Celeste']].map(([v,l])=>`<option value="${v}" ${v===c.color?'selected':''}>${l}</option>`).join('')}</select></div></div>${state.data.hasMoreTeachers ? button('Cargar más docentes','more-teachers','users','secondary compact') : ''}<label class="field-checkbox"><input type="checkbox" name="published" ${c.published?'checked':''} />Habilitar el curso para sus alumnos matriculados</label>`,async form=>{
    const input = Object.fromEntries(new FormData(form)); input.published = form.elements.published.checked;
    input.teacherId = state.data.user.role==='teacher' ? state.data.user.id : input.teacherId;
    const result = await service.saveCourse(input,id); closeModal(); await refresh(); location.hash=`course/${result.id}/overview`; toast(old?'Curso actualizado.':'Tu curso está creado.');
  },{wide:true,submitLabel:old?'Guardar cambios':'Crear curso'});
}
function materialForm(courseId, recording = false) {
  openModal(recording ? 'Compartir una grabación' : 'Agregar material al curso',`<p class="modal-description">${recording ? 'Graba tu pantalla con tu aplicación preferida y sube el video al apartado que corresponde. También puedes añadir un enlace de video.' : 'Sube un archivo o agrega un enlace para tus alumnos.'}${service.mode === 'demo' ? ' Los archivos de prueba se guardarán solo en este navegador.' : ''}</p>${field('Título','title','','required minlength="2" maxlength="140" placeholder="Ej. Guía de la semana 01"')}<div class="field-row">${moduleField(courseById(courseId))}<div class="field"><label for="f-kind">Tipo de recurso</label><select id="f-kind" name="kind">${(recording ? [['recording','Grabación de clase']] : [['document','Documento / imagen'],['video','Video'],['link','Enlace']]).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></div></div><div class="field"><label for="f-file">Archivo</label><input id="f-file" name="file" type="file" accept="${recording ? 'video/mp4,video/webm' : '.pdf,.txt,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mp3,.m4a'}" /><small>${service.mode === 'demo' ? 'Hasta 50 MB en la demostración.' : 'Videos MP4/WebM de hasta 20 GB; otros archivos hasta 200 MB. La duración depende del tamaño del archivo. También puedes compartir un enlace de video.'}</small></div>${field('O enlace del recurso','url','','type="url" placeholder="https://…"')}<div class="field"><label for="f-description">Descripción opcional</label><textarea id="f-description" name="description" maxlength="1000" placeholder="Indicaciones para el alumno"></textarea></div><div id="upload-state" class="helper-text"></div>`,async form=>{
    const input = Object.fromEntries(new FormData(form)); const file = form.elements.file.files[0]; delete input.file;
    if (!file && !input.url) throw new Error('Selecciona un archivo o escribe un enlace.');
    if (file) { const controller=new AbortController();state.uploadAbort=controller;document.querySelector('#upload-state').textContent='Subiendo archivo…'; Object.assign(input,await service.upload(courseId,file,percent=>{ const el=form.querySelector('#upload-state'); if(el)el.textContent=`Subiendo archivo… ${percent}%`; },{signal:controller.signal}));if(controller.signal.aborted||!form.isConnected)throw new Error('Subida cancelada.'); }
    await service.saveMaterial(courseId,input); closeModal(); await refresh(); location.hash=`course/${courseId}/${recording?'recordings':'materials'}`; toast(recording?'Grabación compartida.':'Material agregado al curso.');
  },{submitLabel:recording?'Compartir grabación':'Guardar material'});
}
function questionEditor(q, i) {
  return `<section class="question-editor" data-question="${i}"><div class="question-editor-head"><strong>PREGUNTA ${i+1}</strong><button type="button" class="icon-button" data-action="remove-question" data-index="${i}" aria-label="Eliminar pregunta ${i+1}">${icon('trash')}</button></div><div class="field"><label for="q-${i}-prompt">Enunciado</label><textarea id="q-${i}-prompt" name="q${i}prompt" required maxlength="1000" placeholder="Escribe la pregunta">${esc(q.prompt || '')}</textarea></div><div class="options-editor">${(q.options || ['','','','']).map((o,j)=>`<label class="option-editor"><input type="radio" name="q${i}correct" value="${j}" ${q.correct!==null&&q.correct!==undefined&&Number(q.correct)===j?'checked':''} required aria-label="Alternativa ${j+1} correcta" /><span>${String.fromCharCode(65+j)}</span><input name="q${i}option${j}" type="text" value="${esc(o)}" required maxlength="500" placeholder="Alternativa ${String.fromCharCode(65+j)}" aria-label="Texto alternativa ${j+1}" /></label>`).join('')}</div><div class="editor-hint">Marca con el círculo cuál es la respuesta correcta.</div><label class="points-field">Puntos de la pregunta <input type="number" name="q${i}points" min="1" max="20" value="${q.points || 1}" required /></label></section>`;
}
function readQuestions() {
  const form = document.querySelector('#modal-form');
  return [...form.querySelectorAll('[data-question]')].map((el,i)=>({ prompt:form.elements[`q${i}prompt`].value,options:[...el.querySelectorAll('[name^="q'+i+'option"]')].map(o=>o.value),correct:form.elements[`q${i}correct`].value === '' ? null : Number(form.elements[`q${i}correct`].value),points:Number(form.elements[`q${i}points`].value) }));
}
const localDate = value => value ? new Date(new Date(value).getTime() - 5 * 3600000).toISOString().slice(0,16) : '';
function examForm(courseId, exam = null) {
  const questions = exam?.questions || [{prompt:'',options:['','','',''],correct:null,points:1}];
  openModal(exam ? 'Editar evaluación' : 'Crear una evaluación',`<p class="modal-description">Preguntas de alternativas, un intento por alumno y nota automática sobre 20. Las respuestas correctas quedan en el servidor en la versión conectada.</p><div class="field-row">${field('Título del examen','title',exam?.title,'required minlength="3" maxlength="140" placeholder="Ej. Evaluación de la semana 01"')}${field('Duración en minutos','minutes',exam?.minutes || 30,'type="number" min="1" max="180" required')}</div><div class="field-row">${field('Apertura opcional (hora de Perú)','opensAt',localDate(exam?.opensAt),'type="datetime-local"')}${field('Cierre opcional (hora de Perú)','closesAt',localDate(exam?.closesAt),'type="datetime-local"')}</div>${moduleField(courseById(courseId),exam?.module)}<div class="field"><label for="f-exam-pdf">PDF del examen (opcional)</label><input id="f-exam-pdf" name="examPdf" type="file" accept="application/pdf,.pdf" /><small>Hasta 20 MB. Se muestra durante el intento, con identificación del alumno y sin botones de descarga o impresión. No impide capturas del sistema.</small>${exam?.document ? `<p class="helper-text">Actual: ${esc(exam.document.filename)}</p><label class="field-checkbox"><input type="checkbox" name="removePdf" />Retirar PDF</label>` : ""}</div><div id="upload-state" class="helper-text" role="status"></div><div id="question-editors">${questions.map(questionEditor).join('')}</div>${button('Agregar pregunta','add-question','plus','secondary full')}<label class="field-checkbox" style="margin-top:22px"><input type="checkbox" name="published" ${exam?.published !== false?'checked':''} />Publicar evaluación para los alumnos matriculados</label>`,async form=>{
    const raw = Object.fromEntries(new FormData(form)); raw.minutes=Number(raw.minutes); raw.published=form.elements.published.checked; raw.questions=readQuestions();
    if (raw.questions.some(q=>q.correct===null)) throw new Error('Selecciona la alternativa correcta en cada pregunta.');
    raw.document = form.elements.removePdf?.checked ? null : exam?.document || null;
    const file=form.elements.examPdf?.files?.[0];
    if(file){if(!file.name.toLowerCase().endsWith('.pdf')||file.type!=='application/pdf'||file.size>20*1024**2)throw new Error('Adjunta un PDF de hasta 20 MB.');const controller=new AbortController();state.uploadAbort=controller;raw.document=await service.upload(courseId,file,p=>{const el=form.querySelector('#upload-state');if(el)el.textContent=`Subiendo PDF… ${p}%`;},{signal:controller.signal});if(controller.signal.aborted||!form.isConnected)throw new Error('Subida cancelada.');}
    await service.saveExam(courseId,raw,exam?.id || null); closeModal(); await refresh(); location.hash=`course/${courseId}/exams`; toast('Evaluación guardada.');
  },{wide:true,submitLabel:'Guardar evaluación'});
}
function sessionForm(courseId, old = null) {
  openModal(old?'Editar clase':'Programar una clase',`<p class="modal-description">Comparte el enlace de Meet en la unidad o semestre que corresponde. La reunión se abrirá en otra pestaña.</p>${field('Nombre de la clase','title',old?.title,'required minlength="3" maxlength="140" placeholder="Ej. Resolución de ejercicios"')}${moduleField(courseById(courseId),old?.module)}<div class="field-row">${field('Fecha y hora de Perú','startsAt',localDate(old?.startsAt),'type="datetime-local" required')}${field('Duración en minutos','minutes',old?.minutes || 90,'type="number" min="15" max="480" required')}</div>${field('Enlace de Google Meet o videoconferencia','meetingUrl',old?.meetingUrl,'type="url" required placeholder="https://meet.google.com/…"')}<div class="mini-note">${icon('play')}<div><strong>La grabación se comparte después.</strong><p>Graba con una aplicación externa. Luego sube el video en Grabaciones y selecciona este mismo apartado.</p></div></div>`,async form=>{
    await service.saveSession(courseId,Object.fromEntries(new FormData(form)),old?.id); closeModal(); await refresh(); toast(old?'Clase actualizada.':'Clase publicada en el curso y la agenda.');
  },{submitLabel:old?'Guardar cambios':'Programar clase'});
}
function assignmentForm(courseId, old=null) {
  openModal(old?'Editar trabajo':'Crear un trabajo',`${field('Título del trabajo','title',old?.title,'required minlength="3" maxlength="140"')}${moduleField(courseById(courseId),old?.module)}<div class="field"><label for="f-instructions">Indicaciones</label><textarea name="instructions" id="f-instructions" rows="5" required minlength="3" maxlength="6000" placeholder="Explica el objetivo y lo que deben entregar…">${esc(old?.instructions || '')}</textarea></div>${field('Fecha límite (hora de Perú)','dueAt',localDate(old?.dueAt),'type="datetime-local"')}<label class="field-checkbox"><input name="allowLate" type="checkbox" ${old?.allowLate!==false?'checked':''}>Permitir entregas después del plazo</label><label class="field-checkbox"><input name="published" type="checkbox" ${old?.published!==false?'checked':''}>Publicar para los alumnos matriculados</label>`,async form=>{
    const input=Object.fromEntries(new FormData(form)); input.allowLate=form.elements.allowLate.checked;input.published=form.elements.published.checked;
    await service.saveAssignment(courseId,input,old?.id);closeModal();await refresh();toast('Trabajo guardado.');
  },{wide:true,submitLabel:old?'Guardar cambios':'Publicar trabajo'});
}
function assignmentDetail(courseId,id) {
  const a=state.data.assignments.find(a=>a.id===id&&a.courseId===courseId), c=courseById(courseId);
  if(!a||!c)throw new Error('Trabajo no disponible.');
  const manage=canManageCourse(state.data.user,c), submissions=state.data.submissions.filter(s=>s.assignmentId===id), own=submissions.find(s=>s.uid===state.data.user.id), closed=a.dueAt&&Date.parse(a.dueAt)<Date.now()&&!a.allowLate;
  let body=`<div class="detail-meta">${badge(a.module)}${badge(a.dueAt?'Hasta '+fmtDate(a.dueAt)+' · '+fmtTime(a.dueAt)+' (Perú)':'Sin fecha límite')}</div><p class="instruction-text">${esc(a.instructions)}</p>`;
  if(manage) {
    body+=`<div class="section-head"><h3>Entregas de alumnos</h3><span class="small muted">${submissions.length} recibidas</span></div>${submissions.length?`<div class="submission-list">${submissions.map(s=>`<article class="submission-row"><span class="avatar">${esc(initials(s.displayName))}</span><div><strong>${esc(s.displayName)}</strong><p>${fmtDate(s.submittedAt)} · ${fmtTime(s.submittedAt)} · ${s.late?'Fuera de plazo':'En plazo'}</p></div>${badge(s.status==='graded'?s.score20+' / 20':s.status==='returned'?'Por corregir':'Por revisar',s.status==='graded'?'green':'amber')}${button('Revisar','review-submission','arrow','secondary compact',`data-id="${esc(s.id)}"`)}</article>`).join('')}</div>`:empty('Aún no hay entregas.','Los trabajos enviados aparecerán aquí.','file')}${moreContent(c,'submissions',id)}`;
    openModal(a.title,body,null,{wide:true});return;
  }
  if(own)body+=`<section class="submission-receipt"><div class="panel-head"><h3>Tu entrega</h3>${badge(own.status==='graded'?'Calificado':own.status==='returned'?'Devuelto para corregir':'Entregado','green')}</div><p class="submission-text">${esc(own.text)}</p>${own.path?button(esc(own.filename),'open-submission','download','secondary compact',`data-id="${esc(own.id)}"`):''}<p class="helper-text">${fmtDate(own.submittedAt)} · ${fmtTime(own.submittedAt)} · Revisión ${own.revision}${own.late?' · Entrega fuera de plazo':''}</p>${own.status==='graded'?`<div class="feedback-score">${own.score20}<small> / 20</small></div>`:''}${own.feedback?`<div class="teacher-feedback"><strong>Comentario del docente</strong><p>${esc(own.feedback)}</p></div>`:''}</section>`;
  const canSubmit=a.published&&own?.status!=='graded'&&!closed;
  if(canSubmit)body+=`<div class="field"><label for="f-text">${own?'Actualizar mi respuesta':'Mi respuesta'}</label><textarea id="f-text" name="text" rows="6" maxlength="12000" placeholder="Escribe tu respuesta o adjunta tu trabajo…">${esc(own?.text || '')}</textarea></div><div class="field"><label for="f-file">Archivo adjunto (opcional)</label><input name="file" id="f-file" type="file" accept=".pdf,.txt,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.webp,.mp4,.webm"><small>Hasta 50 MB.${own?.path?' Si no eliges otro archivo, se conserva el anterior.':''}</small></div><div id="upload-state" class="helper-text" role="status"></div><p class="helper-text">${a.allowLate?'Se aceptan entregas tardías y se indicará si están fuera de plazo.':'Después del plazo no se aceptan nuevas entregas.'}</p>`;
  else if(closed&&!own)body+=`<p class="field-error">El plazo de entrega terminó.</p>`;
  openModal(a.title,body,canSubmit?async form=>{
    const input={text:form.elements.text.value},file=form.elements.file.files[0];
    if(file){const controller=new AbortController();state.uploadAbort=controller;Object.assign(input,await service.uploadSubmission(courseId,id,file,percent=>{const el=form.querySelector('#upload-state');if(el)el.textContent=`Subiendo… ${percent}%`;},{signal:controller.signal}));if(controller.signal.aborted||!form.isConnected)throw new Error('Subida cancelada.');}
    else if(own?.path)Object.assign(input,{path:own.path,filename:own.filename,size:own.size,mimetype:own.mimetype});
    await service.submitAssignment(courseId,id,input);closeModal();await refresh();toast('Tu trabajo quedó entregado.');assignmentDetail(courseId,id);
  }:null,{wide:true,submitLabel:own?'Actualizar entrega':'Entregar trabajo'});
}
function reviewSubmission(id) {
  const s=state.data.submissions.find(s=>s.id===id);if(!s)throw new Error('Entrega no encontrada.');
  const c=courseById(s.courseId);if(!canManageCourse(state.data.user,c))throw new Error('No puedes revisar esta entrega.');
  openModal('Revisar · '+s.displayName,`<div class="detail-meta">${badge(s.title)}${badge(s.late?'Fuera de plazo':'En plazo',s.late?'amber':'green')}</div><p class="instruction-text">${esc(s.text || 'El alumno adjuntó un archivo.')}</p>${s.path?button(esc(s.filename),'open-submission','download','secondary',`data-id="${esc(s.id)}"`):''}<div class="divider"></div>${field('Nota sobre 20','score20',s.score20 ?? '','type="number" min="0" max="20" step="0.01" required')}<div class="field"><label for="f-feedback">Comentario para el alumno</label><textarea name="feedback" id="f-feedback" rows="4" maxlength="6000" placeholder="Qué logró y qué puede mejorar…">${esc(s.feedback || '')}</textarea></div><p class="helper-text">Revisión ${s.revision} · ${fmtDate(s.submittedAt)} · ${fmtTime(s.submittedAt)}</p>${s.status==='graded'?button('Habilitar una nueva entrega','return-submission','edit','secondary',`data-id="${esc(s.id)}"`):''}`,async form=>{
    await service.gradeSubmission(id,{...Object.fromEntries(new FormData(form)),revision:s.revision});closeModal();await refresh();toast('Nota y comentario publicados para el alumno.');
  },{wide:true,submitLabel:'Guardar calificación'});
}
function noticeForm(courseId,old=null) {
  openModal(old?'Editar aviso':'Publicar un aviso',`${field('Título','title',old?.title,'required minlength="3" maxlength="140"')}${moduleField(courseById(courseId),old?.module)}<div class="field"><label for="f-text">Mensaje</label><textarea id="f-text" name="text" required rows="5" minlength="3" maxlength="6000" placeholder="Comparte las novedades de este apartado…">${esc(old?.text || '')}</textarea></div><label class="field-checkbox"><input name="pinned" type="checkbox" ${old?.pinned?'checked':''}>Destacar este aviso</label>`,async form=>{
    const input=Object.fromEntries(new FormData(form));input.pinned=form.elements.pinned.checked;
    await service.saveAnnouncement(courseId,input,old?.id);closeModal();await refresh();toast('Aviso publicado.');
  },{submitLabel:old?'Guardar cambios':'Publicar aviso'});
}
function renderExamQuestion() {
  const e = state.exam; if(!e)return; const q=e.attempt.questions[e.index];
  document.querySelector('#exam-questions').innerHTML=`<div class="question-number">PREGUNTA ${e.index+1} DE ${e.attempt.questions.length} · ${q.points} ${q.points===1?'PUNTO':'PUNTOS'}</div><h3>${esc(q.prompt)}</h3>${q.options.map((o,i)=>`<label class="answer-option"><input type="radio" name="answer" value="${i}" data-question-id="${esc(q.id)}" ${e.answers[q.id]===i?'checked':''} /><span class="answer-letter">${String.fromCharCode(65+i)}</span><span>${esc(o)}</span></label>`).join('')}<div class="exam-navigation">${button('Anterior','exam-prev','back','secondary',e.index===0?'disabled':'')}<span class="small muted">${e.index+1} / ${e.attempt.questions.length}</span>${button('Siguiente','exam-next','arrow','secondary',e.index===e.attempt.questions.length-1?'disabled':'')}</div>`;
  document.querySelector('#exam-nav-buttons').innerHTML=e.attempt.questions.map((q,i)=>`<button type="button" class="${e.answers[q.id]!==undefined?'answered':''} ${e.index===i?'current':''}" data-action="exam-goto" data-index="${i}" aria-label="Pregunta ${i+1}">${i+1}</button>`).join('');
  document.querySelector('#exam-answer-count').textContent=`${Object.keys(e.answers).length} de ${e.attempt.questions.length} respondidas`;
}
async function openExam(courseId, examId) {
  const result=await service.startExam(courseId,examId);
  if(result.attempt.status==='graded')return resultModal(result.attempt);
  closeModal(); modal.className='exam-dialog';
  state.exam={attempt:result.attempt,answers:{...result.attempt.answers},index:0,offset:result.serverNow-Date.now(),submitting:false}; state.saveQueue=Promise.resolve();
  const e=state.exam;
  modal.innerHTML=`<header class="modal-head"><div><h2 id="modal-title">${esc(e.attempt.title)}</h2><div class="exam-title-info">${esc(courseById(courseId)?.title)} · Un intento · Nota sobre 20</div></div><div class="exam-clock" id="exam-clock">${icon('clock')}<span id="exam-clock-text"></span></div><button class="icon-button" data-action="close-exam" aria-label="Salir del examen">${icon('close')}</button></header><div class="exam-layout"><aside class="exam-nav"><div><p class="eyebrow">Tu evaluación</p><div class="question-nav" id="exam-nav-buttons"></div></div><div class="exam-save-status" id="exam-save-status">Respuestas guardadas.</div></aside><section class="exam-answer-area">${e.attempt.document ? `<section class="exam-document" id="exam-document" aria-label="PDF del examen"><p>Cargando documento…</p></section>` : ""}<section class="question-content" id="exam-questions"></section></section></div><footer class="modal-footer"><span class="small muted" id="exam-answer-count" style="margin-right:auto"></span><button type="button" class="button primary" data-action="submit-exam" id="submit-exam">Entregar examen ${icon('check')}</button></footer>`;
  renderExamQuestion(); modal.showModal();
  if(e.attempt.document){const host=document.querySelector('#exam-document');Promise.all([service.examDocumentLink(e.attempt.id),import('./exam-document.js')]).then(async([access,viewer])=>{if(state.exam!==e)return;if(access.url.startsWith('blob:'))state.objectURLs.push(access.url);const dispose=await viewer.mountExamDocument(host,access,()=>state.exam===e&&Date.now()+e.offset<e.attempt.deadlineAt);if(state.exam===e)e.disposeDocument=dispose;else dispose();}).catch(()=>{if(state.exam===e)host.textContent='No se pudo cargar el PDF. Revisa la conexión y retoma el examen. El tiempo sigue transcurriendo.';});}
  const tick=()=>{ if(state.exam!==e)return; const seconds=Math.max(0,Math.ceil((e.attempt.deadlineAt-Date.now()-e.offset)/1000)); const el=document.querySelector('#exam-clock-text'); if(el)el.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`; document.querySelector('#exam-clock')?.classList.toggle('urgent',seconds<120); if(seconds===0&&!e.submitting)submitExam(true); };
  e.timer=setInterval(tick,1000);tick();
}
async function submitExam(automatic=false) {
  const e=state.exam; if(!e||e.submitting)return; e.submitting=true; const btn=document.querySelector('#submit-exam'); if(btn){btn.disabled=true;btn.textContent='Registrando entrega…';}
  try { await state.saveQueue; const result=await service.submitExam(e.attempt.id,e.answers); closeModal(); await refresh(); resultModal(result); }
  catch(error){e.submitting=false;if(btn){btn.disabled=false;btn.textContent='Reintentar entrega';}toast(error.message||'No se registró la entrega. Intenta nuevamente.',true);if(automatic)clearInterval(e.timer);}
}
function resultModal(a) {
  openModal('Tu resultado',`<div class="result-view"><div class="result-symbol">${icon('check')}</div><h2>Evaluación completada.</h2><p>${esc(a.title)}</p><div class="result-score">${a.score20}<small> / 20</small></div><div class="result-stats"><div><strong>${a.correct} / ${a.questionCount}</strong>Respuestas correctas</div><div><strong>${a.earned} / ${a.total}</strong>Puntos obtenidos</div></div><p>Tu nota quedó registrada${service.mode==='demo'?' en esta demostración local':''}. Puedes consultarla en Mis notas.</p><a href="#grades" class="button primary" data-action="result-close">Ver mis notas ${icon('arrow')}</a></div>`,null,{footer:false});
}
function connectionGuide() {
  openModal('Conectar el proyecto de Firebase',`<p class="modal-description">El código de la web, las funciones y las reglas de acceso están preparados. La conexión requiere crear y configurar el proyecto bajo tu cuenta.</p><div class="code-steps"><div class="code-step"><span class="step-number">1</span><div><h3>Crea un proyecto independiente</h3><p>En Firebase Console registra una aplicación web. Habilita Authentication con correo/contraseña, Firestore y Storage. Storage y las funciones requieren facturación Blaze.</p></div></div><div class="code-step"><span class="step-number">2</span><div><h3>Vincula la configuración web</h3><p>Copia el objeto de configuración público de la aplicación a dist/firebase-config.js. Nunca coloques una clave privada de una cuenta de servicio en la página.</p></div></div><div class="code-step"><span class="step-number">3</span><div><h3>Despliega las funciones y reglas</h3><p>El proyecto incluye firebase.json, las reglas de Firestore/Storage y las funciones del servidor. Revisa la guía README del código antes del despliegue.</p></div></div><div class="code-step"><span class="step-number">4</span><div><h3>Crea la cuenta del propietario una sola vez</h3><p>El script de preparación crea el primer administrador. Desde entonces, los docentes y alumnos se agregan desde el panel.</p></div></div></div><div class="mini-note">${icon('info')}<div><strong>Pruebas del proyecto real</strong><p>La publicación actual es una demostración. Todavía no se han creado cuentas reales ni se ha verificado una capacidad de 10.000 alumnos.</p></div></div>`);
}
function profileModal() {
  const u=state.data.user;
  openModal('Mi cuenta',`<div class="person-cell" style="margin-bottom:24px"><span class="avatar">${esc(initials(u.displayName))}</span><div><strong>${esc(u.displayName)}</strong><small>${esc(u.email)}</small></div></div><div class="settings-list"><div><span>Rol</span><span>${esc(ROLES[u.role])}</span></div>${u.role==='student'?`<div><span>Nivel</span><span>${esc(levelLabel(u))}</span></div>`:''}<div><span>Estado</span>${badge('Habilitado','green')}</div></div>${u.studentCode?`<p class="helper-text">Tu código: <strong>${esc(u.studentCode)}</strong></p>`:''}${button('Cambiar mi contraseña','change-password','key','secondary full')}${button('Cerrar sesión','logout','logout','ghost full')}`);
}
function changePasswordForm() {
  openModal('Cambiar mi contraseña',`${field('Contraseña actual','oldPassword','','type="password" required autocomplete="current-password"')}${field('Nueva contraseña','newPassword','','type="password" required minlength="10" maxlength="128" autocomplete="new-password"')}${field('Confirmar nueva contraseña','confirmPassword','','type="password" required minlength="10" autocomplete="new-password"')}`,async form=>{
    const input=Object.fromEntries(new FormData(form)); if(input.newPassword!==input.confirmPassword)throw new Error('Las contraseñas nuevas no coinciden.');
    await service.changePassword(input.oldPassword,input.newPassword); closeModal(); toast('Contraseña actualizada.');
  },{submitLabel:'Actualizar contraseña'});
}
function exportGrades() {
  const results=[...state.data.attempts.filter(a=>a.status==='graded').map(a=>({...a,type:'Examen'})),...state.data.submissions.filter(s=>s.status==='graded').map(s=>({...s,type:'Trabajo'}))];
  const protect=value=>{const v=String(value??'');return '"'+(/^[=+\-@\t\r]/.test(v)?"'"+v:v).replaceAll('"','""')+'"';};
  const rows=[['Alumno','Curso','Apartado','Tipo','Actividad','Nota / 20','Fecha','Comentario'],...results.map(a=>[a.displayName||state.data.users.find(u=>u.id===a.uid)?.displayName||'',courseById(a.courseId)?.title,a.module,a.type,a.title,a.score20,new Date(a.submittedAt).toISOString(),a.feedback||''])];
  const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(protect).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='AulaNexo_Notas.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
}
async function openMaterial(courseId,id) {
  const m=state.data.materials.find(m=>m.id===id&&m.courseId===courseId);
  if(!m)throw new Error('El material no está disponible.');
  if(['video','recording'].includes(m.kind)) {
    openModal(m.title,'<div class="loading-inline"><span class="loader"></span>Abriendo video…</div>');
    const loadingBody=modal.querySelector('.modal-body');const url=await service.materialURL(courseId,id); if(!loadingBody?.isConnected){if(url.startsWith('blob:'))URL.revokeObjectURL(url);return;} if(url.startsWith('blob:'))state.objectURLs.push(url);
    const body=modal.querySelector('.modal-body');
    if(m.path || m.mimetype?.startsWith('video/') || /\.(mp4|webm)(\?|$)/i.test(url))body.innerHTML=`<video controls playsinline preload="metadata" src="${esc(url)}" style="width:100%;max-height:55vh;border-radius:10px;background:#102449"></video><p class="helper-text">${esc(m.description || '')}</p>`;
    else body.innerHTML=`<p class="modal-description">Este video está alojado en un servicio externo.</p><a class="button primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir video ${icon('arrow')}</a>`;
  } else {
    const tab=window.open('about:blank','_blank'); if(tab)tab.opener=null;
    try{const url=await service.materialURL(courseId,id);if(tab)tab.location=url;else openModal(m.title,`<a class="button primary full" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir material ${icon('arrow')}</a>`);}catch(error){tab?.close();throw error;}
  }
}
document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-action]'); if(!el)return; const action=el.dataset.action;
  try {
    if(action==='demo-login'){el.disabled=true;await service.signInDemo(el.dataset.role);location.hash='home';await refresh();}
    else if(action==='auth-tab'){state.authTab=el.dataset.tab;login();}
    else if(action==='logout'){closeModal();await service.signOut();state.data=null;state.search='';state.filter='all';state.userSearch='';state.academicFilter='';state.modules={};location.hash='home';login();}
    else if(action==='show-password'){const input=document.getElementById(el.dataset.target);input.type=input.type==='password'?'text':'password';}
    else if(action==='toggle-nav'){state.navOpen=!state.navOpen;document.querySelector('.app-shell')?.classList.toggle('nav-open',state.navOpen);}
    else if(action==='filter'){state.filter=el.dataset.filter;render();}
    else if(action==='new-user'){if(state.data.user.role!=='owner')throw new Error('Solo el administrador puede crear accesos.');userForm(null,el.dataset.course);}
    else if(action==='edit-user')userForm(el.dataset.id);
    else if(action==='new-course')courseForm();
    else if(action==='edit-course')courseForm(el.dataset.id);
    else if(action==='new-material')materialForm(el.dataset.course);
    else if(action==='new-recording')materialForm(el.dataset.course,true);
    else if(action==='open-material')await openMaterial(el.dataset.course,el.dataset.id);
    else if(action==='delete-material'){
      const m=state.data.materials.find(m=>m.id===el.dataset.id);
      openModal('Eliminar material',`<p class="modal-description">${esc(m.title)} dejará de estar disponible en el curso. Esta acción también elimina el archivo subido.</p>`,async()=>{await service.deleteMaterial(el.dataset.course,el.dataset.id);closeModal();await refresh();toast('Material eliminado.');},{submitLabel:'Eliminar material'});
    }
    else if(action==='toggle-user'){
      const u=state.data.users.find(u=>u.id===el.dataset.id);
      openModal(u.active?'Suspender acceso':'Habilitar acceso',`<p class="modal-description">${esc(u.displayName)} ${u.active?'dejará de tener acceso al aula. Sus matrículas y resultados se conservarán.':'podrá volver a ingresar a sus cursos asignados.'}</p>`,async()=>{await service.toggleUser(u.id);closeModal();await refresh();toast(u.active?'Acceso suspendido.':'Acceso habilitado.');},{submitLabel:u.active?'Suspender acceso':'Habilitar acceso'});
    }
    else if(action==='recovery'){
      const result=await service.recoveryLink(el.dataset.id);
      openModal('Recuperar acceso',result.demo?`<p class="modal-description">${esc(result.message)}</p>`:`<p class="modal-description">Comparte este enlace de forma privada con el titular de la cuenta para que establezca una nueva contraseña. No se ha enviado ningún correo automáticamente.</p><div class="field"><label>Enlace de recuperación</label><textarea readonly id="recovery-url">${esc(result.url)}</textarea></div><button class="button secondary full" type="button" data-action="copy-recovery">${icon('clipboard')}Copiar enlace</button>`);
    }
    else if(action==='copy-recovery'){await navigator.clipboard.writeText(document.querySelector('#recovery-url').value);toast('Enlace copiado.');}
    else if(action==='generate-password'){const bytes=crypto.getRandomValues(new Uint8Array(14));const chars='ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#';document.querySelector('#f-password').value=Array.from(bytes,b=>chars[b%chars.length]).join('')+'9!';}
    else if(action==='new-exam')examForm(el.dataset.course);
    else if(action==='edit-exam'){const exam=await service.examForEditor(el.dataset.course,el.dataset.id);examForm(el.dataset.course,exam);}
    else if(action==='add-question'){const q=readQuestions();if(q.length>=60)throw new Error('El máximo es 60 preguntas.');q.push({prompt:'',options:['','','',''],correct:null,points:1});document.querySelector('#question-editors').innerHTML=q.map(questionEditor).join('');}
    else if(action==='remove-question'){const q=readQuestions();if(q.length===1)throw new Error('El examen necesita al menos una pregunta.');q.splice(Number(el.dataset.index),1);document.querySelector('#question-editors').innerHTML=q.map(questionEditor).join('');}
    else if(action==='new-session')sessionForm(el.dataset.course);

    else if(action==='edit-session')sessionForm(el.dataset.course,state.data.sessions.find(s=>s.id===el.dataset.id));
    else if(action==='delete-session')openModal('Eliminar clase','<p>El enlace y el horario dejarán de aparecer en el curso y la agenda.</p>',async()=>{await service.deleteSession(el.dataset.course,el.dataset.id);closeModal();await refresh();toast('Clase eliminada.');},{submitLabel:'Eliminar clase'});
    else if(action==='new-assignment')assignmentForm(el.dataset.course);
    else if(action==='edit-assignment')assignmentForm(el.dataset.course,state.data.assignments.find(a=>a.id===el.dataset.id));
    else if(action==='assignment-detail')assignmentDetail(el.dataset.course,el.dataset.id);
    else if(action==='review-submission')reviewSubmission(el.dataset.id);
    else if(action==='return-submission'){await service.returnSubmission(el.dataset.id);closeModal();await refresh();toast('El alumno puede volver a entregar el trabajo.');}
    else if(action==='open-submission'){
      const tab=window.open('about:blank','_blank');if(tab)tab.opener=null;
      try{const url=await service.submissionURL(el.dataset.id);if(url.startsWith('blob:'))setTimeout(()=>URL.revokeObjectURL(url),60000);if(tab)tab.location=url;else openModal('Archivo de la entrega',`<a class="button primary" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Abrir archivo ${icon('download')}</a>`);}catch(error){tab?.close();throw error;}
    }
    else if(action==='new-notice')noticeForm(el.dataset.course);
    else if(action==='edit-notice')noticeForm(el.dataset.course,state.data.announcements.find(a=>a.id===el.dataset.id));
    else if(action==='delete-notice')openModal('Eliminar aviso','<p>Este aviso dejará de estar disponible para los alumnos del curso.</p>',async()=>{await service.deleteAnnouncement(el.dataset.course,el.dataset.id);closeModal();await refresh();toast('Aviso eliminado.');},{submitLabel:'Eliminar aviso'});
    else if(action==='more-content'){
      el.disabled=true;const name=el.dataset.list,courseId=el.dataset.course;
      const page=await (['attempts','submissions'].includes(name)?service.resultItems(courseId,name,true):service.courseItems(courseId,name,true));
      state.data[name].push(...page.items.filter(item=>!state.data[name].some(old=>old.id===item.id&&old.courseId===item.courseId)));state.data.hasMoreContent[`${courseId}:${name}`]=page.hasMore;
      if(modal.open&&el.dataset.assignment){const assignmentId=el.dataset.assignment;closeModal();render();assignmentDetail(courseId,assignmentId);}else render();
    }
    else if(action==='more-results'){
      const name=el.dataset.list;el.disabled=true;const page=await service.resultItems(null,name,true);state.data[name].push(...page.items);state.data.hasMoreContent['student:'+name]=page.hasMore;render();
    }
    else if(action==='more-courses'){
      el.disabled=true;const page=await service.moreCourses();state.data.courses.push(...page.courses);state.data.hasMoreCourses=page.hasMore;render();
    }
    else if(action==='start-exam'){el.disabled=true;await openExam(el.dataset.course,el.dataset.id);el.disabled=false;}
    else if(action==='exam-prev'){state.exam.index=Math.max(0,state.exam.index-1);renderExamQuestion();}
    else if(action==='exam-next'){state.exam.index=Math.min(state.exam.attempt.questions.length-1,state.exam.index+1);renderExamQuestion();}
    else if(action==='exam-goto'){state.exam.index=Number(el.dataset.index);renderExamQuestion();}
    else if(action==='submit-exam')await submitExam();
    else if(action==='close-exam'){closeModal();toast('Puedes retomarlo desde el curso. El tiempo sigue transcurriendo.');}
    else if(action==='exam-result')resultModal(state.data.attempts.find(a=>a.id===el.dataset.id));
    else if(action==='result-close'){closeModal();}
    else if(action==='close-modal')closeModal();
    else if(action==='profile')profileModal();
    else if(action==='change-password')changePasswordForm();
    else if(action==='connection-guide')connectionGuide();
    else if(action==='export-grades')exportGrades();
    else if(action==='more-roster'){el.disabled=true;await prepareRoster(true);render();}
    else if(action==='more-teachers'){el.disabled=true;const page=await service.listTeachers(true);for(const u of page.users){if(!state.data.teachers.some(old=>old.id===u.id)){state.data.teachers.push(u);const option=document.createElement('option');option.value=u.id;option.textContent=u.displayName;document.querySelector('#f-teacherId').append(option);}}state.data.hasMoreTeachers=page.hasMore;if(!page.hasMore)el.remove();else el.disabled=false;}
    else if(action==='more-users'){el.disabled=true;const page=await service.listUsers(state.userSearch,true);state.data.userResults.push(...page.users);for(const u of page.users)if(!state.data.users.some(old=>old.id===u.id))state.data.users.push(u);state.data.hasMoreUsers=page.hasMore;state.data.enrollments.push(...page.users.flatMap(u=>(u.courseIds||[]).map(courseId=>({uid:u.id,courseId,active:true}))));render();}
    else if(action==='reset-demo'){openModal('Restablecer datos de prueba', '<p class="modal-description">Se eliminarán los usuarios, cursos, exámenes y resultados creados en esta demostración local.</p>',async()=>{await service.resetDemo();closeModal();state.data=null;login();toast('Demostración restablecida.');},{submitLabel:'Restablecer demostración'});}
    else if(action==='forgot'){
      openModal('Recupera tu acceso',`${field('Tu correo electrónico','email',document.querySelector('#login-email')?.value.includes('@') ? document.querySelector('#login-email').value : '','type="email" required autocomplete="email"')}`,async form=>{const result=await service.forgotPassword(form.elements.email.value);closeModal();openModal('Recuperación de acceso',`<p class="modal-description">${esc(result.message)}</p>`);},{submitLabel:'Solicitar recuperación'});
    }
  }catch(error){el.disabled=false;toast(error.message||'No se pudo completar la operación.',true);}
});
document.addEventListener('submit',async event=>{
  if(!['login-form','modal-form'].includes(event.target.id))return;event.preventDefault();const form=event.target;
  const submit=form.querySelector('[type="submit"]');if(submit)submit.disabled=true;
  const errorEl=document.querySelector(form.id==='login-form'?'#login-error':'#modal-error');if(errorEl)errorEl.textContent='';
  try{if(form.id==='login-form'){await service.signIn(form.elements.email.value,form.elements.password.value);location.hash='home';await refresh();}else if(state.modalHandler)await state.modalHandler(form);}
  catch(error){if(errorEl?.isConnected)errorEl.textContent=error.message||'No se pudo guardar.';else toast(error.message,true);}
  finally{if(submit?.isConnected)submit.disabled=false;}
});
document.addEventListener('change',event=>{
  const el=event.target;
  if(el.id==='course-module-filter'){state.modules[el.dataset.course]=el.value;render();}
  else if(el.id==='academic-filter'){state.academicFilter=el.value;render();}
  else if(state.exam&&el.dataset.questionId){
    const e=state.exam;e.answers[el.dataset.questionId]=Number(el.value);const answers={...e.answers};renderExamQuestion();
    const status=document.querySelector('#exam-save-status');status.textContent='Guardando respuesta…';
    state.saveQueue=state.saveQueue.then(()=>service.saveAnswers(e.attempt.id,answers)).then(()=>{if(state.exam===e)document.querySelector('#exam-save-status').textContent='Respuestas guardadas.';}).catch(error=>{if(state.exam===e)document.querySelector('#exam-save-status').textContent=error.code==='deadline-exceeded'?'Tiempo finalizado.':'No se guardó. Revisa tu conexión y reintenta la entrega.';});
  }else if(el.id==='f-level'){
    const stage=document.querySelector('#f-stage');if(stage)stage.innerHTML=stageOptions(el.value,'1');
    if(document.querySelector('#f-modules'))document.querySelector('#f-modules').value=courseModules({level:el.value}).join('\n');
    if(document.querySelector('#user-course-list'))drawUserCourses();
  }else if(['f-stage','f-role','f-career','f-section','f-period'].includes(el.id)&&document.querySelector('#user-course-list'))drawUserCourses();
});
let searchTimer;
document.addEventListener('input',event=>{
  if(['global-search','course-search'].includes(event.target.id)){
    state.search=event.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(()=>{if(route().name!=='courses')location.hash='courses';else{render();const input=document.querySelector('#course-search');input?.focus();input?.setSelectionRange?.(input.value.length,input.value.length);}},180);
  }else if(event.target.id==='user-search'){
    state.userSearch=event.target.value;clearTimeout(searchTimer);searchTimer=setTimeout(async()=>{
      try{if(service.mode==='firebase'){const page=await service.listUsers(state.userSearch);state.data.userResults=page.users;for(const u of page.users){const at=state.data.users.findIndex(old=>old.id===u.id);if(at<0)state.data.users.push(u);else state.data.users[at]=u;}state.data.hasMoreUsers=page.hasMore;const foundEnrollments=page.users.flatMap(u=>(u.courseIds||[]).map(courseId=>({uid:u.id,courseId,active:true})));for(const e of foundEnrollments)if(!state.data.enrollments.some(old=>old.uid===e.uid&&old.courseId===e.courseId))state.data.enrollments.push(e);}
        render();const input=document.querySelector('#user-search');input?.focus();input?.setSelectionRange?.(input.value.length,input.value.length);
      }catch(error){toast(error.message,true);}
    },250);
  }
});
modal.addEventListener('cancel',event=>{event.preventDefault();if(state.exam){closeModal();toast('El tiempo del examen sigue transcurriendo.');}else closeModal();});
window.addEventListener('hashchange',async()=>{state.navOpen=false;if(state.data){try{await prepareRoster();render();}catch(error){toast(error.message,true);render();}}});
async function boot(){
  try{
    service=config.firebase ? new (await import('./firebase-adapter.js')).FirebaseAdapter() : new DemoAdapter();
    await service.init();if(service.currentUser)await refresh();else login();
  }catch(error){app.innerHTML=`<main class="screen-error"><p class="eyebrow">AulaNexo</p><h1>No se pudo abrir el aula.</h1><p>${esc(error.message)}</p><p>Revisa la conexión y la configuración del proyecto. Los datos reales no se sustituyen por datos de prueba.</p><button class="button primary" onclick="location.reload()">Reintentar</button></main>`;}
}
boot();
