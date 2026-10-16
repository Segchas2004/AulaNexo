import test from 'node:test';
import assert from 'node:assert/strict';
import { DemoAdapter } from '../dist/demo-adapter.js';
import { canEnroll, courseModules, academicDate, validateSession } from '../dist/core.js';
class MemoryStorage { constructor(){this.items=new Map();}getItem(k){return this.items.get(k)||null;}setItem(k,v){this.items.set(k,v);}removeItem(k){this.items.delete(k);} }
async function setup(clock){const s=await new DemoAdapter(new MemoryStorage(),new MemoryStorage(),clock).init();await s.signInDemo('teacher');return s;}
const input={title:'Trabajo de práctica',instructions:'Explica los pasos que seguiste.',published:true,module:'Semestre I',allowLate:false};
test('Los apartados distinguen semestres, unidades y cursos independientes',()=>{
  assert.deepEqual(courseModules({level:'secondary'}),['Semestre I','Semestre II']);assert.equal(courseModules({level:'university'})[0],'Unidad 1');
  assert.deepEqual(courseModules({level:'university',modules:['Unidad A']}),['Unidad A']);
  assert.equal(academicDate('2026-10-12T18:00'),'2026-10-12T23:00:00.000Z');
  assert.equal(validateSession({title:'Clase en Meet',meetingUrl:'https://meet.google.com/abc-defg-hij',startsAt:'2026-10-12T18:00'}).mode,'external');
  assert.throws(()=>validateSession({title:'Clase dentro',mode:'integrated',startsAt:'2026-10-12T18:00'}));
});
test('Carrera, sección y periodo impiden matrículas entre grupos incompatibles',()=>{
  const course={level:'university',stage:'4',career:'Sistemas',section:'A',period:'2026-II'},user={role:'student',...course};
  assert.equal(canEnroll(user,course),true);assert.equal(canEnroll({...user,career:'Derecho'},course),false);assert.equal(canEnroll({...user,section:'B'},course),false);assert.equal(canEnroll({...user,period:'2026-I'},course),false);
});
test('Los códigos son únicos y permiten ingresar sin publicar un directorio de correos',async()=>{
  const s=await setup();await s.signInDemo('owner');const u=await s.saveUser({displayName:'Alumno con código',email:'codigo@example.com',password:'PruebaCodigo2026!',role:'student',level:'secondary',stage:'3',courseIds:['math-3'],studentCode:'alum-001'});
  assert.equal(u.studentCode,'ALUM-001');await assert.rejects(()=>s.saveUser({...u,email:'duplicado@example.com',password:'PruebaCodigo2026!'}),{code:'already-exists'});
  await s.signOut();await s.signIn('alum-001','PruebaCodigo2026!');assert.deepEqual((await s.load()).courses.map(c=>c.id),['math-3']);
});
test('Una clase solo se publica en un apartado existente de su curso',async()=>{
  const s=await setup();await assert.rejects(()=>s.saveSession('math-3',{title:'Clase de prueba',startsAt:'2026-10-12T18:00',module:'Unidad 3',meetingUrl:'https://meet.google.com/abc-defg-hij'}));
  const session=await s.saveSession('math-3',{title:'Clase semestre II',startsAt:'2026-10-12T18:00',module:'Semestre II',meetingUrl:'https://meet.google.com/abc-defg-hij'});
  await s.signInDemo('secondary');assert.equal((await s.load()).sessions[0].module,'Semestre II');await s.signInDemo('university');assert.ok(!(await s.load()).sessions.some(a=>a.id===session.id));
});
test('Un alumno entrega, el docente califica y solo su titular consulta su trabajo',async()=>{
  const s=await setup(),a=await s.saveAssignment('math-3',input);await s.signInDemo('secondary');
  const result=await s.submitAssignment('math-3',a.id,{text:'Mi resultado es x=3.',score20:20,status:'graded',uid:'otro'});
  assert.equal(result.status,'submitted');assert.equal(result.uid,'student-secondary');assert.equal(result.score20,undefined);
  await s.signInDemo('university');assert.ok(!(await s.load()).submissions.some(r=>r.id===result.id));await assert.rejects(()=>s.submissionURL(result.id),{code:'permission-denied'});await assert.rejects(()=>s.gradeSubmission(result.id,{score20:20}),{code:'permission-denied'});
  await s.signInDemo('teacher');await s.gradeSubmission(result.id,{score20:17.5,feedback:'Explica tu segundo paso.'});
  await s.signInDemo('secondary');const own=(await s.load()).submissions.find(r=>r.id===result.id);assert.equal(own.score20,17.5);assert.equal(own.feedback,'Explica tu segundo paso.');
  await assert.rejects(()=>s.submitAssignment('math-3',a.id,{text:'Quiero cambiar después de calificar.'}));
  await s.signInDemo('teacher');await s.returnSubmission(result.id);await s.signInDemo('secondary');const updated=await s.submitAssignment('math-3',a.id,{text:'Una respuesta corregida.'});assert.equal(updated.revision,2);assert.equal(updated.status,'submitted');
});
test('La fecha del servidor bloquea entregas tardías salvo autorización del docente',async()=>{
  let now=Date.parse('2026-10-12T20:00:00Z');const s=await setup(()=>now),a=await s.saveAssignment('math-3',{...input,dueAt:'2026-10-12T16:00'});
  await s.signInDemo('secondary');now=Date.parse(a.dueAt)+1;await assert.rejects(()=>s.submitAssignment('math-3',a.id,{text:'Entrega tardía.'}),{code:'deadline-exceeded'});
  await s.signInDemo('teacher');await s.saveAssignment('math-3',{...a,allowLate:true},a.id);await s.signInDemo('secondary');assert.equal((await s.submitAssignment('math-3',a.id,{text:'Entrega tardía permitida.'})).late,true);
});
test('Un alumno no puede publicar avisos ni usar rutas de archivo de otra cuenta',async()=>{
  const s=await setup();await s.signInDemo('secondary');await assert.rejects(()=>s.saveAnnouncement('math-3',{title:'Falso aviso',text:'Un cambio no autorizado.'}),{code:'permission-denied'});
  await assert.rejects(()=>s.submitAssignment('math-3','task-math',{text:'Entrega',path:'submissions/math-3/task-math/otra-cuenta/test/a.pdf'}),{code:'permission-denied'});
});
test('Un apartado con contenido se conserva al editar el curso',async()=>{
  const s=await setup(),c=s.state.courses.find(c=>c.id==='math-3');await assert.rejects(()=>s.saveCourse({...c,modules:['Semestre II']},c.id));
  const saved=await s.saveCourse({...c,modules:[...c.modules,'Refuerzo']},c.id);assert.ok(saved.modules.includes('Refuerzo'));
});
test('Las grabaciones se suben manualmente y respetan el curso y semestre',async()=>{
  const s=await setup();const files=new Map();
  s.fileDB=async()=>({
    close(){},
    transaction(){
      const tx={objectStore(){return {
        put(file,path){files.set(path,file);queueMicrotask(()=>tx.oncomplete());},
        get(path){const r={};queueMicrotask(()=>{r.result=files.get(path);r.onsuccess();});return r;}
      };}};
      return tx;
    }
  });
  const video=new Blob(['video de prueba'],{type:'video/mp4'});Object.defineProperty(video,'name',{value:'mi-clase.mp4'});
  const file=await s.upload('math-3',video),m=await s.saveMaterial('math-3',{...file,title:'Clase grabada por el docente',kind:'recording',module:'Semestre II'});
  await s.signInDemo('secondary');const url=await s.materialURL('math-3',m.id);assert.ok(url.startsWith('blob:'));assert.equal(await (await fetch(url)).text(),'video de prueba');URL.revokeObjectURL(url);
  await s.signInDemo('university');await assert.rejects(()=>s.materialURL('math-3',m.id),{code:'permission-denied'});
});
