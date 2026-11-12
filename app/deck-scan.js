export async function initDeckScan({onLibrary}){
  const button=document.querySelector('#scan-decks'),status=document.querySelector('#scan-status');
  const endpoint=name=>new URL(`../api/decks/${name}`,import.meta.url);
  let token;
  try{const r=await fetch(endpoint('capabilities'));if(!r.ok)throw Error();const capability=await r.json();if(!capability.scan||!capability.token)throw Error();token=capability.token;}
  catch{status.textContent='Local scanning is unavailable here. Start the local application with npm start to scan All Decks.';return;}
  button.disabled=false;status.textContent='Discover folders added to All Decks without restarting the app.';
  button.addEventListener('click',async()=>{
    if(button.disabled)return;button.disabled=true;button.setAttribute('aria-busy','true');status.classList.remove('error');status.textContent='Scanning decks...';
    try{
      const started=await fetch(endpoint('scan'),{method:'POST',headers:{'Content-Type':'application/json','X-Vortex-Scan':token},body:'{}'});
      if(!started.ok){const result=await started.json();throw Error(result.error||'Unable to start scan.');}
      while(true){
        const response=await fetch(endpoint('scan'),{headers:{'X-Vortex-Scan':token}});if(!response.ok)throw Error('Unable to read scan status. Try again after reconnecting to the local server.');
        const job=await response.json();
        if(job.state==='error')throw Error(job.message);
        if(job.state==='complete'){
          const catalog=await fetch(new URL('../data/cards.json',import.meta.url),{cache:'no-store'});if(!catalog.ok)throw Error('Scan finished but the updated catalog could not be loaded. Reload this page.');
          await onLibrary(await catalog.json());
          status.textContent=`Scan complete! ${job.decks} decks found. ${job.cards} cards indexed. ${job.newDecks} new decks and ${job.newCards} new cards discovered. No validation issues.`;break;
        }
        status.textContent=job.message||'Scanning decks...';await new Promise(resolve=>setTimeout(resolve,400));
      }
    }catch(e){status.classList.add('error');status.textContent=`Scan failed: ${e.message}`;}
    finally{button.disabled=false;button.removeAttribute('aria-busy');}
  });
}
