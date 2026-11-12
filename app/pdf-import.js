// Lazy loaded: ordinary cards do not load the PDF renderer.
export async function renderPdfCard(file){
  if(file.size>30*1024*1024)throw Error('PDF exceeds the 30 MB per-file limit.');
  const pdfjs=await import('../assets/pdfjs/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc=new URL('../assets/pdfjs/pdf.worker.mjs',import.meta.url).href;
  const bytes=new Uint8Array(await file.arrayBuffer());
  const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('');
  const base=new URL('../assets/pdfjs/',import.meta.url).href;
  const task=pdfjs.getDocument({data:bytes,isEvalSupported:false,stopAtErrors:true,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/'});
  // Reject password prompts; permission inspection below also catches blank passwords.
  let passwordRequired=false,timedOut=false;
  task.onPassword=()=>{passwordRequired=true;task.destroy();};
  const timeout=setTimeout(()=>{timedOut=true;task.destroy();},60000);
  let doc;
  try{
    doc=await task.promise;
    if(await doc.getPermissions()!==null)throw Error('Encrypted PDFs are not supported.');
    if(doc.numPages!==2)throw Error(`Expected exactly two pages (front/back); found ${doc.numPages}.`);
    const faces=[];
    for(let n=1;n<=2;n++){
      const page=await doc.getPage(n),size=page.getViewport({scale:1});
      if(!Number.isFinite(size.width+size.height)||Math.min(size.width,size.height)<=0)throw Error('Invalid PDF page dimensions.');
      const viewport=page.getViewport({scale:Math.min(2,2400/Math.max(size.width,size.height))});
      const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
      try{
        await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'rgb(255,255,255)'}).promise;
        faces.push(canvas.toDataURL('image/png'));
      }finally{canvas.width=canvas.height=0;page.cleanup();}
    }
    return {id:'user-pdf-'+fingerprint,kind:'physical',title:file.name.replace(/\.pdf$/i,''),front:faces[0],back:faces[1]};
  }catch(e){
    if(passwordRequired)throw Error('Encrypted/password-protected PDFs are not supported.');
    if(timedOut)throw Error('PDF rendering exceeded the 60-second limit. Try a simpler scan.');
    throw Error(`Unable to import PDF: ${e.message}`);
  }
  finally{clearTimeout(timeout);await task.destroy();}
}
