import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,writeFile,readFile,copyFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {indexDecks} from '../tools/index-decks.mjs';
import {renameDeck} from '../tools/rename-deck.mjs';
import {mergedCards,filterCards,validateBackup,mergePersonal,emptyPersonal} from '../app/library.js';
import {DIRECTIONS,revealGeometry,resolveDirection,normalizeDuration} from '../app/reveal-settings.js';
import {availableDecks} from '../app/decks.js';
const deckId='deck-11111111-1111-4111-8111-111111111111',personalId='user-deck-22222222-2222-4222-8222-222222222222';
test('folder discovery, duplicate numbers across decks, safe renaming, and failures retain the previous catalog',async()=>{
  await mkdir('tmp',{recursive:true});const root=await mkdtemp(path.resolve('tmp/index-test-'));
  for(const name of ['First','Second']){const dir=path.join(root,'All Decks',name);await mkdir(dir,{recursive:true});await copyFile('assets/cards/r1/f1.jpg',path.join(dir,'F1.JPG'));await copyFile('assets/cards/r1/b1.jpg',path.join(dir,'b1.JpG'));}
  let report=await indexDecks(root);assert.equal(report.decks,2);assert.equal(report.cards,2);
  const first=JSON.parse(await readFile(path.join(root,'All Decks/First/deck.json'),'utf8'));let catalog=JSON.parse(await readFile(path.join(root,'data/cards.json'),'utf8'));const ids=catalog.cards.map(c=>c.id).sort();
  await renameDeck(root,first.id,'A private displayed title','Renamed');report=await indexDecks(root);catalog=JSON.parse(await readFile(path.join(root,'data/cards.json'),'utf8'));assert.deepEqual(catalog.cards.map(c=>c.id).sort(),ids);assert.equal(catalog.decks.find(d=>d.id===first.id).title,'A private displayed title');
  await assert.rejects(()=>renameDeck(root,first.id,'Unsafe','../outside'),/single valid child/);
  const stable=await readFile(path.join(root,'data/cards.json'),'utf8');
  const third=path.join(root,'All Decks/Problem');await mkdir(third);await copyFile('assets/cards/r1/f1.jpg',path.join(third,'F1.jpg'));await copyFile('assets/cards/r1/f1.jpg',path.join(third,'f01.png'));await writeFile(path.join(third,'notes.txt'),'Unsupported');
  await assert.rejects(()=>indexDecks(root),/blocked/);assert.equal(await readFile(path.join(root,'data/cards.json'),'utf8'),stable);report=JSON.parse(await readFile(path.join(root,'data/deck-index-report.json'),'utf8'));assert.match(report.issues.join(' '),/2 front\(s\), 0 back\(s\)/);assert.match(report.issues.join(' '),/unsupported/);
  await writeFile(path.join(third,'deck.json'),JSON.stringify({...first,title:'Duplicate identity'}));await assert.rejects(()=>indexDecks(root),/Duplicate deck identity/);
});
test('R1 copy, original IDs and original source checksums remain intact',async()=>{
  const {createHash}=await import('node:crypto');const inventory=JSON.parse(await readFile('data/r1-inventory.json','utf8'));const library=JSON.parse(await readFile('data/cards.json','utf8'));
  assert.equal(library.cards.filter(c=>c.deckId==='r1').length,58);assert.deepEqual(library.cards.filter(c=>c.deckId==='r1').map(c=>c.id),Array.from({length:58},(_,i)=>`r1-${String(i+1).padStart(3,'0')}`));
  let copyFolder;for(const entry of await readdir('All Decks',{withFileTypes:true}))if(entry.isDirectory()){const manifest=JSON.parse(await readFile(path.join('All Decks',entry.name,'deck.json'),'utf8'));if(manifest.id==='r1')copyFolder=path.join('All Decks',entry.name);}assert.ok(copyFolder);
  const conversions=JSON.parse(await readFile('data/r1-jpeg-conversions.json','utf8')).conversions;
  for(const item of inventory.inventory){
    assert.equal(createHash('sha256').update(await readFile(path.join('Vortex Cards-R1',item.file))).digest('hex'),item.sha256);
    const conversion=conversions.find(c=>c.originalBackup===`Vortex Cards-R1/${item.file}`);
    const active=await readFile(conversion?conversion.activeSource:path.join(copyFolder,item.file));
    assert.equal(createHash('sha256').update(active).digest('hex'),conversion?.sha256||item.sha256);
    if(conversion){assert.equal(conversion.originalSha256,item.sha256);assert.equal(active.subarray(0,3).toString('hex'),'ffd8ff');const card=library.cards.find(c=>c.id===conversion.cardId);assert.match(card.front,/\.jpg$/);assert.equal(card.sourceFiles[0],path.basename(conversion.activeSource));}
  }
});
test('deck overlays and backup merges are additive; legacy records are unchanged and global organization ignores deck filters',()=>{
  const old=emptyPersonal();old.overrides['r1-001']={favorite:true,tags:['Ease'],archived:false,title:'My edit'};
  assert.deepEqual(validateBackup({format:'into-the-vortex',version:1,personal:old}),old);
  const p={...old,cards:[{id:'user-card',kind:'digital',title:'Personal',front:'Front',back:'Back',deckId:personalId}],decks:[{id:personalId,title:'Quiet practice'}],deckNames:{r1:'A personal R1 name'}};
  const validated=validateBackup({format:'into-the-vortex',version:1,personal:p});assert.deepEqual(validated,p);
  const cards=mergedCards([{id:'r1-001',kind:'physical',title:'Master',deckId:'r1'},{id:`${deckId}-001`,kind:'physical',title:'Another',deckId,archived:true}],p);
  assert.equal(filterCards(cards,{deckId:personalId}).length,1);assert.equal(filterCards(cards,{section:'favorites',deckId:personalId})[0].title,'My edit');assert.equal(filterCards(cards,{section:'tags',tag:'Ease',deckId:personalId}).length,1);assert.equal(filterCards(cards,{section:'archive',deckId:personalId}).length,1);
  const merged=mergePersonal(emptyPersonal(),validated);assert.deepEqual(merged,p);assert.equal(availableDecks([{id:'r1',title:'R1'}],p,cards)[0].title,'A personal R1 name');
  const bad=structuredClone(p);bad.decks.push(bad.decks[0]);assert.throws(()=>validateBackup({format:'into-the-vortex',version:1,personal:bad}),/duplicate personal deck/);
});
test('eight reveal boundaries are true moving half-planes; Random is independent and duration normalization is bounded',()=>{
  const geometries=DIRECTIONS.map(([id])=>revealGeometry(300,420,id));assert.equal(new Set(geometries.map(g=>g.from.clip)).size,8);
  for(const g of geometries){assert.match(g.from.clip,/^polygon\(/);assert.notEqual(g.from.clip,g.to.clip);assert.notEqual(g.from.transform,g.to.transform);}
  assert.deepEqual(Array.from({length:8},(_,i)=>resolveDirection('random',()=>i/8)),DIRECTIONS.map(([id])=>id));
  assert.equal(normalizeDuration(null),1100);assert.equal(normalizeDuration('.5'),500);assert.equal(normalizeDuration('2.0'),2000);assert.equal(normalizeDuration('1.3'),1300);assert.equal(normalizeDuration('broken'),1100);
});
