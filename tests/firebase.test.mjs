import test from 'node:test';
import assert from 'node:assert/strict';
import { FirebaseAdapter } from '../dist/firebase-adapter.js';
import { createRequire } from 'node:module';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signInWithCustomToken, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator, httpsCallable } from 'firebase/functions';
import { getStorage, connectStorageEmulator, ref, uploadBytes, getBytes } from 'firebase/storage';

const emulator = !!process.env.FIRESTORE_EMULATOR_HOST;
test('Firebase emulado: endpoints, Authentication y reglas de acceso', { skip: !emulator, timeout: 180000 }, async t => {
  const projectId = 'demo-aulanexo';
  assert.equal(process.env.GCLOUD_PROJECT || projectId, projectId, 'Solo se ejecuta contra el proyecto demo, nunca contra producción.');
  const require=createRequire(new URL('../functions/package.json',import.meta.url));
  const { initializeApp:adminApp }=await import(require.resolve('firebase-admin/app'));
  const { getAuth:adminAuth }=await import(require.resolve('firebase-admin/auth'));
  const { getFirestore:adminDb }=await import(require.resolve('firebase-admin/firestore'));
  const trusted=adminApp({projectId,storageBucket:`${projectId}.appspot.com`},'qa-admin');
  const adb=adminDb(trusted);const aa=adminAuth(trusted);
  // Alternativa de prueba para entornos sin sockets Unix de procesos hijos.
  // Usa el handler real con un ID token verificado por el Admin SDK del emulador.
  const directMode=!!process.env.AULANEXO_DIRECT_FUNCTION_TESTS;
  const directHandlers=directMode ? await import('../functions/index.js') : null;
  const apps=[];
  function client(label) {
    const app=initializeApp({projectId,apiKey:'demo-public-key',authDomain:`${projectId}.firebaseapp.com`,storageBucket:`${projectId}.appspot.com`},label);apps.push(app);
    const auth=getAuth(app);connectAuthEmulator(auth,'http://127.0.0.1:9099',{disableWarnings:true});
    const db=getFirestore(app);connectFirestoreEmulator(db,'127.0.0.1',8080);
    const functions=getFunctions(app,'us-central1');connectFunctionsEmulator(functions,'127.0.0.1',5001);
    const storage=getStorage(app);connectStorageEmulator(storage,'127.0.0.1',9199);
    return {app,auth,db,functions,storage,call:async(name,data)=>{
      if (!directHandlers) return (await httpsCallable(functions,name)(data)).data;
      try{
        const token=auth.currentUser ? await aa.verifyIdToken(await auth.currentUser.getIdToken()) : null;
        return await directHandlers[name].run({data,auth:token ? {uid:token.uid,token} : undefined});
      }catch(error){
        const mapped=new Error(error.message,{cause:error});
        mapped.code=error.code?.startsWith('auth/') ? 'functions/unauthenticated'
          : error.code?.startsWith('functions/') ? error.code : 'functions/'+error.code;
        throw mapped;
      }
    }};
  }
  const owner=client('qa-owner'),teacher=client('qa-teacher'),student=client('qa-student'),other=client('qa-other');
  const password='SoloEmulador2026!';
  const ownerUser=await aa.createUser({email:'propietario@example.com',password,displayName:'Propietario de prueba'});
  await adb.doc(`users/${ownerUser.uid}`).set({displayName:'Propietario de prueba',displayNameFold:'propietario de prueba',email:'propietario@example.com',role:'owner',active:true,level:'independent',stage:'',courseIds:[],managerIds:[],createdBy:ownerUser.uid});
  await signInWithEmailAndPassword(owner.auth,'propietario@example.com',password);
  let teacherUser,studentUser,otherUser,course,otherCourse,exam,attempt;
  try{
    await t.test('El panel crea docente, cursos y alumnos sin escribir contraseñas en Firestore',async()=>{
      teacherUser=await owner.call('adminCreateUser',{displayName:'Docente de prueba',email:'docente@example.com',password,role:'teacher',level:'independent',stage:'',courseIds:[]});
      course=await owner.call('saveCourse',{title:'Matemática 3',description:'Curso para probar accesos.',level:'secondary',stage:'3',teacherId:teacherUser.id,published:true,color:'copper'});
      otherCourse=await owner.call('saveCourse',{title:'Programación IV',description:'Curso universitario.',level:'university',stage:'4',teacherId:teacherUser.id,published:true,color:'indigo'});
      studentUser=await owner.call('adminCreateUser',{displayName:'Alumno secundaria',email:'alumno@example.com',password,role:'student',level:'secondary',stage:'3',courseIds:[course.id]});
      otherUser=await owner.call('adminCreateUser',{displayName:'Alumno universidad',email:'universitario@example.com',password,role:'student',level:'university',stage:'4',courseIds:[otherCourse.id]});
      const profile=(await adb.doc(`users/${studentUser.id}`).get()).data();assert.equal('password' in profile,false);assert.deepEqual(profile.courseIds,[course.id]);
      await signInWithEmailAndPassword(teacher.auth,'docente@example.com',password);await signInWithEmailAndPassword(student.auth,'alumno@example.com',password);await signInWithEmailAndPassword(other.auth,'universitario@example.com',password);
    });
    await t.test('Las reglas permiten el curso matriculado y bloquean otro curso y la elevación de rol',async()=>{
      assert.equal((await getDoc(doc(student.db,'courses',course.id))).exists(),true);
      await assert.rejects(()=>getDoc(doc(student.db,'courses',otherCourse.id)),e=>e.code==='permission-denied');
      await assert.rejects(()=>setDoc(doc(student.db,'users',studentUser.id),{role:'owner'},{merge:true}),e=>e.code==='permission-denied');
      await assert.rejects(()=>getDoc(doc(student.db,'users',otherUser.id)),e=>e.code==='permission-denied');
      const roster=await getDocs(query(collection(teacher.db,'users'),where('managerIds','array-contains',teacherUser.id),orderBy('displayNameFold'),limit(50)));assert.ok(roster.docs.some(d=>d.id===studentUser.id));
      const teacherCourses=await getDocs(query(collection(teacher.db,'courses'),where('teacherId','==',teacherUser.id),limit(100)));assert.equal(teacherCourses.size,2);
      const enrollments=await getDocs(query(collection(student.db,'enrollments'),where('uid','==',studentUser.id),where('active','==',true),limit(40)));assert.equal(enrollments.size,1);
    });
    await t.test('Los endpoints administrativos rechazan alumnos y matrículas incompatibles',async()=>{
      await assert.rejects(()=>student.call('adminCreateUser',{displayName:'Intruso',email:'intruso@example.com',password,role:'teacher',level:'independent',courseIds:[]}),e=>e.code==='functions/permission-denied');
      await assert.rejects(()=>teacher.call('adminCreateUser',{displayName:'Otro docente',email:'otrodocente@example.com',password,role:'teacher',level:'independent',courseIds:[]}),e=>e.code==='functions/permission-denied');
      await assert.rejects(()=>owner.call('adminCreateUser',{displayName:'Grado incorrecto',email:'grado@example.com',password,role:'student',level:'secondary',stage:'4',courseIds:[course.id]}),e=>e.code==='functions/invalid-argument');
    });
    await t.test('Storage protege archivos por curso y rechaza contenido HTML',async()=>{
      const path=`courses/${course.id}/files/testfile/guia.txt`;const content=new TextEncoder().encode('Guía de prueba de AulaNexo');
      await uploadBytes(ref(owner.storage,path),content,{contentType:'text/plain'});
      const material=await owner.call('saveMaterial',{courseId:course.id,title:'Guía de prueba',module:'Semestre I',kind:'document',path,filename:'guia.txt',mimetype:'text/plain'});
      assert.ok(material.id);assert.equal(material.size,content.length);await assert.rejects(()=>getBytes(ref(student.storage,path)),e=>e.code==='storage/unauthorized');
      await assert.rejects(()=>other.call('materialLink',{courseId:course.id,id:material.id}),e=>e.code==='functions/permission-denied');
      await assert.rejects(()=>getBytes(ref(other.storage,path)),e=>e.code==='storage/unauthorized');
      await assert.rejects(()=>uploadBytes(ref(student.storage,`courses/${course.id}/files/attack/a.txt`),content,{contentType:'text/plain'}),e=>e.code==='storage/unauthorized');
      await assert.rejects(()=>uploadBytes(ref(owner.storage,`courses/${course.id}/files/html/a.html`),content,{contentType:'text/html'}),e=>e.code==='storage/unauthorized');
      await owner.call('deleteMaterial',{courseId:course.id,id:material.id});
    });
    await t.test('Las claves son privadas y la nota se calcula en las funciones del servidor',async()=>{
      exam=await teacher.call('saveExam',{courseId:course.id,title:'Evaluación de prueba',minutes:30,published:true,questions:[{prompt:'2 + 2',options:['3','4','5','6'],correct:1,points:1},{prompt:'3 × 3',options:['6','9','12','15'],correct:1,points:1}]});
      const publicExam=(await getDoc(doc(student.db,'courses',course.id,'exams',exam.id))).data();assert.ok(publicExam.questions.every(q=>!('correct'in q)));
      await assert.rejects(()=>getDoc(doc(student.db,'examKeys',exam.id)),e=>e.code==='permission-denied');
      await assert.rejects(()=>getDoc(doc(owner.db,'examKeys',exam.id)),e=>e.code==='permission-denied');
      await assert.rejects(()=>student.call('examForEditor',{courseId:course.id,id:exam.id}),e=>e.code==='functions/permission-denied');
      attempt=(await student.call('startExam',{courseId:course.id,examId:exam.id})).attempt;
      await student.call('saveAnswers',{attemptId:attempt.id,answers:{q1:1}});
      const result=await student.call('submitExam',{attemptId:attempt.id,answers:{q1:1,q2:1,score20:999}});assert.equal(result.score20,20);
      const repeated=await student.call('submitExam',{attemptId:attempt.id,answers:{q1:0,q2:0}});assert.equal(repeated.score20,20);
      await assert.rejects(()=>setDoc(doc(student.db,'attempts',attempt.id),{score20:999},{merge:true}),e=>e.code==='permission-denied');
      await assert.rejects(()=>other.call('submitExam',{attemptId:attempt.id,answers:{q1:1}}),e=>e.code==='functions/permission-denied');
    });
    await t.test('El código verifica la contraseña con Auth y conserva la privacidad de los correos',async()=>{
      await assert.rejects(()=>getDoc(doc(student.db,'loginCodes',studentUser.studentCode)),e=>e.code==='permission-denied');
      await assert.rejects(()=>owner.call('adminCreateUser',{displayName:'Código duplicado',email:'duplicate@example.com',password,role:'student',level:'secondary',stage:'3',courseIds:[course.id],studentCode:studentUser.studentCode}),e=>e.code==='functions/already-exists');
      await assert.rejects(()=>student.call('loginWithStudentCode',{code:studentUser.studentCode,password:'Incorrecta2026!'}),e=>e.code==='functions/unauthenticated');
      const result=await student.call('loginWithStudentCode',{code:studentUser.studentCode.toLowerCase(),password});assert.equal('email'in result,false);assert.ok(result.token);
      await signOut(student.auth);await signInWithCustomToken(student.auth,result.token);assert.equal(student.auth.currentUser.uid,studentUser.id);
    });
    await t.test('Los enlaces de Meet y las grabaciones manuales quedan en su semestre',async()=>{
      const session=await teacher.call('saveSession',{courseId:course.id,title:'Clase por Meet',module:'Semestre II',startsAt:'2026-10-12T18:00',minutes:360,meetingUrl:'https://meet.google.com/abc-defg-hij'});
      assert.equal(session.mode,'external');assert.equal(session.startsAt,'2026-10-12T23:00:00.000Z');
      assert.equal((await getDoc(doc(student.db,'courses',course.id,'sessions',session.id))).data().module,'Semestre II');
      await assert.rejects(()=>getDoc(doc(other.db,'courses',course.id,'sessions',session.id)),e=>e.code==='permission-denied');
      await assert.rejects(()=>student.call('saveSession',{courseId:course.id,title:'Falsa clase',startsAt:'2026-10-12T18:00',meetingUrl:'https://meet.google.com/abc-defg-hij'}),e=>e.code==='functions/permission-denied');
      const path=`courses/${course.id}/files/video/clase.mp4`;await uploadBytes(ref(teacher.storage,path),new Uint8Array([0,0,0,1]),{contentType:'video/mp4'});
      const recording=await teacher.call('saveMaterial',{courseId:course.id,title:'Grabación manual',kind:'recording',module:'Semestre II',path,filename:'clase.mp4'});
      assert.equal(recording.mimetype,'video/mp4');assert.equal((await getDoc(doc(student.db,'courses',course.id,'materials',recording.id))).data().module,'Semestre II');
      await assert.rejects(()=>other.call('materialLink',{courseId:course.id,id:recording.id}),e=>e.code==='functions/permission-denied');
      await teacher.call('deleteMaterial',{courseId:course.id,id:recording.id});
    });
    await t.test('Trabajos, adjuntos privados, nota y comentario resisten cambios desde otra cuenta',async()=>{
      const task=await teacher.call('saveAssignment',{courseId:course.id,title:'Trabajo del semestre',instructions:'Explica el resultado.',module:'Semestre I',published:true,allowLate:true});
      const path=`submissions/${course.id}/${task.id}/${studentUser.id}/first/trabajo.txt`;await uploadBytes(ref(student.storage,path),new TextEncoder().encode('Mi respuesta es x=3.'),{contentType:'text/plain'});
      await assert.rejects(()=>uploadBytes(ref(other.storage,path+'extra'),new Uint8Array([1]),{contentType:'text/plain'}),e=>e.code==='storage/unauthorized');
      const submission=await student.call('submitAssignment',{courseId:course.id,assignmentId:task.id,text:'Mi respuesta es x=3.',path,filename:'trabajo.txt',score20:20,uid:otherUser.id,status:'graded'});
      assert.equal(submission.uid,studentUser.id);assert.equal(submission.status,'submitted');assert.equal(submission.score20,undefined);
      await assert.rejects(()=>getDoc(doc(other.db,'submissions',submission.id)),e=>e.code==='permission-denied');
      await assert.rejects(()=>other.call('submissionLink',{id:submission.id}),e=>e.code==='functions/permission-denied');
      await assert.rejects(()=>student.call('gradeSubmission',{id:submission.id,score20:20,revision:submission.revision}),e=>e.code==='functions/permission-denied');
      await assert.rejects(()=>teacher.call('gradeSubmission',{id:submission.id,score20:18,feedback:'Bien.',revision:99}),e=>e.code==='functions/failed-precondition');
      const grade=await teacher.call('gradeSubmission',{id:submission.id,score20:18.5,feedback:'Explica el último paso.',revision:submission.revision});assert.equal(grade.score20,18.5);
      const own=(await getDoc(doc(student.db,'submissions',submission.id))).data();assert.equal(own.feedback,'Explica el último paso.');
      const rows=await getDocs(query(collection(student.db,'submissions'),where('uid','==',studentUser.id),limit(100)));assert.equal(rows.size,1);
      await assert.rejects(()=>student.call('submitAssignment',{courseId:course.id,assignmentId:task.id,text:'Intento cambiar lo calificado.'}),e=>e.code==='functions/failed-precondition');
      await teacher.call('returnSubmission',{id:submission.id});const updated=await student.call('submitAssignment',{courseId:course.id,assignmentId:task.id,text:'Respuesta corregida.'});assert.equal(updated.revision,2);
      const hidden=await teacher.call('saveAssignment',{courseId:course.id,title:'Trabajo en borrador',instructions:'Sin publicar todavía.',module:'Semestre II',published:false,allowLate:false});
      await assert.rejects(()=>getDoc(doc(student.db,'courses',course.id,'assignments',hidden.id)),e=>e.code==='permission-denied');
      const visible=await getDocs(query(collection(student.db,'courses',course.id,'assignments'),where('published','==',true),orderBy('__name__'),limit(50)));assert.equal(visible.size,1);
      await assert.rejects(()=>uploadBytes(ref(student.storage,`submissions/${course.id}/${hidden.id}/${studentUser.id}/file/a.txt`),new Uint8Array([1]),{contentType:'text/plain'}),e=>e.code==='storage/unauthorized');
      const announcement=await teacher.call('saveAnnouncement',{courseId:course.id,title:'Aviso de unidad',text:'Revisa tus comentarios.',module:'Semestre I',pinned:true});assert.equal((await getDoc(doc(student.db,'courses',course.id,'announcements',announcement.id))).data().pinned,true);
      await assert.rejects(()=>other.call('saveAnnouncement',{courseId:course.id,title:'Falso aviso',text:'Un mensaje indebido.'}),e=>e.code==='functions/permission-denied');
    });
    await t.test('El adaptador carga datos autorizados y pagina contenido sin duplicar registros',async()=>{
      const sdk={db:await import('firebase/firestore'),auth:await import('firebase/auth'),storage:await import('firebase/storage')};
      const adapter=new FirebaseAdapter();Object.assign(adapter,{sdk,auth:student.auth,db:student.db,storage:student.storage,call:student.call});
      const batch=adb.batch();for(let i=0;i<51;i++)batch.set(adb.doc(`courses/${course.id}/materials/paged-${String(i).padStart(3,'0')}`),{title:'Material '+i,module:'Semestre I',kind:'link',url:'https://example.com/guia',createdAt:new Date().toISOString()});await batch.commit();
      const data=await adapter.load();assert.deepEqual(data.courses.map(c=>c.id),[course.id]);assert.equal(data.materials.length,50);assert.equal(data.hasMoreContent[`${course.id}:materials`],true);assert.equal(data.users.length,1);
      const second=await adapter.courseItems(course.id,'materials',true);assert.equal(second.items.length,1);assert.equal(second.hasMore,false);assert.ok(!data.materials.some(m=>m.id===second.items[0].id));
      const host=new FirebaseAdapter();Object.assign(host,{sdk,auth:owner.auth,db:owner.db,storage:owner.storage,call:owner.call});const all=await host.load();assert.equal(all.teachers.length,2);
      assert.equal((await host.listUsers(studentUser.studentCode)).users[0].id,studentUser.id);assert.equal((await host.listRoster(course.id)).users[0].id,studentUser.id);
    });
    await t.test('La suspensión revoca datos y operaciones con una sesión ya iniciada',async()=>{
      await owner.call('adminToggleUser',{uid:studentUser.id});
      await assert.rejects(()=>getDoc(doc(student.db,'courses',course.id)),e=>e.code==='permission-denied');
      await assert.rejects(()=>student.call('startExam',{courseId:course.id,examId:exam.id}),e=>['functions/permission-denied','functions/unauthenticated'].includes(e.code));
      await owner.call('adminToggleUser',{uid:studentUser.id});
      await signOut(student.auth);await signInWithEmailAndPassword(student.auth,'alumno@example.com',password);assert.equal((await getDoc(doc(student.db,'courses',course.id))).exists(),true);
    });
  }finally{await Promise.all(apps.map(deleteApp));}
});
