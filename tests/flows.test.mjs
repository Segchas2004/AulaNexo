import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { DemoAdapter, DEMO_PASSWORD } from '../dist/demo-adapter.js';
globalThis.crypto ??= webcrypto;
class MemoryStorage {
  constructor(){this.data=new Map();}
  getItem(k){return this.data.get(k) ?? null;}
  setItem(k,v){this.data.set(k,String(v));}
  removeItem(k){this.data.delete(k);}
}
async function setup(clock){const storage=new MemoryStorage(),session=new MemoryStorage();const service=await new DemoAdapter(storage,session,clock).init();await service.signInDemo('owner');return {service,storage,session};}
const newStudent=(overrides={})=>({displayName:'Alumno de prueba',email:'nuevo@example.com',password:'PruebaSegura2026!',role:'student',level:'secondary',stage:'3',courseIds:['math-3'],...overrides});
test('El administrador crea una cuenta; el alumno ingresa y recibe solo su curso',async()=>{
  const {service,storage}=await setup();const created=await service.saveUser(newStudent());
  assert.equal(created.email,'nuevo@example.com');assert.equal('password' in created,false);
  assert.ok(![...storage.data.values()].join('').includes('PruebaSegura2026!'));
  await service.signOut();await service.signIn('nuevo@example.com','PruebaSegura2026!');
  const data=await service.load();assert.deepEqual(data.courses.map(c=>c.id),['math-3']);assert.equal(data.users.length,1);
  assert.ok(data.exams.every(e=>e.questions.every(q=>!('correct' in q))));
});
test('La cuenta nueva y sus matrículas sobreviven a una nueva instancia del aula',async()=>{
  const {service,storage,session}=await setup();await service.saveUser(newStudent());await service.signOut();
  const reopened=await new DemoAdapter(storage,session).init();await reopened.signIn('nuevo@example.com','PruebaSegura2026!');
  assert.deepEqual((await reopened.load()).courses.map(c=>c.id),['math-3']);
});
test('Secundaria y universidad reciben cursos diferentes',async()=>{
  const {service}=await setup();await service.signInDemo('secondary');
  assert.deepEqual((await service.load()).courses.map(c=>c.id).sort(),['language-3','math-3']);
  await service.signInDemo('university');
  assert.deepEqual((await service.load()).courses.map(c=>c.id).sort(),['calculus-4','programming-4']);
});
test('El alumno no puede invocar operaciones administrativas ni leer claves del examen',async()=>{
  const {service}=await setup();await service.signInDemo('secondary');
  await assert.rejects(()=>service.saveUser(newStudent()),{code:'permission-denied'});
  await assert.rejects(()=>service.saveCourse({title:'Falso',level:'secondary',teacherId:'student-secondary',published:true}),{code:'permission-denied'});
  await assert.rejects(()=>service.examForEditor('math-3','exam-math'),{code:'permission-denied'});
  await assert.rejects(()=>service.saveMaterial('math-3',{title:'Cambio',kind:'link',url:'https://example.com'}),{code:'permission-denied'});
});
test('El acceso directo a un curso, material o examen no matriculado también se bloquea',async()=>{
  const {service}=await setup();await service.signInDemo('secondary');
  assert.throws(()=>service.course('programming-4'),{code:'permission-denied'});
  await assert.rejects(()=>service.materialURL('programming-4','sample-code'),{code:'permission-denied'});
  await assert.rejects(()=>service.startExam('programming-4','exam-code'),{code:'permission-denied'});
});
test('No se permite matricular un alumno en otro grado/ciclo',async()=>{
  const {service}=await setup();await assert.rejects(()=>service.saveUser(newStudent({stage:'4'})));
  await assert.rejects(()=>service.saveUser(newStudent({courseIds:['programming-4']})));
  await service.saveUser(newStudent({courseIds:['math-3','digital']}));
});
test('Los correos duplicados se detectan sin distinguir mayúsculas',async()=>{
  const {service}=await setup();await service.saveUser(newStudent());
  await assert.rejects(()=>service.saveUser(newStudent({email:' NUEVO@EXAMPLE.COM '})),{code:'already-exists'});
});
test('Un docente crea alumnos pero no puede crear otros docentes',async()=>{
  const {service}=await setup();await service.signInDemo('teacher');await service.saveUser(newStudent());
  await assert.rejects(()=>service.saveUser(newStudent({email:'t@example.com',role:'teacher',courseIds:[]})),{code:'permission-denied'});
});
test('El docente no puede conceder acceso a un curso de otro responsable',async()=>{
  const {service}=await setup();const c=await service.saveCourse({title:'Curso del propietario',level:'secondary',stage:'3',teacherId:'owner-demo',published:true});
  await service.signInDemo('teacher');await assert.rejects(()=>service.saveUser(newStudent({courseIds:[c.id]})),{code:'permission-denied'});
});
test('Suspender una cuenta bloquea su sesión previa y habilitarla permite volver a entrar',async()=>{
  const {service,storage}=await setup();const u=await service.saveUser(newStudent());
  const pupil=await new DemoAdapter(storage,new MemoryStorage()).init();await pupil.signIn(u.email,'PruebaSegura2026!');
  await service.toggleUser(u.id);await pupil.init();await assert.rejects(()=>pupil.load(),{code:'permission-denied'});
  await assert.rejects(()=>pupil.signIn(u.email,'PruebaSegura2026!'),{code:'permission-denied'});
  await service.toggleUser(u.id);await pupil.init();await pupil.signIn(u.email,'PruebaSegura2026!');assert.equal((await pupil.load()).courses.length,1);
});
test('La cuenta del propietario está protegida contra suspensión desde el panel',async()=>{
  const {service}=await setup();await assert.rejects(()=>service.toggleUser('owner-demo'),{code:'permission-denied'});
});
test('El examen se califica y los reintentos de entrega no alteran la nota',async()=>{
  const {service}=await setup();await service.signInDemo('secondary');const {attempt}=await service.startExam('math-3','exam-math');
  await service.saveAnswers(attempt.id,{q1:1});const result=await service.submitExam(attempt.id,{q1:1,q2:2,q3:2,score20:999});
  assert.equal(result.score20,20);assert.equal(result.status,'graded');
  assert.equal((await service.submitExam(attempt.id,{q1:0,q2:0,q3:0})).score20,20);
  assert.equal((await service.startExam('math-3','exam-math')).attempt.status,'graded');
});
test('Retomar un examen conserva el inicio, el límite y las respuestas guardadas',async()=>{
  let now=1000000;const {service}=await setup(()=>now);await service.signInDemo('secondary');
  const {attempt}=await service.startExam('math-3','exam-math');await service.saveAnswers(attempt.id,{q1:1});now+=60000;
  const resumed=(await service.startExam('math-3','exam-math')).attempt;
  assert.equal(resumed.deadlineAt,attempt.deadlineAt);assert.equal(resumed.answers.q1,1);assert.equal(service.state.attempts.length,1);
});
test('Al vencer el tiempo se califican únicamente respuestas guardadas a tiempo',async()=>{
  let now=1000000;const {service}=await setup(()=>now);await service.signInDemo('secondary');const {attempt}=await service.startExam('math-3','exam-math');
  await service.saveAnswers(attempt.id,{q1:1});now=attempt.deadlineAt+1;
  await assert.rejects(()=>service.saveAnswers(attempt.id,{q2:2}),{code:'deadline-exceeded'});
  const result=await service.submitExam(attempt.id,{q1:1,q2:2,q3:2});assert.equal(result.correct,1);assert.equal(result.score20,6.67);
});
test('Editar el examen no modifica la clave ni las preguntas de un intento ya iniciado',async()=>{
  const {service}=await setup();await service.signInDemo('secondary');const {attempt}=await service.startExam('math-3','exam-math');
  await service.signInDemo('teacher');const exam=await service.examForEditor('math-3','exam-math');exam.questions[0].correct=0;await service.saveExam('math-3',exam,'exam-math');
  await service.signInDemo('secondary');const result=await service.submitExam(attempt.id,{q1:1,q2:2,q3:2});assert.equal(result.score20,20);
});
test('Un alumno no puede guardar ni entregar el intento de otro alumno',async()=>{
  const {service}=await setup();await service.signInDemo('secondary');const {attempt}=await service.startExam('math-3','exam-math');
  await service.signInDemo('university');await assert.rejects(()=>service.submitExam(attempt.id,{q1:1}),{code:'permission-denied'});
});
test('Retirar la publicación del curso revoca el acceso de su alumno',async()=>{
  const {service}=await setup();const c=service.state.courses.find(c=>c.id==='math-3');await service.saveCourse({...c,published:false},c.id);
  await service.signInDemo('secondary');assert.ok(!(await service.load()).courses.some(c=>c.id==='math-3'));
  await assert.rejects(()=>service.startExam('math-3','exam-math'),{code:'permission-denied'});
});
test('El alumno cambia su contraseña sin guardarla en texto legible',async()=>{
  const {service,storage}=await setup();await service.signInDemo('secondary');
  await assert.rejects(()=>service.changePassword('incorrecta','NuevaClave2026!'));
  await service.changePassword(DEMO_PASSWORD,'NuevaClave2026!');assert.ok(![...storage.data.values()].join('').includes('NuevaClave2026!'));
  await service.signOut();await assert.rejects(()=>service.signIn('secundaria@aulanexo.example',DEMO_PASSWORD));await service.signIn('secundaria@aulanexo.example','NuevaClave2026!');
});
test('Los cursos con alumnos conservan su nivel para no romper sus matrículas',async()=>{
  const {service}=await setup();const c=service.state.courses.find(c=>c.id==='math-3');
  await assert.rejects(()=>service.saveCourse({...c,stage:'4'},c.id));
});
test('El docente programa una clase y solo los alumnos matriculados la reciben',async()=>{
  const {service}=await setup();await service.saveSession('math-3',{title:'Clase de ecuaciones',startsAt:'2026-10-07T22:00:00Z',meetingUrl:'https://meet.google.com/abc-defg-hij'});
  await service.signInDemo('secondary');assert.equal((await service.load()).sessions.length,1);
  await service.signInDemo('university');assert.equal((await service.load()).sessions.length,0);
});
