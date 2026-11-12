import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pairFiles,parseDocs,mergedCards,filterCards,drawCard,validateBackup,mergePersonal,emptyPersonal} from '../app/library.js';
test('pairing accepts mixed case and extensions; reports all conflicts and missing partners',()=>{
  const names=['F1.JPG','b1.png','f02.webp','B2.JPEG','F3.png','f03.jpg','b3.jpg','b4.png','notes.txt','f5.PDF'];
  const result=pairFiles(names.map(name=>({name})));
  assert.deepEqual(result.pairs.map(p=>p.number),[1,2]);assert.equal(result.issues.length,4);
  assert.match(result.issues.join(' '),/2 front\(s\)/);assert.match(result.issues.join(' '),/0 front\(s\)/);
});
test('Docs parser preserves paragraphs and rejects descriptions missing after a title',()=>{
  assert.deepEqual(parseDocs('TITLE\r\n\r\nFirst.\r\n\r\nSecond.\r\n==========\r\nNEXT\r\nBody'),[{title:'TITLE',front:'TITLE',back:'First.\n\nSecond.'},{title:'NEXT',front:'NEXT',back:'Body'}]);
  assert.throws(()=>parseDocs('No description'));assert.deepEqual(parseDocs(''),[]);
});
test('metadata overlays retain stable identity; master updates preserve personal changes',()=>{
  const p=emptyPersonal();p.overrides['r1-001']={title:'Mine',favorite:true,tags:['Ease']};
  const cards=mergedCards([{id:'r1-001',title:'Original',kind:'physical'},{id:'r1-002',title:'New',kind:'physical'}],p);
  assert.equal(cards[0].title,'Mine');assert.equal(cards[1].title,'New');assert.equal(filterCards(cards,{section:'favorites'}).length,1);assert.equal(filterCards(cards,{tag:'Ease'}).length,1);
});
test('selection combines archive, favorites, tags, text search and type',()=>{
  const cards=[{id:'a',kind:'physical',title:'Alpha',favorite:true,tags:['Ease']},{id:'b',kind:'digital',title:'Beta',front:'Peace',back:'Rest',favorite:true,tags:['Ease']},{id:'c',kind:'digital',title:'Gamma',archived:true,favorite:true}];
  assert.equal(filterCards(cards).length,2);assert.equal(filterCards(cards,{kind:'digital',section:'favorites',tag:'Ease',query:'peace'})[0].id,'b');assert.equal(filterCards(cards,{section:'archive'})[0].id,'c');
});
test('without replacement exhausts the pool then starts a new round; filters cannot leak stale IDs',()=>{
  const cards=[{id:'a'},{id:'b'},{id:'c'}];let bag=[];const ids=[];
  for(let i=0;i<3;i++){const d=drawCard(cards,bag,true,()=>0);bag=d.bag;ids.push(d.card.id);}assert.equal(new Set(ids).size,3);
  const d=drawCard(cards,bag,true,()=>0);assert.deepEqual(d.bag,['a']);assert.equal(drawCard([{id:'z'}],bag,true).card.id,'z');assert.equal(drawCard([],bag,true).card,null);
});
test('backup preserves assets and metadata; merge retains other cards and validates before use',()=>{
  const p=emptyPersonal();p.cards=[{id:'user-one',kind:'physical',title:'Pair',front:'data:image/png;base64,YWJj',back:'data:image/png;base64,YWJj'}];p.overrides['r1-001']={favorite:true,tags:['Ease'],archived:true};
  const incoming=validateBackup(JSON.parse(JSON.stringify({format:'into-the-vortex',version:1,personal:p})));
  assert.deepEqual(incoming,p);const current=emptyPersonal();current.cards=[{id:'user-two'}];assert.equal(mergePersonal(current,incoming).cards.length,2);
  const bad=structuredClone(p);bad.cards[0].front='assets/missing.jpg';assert.throws(()=>validateBackup({format:'into-the-vortex',version:1,personal:bad}),/include both image assets/);
  assert.throws(()=>validateBackup({format:'other',version:1,personal:p}));
  const polluted=JSON.parse('{"format":"into-the-vortex","version":1,"personal":{"cards":[],"overrides":{"__proto__":{"favorite":true}}}}');assert.throws(()=>validateBackup(polluted));
});
test('master has 58 unique real pairs and inventory has no issues',async()=>{
  const library=JSON.parse(await readFile(new URL('../data/cards.json',import.meta.url)));
  const inventory=JSON.parse(await readFile(new URL('../data/r1-inventory.json',import.meta.url)));
  assert.equal(library.cards.filter(c=>c.deckId==='r1').length,58);assert.equal(new Set(library.cards.map(c=>c.id)).size,library.cards.length);assert.deepEqual(inventory.issues,[]);assert.equal(inventory.sourceFiles,116);
  for(const c of library.cards){assert.ok((await readFile(new URL('../'+c.front,import.meta.url))).length);assert.ok((await readFile(new URL('../'+c.back,import.meta.url))).length);}
});
