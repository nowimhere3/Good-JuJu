import {validDeckId} from './decks.js';
export const IMAGE_EXT = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;
export function pairFiles(files) {
  const groups=new Map(), issues=[];
  for(const file of files){
    const match=/^([fb])(\d+)\.[^.]+$/i.exec(file.name);
    if(!match || !IMAGE_EXT.test(file.name)){issues.push(`Unsupported name or format: ${file.name}. Use F<number>/B<number> with JPG, PNG, WebP, GIF, BMP or AVIF.`);continue;}
    const n=Number(match[2]);
    if(!Number.isSafeInteger(n)){issues.push(`Invalid card number: ${file.name}`);continue;}
    if(!groups.has(n))groups.set(n,{number:n,f:[],b:[]});
    groups.get(n)[match[1].toLowerCase()].push(file);
  }
  const pairs=[];
  for(const group of [...groups.values()].sort((a,b)=>a.number-b.number)){
    if(group.f.length!==1 || group.b.length!==1)issues.push(`Card ${group.number}: ${group.f.length} front(s), ${group.b.length} back(s). Exactly one of each is required.`);
    else pairs.push({number:group.number,front:group.f[0],back:group.b[0]});
  }
  return {pairs,issues};
}
export function parseDocs(text){
  return text.replace(/\r\n?/g,'\n').split(/^\s*={5,}\s*$/m).map(s=>s.trim()).filter(Boolean).map((s,i)=>{
    const [title,...body]=s.split('\n');
    if(!body.join('\n').trim())throw Error(`Card ${i+1} needs a title and description on separate lines.`);
    return {title:title.trim(),front:title.trim(),back:body.join('\n').trim()};
  });
}
export function mergedCards(master,personal){return [...master.map(c=>({...c,deckId:c.deckId||'r1'})),...personal.cards.map(c=>({...c,deckId:c.deckId||'personal'}))].map(card=>({...card,...personal.overrides[card.id],id:card.id,kind:card.kind}));}
export function filterCards(cards,{section='all',kind='all',tag='',query='',deckId='',deckIds=null}={}){
  return cards.filter(c=>(section==='archive'?c.archived:!c.archived) && (section!=='favorites'||c.favorite) && (!deckId||['favorites','tags','archive'].includes(section)||c.deckId===deckId) && (!deckIds||['favorites','tags','archive'].includes(section)||deckIds.includes(c.deckId)) && (kind==='all'||c.kind===kind) && (!tag||(c.tags||[]).includes(tag)) && (!query||`${c.title} ${(c.tags||[]).join(' ')} ${c.kind==='digital'?c.front+' '+c.back:''}`.toLowerCase().includes(query.toLowerCase())));
}
export function drawCard(cards,bag=[],noRepeat=false,random=Math.random){
  if(!cards.length)return {card:null,bag:[]};
  const remaining=noRepeat?cards.filter(c=>!bag.includes(c.id)):cards;
  const pool=remaining.length?remaining:cards;
  const card=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];
  return {card,bag:noRepeat?[...(remaining.length?bag:[]),card.id]:[]};
}
export const emptyPersonal=()=>({cards:[],overrides:{},settings:{noRepeat:true}});
const validColor=c=>typeof c==='string'&&/^#[a-f\d]{6}$/i.test(c);
export function validateBackup(value){
  if(!value||value.format!=='into-the-vortex'||value.version!==1)throw Error('This is not a supported Into the VORTEX backup.');
  const p=value.personal;
  if(!p||!Array.isArray(p.cards)||!p.overrides||typeof p.overrides!=='object'||Array.isArray(p.overrides))throw Error('Backup is missing personal library data.');
  const ids=new Set();
  function content(c,full=false){
    if(!c||typeof c!=='object'||Array.isArray(c))throw Error('Invalid card record.');
    const allowed=full?['id','kind','deckId','title','front','back','collection','background','color','favorite','archived','tags']:['deckId','title','front','back','background','color','favorite','archived','tags'];
    if(Object.keys(c).some(k=>!allowed.includes(k)))throw Error('Backup contains unrecognized card fields.');
    for(const k of ['title','front','back','collection'])if(k in c&&typeof c[k]!=='string')throw Error(`Invalid ${k}.`);
    if('deckId' in c&&!validDeckId(c.deckId))throw Error('Invalid deck assignment.');
    for(const k of ['background','color'])if(k in c&&!validColor(c[k]))throw Error('Invalid card color.');
    for(const k of ['favorite','archived'])if(k in c&&typeof c[k]!=='boolean')throw Error('Invalid metadata.');
    if('tags' in c&&(!Array.isArray(c.tags)||c.tags.some(t=>typeof t!=='string'||!t.trim()||t.length>80)))throw Error('Invalid tags.');
  }
  for(const c of p.cards){
    content(c,true);
    if(typeof c.id!=='string'||!/^user-[a-z\d-]+$/i.test(c.id)||ids.has(c.id))throw Error('Duplicate or invalid personal card identity.');
    ids.add(c.id);
    if(!['physical','digital'].includes(c.kind)||!c.title?.trim()||!c.front||!c.back)throw Error('Incomplete personal card.');
    if(c.kind==='physical'&&[c.front,c.back].some(s=>!/^data:image\/(jpeg|png|webp|gif|bmp|avif);base64,[a-z\d+/=\s]+$/i.test(s)))throw Error('Physical cards must include both image assets inside the backup.');
  }
  for(const [id,c] of Object.entries(p.overrides)){
    if(!/^(r1-\d{3,}|deck-[a-f\d-]{36}-(?:\d{3,}|pdf-[a-f\d]{64})|r1-pdf-[a-f\d]{64}|user-[a-z\d-]+)$/i.test(id))throw Error('Invalid metadata identity.');
    content(c);
    if('front' in c||'back' in c)throw Error('Card face edits must be stored in personal cards.');
  }
  if(p.settings&&('noRepeat' in p.settings)&&typeof p.settings.noRepeat!=='boolean')throw Error('Invalid shuffle setting.');
  const extra={};
  if('decks' in p){
    if(!Array.isArray(p.decks))throw Error('Invalid personal deck list.');
    const seen=new Set();for(const d of p.decks){if(!d||!validDeckId(d.id)||!d.id.startsWith('user-deck-')||seen.has(d.id)||typeof d.title!=='string'||!d.title.trim()||d.title.length>160||Object.keys(d).some(k=>!['id','title'].includes(k)))throw Error('Invalid or duplicate personal deck identity.');seen.add(d.id);}extra.decks=p.decks;
  }
  if('deckNames' in p){if(!p.deckNames||typeof p.deckNames!=='object'||Array.isArray(p.deckNames))throw Error('Invalid deck names.');for(const [id,title] of Object.entries(p.deckNames))if(!validDeckId(id)||typeof title!=='string'||!title.trim()||title.length>160)throw Error('Invalid deck display name.');extra.deckNames=p.deckNames;}
  return structuredClone({cards:p.cards,overrides:p.overrides,settings:{noRepeat:p.settings?.noRepeat??true},...extra});
}
export function mergePersonal(current,incoming){
  const byId=new Map(current.cards.map(c=>[c.id,c]));
  for(const c of incoming.cards)byId.set(c.id,c);
  const overrides={...current.overrides};
  for(const [id,patch] of Object.entries(incoming.overrides))overrides[id]={...overrides[id],...patch};
  const extras={};
  if(current.decks||incoming.decks){const decks=new Map((current.decks||[]).map(d=>[d.id,d]));for(const d of incoming.decks||[])decks.set(d.id,d);extras.decks=[...decks.values()];}
  if(current.deckNames||incoming.deckNames)extras.deckNames={...current.deckNames,...incoming.deckNames};
  return {cards:[...byId.values()],overrides,settings:{...current.settings,...incoming.settings},...extras};
}
