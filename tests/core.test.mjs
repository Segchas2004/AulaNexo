import test from 'node:test';
import assert from 'node:assert/strict';
import { canReadCourse, canManageCourse, canEnroll, validateUserInput, validateProvision, validateExam, splitExam, gradeExam, sanitizeAnswers, safeURL, escapeHTML, deadlineFor } from '../dist/core.js';

const owner = { id:'owner',role:'owner',active:true };
const student = { id:'student',role:'student',active:true,level:'secondary',stage:'3' };
const teacher = { id:'teacher',role:'teacher',active:true };
const course = { id:'math',title:'Matemática',teacherId:'teacher',level:'secondary',stage:'3',published:true };
const enrollment = { uid:'student',courseId:'math',active:true };
const examInput = { title:'Evaluación inicial',minutes:30,published:true,questions:[
  {prompt:'Dos más dos',options:['3','4','5','6'],correct:1,points:1},
  {prompt:'Tres por tres',options:['6','9','12','15'],correct:1,points:3},
] };

test('El PDF del examen acepta únicamente documentos limitados y conserva metadatos seguros',()=>{
  const document={path:'courses/math/files/id/examen.pdf',filename:'Examen.pdf',size:2000,mimetype:'application/pdf',url:'https://externo.example/no-admitido'};
  const validated=validateExam({...examInput,document});
  assert.equal(validated.document.path,document.path);
  assert.equal('url' in validated.document,false);
  for(const bad of [{...document,path:'../privado.pdf'},{...document,mimetype:'text/html'},{...document,size:21*1024**2},{...document,size:-1}])assert.throws(()=>validateExam({...examInput,document:bad}));
});
test('Una matrícula habilita el curso solo a su titular activo',()=>{
  assert.equal(canReadCourse(student,course,[enrollment]),true);
  assert.equal(canReadCourse({...student,id:'other'},course,[enrollment]),false);
  assert.equal(canReadCourse({...student,active:false},course,[enrollment]),false);
  assert.equal(canReadCourse(student,{...course,published:false},[enrollment]),false);
});
test('El docente administra únicamente sus cursos y el propietario administra todos',()=>{
  assert.equal(canManageCourse(teacher,course),true);
  assert.equal(canManageCourse({...teacher,id:'other'},course),false);
  assert.equal(canManageCourse(owner,course),true);
  assert.equal(canManageCourse(student,course),false);
});
test('La matrícula respeta nivel y grado/ciclo, y permite cursos independientes',()=>{
  assert.equal(canEnroll(student,course),true);
  assert.equal(canEnroll({...student,stage:'4'},course),false);
  assert.equal(canEnroll({...student,level:'university'},course),false);
  assert.equal(canEnroll(student,{...course,level:'independent',stage:''}),true);
});
test('Un alumno no puede crear cuentas ni concederse matrículas',()=>{
  assert.throws(()=>validateProvision(student,{role:'student',courseIds:['math']},[course]),{code:'permission-denied'});
  assert.throws(()=>validateProvision(teacher,{role:'teacher',courseIds:[]},[course]),{code:'permission-denied'});
});
test('Una contraseña débil o un correo incorrecto no crean cuenta',()=>{
  assert.throws(()=>validateUserInput({displayName:'Alumno',email:'bad',role:'student',password:'GoodPass123!'}));
  assert.throws(()=>validateUserInput({displayName:'Alumno',email:'a@example.com',role:'student',password:'123'}));
  const profile=validateUserInput({displayName:'Alumno',email:' ALUMNO@EXAMPLE.COM ',role:'student',password:'GoodPass123!'});
  assert.equal(profile.email,'alumno@example.com');assert.equal('password' in profile,false);
});
test('El examen público no contiene las respuestas correctas',()=>{
  const {publicExam,keys}=splitExam(validateExam(examInput));
  assert.equal(publicExam.totalPoints,4);assert.deepEqual(keys,{q1:1,q2:1});
  assert.ok(publicExam.questions.every(q=>!Object.hasOwn(q,'correct')));
});
test('La nota ponderada se calcula sobre 20 y no acepta puntuaciones del cliente',()=>{
  const {publicExam,keys}=splitExam(validateExam(examInput));
  assert.equal(gradeExam(publicExam.questions,keys,{q1:1,q2:0,score20:20}).score20,5);
  assert.equal(gradeExam(publicExam.questions,keys,{q1:1,q2:1}).score20,20);
  assert.equal(gradeExam(publicExam.questions,keys,{}).score20,0);
});
test('Alternativas fuera de rango y claves incompletas se rechazan',()=>{
  const {publicExam,keys}=splitExam(validateExam(examInput));
  assert.throws(()=>sanitizeAnswers(publicExam.questions,{q1:99}));
  assert.throws(()=>sanitizeAnswers(publicExam.questions,{q1:'1'}));
  assert.throws(()=>gradeExam(publicExam.questions,{},{}),{code:'failed-precondition'});
  assert.throws(()=>validateExam({...examInput,questions:[{...examInput.questions[0],correct:null}]}));
  assert.throws(()=>validateExam({...examInput,opensAt:'invalid-date'}));
});
test('El cierre del examen limita el tiempo disponible',()=>{
  const now=Date.parse('2026-10-06T20:00:00Z');
  assert.equal(deadlineFor({...examInput,closesAt:'2026-10-06T20:05:00Z'},now),now+300000);
});
test('Los enlaces ejecutables y el HTML inyectado no se aceptan como contenido',()=>{
  assert.equal(safeURL('javascript:alert(1)'),null);assert.equal(safeURL('data:text/html,test'),null);
  assert.equal(safeURL('https://example.com/resource'),'https://example.com/resource');
  assert.equal(escapeHTML('<img src=x onerror="test">'),'&lt;img src=x onerror=&quot;test&quot;&gt;');
});
