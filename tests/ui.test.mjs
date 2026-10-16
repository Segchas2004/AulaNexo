import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { webcrypto } from 'node:crypto';
import { JSDOM } from 'jsdom';

test('Interfaz DOM: crear curso, examen, acceso y rendir desde la cuenta nueva', {timeout:40000}, async t=>{
  // La prueba siempre usa la demostración, incluso después de configurar el proyecto real.
  const code=mkdtempSync(join(tmpdir(),'aulanexo-ui-'));
  for(const file of ['app.js','core.js','demo-adapter.js'])copyFileSync(new URL('../dist/'+file,import.meta.url),join(code,file));
  writeFileSync(join(code,'package.json'),'\{"type":"module"\}');
  writeFileSync(join(code,'firebase-config.js'),'export const config = {firebase:null,functionsRegion:"us-central1",emulators:null};');
  const dom=new JSDOM(readFileSync(new URL('../dist/index.html',import.meta.url),'utf8'),{url:'https://aulanexo.example/#home',pretendToBeVisual:true});
  const {window}=dom;
  for(const [name,value] of Object.entries({window,document:window.document,location:window.location,localStorage:window.localStorage,sessionStorage:window.sessionStorage,FormData:window.FormData,crypto:webcrypto,navigator:{clipboard:{writeText:async()=>{}}}}))Object.defineProperty(globalThis,name,{value,configurable:true});
  window.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','');};
  window.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');};
  window.open=()=>null;
  const select=selector=>{const el=window.document.querySelector(selector);assert.ok(el,`Elemento esperado: ${selector}`);return el;};
  const click=selector=>select(selector).click();
  const set=(selector,value)=>{select(selector).value=value;};
  const submit=()=>select('#modal-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
  const wait=async predicate=>{const start=Date.now();while(!predicate()){if(Date.now()-start>6000)throw new Error('La interfaz no llegó al estado esperado: '+window.document.querySelector('#modal-error')?.textContent);await new Promise(r=>setTimeout(r,15));}};
  let courseId,examId;
  try{
    await import(pathToFileURL(join(code,'app.js')).href);
    await wait(()=>window.document.querySelector('[data-action="demo-login"]'));
    await t.test('Entrar como propietario y crear un curso independiente',async()=>{
      click('[data-action="demo-login"][data-role="owner"]');await wait(()=>window.document.querySelector('.sidebar'));
      click('[data-action="new-course"]');set('#f-title','Curso práctico UI');set('#f-description','Un curso independiente de prueba.');
      set('#f-level','independent');select('#f-level').dispatchEvent(new window.Event('change',{bubbles:true}));submit();
      await wait(()=>window.document.querySelector('.course-header h1')?.textContent==='Curso práctico UI');
      courseId=window.location.hash.split('/')[1];assert.ok(courseId.startsWith('course-'));
    });
    await t.test('Crear preguntas sin respuestas correctas seleccionadas por defecto',async()=>{
      window.location.hash=`course/${courseId}/exams`;await wait(()=>window.document.querySelector('[data-action="new-exam"]'));
      click('[data-action="new-exam"]');assert.equal(window.document.querySelectorAll('.question-editor [type="radio"]:checked').length,0);
      set('#f-title','Evaluación UI');set('#f-minutes','5');set('#q-0-prompt','¿Cuánto es 2 + 2?');
      ['3','4','5','6'].forEach((text,i)=>set(`[name="q0option${i}"]`,text));select('[name="q0correct"][value="1"]').checked=true;submit();
      await wait(()=>!select('#modal').open&&window.document.querySelector('.exam-card h3')?.textContent==='Evaluación UI');
      examId=select('[data-action="edit-exam"]').dataset.id;
    });
    await t.test('Crear la cuenta y asignar su curso desde el panel',async()=>{
      window.location.hash=`course/${courseId}/roster`;await wait(()=>window.document.querySelector('[data-action="new-user"]'));
      click('[data-action="new-user"]');set('#f-displayName','Alumno de la interfaz');set('#f-email','interfaz@example.com');set('#f-password','InterfazPrueba2026!');set('#f-studentCode','UI-001');
      assert.equal(select(`[name="courseIds"][value="${courseId}"]`).checked,true);submit();
      await wait(()=>window.document.querySelector('#modal-title')?.textContent==='El acceso está creado.');
      assert.ok(select('.credentials').textContent.includes('interfaz@example.com'));click('[data-action="close-modal"]');
      assert.ok(select('.data-table').textContent.includes('Alumno de la interfaz'));
    });
    await t.test('Publicar Meet y una grabación manual en el módulo correspondiente',async()=>{
      window.location.hash=`course/${courseId}/live`;await wait(()=>window.document.querySelector('[data-action="new-session"]'));
      click('[data-action="new-session"]');assert.equal(window.document.querySelector('[name="autoRecord"]'),null);
      set('#f-title','Clase por Meet');set('#f-startsAt','2026-10-12T18:00');set('#f-module','Módulo 2');set('#f-meetingUrl','https://meet.google.com/abc-defg-hij');submit();
      await wait(()=>!select('#modal').open&&window.document.querySelector('.session-row'));
      assert.ok(select('.session-row').textContent.includes('Módulo 2'));
      const link=select('.session-row a');assert.equal(link.target,'_blank');assert.equal(link.href,'https://meet.google.com/abc-defg-hij');
      set('#course-module-filter','Módulo 1');select('#course-module-filter').dispatchEvent(new window.Event('change',{bubbles:true}));assert.equal(window.document.querySelector('.session-row'),null);
      set('#course-module-filter','Módulo 2');select('#course-module-filter').dispatchEvent(new window.Event('change',{bubbles:true}));assert.ok(window.document.querySelector('.session-row'));
      window.location.hash=`course/${courseId}/recordings`;await wait(()=>window.document.querySelector('[data-action="new-recording"]'));
      click('[data-action="new-recording"]');set('#f-title','Grabación manual UI');set('#f-url','https://example.com/clase.mp4');submit();
      await wait(()=>!select('#modal').open&&window.document.querySelector('.material-row'));assert.ok(select('.materials-group').textContent.includes('Módulo 2'));
      click('[data-action="open-material"]');await wait(()=>window.document.querySelector('#modal video'));assert.equal(select('#modal video').src,'https://example.com/clase.mp4');click('[data-action="close-modal"]');
      set('#course-module-filter','all');select('#course-module-filter').dispatchEvent(new window.Event('change',{bubbles:true}));
    });
    await t.test('Crear un trabajo y un aviso con su apartado',async()=>{
      window.location.hash=`course/${courseId}/work`;await wait(()=>window.document.querySelector('[data-action="new-assignment"]'));
      click('[data-action="new-assignment"]');set('#f-title','Trabajo UI');set('#f-instructions','Explica cómo resolver una ecuación.');submit();
      await wait(()=>!select('#modal').open&&window.document.querySelector('.assignment-card'));assert.ok(select('.assignment-card').textContent.includes('Módulo 1'));
      window.location.hash=`course/${courseId}/notices`;await wait(()=>window.document.querySelector('[data-action="new-notice"]'));
      click('[data-action="new-notice"]');set('#f-title','Aviso UI');set('#f-text','Bienvenidos al curso. <script>no se ejecuta</script>');submit();
      await wait(()=>!select('#modal').open&&window.document.querySelector('.notice-card'));assert.equal(window.document.querySelector('.notice-card script'),null);
    });
    await t.test('El alumno nuevo inicia sesión y no recibe herramientas de administración',async()=>{
      click('[data-action="logout"]');await wait(()=>window.document.querySelector('[data-action="auth-tab"]'));
      click('[data-action="auth-tab"][data-tab="account"]');set('#login-email','ui-001');set('#login-password','InterfazPrueba2026!');
      select('#login-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
      await wait(()=>window.document.querySelector('.sidebar-user strong')?.textContent==='Alumno de la interfaz');
      assert.equal(window.document.querySelectorAll('.course-card').length,1);assert.equal(window.document.querySelector('[data-action="new-course"]'),null);
      window.location.hash='users';await wait(()=>select('#main').textContent.includes('Este apartado es de administración.'));
    });
    await t.test('Responder y entregar muestra la nota automática y la conserva en Mis notas',async()=>{
      window.location.hash=`course/${courseId}/exams`;await wait(()=>window.document.querySelector('[data-action="start-exam"]'));
      assert.equal(select('[data-action="start-exam"]').dataset.id,examId);click('[data-action="start-exam"]');
      await wait(()=>window.document.querySelector('.answer-option'));
      const answer=select('.answer-option input[value="1"]');answer.checked=true;answer.dispatchEvent(new window.Event('change',{bubbles:true}));
      await wait(()=>window.document.querySelector('#exam-save-status')?.textContent==='Respuestas guardadas.');click('[data-action="submit-exam"]');
      await wait(()=>window.document.querySelector('.result-score'));assert.equal(select('.result-score').textContent.trim(),'20 / 20');
      click('[data-action="result-close"]');await wait(()=>window.location.hash==='#grades'&&window.document.querySelector('.data-table'));
      assert.ok(select('.data-table').textContent.includes('Evaluación UI'));assert.ok(select('.data-table').textContent.includes('20'));
    });
    await t.test('Entregar trabajo, calificar como docente y consultar la devolución como alumno',async()=>{
      window.location.hash=`course/${courseId}/work`;await wait(()=>window.document.querySelector('[data-action="assignment-detail"]'));click('[data-action="assignment-detail"]');
      set('#f-text','Mi respuesta: x = 3. <img src=x>');submit();await wait(()=>window.document.querySelector('.submission-receipt'));assert.equal(window.document.querySelector('.submission-receipt img'),null);click('[data-action="close-modal"]');
      click('[data-action="logout"]');await wait(()=>window.document.querySelector('[data-action="auth-tab"]'));click('[data-action="auth-tab"][data-tab="demo"]');click('[data-action="demo-login"][data-role="teacher"]');await wait(()=>window.document.querySelector('.sidebar'));
      window.location.hash=`course/${courseId}/work`;await wait(()=>window.document.querySelector('.assignment-card'));click('[data-action="assignment-detail"]');await wait(()=>window.document.querySelector('[data-action="review-submission"]'));click('[data-action="review-submission"]');
      set('#f-score20','18.5');set('#f-feedback','Buen procedimiento. Explica el último paso.');submit();await wait(()=>!select('#modal').open);click('[data-action="logout"]');
      await wait(()=>window.document.querySelector('[data-action="auth-tab"]'));click('[data-action="auth-tab"][data-tab="account"]');set('#login-email','UI-001');set('#login-password','InterfazPrueba2026!');select('#login-form').dispatchEvent(new window.Event('submit',{bubbles:true,cancelable:true}));
      await wait(()=>window.document.querySelector('.sidebar-user strong')?.textContent==='Alumno de la interfaz');window.location.hash='grades';await wait(()=>window.document.querySelector('.data-table'));
      assert.ok(select('.data-table').textContent.includes('18.5'));assert.ok(select('.data-table').textContent.includes('Trabajo UI'));click('[data-action="assignment-detail"]');assert.ok(select('.teacher-feedback').textContent.includes('Buen procedimiento.'));assert.equal(window.document.querySelector('#f-text'),null);click('[data-action="close-modal"]');
      window.location.hash=`course/${courseId}/overview`;await wait(()=>window.document.querySelector('progress'));assert.equal(select('progress').value,100);
    });
  }finally{dom.window.close();rmSync(code,{recursive:true,force:true});}
});
