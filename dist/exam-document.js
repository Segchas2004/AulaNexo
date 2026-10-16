// Visor disuasorio: no garantiza impedir copias o capturas del sistema.
export async function mountExamDocument(container, access, isActive) {
  const pdfjs = await import('./vendor/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdf.worker.mjs', import.meta.url).href;
  const response = await fetch(access.url, { cache:'no-store', credentials:'omit' });
  if (!response.ok) throw new Error('No se pudo cargar el PDF.');
  const loading = pdfjs.getDocument({data:new Uint8Array(await response.arrayBuffer()),isEvalSupported:false});
  const pdf = await loading.promise;
  if(!isActive() || !container.isConnected){await pdf.destroy();return ()=>{};}
  container.replaceChildren();
  const heading=document.createElement('h3');heading.textContent='Documento del examen';
  const note=document.createElement('p');note.className='helper-text';note.textContent='Consulta personal durante el intento. Documento identificado con tu cuenta.';
  const controls=document.createElement('div');controls.className='pdf-controls';
  const prev=document.createElement('button'),next=document.createElement('button'),label=document.createElement('span');
  for(const b of [prev,next]){b.type='button';b.className='button secondary compact';}
  prev.textContent='Página anterior';next.textContent='Página siguiente';label.setAttribute('aria-live','polite');
  const canvas=document.createElement('canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Página del PDF con identificación del alumno');
  controls.append(prev,label,next);container.append(heading,note,controls,canvas);
  let pageNumber=1,busy=false,disposed=false;
  async function render(){
    if(busy||disposed||!isActive())return;busy=true;prev.disabled=next.disabled=true;
    try{
      const page=await pdf.getPage(pageNumber),original=page.getViewport({scale:1});
      if(disposed||!isActive())return;
      const width=Math.min(900,Math.max(240,container.clientWidth-24));
      const viewport=page.getViewport({scale:width/original.width});
      canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      const context=canvas.getContext('2d');await page.render({canvasContext:context,viewport}).promise;
      if(disposed||!isActive()){canvas.width=0;return;}
      context.save();context.fillStyle='rgba(30,55,95,.22)';context.font='15px sans-serif';
      for(let y=65;y<canvas.height;y+=160){context.save();context.translate(15,y);context.rotate(-.15);context.fillText(access.watermark.slice(0,110),0,0);context.restore();}
      context.restore();label.textContent=`${pageNumber} / ${pdf.numPages}`;
    }finally{busy=false;prev.disabled=pageNumber===1;next.disabled=pageNumber===pdf.numPages;}
  }
  prev.onclick=()=>{if(!busy&&pageNumber>1){pageNumber--;render().catch(()=>{note.textContent='No se pudo mostrar la página.';});}};
  next.onclick=()=>{if(!busy&&pageNumber<pdf.numPages){pageNumber++;render().catch(()=>{note.textContent='No se pudo mostrar la página.';});}};
  await render();return ()=>{disposed=true;canvas.width=0;container.replaceChildren();void pdf.destroy();};
}
