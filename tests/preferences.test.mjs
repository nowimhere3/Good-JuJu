import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EFFECTS,DEFAULT_DURATION,MIGRATION_KEY,resolveEffect,resolveDirection,getRevealSettings,saveRevealSettings,migrateRevealSettings,normalizeDuration,getLastView,rememberView} from '../app/reveal-settings.js';
import {EFFECT_PRESETS} from '../app/sparkle.js';
import {isPublishedCard,isPdfCard,buildCardShareUrl,parseSharedCardParams,createTwoPagePdfBytes} from '../app/share.js';
import {readFile} from 'node:fs/promises';
test('six distinct bounded presets include leading glints and real trails; independent effect/direction selection',()=>{
  assert.equal(new Set(Object.values(EFFECT_PRESETS).map(p=>JSON.stringify(p))).size,6);
  for(const p of Object.values(EFFECT_PRESETS)){assert.ok(p.leading>=5&&p.particles>0&&p.length>0);assert.ok(p.leading+p.particles<65);}
  assert.deepEqual(EFFECTS.map((_,i)=>resolveEffect('random',()=>i/6)),EFFECTS.map(([id])=>id));
  for(let effect=0;effect<6;effect++)for(let direction=0;direction<8;direction++){assert.equal(resolveEffect('random',()=>effect/6),EFFECTS[effect][0]);assert.ok(resolveDirection('random',()=>direction/8));}
  assert.equal(DEFAULT_DURATION,3500);
  assert.equal(normalizeDuration(.5),500);assert.equal(normalizeDuration(3.5),3500);assert.equal(normalizeDuration(3.6),3500);
});
test('new installs default to Random/Random/3.5s/Remember; one-time migration preserves subsequent user choices',()=>{
  const previous=globalThis.localStorage;
  const makeStorage=(entries=[])=>{const map=new Map(entries);return {map,getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v))};};
  try{
    globalThis.localStorage=makeStorage();
    assert.deepEqual(getRevealSettings(),{effect:'random',direction:'random',duration:3500,defaultView:'remember'});
    assert.deepEqual(migrateRevealSettings(),{effect:'random',direction:'random',duration:3500,defaultView:'remember'});
    assert.equal(globalThis.localStorage.getItem(MIGRATION_KEY),'1');

    globalThis.localStorage=makeStorage([
      ['vortex-preferences-v2',JSON.stringify({version:2,effect:'classic',direction:'ltr',duration:1100,defaultView:'normal'})],
      ['vortex-theme','dark']
    ]);
    const migrated=migrateRevealSettings();
    assert.deepEqual(migrated,{effect:'random',direction:'random',duration:3500,defaultView:'remember'});
    assert.equal(globalThis.localStorage.getItem('vortex-theme'),'dark');

    const chosen={effect:'comet',direction:'tl-br',duration:1800,defaultView:'enlarged'};
    assert.deepEqual(saveRevealSettings(chosen),chosen);
    assert.deepEqual(migrateRevealSettings(),chosen);
    assert.deepEqual(getRevealSettings(),chosen);
  }finally{globalThis.localStorage=previous;}
});
test('legacy preferences read without mutation; Apply saves atomically and view tracking stays separate',()=>{
  const previous=globalThis.localStorage;const values=new Map([['vortex-reveal-direction','br-tl'],['vortex-reveal-seconds','1.7']]);
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  try{
    const initial=getRevealSettings();assert.deepEqual(initial,{effect:'random',direction:'br-tl',duration:1700,defaultView:'remember'});assert.equal(values.size,2);
    const draft={effect:'random',direction:'random',duration:3500,defaultView:'enlarged'};assert.equal(getRevealSettings().duration,1700);
    assert.deepEqual(saveRevealSettings(draft),draft);assert.deepEqual(getRevealSettings(),draft);assert.equal(values.get('vortex-reveal-seconds'),'1.7');
    assert.equal(getLastView(),'normal');rememberView('enlarged');assert.equal(getLastView(),'enlarged');assert.deepEqual(getRevealSettings(),draft);
  }finally{globalThis.localStorage=previous;}
});
test('share URLs only generate for published master cards and preserve front/back state',()=>{
  const master=[{id:'r1-001',kind:'physical',title:'Card 01'}];
  const personal={id:'user-1234',kind:'digital',title:'My note'};
  assert.equal(isPublishedCard(master[0],master),true);
  assert.equal(isPublishedCard(personal,master),false);
  const frontUrl=buildCardShareUrl(master[0],{back:false,baseHref:'http://127.0.0.1:4173/?foo=bar#hash',masterCards:master});
  assert.equal(frontUrl,'http://127.0.0.1:4173/?card=r1-001');
  assert.deepEqual(parseSharedCardParams(new URL(frontUrl).search),{cardId:'r1-001',back:false});
  const backUrl=buildCardShareUrl(master[0],{back:true,baseHref:'http://127.0.0.1:4173/',masterCards:master});
  assert.equal(backUrl,'http://127.0.0.1:4173/?card=r1-001&side=back');
  assert.deepEqual(parseSharedCardParams(new URL(backUrl).search),{cardId:'r1-001',back:true});
  assert.equal(buildCardShareUrl(personal,{back:false,baseHref:'http://127.0.0.1:4173/',masterCards:master}),null);
});
test('PDF card detection and generated two-page PDF export produce a valid 2-page PDF',async()=>{
  assert.equal(isPdfCard({id:'deck-1-pdf-abc',sourceType:'pdf'}),true);
  assert.equal(isPdfCard({id:'user-pdf-1234',kind:'physical'}),true);
  assert.equal(isPdfCard({id:'r1-001',kind:'physical'}),false);
  const [frontJpeg,backJpeg]=await Promise.all([readFile('assets/cards/r1/f1.jpg'),readFile('assets/cards/r1/b1.jpg')]);
  const pdfBytes=createTwoPagePdfBytes({frontJpeg:new Uint8Array(frontJpeg),frontWidth:1000,frontHeight:1400,backJpeg:new Uint8Array(backJpeg),backWidth:1000,backHeight:1400});
  assert.equal(new TextDecoder().decode(pdfBytes.subarray(0,5)),'%PDF-');
  const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc=await pdfjs.getDocument({data:pdfBytes,verbosity:0}).promise;
  try{assert.equal(doc.numPages,2);}finally{await doc.destroy();}
});
