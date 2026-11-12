import {test} from 'node:test';
import assert from 'node:assert/strict';
import {EFFECTS,resolveEffect,resolveDirection,getRevealSettings,saveRevealSettings,normalizeDuration,getLastView,rememberView} from '../app/reveal-settings.js';
import {EFFECT_PRESETS} from '../app/sparkle.js';
test('six distinct bounded presets include leading glints and real trails; independent effect/direction selection',()=>{
  assert.equal(new Set(Object.values(EFFECT_PRESETS).map(p=>JSON.stringify(p))).size,6);
  for(const p of Object.values(EFFECT_PRESETS)){assert.ok(p.leading>=5&&p.particles>0&&p.length>0);assert.ok(p.leading+p.particles<65);}
  assert.deepEqual(EFFECTS.map((_,i)=>resolveEffect('random',()=>i/6)),EFFECTS.map(([id])=>id));
  for(let effect=0;effect<6;effect++)for(let direction=0;direction<8;direction++){assert.equal(resolveEffect('random',()=>effect/6),EFFECTS[effect][0]);assert.ok(resolveDirection('random',()=>direction/8));}
  assert.equal(normalizeDuration(.5),500);assert.equal(normalizeDuration(3.5),3500);assert.equal(normalizeDuration(3.6),1100);
});
test('legacy preferences read without mutation; Apply saves atomically and view tracking stays separate',()=>{
  const previous=globalThis.localStorage;const values=new Map([['vortex-reveal-direction','br-tl'],['vortex-reveal-seconds','1.7']]);
  globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  try{
    const initial=getRevealSettings();assert.deepEqual(initial,{effect:'classic',direction:'br-tl',duration:1700,defaultView:'remember'});assert.equal(values.size,2);
    const draft={effect:'random',direction:'random',duration:3500,defaultView:'enlarged'};assert.equal(getRevealSettings().duration,1700);
    assert.deepEqual(saveRevealSettings(draft),draft);assert.deepEqual(getRevealSettings(),draft);assert.equal(values.get('vortex-reveal-seconds'),'1.7');
    assert.equal(getLastView(),'normal');rememberView('enlarged');assert.equal(getLastView(),'enlarged');assert.deepEqual(getRevealSettings(),draft);
  }finally{globalThis.localStorage=previous;}
});
