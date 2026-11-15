import {DIRECTIONS,EFFECTS,getRevealSettings,saveRevealSettings} from './reveal-settings.js';
import {captureFace,prepareFace,startSparkleReveal} from './sparkle.js';
const $=s=>document.querySelector(s);
const formatDuration=seconds=>`${Number(seconds).toFixed(1)}s${Math.round(Number(seconds)*10)===35?' (Default)':''}`;
export function initSettings({getCard,renderFace,onError}){
  let baseline='',preview=null,loader=null,previewBusy=false;
  function cancelPreview(){loader?.abort();loader=null;preview?.cancel();preview=null;}
  function readDraft(){return {effect:$('#reveal-effect').value,direction:$('#reveal-direction').value,duration:Math.round(Number($('#reveal-duration').value)*1000),defaultView:$('#default-view').value};}
  function fill(settings){
    $('#reveal-effect').value=settings.effect;$('#reveal-direction').value=settings.direction;$('#reveal-duration').value=settings.duration/1000;$('#default-view').value=settings.defaultView;
    $('#reveal-duration-value').textContent=formatDuration(settings.duration/1000);
  }
  function pending(){
    cancelPreview();$('#reveal-duration-value').textContent=formatDuration($('#reveal-duration').value);
    const changed=JSON.stringify(readDraft())!==baseline;$('#settings-status').textContent=changed?'Unapplied changes':'Using saved settings';$('#settings-status').dataset.state=changed?'pending':'idle';
  }
  $('#reveal-effect').replaceChildren(...[...EFFECTS,['random','Random (Default)']].map(([id,title])=>new Option(title,id)));
  $('#reveal-direction').replaceChildren(...[...DIRECTIONS,['random','Random (Default)']].map(([id,title])=>new Option(title,id)));
  function open(){
    const saved=getRevealSettings();fill(saved);baseline=JSON.stringify(saved);$('#settings-status').textContent='Using saved settings';$('#settings-status').dataset.state='idle';$('#settings-preview-area').hidden=true;$('#preview-effect').disabled=!getCard()?.card;
    $('#settings-dialog').querySelector('.dialog-error')?.remove();$('#settings-dialog').showModal();
  }
  $('#settings-open').addEventListener('click',open);$('#expanded-settings').addEventListener('click',open);
  for(const selector of ['#reveal-effect','#reveal-direction','#default-view'])$(selector).addEventListener('change',pending);
  $('#reveal-duration').addEventListener('input',pending);
  $('#surprise-me').addEventListener('click',()=>{$('#reveal-effect').value='random';$('#reveal-direction').value='random';pending();});
  $('#apply-settings').addEventListener('click',()=>{
    try{const saved=saveRevealSettings(readDraft());fill(saved);baseline=JSON.stringify(saved);$('#settings-status').textContent='✓ Settings Saved';$('#settings-status').dataset.state='saved';}catch(error){onError(error);}
  });
  $('#settings-dialog').addEventListener('close',()=>{cancelPreview();fill(getRevealSettings());$('#settings-preview-area').hidden=true;});
  $('#close-settings').addEventListener('click',()=>$('#settings-dialog').close());
  $('#shuffle-effects-section').addEventListener('toggle',()=>{if(!$('#shuffle-effects-section').open)cancelPreview();});
  $('#preview-effect').addEventListener('click',async()=>{
    if(previewBusy)return;const state=getCard();if(!state?.card)return;
    cancelPreview();previewBusy=true;$('#preview-effect').disabled=true;$('#preview-effect').setAttribute('aria-busy','true');
    const {card,back}=state,face=$('#settings-preview-face'),surface=$('#settings-preview-card');
    $('#settings-preview-area').hidden=false;face.innerHTML=renderFace(card,back?'back':'front');
    $('#preview-status').textContent=matchMedia('(prefers-reduced-motion: reduce)').matches?'Reduced motion: direct reveal. No card drawn.':'Preview only · no card drawn';
    try{
      loader=new AbortController();const signal=loader.signal;
      await prepareFace({...card,front:card[back?'back':'front']},signal);
      await prepareFace({...card,front:card[back?'front':'back']},signal);loader=null;
      if(signal.aborted||!$('#settings-dialog').open)return;
      const image=face.querySelector('img'),ratio=image?.naturalWidth?image.naturalWidth/image.naturalHeight:5/7;
      surface.style.width=`${Math.min(240,200*ratio)}px`;surface.style.height=`${Math.min(200,240/ratio)}px`;
      const snapshot=captureFace(face);face.innerHTML=renderFace(card,back?'front':'back');
      $('#settings-preview-area').scrollIntoView({block:'center',behavior:'instant'});
      preview=startSparkleReveal(surface,snapshot,readDraft());await preview.finished;
    }catch(error){if(error.name!=='AbortError')onError(error);}finally{cancelPreview();previewBusy=false;$('#preview-effect').disabled=!getCard()?.card;$('#preview-effect').removeAttribute('aria-busy');}
  });
}
