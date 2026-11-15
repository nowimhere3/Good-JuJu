import {initDeckScan} from './deck-scan.js';
import {renderPdfCard} from './pdf-import.js';
import {pairFiles,parseDocs,mergedCards,filterCards,drawCard,validateBackup,mergePersonal} from './library.js';
import {openStorage,readPersonal,mutatePersonal} from './storage.js';
import {captureFace,prepareFace,startSparkleReveal} from './sparkle.js';
import {availableDecks} from './decks.js';
import {migrateRevealSettings,getRevealSettings,getLastView,rememberView} from './reveal-settings.js';
import {initSettings} from './settings-ui.js';
import {shareCard,copyCardLink,shareCardAsImage,parseSharedCardParams} from './share.js';
const $=s=>document.querySelector(s);
let master=[],personal,section='all',kind='all',tag='',query='',currentId=null,back=false,bag=[],poolKey='',docsPreview=[],physicalPreview=[],restorePreview=null,toastTimer,physicalGeneration=0;
let expandedRatio=5/7,expandedScroll=0;
let masterDecks=[],deckId='',customMode=false;
const CUSTOM_KEY='vortex-custom-decks';
let customIds=(()=>{try{const v=JSON.parse(localStorage.getItem(CUSTOM_KEY));return Array.isArray(v)?v.filter(x=>typeof x==='string'):null;}catch{return null;}})();
function saveCustom(){try{localStorage.setItem(CUSTOM_KEY,JSON.stringify(customIds));}catch{}}
let drawPending=false,activeReveal=null,pendingFace=null,renderVersion=0,readerRatioLock=null;
function cancelReveal(){pendingFace?.abort();pendingFace=null;activeReveal?.cancel();activeReveal=null;readerRatioLock=null;}
const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('vortex-updates'):null;
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const all=()=>mergedCards(master,personal);
const decks=()=>availableDecks(masterDecks,personal,all());
const customSelection=()=>{const ids=decks().map(d=>d.id);return customIds===null?ids:ids.filter(id=>customIds.includes(id));};
const selected=()=>filterCards(all(),{section,kind,tag,query,deckId,deckIds:customMode&&!deckId?customSelection():null});
function setCustom(ids){customIds=ids;saveCustom();render();}
const deckTitle=id=>decks().find(d=>d.id===id)?.title||'All Decks';
function deckOptions(value){return decks().map(d=>`<option value="${escape(d.id)}"${d.id===value?' selected':''}>${escape(d.title)}</option>`).join('');}
const current=()=>all().find(c=>c.id===currentId);
function toast(message){
  for(const el of [$('#toast'),$('#expanded-toast')]){
    if(!el)continue;
    el.textContent=message;
    el.classList.add('visible');
  }
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{
    for(const el of [$('#toast'),$('#expanded-toast')])el?.classList.remove('visible');
  },4500);
}
function closeMoreMenu(){
  const menu=$('#expanded-more-menu'),btn=$('#expanded-more');
  if(menu)menu.hidden=true;
  if(btn)btn.setAttribute('aria-expanded','false');
}
function toggleMoreMenu(){
  const menu=$('#expanded-more-menu'),btn=$('#expanded-more');
  if(!menu||!btn||btn.disabled)return;
  if(!menu.hidden){closeMoreMenu();return;}
  menu.hidden=false;
  btn.setAttribute('aria-expanded','true');
  const rect=btn.getBoundingClientRect();
  menu.style.bottom=`${Math.max(12,window.innerHeight-rect.top+8)}px`;
  menu.style.right=`${Math.max(12,window.innerWidth-rect.right)}px`;
}
function failure(e){console.error(e);const message=e.name==='QuotaExceededError'?'Browser storage is full. Export a backup and free device storage before trying again.':e.message||'Something went wrong. Please try again.';const dialog=[...document.querySelectorAll('dialog[open]')].at(-1);if(dialog){let out=dialog.querySelector('.dialog-error');if(!out){out=document.createElement('p');out.className='error dialog-error';out.setAttribute('role','alert');dialog.append(out);}out.textContent=message;}toast(message);}
function on(selector,event,handler){$(selector).addEventListener(event,async e=>{const button=e.submitter||(e.currentTarget instanceof HTMLButtonElement?e.currentTarget:null);if(button?.dataset.busy)return;if(button)button.dataset.busy='true';try{await handler(e);}catch(err){failure(err);}finally{if(button)delete button.dataset.busy;}});}
async function save(update,message){personal=await mutatePersonal(update);channel?.postMessage('updated');render();if(message)toast(message);}
async function patch(id,values,message){await save(p=>({...p,overrides:{...p.overrides,[id]:{...p.overrides[id],...values}}}),message);}
function showDialog(id){closeMoreMenu();cancelReveal();fitExpandedCard();const d=$(id);d.querySelector('.dialog-error')?.remove();d.showModal();}
function selectionChanged(){bag=[];poolKey='';back=false;const cards=selected();currentId=cards[0]?.id||null;render();}
function reset(){section='all';deckId='';customMode=false;kind='all';tag='';query='';$('#kind').value='all';$('#search').value='';selectionChanged();}
function displayFace(card,side){
  if(card.kind==='physical')return `<img src="${escape(card[side])}" alt="${escape(card.title)} — ${side}" decoding="async">`;
  return `<div class="digital-face ${side==='back'?'back':''}" style="background:${escape(card.background||'#214f49')};color:${escape(card.color||'#fff8e9')}">${escape(card[side])}</div>`;
}
function applyTheme(theme){
  const dark=theme==='dark';
  document.documentElement.dataset.theme=dark?'dark':'light';
  $('#theme-toggle').textContent=dark?'☀ Light':'☾ Dark';
  $('#theme-toggle').setAttribute('aria-pressed',String(dark));
  document.querySelector('meta[name="theme-color"]').content=dark?'#12221f':'#f5f3ec';
}
function fitExpandedCard(){
  if(!$('#expanded-dialog').open)return;
  const reading=$('#expanded-reading'),footer=$('#expanded-controls');
  const availableHeight=Math.max(0,reading.clientHeight-footer.offsetHeight-12);
  const ratio=readerRatioLock??expandedRatio;
  const width=Math.min(reading.clientWidth,availableHeight*ratio);
  $('#expanded-card').style.width=`${width}px`;
  $('#expanded-card').style.height=`${width/ratio}px`;
}
function renderExpanded(card){
  if(!$('#expanded-dialog').open)return;
  if(!card){closeMoreMenu();$('#expanded-dialog').close();return;}
  $('#expanded-title').textContent=card.title;
  const chosen=customSelection(),totalDecks=decks().length;
  $('#expanded-selection').textContent=section==='favorites'?'Favorites · All Decks':section==='tags'?`Tag: ${tag||'All tags'} · All Decks`:section==='archive'?'Archive · All Decks':deckId?deckTitle(deckId):customMode?`Custom · ${chosen.length}/${totalDecks} decks`:'All Decks';
  const expandedDeck=$('#expanded-deck-select');
  if(expandedDeck){
    expandedDeck.innerHTML='<option value="">All Decks</option>'+`<option value="__custom">Custom selection (${chosen.length}/${totalDecks})</option>`+deckOptions(deckId);
    expandedDeck.value=customMode&&!deckId?'__custom':deckId;
  }
  $('#expanded-face').innerHTML=displayFace(card,back?'back':'front');
  $('#expanded-favorite').textContent=card.favorite?'★':'☆';
  $('#expanded-favorite').setAttribute('aria-pressed',String(!!card.favorite));
  $('#expanded-favorite').setAttribute('aria-label',card.favorite?'Unfavorite card':'Favorite card');
  $('#expanded-flip').textContent=back?'Show front':'Reveal back';
  $('#expanded-shuffle').disabled=drawPending||section==='archive'||!selected().length;
  for(const id of ['expanded-share','expanded-more','expanded-details','expanded-copy-link','expanded-share-image']){
    const el=$('#'+id);if(el)el.disabled=!card;
  }
  const img=$('#expanded-face img');
  expandedRatio=5/7;
  if(img){
    const fit=()=>{if(img!==$('#expanded-face img')||!img.naturalWidth)return;expandedRatio=img.naturalWidth/img.naturalHeight;fitExpandedCard();};
    img.addEventListener('load',fit,{once:true});
    img.addEventListener('error',()=>failure(Error('This card image could not be displayed.')),{once:true});
    if(img.complete)fit();
  }
  fitExpandedCard();
}
new ResizeObserver(fitExpandedCard).observe($('#expanded-reading'));
new ResizeObserver(fitExpandedCard).observe($('#expanded-controls'));
window.addEventListener('resize',closeMoreMenu);
$('#expanded-dialog').addEventListener('cancel',e=>{
  const menu=$('#expanded-more-menu');
  if(menu&&!menu.hidden){e.preventDefault();closeMoreMenu();$('#expanded-more')?.focus({preventScroll:true});}
});
$('#expanded-dialog').addEventListener('close',()=>{
  closeMoreMenu();
  $('#expanded-toast')?.classList.remove('visible');
  cancelReveal();
  rememberView('normal');
  document.body.classList.remove('enlarged');
  $('#enlarge').focus({preventScroll:true});
  window.scrollTo({top:expandedScroll,behavior:'instant'});
});
function render(){
  cancelReveal();renderVersion++;
  const cards=all(),pool=selected();
  if(!pool.some(c=>c.id===currentId)){currentId=pool[0]?.id||null;back=false;}
  const card=current();
  $('#count-all').textContent=cards.filter(c=>!c.archived).length;
  $('#count-favorites').textContent=cards.filter(c=>!c.archived&&c.favorite).length;
  $('#count-archive').textContent=cards.filter(c=>c.archived).length;
  const chosen=customSelection(),totalDecks=decks().length;
  const selectMarkup='<option value="">All Decks</option>'+`<option value="__custom">Custom selection (${chosen.length}/${totalDecks})</option>`+deckOptions(deckId);
  const selectValue=customMode&&!deckId?'__custom':deckId;
  $('#deck-select').innerHTML=selectMarkup;
  $('#deck-select').value=selectValue;
  if($('#expanded-deck-select')){$('#expanded-deck-select').innerHTML=selectMarkup;$('#expanded-deck-select').value=selectValue;}
  $('#all-decks').hidden=!deckId&&!customMode;
  $('#custom-toggle').setAttribute('aria-pressed',String(customMode));
  $('#custom-toggle').classList.toggle('selected',customMode);
  $('#custom-count').textContent=`${chosen.length}/${totalDecks}`;
  $('#custom-count').hidden=!customMode;
  $('#custom-tools').hidden=!customMode;
  $('#decks-panel').classList.toggle('custom-on',customMode);
  $('#decks-panel').hidden=section!=='decks';
  $('#deck-list').innerHTML=decks().map(d=>`<div class="deck-row"><div class="deck-card">${customMode?`<button type="button" role="checkbox" aria-checked="${chosen.includes(d.id)}" aria-label="Include ${escape(d.title)} in custom selection" class="deck-pill${chosen.includes(d.id)?' on':''}" data-pick="${escape(d.id)}"></button>`:''}<button data-deck="${escape(d.id)}" class="${d.id===deckId?'selected':customMode&&chosen.includes(d.id)?'included':''}"><strong>${escape(d.title)}</strong><small>${cards.filter(c=>c.deckId===d.id&&!c.archived).length} active · ${cards.filter(c=>c.deckId===d.id).length} total · ${d.origin==='master'?'Built-in':d.origin==='unavailable'?'Unavailable source':'Personal'}</small></button></div><button class="text-button" data-rename-deck="${escape(d.id)}" aria-label="Rename ${escape(d.title)}">Rename</button></div>`).join('');
  document.querySelectorAll('[data-section]').forEach(b=>{b.classList.toggle('active',b.dataset.section===section);b.setAttribute('aria-current',b.dataset.section===section?'page':'false');});
  const tags=[...new Set(cards.filter(c=>!c.archived).flatMap(c=>c.tags||[]))].sort((a,b)=>a.localeCompare(b));
  $('#tag-nav').innerHTML=tags.slice(0,12).map(t=>`<button class="${tag===t?'selected':''}" data-tag="${escape(t)}">⌑ ${escape(t)}</button>`).join('');
  $('#tags-panel').hidden=section!=='tags';
  $('#tags-list').innerHTML=tags.length?tags.map(t=>`<button class="chip ${tag===t?'selected':''}" data-tag="${escape(t)}">${escape(t)} · ${cards.filter(c=>!c.archived&&c.tags?.includes(t)).length}</button>`).join(''):'<p>Add tags in Card details to create your own pathways.</p>';
  const label=section==='archive'?'Archived cards':section==='favorites'?'Favorite cards':tag?`Tag: ${tag}`:deckId?`Deck: ${deckTitle(deckId)}`:customMode?`Custom: ${chosen.length} of ${totalDecks} decks`:'All active cards';
  $('#selection-label').textContent=label;
  $('#browse-title').textContent=section==='archive'?'Your archive':section==='favorites'?'Your favorites':tag?tag:deckId?deckTitle(deckId):customMode?'Your custom selection':'Your collection';
  $('#card').hidden=!card;$('#empty').hidden=!!card;
  $('#empty-message').textContent=section==='favorites'?'Star a card to keep it close.':section==='archive'?'Archived cards will wait for you here.':customMode&&!deckId&&!chosen.length?'No decks are selected. Include at least one deck in Custom selection to shuffle.':'There are no cards in this selection. Try another filter or add a card.';
  $('#card-face').innerHTML=card?displayFace(card,back?'back':'front'):'';
  $('#card-face img')?.addEventListener('error',()=>toast('This image could not be displayed. Check that the complete assets folder is available.'));
  $('#favorite').textContent=card?.favorite?'★':'☆';$('#favorite').setAttribute('aria-pressed',String(!!card?.favorite));$('#favorite').setAttribute('aria-label',card?.favorite?'Unfavorite card':'Favorite card');
  $('#side-label').textContent=back?'BACK':'FRONT';$('#flip span').textContent=back?'Show front':'Reveal back';
  $('#card-title').textContent=card?.title||'Your next perspective is waiting';$('#card-position').textContent=`${pool.length} card${pool.length===1?'':'s'}`;
  for(const id of ['flip','details-open','enlarge','share'])$('#'+id).disabled=!card;
  renderExpanded(card);
  $('#shuffle').disabled=drawPending||!pool.length||section==='archive';
  $('#no-repeat').checked=personal.settings.noRepeat;
  $('#shuffle-status').textContent=section==='archive'?'Select a card below to restore it. Archived cards are never shuffled.':personal.settings.noRepeat?`${bag.filter(id=>pool.some(c=>c.id===id)).length} of ${pool.length} drawn this round`:'Open to every possibility, including a familiar one.';
  $('#grid').innerHTML=pool.map(c=>`<button class="mini-card ${c.id===currentId?'selected':''}" data-card="${escape(c.id)}" aria-label="Open ${escape(c.title)}">${c.kind==='physical'?`<img src="${escape(c.front)}" alt="" loading="lazy">`:`<div class="mini-art" style="background:${escape(c.background||'#214f49')};color:${escape(c.color||'#fff8e9')}">${escape(c.front.slice(0,110))}</div>`}${c.favorite?'<span class="mini-star">★</span>':''}<strong>${escape(c.title)}</strong><small>${c.kind==='physical'?'Scanned card':'Digital card'}${c.tags?.length?' · '+escape(c.tags.join(', ')):''}</small></button>`).join('');
  $('#grid-empty').hidden=!!pool.length;syncCardControls();
}
function syncCardControls(){
  for(const id of ['flip','expanded-flip','shuffle','expanded-shuffle']){
    const button=$('#'+id),shuffle=id.includes('shuffle');
    button.disabled=drawPending||!current()||(shuffle&&(section==='archive'||!selected().length));
    if(drawPending)button.setAttribute('aria-busy','true');else button.removeAttribute('aria-busy');
  }
}
async function revealChange(card,nextBack,commit){
  if(drawPending)return;
  const version=renderVersion,old=current(),oldBack=back;
  drawPending=true;syncCardControls();
  try{
    pendingFace=new AbortController();
    await prepareFace(card,pendingFace.signal,nextBack?'back':'front');
    pendingFace=null;
    if(version!==renderVersion)return;
    const enlarged=$('#expanded-dialog').open;
    const surface=enlarged?$('#expanded-card'):$('#card');
    const face=enlarged?$('#expanded-face'):$('#card-face');
    const snapshot=captureFace(face),oldRatio=expandedRatio;
    commit();back=nextBack;render();
    if(old&&(old.id!==currentId||oldBack!==back)){
      if(enlarged){readerRatioLock=oldRatio;fitExpandedCard();}
      activeReveal=startSparkleReveal(surface,snapshot,getRevealSettings());
      await activeReveal.finished;
    }
  }catch(error){if(error.name!=='AbortError')throw error;}
  finally{cancelReveal();fitExpandedCard();drawPending=false;syncCardControls();}
}
async function draw(){
  if(section==='archive'||drawPending)return;
  const pool=selected(),key=pool.map(c=>c.id).sort().join('|');
  const result=drawCard(pool,key===poolKey?bag:[],personal.settings.noRepeat);
  if(result.card)await revealChange(result.card,false,()=>{currentId=result.card.id;bag=result.bag;poolKey=key;});
}
async function flip(){const card=current();if(card&&!drawPending)await revealChange(card,!back,()=>{});}
function splitTags(text){return [...new Set(text.split(',').map(t=>t.trim()).filter(Boolean))].map(t=>{if(t.length>80)throw Error('Keep each tag under 81 characters.');return t;});}
function digitalCard(values){return {id:`user-${crypto.randomUUID()}`,kind:'digital',collection:'Personal digital cards',...values};}
function fileData(file){return new Promise((resolve,reject)=>{if(file.size>30*1024*1024){reject(Error(`${file.name} is larger than 30 MB. Please resize it before importing.`));return;}const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(Error(`Unable to read ${file.name}`));r.readAsDataURL(file);});}
async function checkImage(src){const im=new Image();im.src=src;await im.decode();if(!im.naturalWidth)throw Error('An imported image is empty or unsupported by this browser.');}
async function hash(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
async function importCards(cards){
  const selectedDeckBeforeImport=deckId;
  const assigned=$('#import-deck').value||'personal';
  cards=cards.map(c=>({...c,deckId:assigned}));
  const estimateIds=new Set(personal.cards.map(c=>c.id));
  const incoming=cards.filter(c=>{if(estimateIds.has(c.id))return false;estimateIds.add(c.id);return true;});
  const bytes=new Blob([JSON.stringify({...personal,cards:[...personal.cards,...incoming]})]).size;
  if(incoming.length&&bytes>200*1024*1024)throw Error('Personal library would exceed the 200 MB portable backup safeguard. Import a smaller batch.');
  const estimate=await navigator.storage?.estimate?.();
  if(incoming.length&&estimate?.quota&&new Blob([JSON.stringify(incoming)]).size*2>estimate.quota-(estimate.usage||0))throw Error('Insufficient browser storage for this import. Export a backup and free device storage.');
  let added=0;
  await save(p=>{const ids=new Set(p.cards.map(c=>c.id)),fresh=cards.filter(c=>{if(ids.has(c.id))return false;ids.add(c.id);return true;});added=fresh.length;const next={...p,cards:[...p.cards,...fresh]};if(fresh.length&&new Blob([JSON.stringify(next)]).size>200*1024*1024)throw Error('Personal library would exceed the 200 MB portable backup safeguard. Import a smaller batch.');return next;});
  reset();if(selectedDeckBeforeImport){deckId=assigned;section='decks';selectionChanged();}currentId=cards.find(c=>all().some(x=>x.id===c.id))?.id||currentId;render();$('#add-dialog').close();toast(`${added} card${added===1?'':'s'} added${cards.length-added?`; ${cards.length-added} existing pair(s) skipped`:''}.`);
}
document.addEventListener('click',e=>{
  if(e.target.closest('#settings-open,#expanded-settings')){cancelReveal();fitExpandedCard();}
},true);
document.addEventListener('click',e=>{
  if(!e.target.closest('#expanded-more-menu,#expanded-more'))closeMoreMenu();
  const close=e.target.closest('[data-close]');if(close)close.closest('dialog').close();
  const nav=e.target.closest('[data-section]');if(nav){section=nav.dataset.section;deckId='';if(section!=='decks')customMode=false;tag='';selectionChanged();}
  const t=e.target.closest('[data-tag]');if(t){section='tags';deckId='';customMode=false;tag=tag===t.dataset.tag?'':t.dataset.tag;selectionChanged();}
  const deck=e.target.closest('[data-deck]');if(deck){deckId=deck.dataset.deck;customMode=false;section='decks';tag='';query='';$('#search').value='';selectionChanged();}
  const pick=e.target.closest('[data-pick]');if(pick){const id=pick.dataset.pick,cur=customSelection();setCustom(cur.includes(id)?cur.filter(x=>x!==id):[...cur,id]);}
  const rename=e.target.closest('[data-rename-deck]');if(rename){$('#deck-name-form').dataset.id=rename.dataset.renameDeck;$('#deck-name').value=deckTitle(rename.dataset.renameDeck);showDialog('#deck-name-dialog');}
  const c=e.target.closest('[data-card]');if(c){currentId=c.dataset.card;back=false;render();$('#card').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'});}
  const method=e.target.closest('[data-method]');if(method){document.querySelectorAll('[data-method]').forEach(b=>b.classList.toggle('selected',b===method));$('#custom-form').hidden=method.dataset.method!=='custom';$('#docs-method').hidden=method.dataset.method!=='docs';$('#physical-method').hidden=method.dataset.method!=='physical';}
});
on('#shuffle','click',draw);on('#flip','click',flip);
function enterEnlarged(){if(!current()||$('#expanded-dialog').open)return;cancelReveal();expandedScroll=window.scrollY;document.body.classList.add('enlarged');showDialog('#expanded-dialog');renderExpanded(current());rememberView('enlarged');}
on('#enlarge','click',enterEnlarged);
on('#share','click',()=>shareCard(current(),{back,masterCards:master,onToast:toast}));
on('#expanded-share','click',()=>{closeMoreMenu();return shareCard(current(),{back,masterCards:master,onToast:toast});});
on('#expanded-flip','click',flip);
on('#expanded-shuffle','click',draw);
on('#expanded-more','click',()=>toggleMoreMenu());
on('#expanded-copy-link','click',()=>{closeMoreMenu();return copyCardLink(current(),{back,masterCards:master,onToast:toast});});
on('#expanded-share-image','click',()=>{closeMoreMenu();return shareCardAsImage(current(),{back,onToast:toast});});
async function toggleFavorite(){const c=current();if(c)await patch(c.id,{favorite:!c.favorite},c.favorite?'Removed from favorites.':'Saved to favorites.');}
on('#favorite','click',toggleFavorite);on('#expanded-favorite','click',toggleFavorite);
on('#theme-toggle','click',()=>{const theme=document.documentElement.dataset.theme==='dark'?'light':'dark';localStorage.setItem('vortex-theme',theme);applyTheme(theme);});
window.addEventListener('storage',e=>{if(e.key==='vortex-theme'||e.key===null)applyTheme(localStorage.getItem('vortex-theme'));});
applyTheme(document.documentElement.dataset.theme);
on('#kind','change',e=>{kind=e.target.value;selectionChanged();});on('#search','input',e=>{query=e.target.value;selectionChanged();});
function handleDeckSelect(value){
  if(value==='__custom'){deckId='';customMode=true;section='decks';tag='';}
  else{deckId=value;customMode=false;section=deckId?'decks':'all';tag='';}
  selectionChanged();
}
on('#deck-select','change',e=>handleDeckSelect(e.target.value));
on('#expanded-deck-select','change',e=>{closeMoreMenu();handleDeckSelect(e.target.value);});
on('#custom-toggle','click',()=>{customMode=!customMode;if(customMode){deckId='';section='decks';tag='';}selectionChanged();});
on('#custom-all','click',()=>setCustom(decks().map(d=>d.id)));
on('#custom-none','click',()=>setCustom([]));
on('#all-decks','click',reset);
on('#create-deck-form','submit',async e=>{e.preventDefault();const title=$('#new-deck-name').value.trim();if(!title)throw Error('Enter a deck name.');const id=`user-deck-${crypto.randomUUID()}`;await save(p=>({...p,decks:[...(p.decks||[]),{id,title}]}),'Personal deck created.');$('#new-deck-name').value='';deckId=id;section='decks';tag='';selectionChanged();});
on('#deck-name-form','submit',async e=>{e.preventDefault();const id=e.target.dataset.id,title=$('#deck-name').value.trim();if(!title)throw Error('Enter a deck name.');await save(p=>({...p,deckNames:{...p.deckNames,[id]:title}}),'Deck display name saved in this browser.');$('#deck-name-dialog').close();});
on('#reset','click',reset);on('#empty-reset','click',reset);
on('#no-repeat','change',async e=>{const noRepeat=e.target.checked;bag=[];await save(p=>({...p,settings:{...p.settings,noRepeat}}));});
function openDetails(){
  const c=current();if(!c)return;
  $('#details-form').dataset.card=c.id;$('#detail-title').value=c.title;$('#detail-tags').value=(c.tags||[]).join(', ');$('#digital-fields').hidden=c.kind!=='digital';$('#physical-note').hidden=c.kind!=='physical';
  $('#detail-deck').innerHTML=deckOptions(c.deckId);$('#detail-deck').value=c.deckId;
  if(c.kind==='digital'){for(const k of ['front','back'])$('#detail-'+k).value=c[k];$('#detail-bg').value=c.background||'#214f49';$('#detail-color').value=c.color||'#fff8e9';}
  $('#archive-card').textContent=c.archived?'Restore card':'Archive card';showDialog('#details-dialog');
}
on('#details-open','click',openDetails);on('#expanded-details','click',openDetails);
on('#details-form','submit',async e=>{
  e.preventDefault();const id=e.target.dataset.card,c=all().find(c=>c.id===id),title=$('#detail-title').value.trim(),tags=splitTags($('#detail-tags').value);
  if(!title)throw Error('Please enter a title.');
  const edits={title,tags,deckId:$('#detail-deck').value};
  if(c.kind==='digital'){
    const front=$('#detail-front').value.trim(),back=$('#detail-back').value.trim();if(!front||!back)throw Error('Both card faces need text.');
    await save(p=>({...p,cards:p.cards.map(item=>item.id===id?{...item,title,front,back,background:$('#detail-bg').value,color:$('#detail-color').value}:item),overrides:{...p.overrides,[id]:{...p.overrides[id],...edits}}}),'Your card has been updated.');
  }else await patch(id,edits,'Your card details have been saved.');
  $('#details-dialog').close();
});
on('#archive-card','click',async()=>{const id=$('#details-form').dataset.card,c=all().find(c=>c.id===id);await patch(id,{archived:!c.archived},c.archived?'Card restored to your collection.':'Card moved to the archive.');$('#details-dialog').close();});
on('#add-open','click',()=>{$('#import-deck').innerHTML=deckOptions(deckId||'personal');$('#import-deck').value=deckId||'personal';showDialog('#add-dialog');});
on('#custom-form','submit',async e=>{e.preventDefault();const f=new FormData(e.target),values=Object.fromEntries(f);for(const k of ['title','front','back']){values[k]=values[k].trim();if(!values[k])throw Error('Please complete the title and both card faces.');}await importCards([digitalCard(values)]);e.target.reset();});
on('#docs-file','change',async e=>{const f=e.target.files[0];if(f){if(f.size>5*1024*1024)throw Error('Please use a text export smaller than 5 MB.');$('#docs-text').value=await f.text();docsPreview=[];$('#docs-import').hidden=true;$('#docs-preview-list').textContent='';}});
on('#docs-text','input',()=>{docsPreview=[];$('#docs-import').hidden=true;$('#docs-preview-list').textContent='Text changed. Preview again before importing.';});
on('#docs-preview','click',()=>{docsPreview=[];$('#docs-import').hidden=true;docsPreview=parseDocs($('#docs-text').value);if(!docsPreview.length)throw Error('Paste some card text first.');$('#docs-preview-list').innerHTML=`<p>${docsPreview.length} card(s) ready. The title becomes the front; the description becomes the back.</p>`+docsPreview.map(c=>`<div class="preview-row"><strong>${escape(c.title)}</strong>${escape(c.back)}</div>`).join('');$('#docs-import').hidden=false;});
on('#docs-import','click',async()=>{if(!docsPreview.length)return;await importCards(docsPreview.map(c=>digitalCard({...c,background:'#214f49',color:'#fff8e9'})));docsPreview=[];$('#docs-text').value='';$('#docs-preview-list').textContent='';$('#docs-import').hidden=true;});
on('#physical-files','change',async e=>{
  const generation=++physicalGeneration;physicalPreview=[];$('#physical-import').hidden=true;
  const files=[...e.target.files],pdfs=files.filter(f=>/\.pdf$/i.test(f.name));
  if(files.reduce((n,f)=>n+f.size,0)>120*1024*1024){$('#physical-preview').textContent='Selected files exceed the 120 MB batch limit. Choose a smaller batch.';return;}
  const {pairs,issues}=pairFiles(files.filter(f=>!/\.pdf$/i.test(f.name)));
  $('#physical-preview').innerHTML=issues.map(i=>`<p class="error">${escape(i)}</p>`).join('')+(pairs.length||pdfs.length?'<p>Checking paired image files…</p>':'<p>No complete image pairs or PDFs found.</p>');
  const prepared=[],errors=[...issues];let previewBytes=0;
  const appendPreview=card=>{const bytes=card.front.length+card.back.length;if(previewBytes+bytes>100*1024*1024)throw Error('Rendered preview exceeds the 100 MB limit. Choose a smaller batch.');previewBytes+=bytes;prepared.push(card);};
  for(const pair of pairs){try{
    const front=await fileData(pair.front),back=await fileData(pair.back);await Promise.all([checkImage(front),checkImage(back)]);
    const id='user-'+await hash(front+'|'+back);
    appendPreview({id,kind:'physical',title:`Card ${pair.number}`,front,back,collection:$('#batch-name').value.trim()||'My physical cards'});
  }catch(err){errors.push(`Card ${pair.number}: ${err.message}`);}}
  for(const file of pdfs){
    if(generation!==physicalGeneration)return;
    try{const card=await renderPdfCard(file);appendPreview({...card,title:file.name,collection:$('#batch-name').value.trim()||'My physical cards'});}
    catch(err){errors.push(`${file.name}: ${err.message}`);}
  }
  if(generation!==physicalGeneration)return;
  const unique=new Map();
  for(const card of prepared){if(unique.has(card.id))errors.push(`${card.title}: duplicate content in this selection; will import once.`);else unique.set(card.id,card);}
  physicalPreview=[...unique.values()];
  $('#physical-preview').innerHTML=errors.map(i=>`<p class="error">${escape(i)}</p>`).join('')+`<p>${physicalPreview.length} complete pair(s) ready. PDF pages are shown front first, back second. Target deck: <span id="physical-target">${escape($('#import-deck').selectedOptions[0]?.textContent||'My cards')}</span>. ${errors.length?'Only the valid pairs shown below will be imported. Resolve the listed problems and select files again to include them.':''}</p>`+physicalPreview.map(c=>`<div class="preview-row"><strong>${escape(c.title)}${personal.cards.some(x=>x.id===c.id)?' · Already imported; will skip':''}</strong><img src="${c.front}" alt="${escape(c.title)} front preview"><img src="${c.back}" alt="${escape(c.title)} back preview"></div>`).join('');
  $('#physical-import').hidden=!physicalPreview.length;
});
on('#import-deck','change',()=>{const target=$('#physical-target');if(target)target.textContent=$('#import-deck').selectedOptions[0]?.textContent||'My cards';});
on('#physical-import','click',async()=>{if(!physicalPreview.length)return;await importCards(physicalPreview.map(c=>({...c,collection:$('#batch-name').value.trim()||'My physical cards'})));physicalPreview=[];$('#physical-files').value='';$('#physical-preview').textContent='';$('#physical-import').hidden=true;});
on('#backup-open','click',()=>showDialog('#backup-dialog'));
on('#export','click',async()=>{
  const latest=await readPersonal();const value={format:'into-the-vortex',version:1,exportedAt:new Date().toISOString(),masterVersion:'decks-v1',personal:latest};
  validateBackup(value);
  const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`into-the-vortex-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);toast('Backup exported, including personal images.');
});
on('#restore-file','change',async e=>{
  restorePreview=null;$('#restore').hidden=true;$('#restore-preview').textContent='';const file=e.target.files[0];if(!file)return;
  if(file.size>250*1024*1024)throw Error('Backup is larger than the V1 restore limit of 250 MB.');
  const candidate=validateBackup(JSON.parse(await file.text()));
  for(const c of candidate.cards.filter(c=>c.kind==='physical'))await Promise.all([checkImage(c.front),checkImage(c.back)]);
  restorePreview=candidate;const matches=candidate.cards.filter(c=>personal.cards.some(x=>x.id===c.id)).length;
  $('#restore-preview').textContent=`Validated ${candidate.cards.length} personal card(s), including ${candidate.cards.filter(c=>c.kind==='physical').length} complete image pair(s), and ${Object.keys(candidate.overrides).length} metadata record(s). ${matches} existing personal card(s) have matching identities. Backup values take priority for matching identities.`;$('#restore').hidden=false;
});
on('#restore','click',async()=>{if(!restorePreview)return;const incoming=restorePreview;await save(p=>mergePersonal(p,incoming),'Backup restored. Your collection is ready.');restorePreview=null;$('#restore').hidden=true;$('#restore-preview').textContent='Restore complete.';$('#restore-file').value='';$('#backup-dialog').close();reset();});
channel?.addEventListener('message',async()=>{try{personal=await readPersonal();render();}catch(e){failure(e);}});
try{
  const response=await fetch(new URL('../data/cards.json',import.meta.url));if(!response.ok)throw Error('The master card library could not be loaded.');
  const library=await response.json();master=library.cards;masterDecks=library.decks||[{id:'r1',title:'Well Being'}];personal=await openStorage();
  migrateRevealSettings();
  const shared=parseSharedCardParams(window.location.search);
  let missingShared=false;
  if(shared.cardId){
    const target=all().find(c=>c.id===shared.cardId&&!c.archived);
    if(target){currentId=target.id;back=shared.back;}
    else{currentId=master[0]?.id;missingShared=true;}
  }else{
    const home=all().filter(c=>!c.archived);
    currentId=(home[Math.floor(Math.random()*home.length)]||master[0])?.id;
  }
  render();
  if(missingShared)toast('That shared card could not be found in this collection.');
  initDeckScan({onLibrary:async library=>{master=library.cards;masterDecks=library.decks;personal=await readPersonal();if(deckId&&!decks().some(d=>d.id===deckId))deckId='';render();channel?.postMessage('master-updated');}});
  initSettings({getCard:()=>({card:current(),back}),renderFace:displayFace,onError:failure});
  const preference=getRevealSettings().defaultView;
  if(preference==='enlarged'||preference==='remember'&&getLastView()==='enlarged')enterEnlarged();
}catch(e){failure(e);$('#card-title').textContent='Your collection could not be opened.';$('#empty').hidden=false;$('#card').hidden=true;$('#empty-message').textContent='Enable browser storage and serve the complete application over localhost. Reload to try again.';for(const b of document.querySelectorAll('button,input,select'))b.disabled=true;}
